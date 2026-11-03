import { cn } from 'cn'
import { memo } from 'react'
import { useFormatSpeed } from '../hooks/useFormatSpeed'
import { categoryOf } from '../utils/categories'
import { describeError, formatBytes, formatEta, formatPercent, wantedBytes } from '../utils/format'
import {
  isDone,
  isFinished,
  rowAction,
  type ActionId,
  type DownloadItem
} from '../utils/downloadActions'
import { FILE_TYPES, type FileType } from '../utils/fileTypes'
import { statusOf, type SortKey, type SortState } from '../utils/downloadSort'
import { ACTION_META } from './downloadActionMeta'
import { DownloadContextMenu } from './DownloadContextMenu'
import { TorrentBadge } from './TorrentBadge'
import { Checkbox } from './ui/checkbox'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

// The dashboard's list: a card per download, with a type tile and chip, a progress bar and a
// status pill, in the redesign's grid.

const GRID =
  'grid grid-cols-[24px_44px_minmax(160px,1fr)_120px_minmax(180px,220px)_120px_36px] items-center gap-4'

function typeOf(item: DownloadItem): FileType {
  return categoryOf(item)
}

interface StatusChip {
  label: string
  background: string
  color: string
  live?: boolean
}

function chipOf(item: DownloadItem): StatusChip {
  if (isFinished(item)) {
    return item.missing
      ? {
          label: 'Missing',
          background: 'var(--status-error-bg)',
          color: 'var(--status-error-text)'
        }
      : {
          label: 'Finished',
          background: 'var(--status-finished-bg)',
          color: 'var(--status-finished-text)'
        }
  }
  switch (item.status) {
    case 'downloading':
      return {
        label: 'Downloading',
        background: 'var(--status-downloading-bg)',
        color: 'var(--status-downloading-text)',
        live: true
      }
    case 'paused':
      return {
        label: 'Paused',
        background: 'var(--status-paused-bg)',
        color: 'var(--status-paused-text)'
      }
    case 'queued':
      return {
        label: 'Queued',
        background: 'var(--status-queued-bg)',
        color: 'var(--status-queued-text)'
      }
    case 'error':
      return {
        label: 'Failed',
        background: 'var(--status-error-bg)',
        color: 'var(--status-error-text)'
      }
    case 'completed':
      return {
        label: 'Finished',
        background: 'var(--status-finished-bg)',
        color: 'var(--status-finished-text)'
      }
    default:
      return {
        label: statusOf(item),
        background: 'var(--status-queued-bg)',
        color: 'var(--status-queued-text)'
      }
  }
}

