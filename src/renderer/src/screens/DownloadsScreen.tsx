import { cn } from 'cn'
import {
  Clock3,
  Gauge,
  ListPlus,
  ListX,
  Pause,
  Play,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
  type LucideIcon
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { rotatedNetwork } from '@shared/networkRotation'
import { useDownloadActions, useDownloadActionsState } from '../components/downloadActionsContext'
import { MoreActionsMenu } from '../components/MoreActionsMenu'
import { CategorySidebar } from '../components/CategorySidebar'
import { DownloadSearchInput } from '../components/DownloadSearchInput'
import { CompletionMenu } from '../components/CompletionMenu'
import { CombineDiagram } from '../components/CombineDiagram'
import { LimitsDialog } from '../components/LimitsDialog'
import { NetworksMenu } from '../components/NetworksMenu'
import { DownloadTable } from '../components/DownloadTable'
import { LinkGrabberView } from '../components/LinkGrabberView'
import { StatsRow } from '../components/StatsRow'
import { Button } from '../components/ui/button'
import { useAppStore, type DownloadCategory, type DownloadFilter } from '../store/useAppStore'
import { categoryOf } from '../utils/categories'
import { sortItems, type SortKey, type SortState } from '../utils/downloadSort'
import { sourceOf } from '../utils/format'
import {
  availableActions,
  type ActionId,
  type AvailableAction,
  type DownloadItem
} from '../utils/downloadActions'

function filterOf(item: DownloadItem): Exclude<DownloadFilter, 'all'> {
  if ('unitsWritten' in item || item.status === 'completed') return 'finished'
  return item.status === 'error' ? 'failed' : 'progress'
}

/** Whether the search box keeps this download: its name, its link, or its host, lower-cased. */
function matchesSearch(item: DownloadItem, query: string): boolean {
  return (
    item.fileName.toLowerCase().includes(query) ||
    item.url.toLowerCase().includes(query) ||
    sourceOf(item.url).toLowerCase().includes(query)
  )
}

/** One of the four actions in the grouped button cluster. */
function ToolAction({
  icon: Icon,
  label,
  disabled,
  emphasis,
  onClick
}: {
  icon: LucideIcon
  label: string
  disabled?: boolean
  emphasis?: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-[30px] items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium text-[var(--text)] outline-none hover:bg-[var(--hover-bg)] disabled:pointer-events-none disabled:opacity-40',
        emphasis && 'bg-[var(--bg-tertiary)]'
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </button>
  )
}

/** A standalone action on the right of the toolbar. */
function PillButton({
  icon: Icon,
  label,
  disabled,
  active,
  onClick
}: {
  icon: LucideIcon
  label: string
  disabled?: boolean
  active?: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex h-9 items-center gap-2 rounded-[10px] border border-[var(--card-border)] bg-[var(--card)] px-3.5 text-[13px] font-medium text-[var(--text)] outline-none hover:bg-[var(--hover-bg)] disabled:pointer-events-none disabled:opacity-40',
        active && 'border-[var(--active-ring)] bg-[var(--select-bg)] text-[var(--color-accent)]'
      )}
    >
      <Icon aria-hidden className="size-[15px]" />
      {label}
    </button>
  )
}

