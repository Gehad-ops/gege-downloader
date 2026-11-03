import { expect, test } from '@playwright/test'
import { sortItems } from '../src/renderer/src/utils/downloadSort'
import type { DownloadItem } from '../src/renderer/src/utils/downloadActions'

// The natural order: the running download, then the queue in the order it will run (so it reads
// top to bottom), then finished newest first.

const item = (patch: Record<string, unknown>): DownloadItem =>
  ({
    id: 'x',
    kind: 'http',
    url: 'https://example.com/f.bin',
    fileName: 'f.bin',
    bytesDownloaded: 0,
    totalBytes: 0,
    ...patch
  }) as unknown as DownloadItem

test('the default order runs top to bottom, finished newest first', () => {
  const items = [
    item({ id: 'finished1', status: 'completed', startedAt: 10, completedAt: 100 }),
    item({ id: 'q2', status: 'queued', startedAt: 200, queuedAt: 200 }),
    item({ id: 'run', status: 'downloading', startedAt: 1 }),
    item({ id: 'q1', status: 'queued', startedAt: 150, queuedAt: 150 }),
    item({ id: 'finished2', status: 'completed', startedAt: 20, completedAt: 300 })
  ]
  expect(sortItems(items, { key: 'default', descending: false }).map((entry) => entry.id)).toEqual([
    'run',
    'q1',
    'q2',
    'finished2',
    'finished1'
  ])
})
