import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { URL } from 'node:url'
import type { PageLinkKind, ResolvedLink, ResolvedLinks } from '../../shared/types'
import { requestHeaders } from './browserContext'
import { parseContentDispositionFilename } from './contentDisposition'

// The "find the real download link" step: given a URL, open it and work out whether it *is* the
// file (a direct link, a redirect, an attachment), or a page holding the file — a plain <a>, an
// embedded player/iframe, a meta refresh, or a JavaScript redirect. This is a generic crawler, not
// a per-site decrypter: sites that require a scripted handshake or a captcha are out of scope.

const MAX_REDIRECTS = 5
const MAX_BODY_BYTES = 4 * 1024 * 1024
const RESOLVE_TIMEOUT_MS = 15_000
/** The most candidate links one page may yield: past this, a page is a directory, not a download. */
const MAX_LINKS = 300

type Headers = Record<string, string | string[] | undefined>

function headerValue(headers: Headers, name: string): string | undefined {
  const value = headers[name]
  return Array.isArray(value) ? value[0] : value
}

const NON_HTTP = /^(?:mailto|tel|javascript|data|blob|about|file):/i

/** The link kinds the resolver keeps. iframes/embeds often *are* the player holding the file. */
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
    case 'iframe':
    case 'embed':
      return 'file'
    default:
      return null
  }
}