export function DownloadsScreen(): React.JSX.Element {
  const downloadsById = useAppStore((store) => store.downloads)
  const history = useAppStore((store) => store.history)
  const setView = useAppStore((store) => store.setView)
  const openNewDownload = useAppStore((store) => store.openNewDownload)
  const filter = useAppStore((store) => store.downloadFilter)
  const setFilter = useAppStore((store) => store.setDownloadFilter)
  const category = useAppStore((store) => store.downloadCategory)
  const setCategory = useAppStore((store) => store.setDownloadCategory)
  const search = useAppStore((store) => store.downloadSearch)
  const setSearch = useAppStore((store) => store.setDownloadSearch)
  const mainTab = useAppStore((store) => store.mainTab)
  const setMainTab = useAppStore((store) => store.setMainTab)
  const slowMode = useAppStore((store) => store.slowMode)
  const setSlowMode = useAppStore((store) => store.setSlowMode)
  const grabberCount = useAppStore((store) => store.grabber.length)
  // A signature of everything the alternating assignment depends on: the mode, the pool, and the
  // active downloads' order and networks. A string, so a speed tick (which changes the downloads
  // object) doesn't re-run the effect below.
  const alternateSignal = useAppStore((store) => {
    if (store.networkMode !== 'alternate') return 'combine'
    const pool = store.interfaces
      .filter((iface) => !store.networkPreferences[iface.id]?.off)
      .map((iface) => iface.id)
    const active = Object.values(store.downloads)
      .filter((download) => download.status === 'downloading' || download.status === 'queued')
      .map(
        (download) =>
          `${download.id}${download.status === 'downloading' ? 'D' : 'Q'}${download.networks
            .map((network) => (network.enabled ? '1' : '0'))
            .join('')}`
      )
      .join(',')
    return `${pool.join('|')}#${active}`
  })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const { perform, askClearFinished } = useDownloadActions()
  const { busy } = useDownloadActionsState()
  const [limitsOpen, setLimitsOpen] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [limitsPage, setLimitsPage] = useState<string | null>(null)
  const [sort, setSort] = useState<SortState>({ key: 'default', descending: false })

  const downloads = Object.values(downloadsById).filter(
    (download) => download.status !== 'cancelled'
  )
  const allItems: DownloadItem[] = [...downloads, ...history]

  const query = search.trim().toLowerCase()
  const searched =
    query.length === 0 ? allItems : allItems.filter((item) => matchesSearch(item, query))
  const counts: Record<DownloadFilter, number> = {
    all: searched.length,
    progress: 0,
    finished: 0,
    failed: 0
  }
  const categoryCounts: Record<DownloadCategory, number> = {
    all: searched.length,
    video: 0,
    audio: 0,
    images: 0,
    documents: 0,
    archives: 0,
    programs: 0,
    other: 0
  }
  for (const item of searched) {
    counts[filterOf(item)]++
    categoryCounts[categoryOf(item)]++
  }
  const items = sortItems(
    searched.filter(
      (item) =>
        (filter === 'all' || filterOf(item) === filter) &&
        (category === 'all' || categoryOf(item) === category)
    ),
    sort
  )
  const chosen = items.filter((item) => selected.has(item.id))
  const allSelected = items.length > 0 && chosen.length === items.length
  const someSelected = chosen.length > 0 && !allSelected

  const toggle = useCallback(
    (ids: string[], on: boolean): void =>
      setSelected((previous) => {
        const next = new Set(previous)
        for (const id of ids) {
          if (on) next.add(id)
          else next.delete(id)
        }
        return next
      }),
    []
  )
  const selectRow = useCallback((id: string, on: boolean) => toggle([id], on), [toggle])
  const selectAll = useCallback(
    (on: boolean) =>
      toggle(
        items.map((item) => item.id),
        on
      ),
    [toggle, items]
  )
  const openRow = useCallback((id: string) => setView({ name: 'download', id }), [setView])
  const changeSort = useCallback(
    (key: SortKey) =>
      setSort((previous) =>
        previous.key === key
          ? { key, descending: !previous.descending }
          : { key, descending: false }
      ),
    []
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target
      if (
        event.defaultPrevented ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName))) ||
        document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')
      )
        return
      const command = window.plexo.platform === 'darwin' ? event.metaKey : event.ctrlKey
      if (event.key === 'Escape') setSelected(new Set())
      else if (command && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        setSelected(new Set(items.map((item) => item.id)))
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        const id = command ? 'trash' : 'remove'
        const action = availableActions(chosen)
          .flat()
          .find((available) => available.id === id)
        if (!action) return
        event.preventDefault()
        void perform(id, action.targets)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [items, chosen, perform])

  // Alternating networks by position: the Nth active download (running first, then queued in
  // order) takes the Nth network of the pool. Reordering the queue moves the turns, and this puts
  // every download on the network its new place calls for.
  useEffect(() => {
    const state = useAppStore.getState()
    if (state.networkMode !== 'alternate') return
    const pool = state.interfaces
      .filter((iface) => !state.networkPreferences[iface.id]?.off)
      .map((iface) => iface.id)
    if (pool.length <= 1) return
    const active = Object.values(state.downloads)
      .filter((download) => download.status === 'downloading' || download.status === 'queued')
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'downloading' ? -1 : 1
        return a.status === 'queued'
          ? (a.queuedAt ?? 0) - (b.queuedAt ?? 0)
          : a.startedAt - b.startedAt
      })
    active.forEach((download, index) => {
      const target = rotatedNetwork(pool, index).network
      const targetNetwork = download.networks.find((network) => network.id === target)
      if (targetNetwork?.enabled && download.networks.filter((n) => n.enabled).length === 1) return
      // Switch the wanted network on first, so the download is never left with none.
      if (targetNetwork && !targetNetwork.enabled) {
        void window.plexo.setDownloadNetwork(download.id, target, true)
      }
      for (const network of download.networks) {
        if (network.id !== target && network.enabled) {
          void window.plexo.setDownloadNetwork(download.id, network.id, false)
        }
      }
    })
  }, [alternateSignal])

  const actionGroups = availableActions(chosen)
  const flatActions = actionGroups.flat()
  const actionFor = (id: ActionId): AvailableAction | undefined =>
    flatActions.find((action) => action.id === id)
  const resumeAction = actionFor('resume')
  const pauseAction = actionFor('pause')
  const cancelAction = actionFor('cancel')
  const removeAction = actionFor('remove')
  // What the toolbar already shows as its own button stays out of More.
  const onToolbar = new Set<ActionId>(['pause', 'resume', 'cancel', 'remove'])
  const moreActions = actionGroups
    .map((group) => group.filter((action) => !onToolbar.has(action.id)))
    .filter((group) => group.length > 0)
  const counted = (label: string, action: AvailableAction | undefined): string =>
    action ? `${label} (${action.targets.length})` : label

  const openSchedule = (): void => {
    setLimitsPage(null)
    setShowSchedule(true)
    setLimitsOpen(true)
  }
  const openLimits = (): void => {
    setShowSchedule(false)
    setLimitsPage(null)
    setLimitsOpen(true)
  }
  const pickView = (nextFilter: DownloadFilter, nextCategory: DownloadCategory): void => {
    setFilter(nextFilter)
    setCategory(nextCategory)
    setSelected(new Set())
  }

  return (
    <div className="flex h-full min-h-0 bg-[var(--bg)]">
      <CategorySidebar
        mainTab={mainTab}
        onTab={setMainTab}
        grabberCount={grabberCount}
        filter={filter}
        category={category}
        counts={counts}
        categoryCounts={categoryCounts}
        onPick={pickView}
        onClearFinished={askClearFinished}
        hasFinished={history.length > 0}
      />

      <main className="flex min-w-0 flex-1 flex-col gap-5 overflow-hidden px-8 py-6">
        {mainTab === 'grabber' ? (
          <>
            <header className="flex flex-wrap items-center gap-2.5">
              <h1 className="mr-auto text-[24px] leading-none font-bold tracking-[-0.02em]">
                LinkGrabber
              </h1>
              <span className="rounded-full border border-[var(--card-border)] bg-[var(--card)] px-2.5 py-1 font-mono text-[11px] text-[var(--text-tertiary)]">
                {grabberCount} {grabberCount === 1 ? 'link' : 'links'}
              </span>
            </header>
            <LinkGrabberView />
          </>
        ) : (
          <>
            <header className="flex flex-wrap items-center gap-2.5">
              <h1 className="mr-auto text-[24px] leading-none font-bold tracking-[-0.02em]">
                Downloads
              </h1>
              <DownloadSearchInput value={search} onChange={setSearch} />
              <button
                type="button"
                onClick={() => openNewDownload()}
                className="accent-gradient flex h-9 items-center gap-2 rounded-[10px] px-3.5 text-[13px] font-semibold text-[#06231f] outline-none hover:opacity-95 focus-visible:ring-3 focus-visible:ring-[var(--color-accent)]/40"
              >
                <Plus aria-hidden className="size-4" strokeWidth={2.4} />
                Add URL
              </button>
              <button
                type="button"
                onClick={() => openNewDownload()}
                className="flex h-9 items-center gap-2 rounded-[10px] border border-[var(--card-border)] bg-[var(--card)] px-3.5 text-[13px] font-medium text-[var(--text)] outline-none hover:bg-[var(--hover-bg)] focus-visible:ring-3 focus-visible:ring-[var(--color-accent)]/40"
              >
                <ListPlus aria-hidden className="size-4" />
                Add batch
              </button>
            </header>

            <StatsRow active={counts.progress} finished={counts.finished} errors={counts.failed} />

            <div
              role="toolbar"
              aria-label="Downloads"
              aria-busy={busy}
              className="flex flex-wrap items-center gap-2"
            >
              <div className="flex items-center gap-1 rounded-[12px] border border-[var(--card-border)] bg-[var(--card)] p-1">
                <ToolAction
                  icon={Play}
                  label={counted('Resume', resumeAction)}
                  disabled={!resumeAction || busy}
                  emphasis={Boolean(resumeAction)}
                  onClick={() => resumeAction && void perform('resume', resumeAction.targets)}
                />
                <ToolAction
                  icon={Pause}
                  label={counted('Pause', pauseAction)}
                  disabled={!pauseAction || busy}
                  emphasis={!resumeAction && Boolean(pauseAction)}
                  onClick={() => pauseAction && void perform('pause', pauseAction.targets)}
                />
                <ToolAction
                  icon={X}
                  label={counted('Cancel', cancelAction)}
                  disabled={!cancelAction || busy}
                  onClick={() => cancelAction && void perform('cancel', cancelAction.targets)}
                />
                <ToolAction
                  icon={Trash2}
                  label={counted('Remove', removeAction)}
                  disabled={!removeAction || busy}
                  onClick={() => removeAction && void perform('remove', removeAction.targets)}
                />
              </div>

              <PillButton
                icon={ListX}
                label="Clear done"
                disabled={history.length === 0}
                onClick={askClearFinished}
              />

              <div className="ml-auto flex flex-wrap items-center gap-2">
                {chosen.length > 0 && (
                  <span className="rounded-full bg-[var(--select-bg)] px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-[var(--color-accent)]">
                    {chosen.length} selected
                  </span>
                )}
                <MoreActionsMenu groups={moreActions} disabled={busy} />
                <CompletionMenu />
                <NetworksMenu
                  compact
                  onOpenLimits={(page) => {
                    setShowSchedule(false)
                    setLimitsPage(page)
                    setLimitsOpen(true)
                  }}
                />
                <PillButton
                  icon={Clock3}
                  label="Scheduler"
                  active={showSchedule}
                  onClick={openSchedule}
                />
                <PillButton
                  icon={Gauge}
                  label={slowMode ? 'Limiter: On' : 'Limiter: Off'}
                  active={slowMode}
                  onClick={() => setSlowMode(!slowMode)}
                />
                <PillButton icon={SlidersHorizontal} label="Limits" onClick={openLimits} />
              </div>
            </div>

            {allItems.length === 0 ? (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <EmptyState />
              </div>
            ) : items.length === 0 ? (
              <div
                role="status"
                className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-[18px] border border-[var(--card-border)] bg-[var(--card)] px-6 py-16 text-center"
              >
                {query.length > 0 || category !== 'all' ? (
                  <>
                    <p className="text-[18px] font-semibold">No downloads match</p>
                    <p className="max-w-[380px] text-[13px] leading-[1.6] text-[var(--text-secondary)]">
                      Try a different search, or a different type.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('')
                        setCategory('all')
                        setFilter('all')
                      }}
                      className="accent-gradient mt-1 flex h-9 items-center rounded-[10px] px-3.5 text-[13px] font-semibold text-[#06231f]"
                    >
                      Clear filters
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[18px] font-semibold">
                      {filter === 'progress'
                        ? 'No downloads in progress'
                        : filter === 'finished'
                          ? 'No finished downloads'
                          : 'No downloads need attention'}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setFilter('all')}
                      className="mt-1"
                    >
                      Show all downloads
                    </Button>
                    {filter === 'finished' && history.length > 0 && (
                      <button
                        type="button"
                        className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--text)]"
                        onClick={askClearFinished}
                      >
                        Clear finished list
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <DownloadTable
                items={items}
                selected={selected}
                chosen={chosen}
                allSelected={allSelected}
                someSelected={someSelected}
                sort={sort}
                onSort={changeSort}
                onSelectAll={selectAll}
                onSelect={selectRow}
                onOpen={openRow}
                onPerform={perform}
              />
            )}

            <LimitsDialog
              open={limitsOpen}
              showSchedule={showSchedule}
              onOpenChange={setLimitsOpen}
              page={limitsPage}
              onPageChange={setLimitsPage}
            />
          </>
        )}
      </main>
    </div>
  )
}

