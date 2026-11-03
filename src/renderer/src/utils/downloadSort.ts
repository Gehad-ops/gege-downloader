import type { DownloadItem } from './downloadActions'
import { isFinished } from './downloadActions'
import { wantedBytes } from './format'

// The downloads table's sorting, kept out of the component file so fast refresh stays happy.

export type SortKey = 'default' | 'name' | 'progress' | 'size' | 'speed' | 'status' | 'date'
export interface SortState {
  key: SortKey
  descending: boolean
}

/** Where a download sits in the natural order: running first, then the queue in its run order,
 * then paused/failed, then finished — so the one that runs next is nearest the top. */
function rank(item: DownloadItem): number {
  if (isFinished(item) || item.status === 'completed') return 4
  switch (item.status) {
    case 'downloading':
      return 0
    case 'queued':
      return 1
    case 'paused':
      return 2
    default:
      return 3
  }
}

/** The Status column's word for a download, which is also how that column sorts. */
export function statusOf(item: DownloadItem): string {
  if (isFinished(item)) return item.missing ? 'Missing' : 'Finished'
  switch (item.status) {
    case 'downloading':
      return 'Downloading'
    case 'queued':
      return 'Queued'
    case 'paused':
      return 'Paused'
    case 'completed':
      return 'Finished'
    case 'error':
      return 'Error'
    default:
      return item.status
  }
}

/** The value a column sorts by. */
function sortValue(item: DownloadItem, key: SortKey): number | string {
  switch (key) {
    case 'default':
      return item.startedAt
    case 'name':
      return item.fileName.toLowerCase()
    case 'size':
      return wantedBytes(item) || item.bytesDownloaded
    case 'progress':
      return item.bytesDownloaded / (wantedBytes(item) || 1)
    case 'speed':
      return item.status === 'downloading' ? item.speedBytesPerSec : 0
    case 'status':
      return statusOf(item)
    case 'date':
      return isFinished(item) ? (item.completedAt ?? item.startedAt) : item.startedAt
  }
}

export function sortItems(items: DownloadItem[], { key, descending }: SortState): DownloadItem[] {
  // The natural order: running first, then queued in turn (so the queue reads top to bottom),
  // then paused/failed, then finished newest first.
  if (key === 'default') {
    return [...items].sort((a, b) => {
      const groupA = rank(a)
      const groupB = rank(b)
      if (groupA !== groupB) return groupA - groupB
      if (groupA === 1) return (a.queuedAt ?? a.startedAt) - (b.queuedAt ?? b.startedAt)
      if (groupA === 4) return (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt)
      return a.startedAt - b.startedAt
    })
  }
  return [...items].sort((a, b) => {
    const left = sortValue(a, key)
    const right = sortValue(b, key)
    const order =
      typeof left === 'string' && typeof right === 'string'
        ? left.localeCompare(right)
        : Number(left) - Number(right)
    return descending ? -order : order
  })
}
