import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, test } from '@playwright/test'
import { resolveLinks, resolveLinksDeep } from '../src/main/download/resolve'

// The "find the real download link" step, checked against pages a test server serves: a direct
// file, an attachment, a page linking to the file, and a meta-refresh redirect.

let server: Server
let base: string

test.beforeAll(async () => {
  server = createServer((req, res) => {
    const path = req.url ?? '/'
    if (path.startsWith('/page')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        '<html><body><a href="/real/file.bin">Download</a><img src="thumb.png"></body></html>'
      )
      return
    }
    if (path.startsWith('/meta')) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(
        '<html><head><meta http-equiv="refresh" content="0; url=/real/file.bin"></head></html>'
      )
      return
    }
    if (path.startsWith('/go')) {
      res.writeHead(302, { Location: '/real/file.bin' }).end()
      return
    }
    if (path.startsWith('/deep/leaf')) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<a href="/real/file.bin">the file</a>')
      return
    }
    if (path.startsWith('/deep')) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<a href="/deep/leaf">more</a>')
      return
    }
    if (path.startsWith('/attachment')) {
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="renamed.bin"'
      })
      res.end('bytes')
      return
    }
    // Anything else is served as a plain file (no content-type): a direct download.
    res.writeHead(200).end('bytes')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

test('a plain file is its own download link', async () => {
  const resolved = await resolveLinks(`${base}/real/file.bin`)
  expect(resolved.direct).toBe(true)
  expect(resolved.links).toHaveLength(1)
  expect(resolved.links[0].url).toBe(`${base}/real/file.bin`)
  expect(resolved.links[0].fileName).toBe('file.bin')
})

test('an attachment names the file from its Content-Disposition', async () => {
  const resolved = await resolveLinks(`${base}/attachment`)
  expect(resolved.direct).toBe(true)
  expect(resolved.links[0].fileName).toBe('renamed.bin')
})

test('a page yields its links, resolved and absolute', async () => {
  const resolved = await resolveLinks(`${base}/page`)
  expect(resolved.direct).toBe(false)
  const urls = resolved.links.map((link) => link.url).sort()
  expect(urls).toEqual([`${base}/real/file.bin`, `${base}/thumb.png`].sort())
})

test('a meta refresh points at the real link', async () => {
  const resolved = await resolveLinks(`${base}/meta`)
  expect(resolved.direct).toBe(false)
  expect(resolved.links.map((link) => link.url)).toContain(`${base}/real/file.bin`)
})

test('a redirect is followed to the file', async () => {
  const resolved = await resolveLinks(`${base}/go`)
  expect(resolved.direct).toBe(true)
  expect(resolved.finalUrl).toBe(`${base}/real/file.bin`)
})

test('deep analysis crawls a site to the files it holds', async () => {
  const resolved = await resolveLinksDeep(`${base}/deep`)
  expect(resolved.links.map((link) => link.url)).toContain(`${base}/real/file.bin`)
})