function resolveUrl(base: URL, reference: string): string | null {
  const raw = reference.trim()
  if (!raw || raw.startsWith('#') || NON_HTTP.test(raw)) return null
  try {
    const url = new URL(raw, base)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function fileNameOf(headers: Headers, url: URL): string {
  const disposition = headerValue(headers, 'content-disposition')
  if (disposition) {
    const parsed = parseContentDispositionFilename(disposition)
    if (parsed) return parsed
  }
  let pathname = url.pathname
  try {
    pathname = decodeURIComponent(pathname)
  } catch {
    // A malformed %-escape: the raw path names it well enough.
  }
  const base = pathname.split('/').filter(Boolean).pop()
  return base && base.length > 0 ? base : 'download'
}

/** Collects href/src from tags, plus meta-refresh and JavaScript redirects, from a page's HTML. */
function linksInHtml(html: string, base: URL): ResolvedLink[] {
  const found = new Map<string, ResolvedLink>()
  const add = (url: string | null, kind: PageLinkKind): void => {
    if (url && found.size < MAX_LINKS && !found.has(url)) {
      found.set(url, { url, kind, fileName: fileNameOf({}, new URL(url)) })
    }
  }

  const tag = /<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g
  const attr = /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/i
  for (const match of html.matchAll(tag)) {
    const kind = kindOfTag(match[1].toLowerCase())
    if (!kind) continue
    const value = attr.exec(match[2])
    if (!value) continue
    add(resolveUrl(base, value[1] ?? value[2] ?? value[3] ?? ''), kind)
  }

  // A meta refresh (the old redirect sites still use), then a JavaScript one.
  const meta =
    /<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*["']([^"']*)["']/i.exec(html)
  if (meta) {
    const url = /url\s*=\s*(.+)$/i.exec(meta[1])
    if (url) add(resolveUrl(base, url[1].replace(/^["']|["']$/g, '')), 'file')
  }
  const js =
    /(?:window\.)?location(?:\.href|\.replace\s*\(|\s*=\s*)\s*\(?\s*["']([^"']+)["']/i.exec(html)
  if (js) add(resolveUrl(base, js[1]), 'file')

  return [...found.values()]
}

interface Fetched {
  status: number
  headers: Headers
  body: string
  /** Set when the response is a redirect: where to go next. */
  redirect?: URL
}

function fetchOnce(url: URL): Promise<Fetched> {
  return new Promise((resolve, reject) => {
    const requester = url.protocol === 'https:' ? httpsRequest : httpRequest
    const deadline = Date.now() + RESOLVE_TIMEOUT_MS
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
        const headers = res.headers as Headers
        if (status >= 300 && status < 400 && headers.location) {
          res.resume()
          resolve({ status, headers, body: '', redirect: new URL(headers.location, url) })
          return
        }
        // A file's body is never read here: resolving only needs to know it *is* a file, not its
        // bytes. (Reading a page does need the body.) This is why adding a link is fast.
        const contentType = headerValue(headers, 'content-type') ?? ''
        const disposition = headerValue(headers, 'content-disposition') ?? ''
        if (!/html/i.test(contentType) || /attachment/i.test(disposition)) {
          res.destroy()
          resolve({ status, headers, body: '' })
          return
        }
        const chunks: Buffer[] = []
        let total = 0
        res.on('error', reject)
        res.on('data', (chunk: Buffer) => {
          if (total >= MAX_BODY_BYTES) return
          total += chunk.length
          chunks.push(chunk)
          if (total >= MAX_BODY_BYTES) {
            res.destroy()
            resolve({ status, headers, body: Buffer.concat(chunks).toString('utf8') })
          }
        })
        res.on('end', () =>
          resolve({ status, headers, body: Buffer.concat(chunks).toString('utf8') })
        )
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

/** Opens `rawUrl` and returns what to download from it: the file itself, or the candidates a page
 * holds. Follows redirects; throws (readably) on a bad link or a server that never answers. */
export async function resolveLinks(rawUrl: string): Promise<ResolvedLinks> {
  let current = new URL(rawUrl)
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetchOnce(current)
    if (response.redirect) {
      current = response.redirect
      continue
    }
    if (response.status >= 400) {
      throw new Error(`Server responded with status ${response.status}`)
    }

    const contentType = headerValue(response.headers, 'content-type') ?? ''
    const disposition = headerValue(response.headers, 'content-disposition') ?? ''
    const isHtml = /html/i.test(contentType)
    const isAttachment = /attachment/i.test(disposition)
    // Anything that isn't a web page is the file itself — a direct link in disguise.
    if (!isHtml || isAttachment) {
      return {
        finalUrl: current.toString(),
        direct: true,
        links: [
          { url: current.toString(), kind: 'file', fileName: fileNameOf(response.headers, current) }
        ]
      }
    }
    return {
      finalUrl: current.toString(),
      direct: false,
      links: linksInHtml(response.body, current)
    }
  }
  throw new Error('Too many redirects')
}

/** A path that names a file rather than another page. */
const FILE_PATH =
  /\.(zip|rar|7z|tar|tgz|gz|bz2|xz|iso|pdf|epub|mobi|torrent|apk|exe|msi|dmg|pkg|deb|rpm|bin|mp4|mkv|avi|mov|webm|flv|m4v|mp3|m4a|flac|wav|ogg|opus|jpg|jpeg|png|gif|webp|bmp|tiff?|svg|psd|docx?|xlsx?|pptx?|txt|csv|rtf)$/i

function looksLikeFile(url: string): boolean {
  try {
    return FILE_PATH.test(new URL(url).pathname)
  } catch {
    return false
  }
}

export interface DeepOptions {
  /** How many links deep from the start page to follow, same host only. */
  maxDepth?: number
  /** The most pages to read. */
  maxPages?: number
}

/** "Deep link analysis", as JDownloader calls it: when one page holds no file, crawl from it —
 * following its own links a few levels, same host — and collect every file it reaches. Bounded by
 * depth, page count and a deadline, so it always finishes. */
export async function resolveLinksDeep(
  rawUrl: string,
  options: DeepOptions = {}
): Promise<ResolvedLinks> {
  const maxDepth = options.maxDepth ?? 2
  const maxPages = options.maxPages ?? 40
  const start = new URL(rawUrl)
  const seen = new Set<string>()
  const found = new Map<string, ResolvedLink>()
  const queue: { url: URL; depth: number }[] = [{ url: start, depth: 0 }]
  const deadline = Date.now() + 30_000

  const add = (link: ResolvedLink): void => {
    if (found.size < MAX_LINKS && !found.has(link.url)) found.set(link.url, link)
  }

  while (
    queue.length > 0 &&
    seen.size < maxPages &&
    Date.now() < deadline &&
    found.size < MAX_LINKS
  ) {
    const { url, depth } = queue.shift()!
    const key = url.toString()
    if (seen.has(key)) continue
    seen.add(key)

    let response: Fetched
    try {
      response = await fetchOnce(url)
    } catch {
      continue
    }
    if (response.redirect) {
      queue.push({ url: response.redirect, depth })
      continue
    }
    if (response.status >= 400) continue

    const contentType = headerValue(response.headers, 'content-type') ?? ''
    const disposition = headerValue(response.headers, 'content-disposition') ?? ''
    if (!/html/i.test(contentType) || /attachment/i.test(disposition)) {
      add({ url: key, kind: 'file', fileName: fileNameOf(response.headers, url) })
      continue
    }

    for (const link of linksInHtml(response.body, url)) {
      if (link.kind !== 'link' || looksLikeFile(link.url)) {
        add(link)
        continue
      }
      // A page link: follow it, same host, within the depth budget.
      try {
        const target = new URL(link.url)
        if (
          target.hostname === start.hostname &&
          depth < maxDepth &&
          !seen.has(target.toString())
        ) {
          queue.push({ url: target, depth: depth + 1 })
        }
      } catch {
        // A link that won't parse as a URL is ignored.
      }
    }
  }

  return { finalUrl: start.toString(), direct: false, links: [...found.values()] }
}
