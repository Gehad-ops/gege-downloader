import { cn } from 'cn'
import { Download, Link2, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DownloadCategory, DownloadFilter, MainTab } from '../store/useAppStore'
import { useAppStore } from '../store/useAppStore'
import { formatBytes } from '../utils/format'
import { FILE_TYPES, type FileType } from '../utils/fileTypes'

const FREE_SPACE_POLL_MS = 30_000

function NavItem({
  icon: Icon,
  label,
  count,
  active,
  onClick
}: {
  icon: LucideIcon
  label: string
  count: number
  active: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-9 w-full shrink-0 items-center gap-2.5 rounded-[10px] border px-2.5 text-left text-[13px] font-medium outline-none',
        active
          ? 'border-[var(--active-ring)] bg-[var(--active-item)] text-[var(--text)]'
          : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text)]'
      )}
    >
      <Icon
        aria-hidden
        className={cn('size-4 shrink-0', active ? 'text-[var(--chart-teal)]' : 'text-current')}
        strokeWidth={2}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="font-mono text-[11px] text-[var(--text-tertiary)]">{count}</span>
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="px-2.5 pt-5 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-[var(--text-tertiary)] uppercase">
      {children}
    </div>
  )
}

function DotItem({
  dot,
  label,
  count,
  active,
  live,
  onClick
}: {
  dot: string
  label: string
  count: number
  active: boolean
  live?: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex h-8 w-full shrink-0 items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13px] font-medium outline-none',
        active
          ? 'bg-[var(--active-item)] text-[var(--text)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text)]'
      )}
    >
      <span
        aria-hidden
        className={cn('size-2 shrink-0 rounded-full', live && 'live-dot')}
        style={live ? undefined : { background: dot }}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="font-mono text-[11px] text-[var(--text-tertiary)]">{count}</span>
    </button>
  )
}

/** The meter under "Disk space": how much of the drive is in use. Null while it's being read. */
function DiskSpaceCard({
  onClearFinished,
  hasFinished
}: {
  onClearFinished: () => void
  hasFinished: boolean
}): React.JSX.Element {
  const destinationDir = useAppStore((store) => store.destinationDir)
  const [space, setSpace] = useState<{ free: number; total: number } | null>(null)

  useEffect(() => {
    let disposed = false
    const load = (): void => {
      void window.gege
        .diskSpace(destinationDir)
        .then((next) => !disposed && setSpace(next))
        .catch(() => {})
    }
    load()
    const interval = setInterval(load, FREE_SPACE_POLL_MS)
    return () => {
      disposed = true
      clearInterval(interval)
    }
  }, [destinationDir])

  const usedShare = space && space.total > 0 ? 1 - space.free / space.total : 0

  return (
    <div className="mt-auto rounded-[14px] border border-[var(--card-border)] bg-[var(--card)] p-3.5">
      <div className="flex items-center justify-between gap-2 text-[12px] text-[var(--text-secondary)]">
        <span>Disk space</span>
        <span className="font-mono text-[var(--text)]">
          {space ? `${formatBytes(space.free)} free` : '—'}
        </span>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--track-bg)]">
        <div
          className="h-full rounded-full bg-[var(--chart-blue)] transition-[width] duration-500"
          style={{ width: `${Math.round(usedShare * 100)}%` }}
        />
      </div>
      {hasFinished && (
        <button
          type="button"
          onClick={onClearFinished}
          className="mt-2.5 w-full rounded-[6px] py-1 text-left text-[12px] text-[var(--text-secondary)] outline-none hover:text-[var(--text)]"
        >
          Clear finished list
        </button>
      )}
    </div>
  )
}

/** The dashboard's left rail: the two lists, file-type and state filters, and the disk card. */
export function CategorySidebar({
  mainTab,
  onTab,
  grabberCount,
  filter,
  category,
  counts,
  categoryCounts,
  onPick,
  onClearFinished,
  hasFinished
}: {
  mainTab: MainTab
  onTab: (tab: MainTab) => void
  grabberCount: number
  filter: DownloadFilter
  category: DownloadCategory
  counts: Record<DownloadFilter, number>
  categoryCounts: Record<DownloadCategory, number>
  onPick: (filter: DownloadFilter, category: DownloadCategory) => void
  onClearFinished: () => void
  hasFinished: boolean
}): React.JSX.Element {
  return (
    <aside className="flex w-[240px] shrink-0 flex-col gap-1 border-r border-[var(--border-subtle)] bg-[var(--panel)] px-3.5 py-5">
      <NavItem
        icon={Download}
        label="All downloads"
        count={counts.all}
        active={mainTab === 'downloads' && filter === 'all' && category === 'all'}
        onClick={() => {
          onTab('downloads')
          onPick('all', 'all')
        }}
      />
      <NavItem
        icon={Link2}
        label="LinkGrabber"
        count={grabberCount}
        active={mainTab === 'grabber'}
        onClick={() => onTab('grabber')}
      />

      <SectionLabel>Types</SectionLabel>
      {(Object.keys(FILE_TYPES) as FileType[]).map((type) => (
        <DotItem
          key={type}
          dot={FILE_TYPES[type].dot}
          label={FILE_TYPES[type].label}
          count={categoryCounts[type]}
          active={mainTab === 'downloads' && filter === 'all' && category === type}
          onClick={() => {
            onTab('downloads')
            onPick('all', type)
          }}
        />
      ))}

      <SectionLabel>Status</SectionLabel>
      <DotItem
        dot="var(--chart-teal)"
        label="Unfinished"
        count={counts.progress}
        live
        active={mainTab === 'downloads' && filter === 'progress'}
        onClick={() => {
          onTab('downloads')
          onPick('progress', 'all')
        }}
      />
      <DotItem
        dot="var(--color-success)"
        label="Finished"
        count={counts.finished}
        active={mainTab === 'downloads' && filter === 'finished'}
        onClick={() => {
          onTab('downloads')
          onPick('finished', 'all')
        }}
      />
      <DotItem
        dot="var(--color-danger)"
        label="Errors"
        count={counts.failed}
        active={mainTab === 'downloads' && filter === 'failed'}
        onClick={() => {
          onTab('downloads')
          onPick('failed', 'all')
        }}
      />

      <DiskSpaceCard onClearFinished={onClearFinished} hasFinished={hasFinished} />
    </aside>
  )
}
