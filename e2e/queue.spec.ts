import { BLOCK, expect, test } from './fixtures'

// Editing the queue: a queued download can be moved up and down, changing which one runs next.

test('a queued download can be moved up and down the queue', async ({ plexo, serve }) => {
  const origin = await serve({ size: 24 * BLOCK })
  await plexo.api.updateSettings({ downloadsAtOnce: 1 })
  // Hold the first download so it stays running, leaving the rest queued.
  const reached = origin.hold(4 * BLOCK)
  const a = await plexo.start(origin.url('/a'), origin.sha256)
  const b = await plexo.start(origin.url('/b'), origin.sha256)
  const c = await plexo.start(origin.url('/c'), origin.sha256)
  await reached
  expect((await plexo.byId(a))?.status).toBe('downloading')
  await expect.poll(async () => (await plexo.byId(b))?.status).toBe('queued')
  await expect.poll(async () => (await plexo.byId(c))?.status).toBe('queued')

  const queueOrder = async (): Promise<string[]> => {
    const all = await plexo.api.listDownloads()
    return all
      .map((entry) => entry.state)
      .filter((state) => state.status === 'queued')
      .sort((left, right) => (left.queuedAt ?? 0) - (right.queuedAt ?? 0))
      .map((state) => state.id)
  }
  expect(await queueOrder()).toEqual([b, c])
  await plexo.api.moveDownload(c, 'up')
  expect(await queueOrder()).toEqual([c, b])
  await plexo.api.moveDownload(c, 'down')
  expect(await queueOrder()).toEqual([b, c])

  // Let the held one finish, so the whole queue drains and every file is checked.
  origin.release()
  await expect
    .poll(async () => (await plexo.byId(a))?.status, { timeout: 30_000 })
    .toBe('completed')
  await expect
    .poll(async () => (await plexo.byId(b))?.status, { timeout: 30_000 })
    .toBe('completed')
  await expect
    .poll(async () => (await plexo.byId(c))?.status, { timeout: 30_000 })
    .toBe('completed')
})