// Colors are irrelevant here — the diagram is rendered `muted`, which overrides them all.
const PLACEHOLDER_NETWORKS = [
  { solid: 'var(--icon-muted)', label: 'Wi-Fi' },
  { solid: 'var(--icon-muted)', label: 'USB' },
  { solid: 'var(--icon-muted)', label: 'Ethernet' }
]
const PASTE_SHORTCUT = window.plexo.platform === 'darwin' ? '⌘V' : 'Ctrl+V'
const NEW_SHORTCUT = window.plexo.platform === 'darwin' ? '⌘N' : 'Ctrl+N'

/** Nothing listed yet: how to start one — or, with no network connected, how to get one. */
function EmptyState(): React.JSX.Element {
  const noNetworks = useAppStore(
    (store) => store.interfacesStatus === 'ready' && store.interfaces.length === 0
  )
  const loadInterfaces = useAppStore((store) => store.loadInterfaces)
  const openNewDownload = useAppStore((store) => store.openNewDownload)

  return (
    <div className="mx-auto flex min-h-full max-w-[560px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <CombineDiagram networks={PLACEHOLDER_NETWORKS} muted />
      {noNetworks ? (
        <>
          <div className="text-[20px] leading-tight font-semibold">No networks connected</div>
          <div className="max-w-[380px] text-[13px] leading-[1.6] text-[var(--text-secondary)]">
            Plexo needs at least one active network. Join a Wi-Fi network, plug in Ethernet, or
            connect your phone using USB tethering.
          </div>
          <div className="mt-1 flex gap-2">
            <Button type="button" variant="secondary" onClick={() => loadInterfaces()}>
              Scan again
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.plexo.openNetworkSettings()}
            >
              Network settings
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="text-[20px] leading-tight font-semibold">No downloads yet</div>
          <div className="max-w-[380px] text-[13px] leading-[1.6] text-[var(--text-secondary)]">
            Paste a link ({PASTE_SHORTCUT}) or drop a .torrent anywhere in this window.
          </div>
          <button
            type="button"
            onClick={() => openNewDownload()}
            className="accent-gradient mt-1 flex h-9 items-center gap-2 rounded-[10px] px-3.5 text-[13px] font-semibold text-[#06231f]"
          >
            <Plus aria-hidden className="size-4" strokeWidth={2.4} />
            New download
            <span className="font-mono text-[11px] opacity-70">{NEW_SHORTCUT}</span>
          </button>
        </>
      )}
    </div>
  )
}
