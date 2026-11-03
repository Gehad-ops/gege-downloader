import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { URL } from 'node:url'
import type { PageLink, PageLinkKind, PageLinks } from '../../shared/types'
import { testKnobs } from '../testKnobs'
import { requestHeaders } from './browserContext'

// "Download all links": fetch a page and read the links and media it points at, so the user can
// pick which to download. Server-side and regex-based — no DOM — and it stops at a byte cap: a
// page bigger than this is a download, not a page to scrape.

const MAX_REDIRECTS = 5
/** Past this, a body is treated as a file, not a page to read links out of. */
const MAX_PAGE_BYTES = 4 * 1024 * 1024
const PAGE_TIMEOUT_MS = testKnobs.stallTimeoutMs

type Headers = Record<string, string | string[] | undefined>

function headerValue(headers: Headers, name: string): string | undefined {
  const value = headers[name]
  return Array.isArray(value) ? value[0] : value
}

/** Schemes that aren't a link to fetch. */
const NON_HTTP = /^(?:mailto|tel|javascript|data|blob|about|file):/i

/** The kind of media an element contributes, or null when it isn't one we grab. */
function kindOfTag(tag: string): PageLinkKind | null {
  switch (tag) {
    case 'a':
      return 'link'
    case 'img':
      return 'image'
    case 'video':
      return 'video'
    case 'audio':
      return 'audio'
    case 'source':
      return 'file'
    default:
      return null
  }
}

/** Every href/src on the page, resolved against `base` and de-duplicated, in the order found. */
function parseLinks(html: string, base: URL): PageLink[] {
  // Defined here, not at module scope: a global regex carries lastIndex between calls.
  const tag = /<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g
  const attr = /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/i
  const found = new Map<string, PageLink>()
  for (const match of html.matchAll(tag)) {
    const kind = kindOfTag(match[1].toLowerCase())
    if (!kind) continue
    const value = attr.exec(match[2])
    if (!value) continue
    const raw = (value[1] ?? value[2] ?? value[3] ?? '').trim()
    if (!raw || raw.startsWith('#') || NON_HTTP.test(raw)) continue
    let resolved: URL
    try {
      resolved = new URL(raw, base)
    } catch {
      continue
    }
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue
    const url = resolved.toString()
    if (!found.has(url)) found.set(url, { url, kind })
  }
  return [...found.values()]
}

function titleOf(html: string): string {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  return match ? match[1].replace(/\s+/g, ' ').trim() : ''
}

interface Fetched {
  html: string
  /** Set when the response is a redirect: where to go next. */
  redirect?: URL
}

/** One GET, following `url`'s own redirect through the caller. Reads at most MAX_PAGE_BYTES. */
function fetchPage(url: URL): Promise<Fetched> {
  return new Promise((resolve, reject) => {
    const requester = url.protocol === 'https:' ? httpsRequest : httpRequest
    const deadline = Date.now() + PAGE_TIMEOUT_MS
    const req = requester(
      {
        method: 'GET',
        hostname: url.hostname.replace(/^\[|\]$/g, ''),
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        headers: requestHeaders(url)
      },
      (res) => {
        const status = res.statusCode ?? 0
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume()
          resolve({ html: '', redirect: new URL(res.headers.location, url) })
          return
        }
        if (status >= 400) {
          res.resume()
          reject(new Error(`Server responded with status ${status}`))
          return
        }
        const contentType = headerValue(res.headers, 'content-type')
        if (contentType && !/html/i.test(contentType)) {
          res.resume()
          reject(new Error('That link isn’t a web page.'))
          return
        }
        const chunks: Buffer[] = []
        let total = 0
        res.on('error', reject)
        res.on('data', (chunk: Buffer) => {
          if (total >= MAX_PAGE_BYTES) return
          total += chunk.length
          chunks.push(chunk)
          if (total >= MAX_PAGE_BYTES) {
            res.destroy()
            resolve({ html: Buffer.concat(chunks).toString('utf8') })
          }
        })
        res.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8') }))
      }
    )
    const timer = setTimeout(
      () => req.destroy(new Error('The server did not respond — check the link and try again')),
      Math.max(0, deadline - Date.now())
    )
    const done = (): void => clearTimeout(timer)
    req.on('close', done)
    req.on('error', (error) => {
      done()
      reject(error)
    })
    req.end()
  })
}

/** Reads a page's links. Follows redirects; throws (with a readable message) on a bad link, a
 * non-HTML response, or a server that never answers. */
export async function extractPageLinks(rawUrl: string): Promise<PageLinks> {
  let current = new URL(rawUrl)
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const page = await fetchPage(current)
    if (page.redirect) {
      current = page.redirect
      continue
    }
    return {
      finalUrl: current.toString(),
      title: titleOf(page.html),
      links: parseLinks(page.html, current)
    }
  }
  throw new Error('Too many redirects')
}