export function DownloadTable({
  items,
  selected,
  chosen,
  allSelected,
  someSelected,
  sort,
  onSort,
  onSelectAll,
  onSelect,
  onOpen,
  onPerform
}: {
  items: DownloadItem[]
  selected: Set<string>
  chosen: DownloadItem[]
  allSelected: boolean
  someSelected: boolean
  sort: SortState
  onSort: (key: SortKey) => void
  onSelectAll: (on: boolean) => void
  onSelect: (id: string, on: boolean) => void
  onOpen: (id: string) => void
  onPerform: (id: ActionId, targets: DownloadItem[]) => Promise<boolean>
}): React.JSX.Element {
  const sortable = (key: SortKey, label: string): React.JSX.Element => (
    <button
      type="button"
      onClick={() => onSort(key)}
      className="flex items-center gap-1 text-left outline-none hover:text-[var(--text)] focus-visible:text-[var(--text)]"
    >
      {label}
      <span className={cn('text-[9px]', sort.key === key ? 'opacity-100' : 'opacity-0')}>
        {sort.descending ? '▼' : '▲'}
      </span>
    </button>
  )

  return (
    <div role="table" className="min-h-0 flex-1 overflow-auto">
      <div className="min-w-[900px] px-1 pb-4">
        <div
          role="row"
          className={cn(
            GRID,
            'sticky top-0 z-10 px-4 py-2 text-[11px] font-semibold tracking-[0.08em] text-[var(--text-tertiary)] uppercase'
          )}
          style={{ background: 'var(--bg)' }}
        >
          <Checkbox
            aria-label="Select all"
            checked={allSelected}
            indeterminate={someSelected}
            onCheckedChange={(on) => onSelectAll(on)}
          />
          <span aria-hidden />
          {sortable('name', 'Name')}
          <span aria-hidden>Type</span>
          {sortable('progress', 'Progress')}
          {sortable('status', 'Status')}
          <span aria-hidden />
        </div>
        <div role="rowgroup" className="flex flex-col gap-0.5">
          {items.map((item) => (
            <DownloadRow
              key={item.id}
              item={item}
              selected={selected.has(item.id)}
              chosen={selected.has(item.id) ? chosen : NOT_CHOSEN}
              onSelect={onSelect}
              onOpen={onOpen}
              onPerform={onPerform}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const NOT_CHOSEN: DownloadItem[] = []

const DownloadRow = memo(function DownloadRow({
  item,
  selected,
  chosen,
  onSelect,
  onOpen,
  onPerform
}: {
  item: DownloadItem
  selected: boolean
  chosen: DownloadItem[]
  onSelect: (id: string, on: boolean) => void
  onOpen: (id: string) => void
  onPerform: (id: ActionId, targets: DownloadItem[]) => Promise<boolean>
}): React.JSX.Element {
  const formatSpeed = useFormatSpeed()
  const finished = isDone(item) || isFinished(item)
  const wanted = wantedBytes(item)
  const percent = finished ? 100 : formatPercent(item.bytesDownloaded, wanted)
  const failed = !isFinished(item) && item.status === 'error'
  const type = typeOf(item)
  const meta = FILE_TYPES[type]
  const TypeIcon = meta.icon
  const chip = chipOf(item)
  const actionId: ActionId | null = rowAction(item) ?? (isDone(item) ? 'reveal' : null)
  const action = actionId ? ACTION_META[actionId] : null
  const highlighted = selected || item.status === 'downloading'

  const speed =
    !finished && item.status === 'downloading' ? formatSpeed(item.speedBytesPerSec) : null
  const subtitle = speed
    ? `${formatBytes(wanted || item.bytesDownloaded)} · ${speed}`
    : formatBytes(wanted || item.bytesDownloaded)

  const barClass = finished
    ? 'bg-[var(--color-success)]'
    : failed
      ? 'bg-[var(--color-danger)]'
      : item.status === 'downloading'
        ? 'progress-flow'
        : 'bg-[var(--warn)]'

  return (
    <DownloadContextMenu item={item} selected={selected} chosen={chosen}>
      <div
        role="row"
        data-selected={selected || undefined}
        onDoubleClick={() => onOpen(item.id)}
        className={cn(
          GRID,
          'cursor-default rounded-[14px] border px-4 py-3',
          highlighted
            ? 'border-[var(--active-ring)] bg-[var(--card)]'
            : 'border-transparent hover:border-[var(--card-border)] hover:bg-[var(--card)]'
        )}
      >
        <Checkbox
          aria-label={`Select ${item.fileName}`}
          checked={selected}
          onCheckedChange={(on) => onSelect(item.id, on)}
        />

        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-[12px]"
          style={{ background: meta.tileBg, color: meta.tileText }}
        >
          <TypeIcon className="size-5" strokeWidth={2} />
        </span>

        <button
          type="button"
          aria-label={`Open ${item.fileName}`}
          onClick={() => onOpen(item.id)}
          className="min-w-0 text-left outline-none focus-visible:underline"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[14px] font-semibold">{item.fileName}</span>
            {item.kind === 'torrent' && <TorrentBadge />}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[12px] text-[var(--text-tertiary)]">
            {subtitle}
          </span>
        </button>

        <span
          className="w-max rounded-full px-2.5 py-1 text-[12px] font-medium"
          style={{ background: meta.chipBg, color: meta.chipText }}
        >
          {meta.singular}
        </span>

        <div className="flex h-8 flex-col justify-center">
          {!finished && (
            <div className="mb-1.5 flex items-center justify-between gap-2 text-[12px]">
              <span className="font-mono">{percent}%</span>
              <span
                className="truncate font-mono text-[var(--text-tertiary)]"
                title={failed ? describeError(item.error ?? '') : undefined}
              >
                {failed
                  ? 'Failed'
                  : item.status === 'paused'
                    ? 'Paused'
                    : item.status === 'queued'
                      ? 'Waiting'
                      : item.timeLeftSeconds !== undefined
                        ? `ETA ${formatEta(item.timeLeftSeconds)}`
                        : ''}
              </span>
            </div>
          )}
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--track-bg)]">
            <div
              className={cn('h-full rounded-full', barClass)}
              style={{ width: `${Math.min(100, percent)}%` }}
            />
          </div>
        </div>

        <span
          className="flex h-6 w-max items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium"
          style={{ background: chip.background, color: chip.color }}
        >
          {chip.live && <span className="live-dot size-2 rounded-full" aria-hidden />}
          {chip.label}
        </span>

        <div className="flex justify-end">
          {action && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`${action.label} ${item.fileName}`}
                    onClick={() => void onPerform(actionId!, [item])}
                    className="text-[var(--text-secondary)] hover:text-[var(--text)]"
                  >
                    <action.icon />
                  </Button>
                }
              />
              <TooltipContent>{action.label}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </DownloadContextMenu>
  )
})
