import { applyDownloadUpdate } from '@shared/downloadUpdate'
import type {
  AppSettings,
  DownloadSchedule,
  DownloadState,
  DownloadUpdate,
  FinishedDownload,
  NetworkInterfaceInfo,
  NetworkPreference,
  NetworkPreferences,
  NetworkMode,
  OnDownloadComplete,
  PendingLink,
  ProbeResult,
  SpeedUnit,
  ThemeSource,
  WhenQueueFinishes
} from '@shared/types'
import { create } from 'zustand'
import { fileNameFromPath, sourceOf } from '../utils/format'

export type DownloadFilter = 'all' | 'progress' | 'finished' | 'failed'

/** Which main tab is shown, as a download manager has: collect in the LinkGrabber, then start. */
export type MainTab = 'downloads' | 'grabber'

/** One link the LinkGrabber has collected: checked (probed), but not started yet. */
export interface GrabberLink {
  id: string
  url: string
  fileName: string
  host: string
  /** Null until the probe answers, or when the server didn't say. */
  totalBytes: number | null
  status: 'checking' | 'ready' | 'error'
  error?: string
  /** What the probe found, kept so starting it needs no second check. */
  probe?: ProbeResult
}

/** The column the LinkGrabber's queue is ordered by. Sorting reorders the queue itself, so the
 * order shown is the order links download in. */
export type GrabberSortKey = 'name' | 'size' | 'host' | 'status'
export interface GrabberSort {
  key: GrabberSortKey
  descending: boolean
}

/** Orders collected links by one column, leaving the given array alone. */
function sortGrabberLinks(links: GrabberLink[], { key, descending }: GrabberSort): GrabberLink[] {
  const value = (link: GrabberLink): number | string =>
    key === 'name'
      ? link.fileName.toLowerCase()
      : key === 'host'
        ? link.host.toLowerCase()
        : key === 'status'
          ? link.status
          : (link.totalBytes ?? 0)
  return [...links].sort((left, right) => {
    const a = value(left)
    const b = value(right)
    const order = typeof a === 'string' ? a.localeCompare(b as string) : a - (b as number)
    return descending ? -order : order
  })
}

/** What a download is by its file type, as IDM groups its list. `other` is the fallback: an
 * unknown extension, no extension, or a torrent's folder (which has none to read). */
export type DownloadCategory =
  'all' | 'video' | 'audio' | 'images' | 'documents' | 'archives' | 'programs' | 'other'

/** How the list is ordered inside each group. `default` keeps the order the app already uses
 * (oldest first while running, newest first once finished), so nothing moves until asked. */
export type DownloadSort = 'default' | 'name' | 'size' | 'date'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

/** What the window shows: the list of downloads, or one download. */
export type View = { name: 'list' } | { name: 'download'; id: string }

interface AppStore {
  interfaces: NetworkInterfaceInfo[]
  interfacesStatus: LoadStatus
  interfacesError: string | null
  /** User customizations (name/color) per network interface id — persisted in the main process. */
  networkPreferences: NetworkPreferences

  /** Persisted in the main process alongside nativeTheme.themeSource. */
  themeSource: ThemeSource

  homeDir: string
  downloadsDir: string

  /** Every download that isn't finished, by id — running, queued, paused or failed. */
  downloads: Record<string, DownloadState>
  /** Finished downloads, newest first (see main/download/history.ts). */
  history: FinishedDownload[]
  view: View
  downloadFilter: DownloadFilter
  setDownloadFilter: (filter: DownloadFilter) => void
  /** Narrows the list to one kind of file; `all` shows every kind. */
  downloadCategory: DownloadCategory
  setDownloadCategory: (category: DownloadCategory) => void
  /** Orders each group; view state like downloadFilter, so it resets on reload. */
  downloadSort: DownloadSort
  setDownloadSort: (sort: DownloadSort) => void
  /** Free text matched against a download's name, link and host. */
  downloadSearch: string
  setDownloadSearch: (search: string) => void
  /** Which main tab is shown. */
  mainTab: MainTab
  setMainTab: (tab: MainTab) => void
  /** Links collected by the LinkGrabber, oldest first. */
  grabber: GrabberLink[]
  /** How the queue is ordered, or null for the order links were added in. */
  grabberSort: GrabberSort | null
  /** Reorders the queue itself by a column; null restores the added order. */
  setGrabberSort: (sort: GrabberSort | null) => void
  /** Adds links and probes each; an entry is `checking` until its probe answers. */
  addToGrabber: (urls: string[]) => void
  removeFromGrabber: (ids: string[]) => void
  clearGrabber: () => void
  /** Moves a collected link one place up or down the grabber's order, which hands the queue
   * back to manual order (any column sort is dropped). */
  moveGrabberLink: (id: string, direction: 'up' | 'down') => void
  downloadSchedule: DownloadSchedule | undefined
  /** The New download dialog, over whatever the window shows. */
  newDownloadOpen: boolean
  /** Persisted — how many downloads run at once; the rest wait in the queue. */
  downloadsAtOnce: number
  /** Persisted — the speed limits (see AppSettings). */
  speedLimit: number | undefined
  slowMode: boolean
  slowModeSpeed: number
  /** Persisted — MB/s or Mbps, for every speed shown. */
  speedUnit: SpeedUnit
  /** Persisted — what happens after each download finishes, and once the queue empties. */
  onDownloadComplete: OnDownloadComplete
  whenQueueFinishes: WhenQueueFinishes
  /** Persisted — combine the picked networks on one download, or alternate one per download. */
  networkMode: NetworkMode

  /** Lifted out of the Idle screen so it survives a swap to/from the No-connections screen. */
  draftUrl: string
  /** Handed-over links stacked in New download, oldest first. */
  links: PendingLink[]
  /** Null while New download shows a link typed or pasted there instead. Links are named by
   * id, never by position: the list changes while a start is under way. */
  shownId: string | null
  /** Bumped to remount New download's form for another link. */
  formKey: number
  /** The link last started: still on the clipboard afterwards, so not offered again. */
  startedUrl: string
  /** Persisted — the last folder picked, falling back to downloadsDir. */
  destinationDir: string

  /** Asks the main process for the network list now; it also pushes every change. */
  loadInterfaces: () => Promise<void>
  receiveInterfaces: (interfaces: NetworkInterfaceInfo[]) => void
  setNetworkPreference: (id: string, patch: NetworkPreference) => void
  setThemeSource: (source: ThemeSource) => void
  /** A snapshot or an update of a download, from the main process. */
  receiveDownloadUpdate: (update: DownloadUpdate) => void
  /** Finished downloads as main lists them; any that finished leave `downloads`. */
  receiveHistory: (history: FinishedDownload[]) => void
  /** Drops a download from the window's view once the main process has removed it. */
  forgetDownload: (id: string) => void
  setView: (view: View) => void
  /** Opens New download, with `link` in its link field when one is given. */
  openNewDownload: (link?: string) => void
  closeNewDownload: () => void
  receiveLinks: () => Promise<void>
  showLink: (id: string) => void
  /** If it was the one shown, the newest left is shown, or New download closes. */
  finishLink: (id: string, started: boolean) => void
  /** Leaves what New download shows alone, the typed link included. */
  dropLink: (id: string, started: boolean) => void
  setDownloadsAtOnce: (count: number) => void
  /** Each one applies at once, to every download (see main/network/limits.ts). */
  setSpeedLimit: (bytesPerSec: number | undefined) => void
  setSlowMode: (on: boolean) => void
  setSlowModeSpeed: (bytesPerSec: number) => void
  setSpeedUnit: (unit: SpeedUnit) => void
  setOnDownloadComplete: (value: OnDownloadComplete) => void
  setWhenQueueFinishes: (value: WhenQueueFinishes) => void
  setNetworkMode: (mode: NetworkMode) => void
  setDraftUrl: (url: string) => void
  setDestinationDir: (dir: string) => void
}

// Settings saved by the main process, read once before the first paint (see InitialState).
const initial = window.gege.initialState

/** Every setting changes optimistically: the store is updated first so the UI feels instant,
 * then this saves it. The store stays the source of truth either way — a failed save just means
 * the change isn't remembered next launch. */
function persist(patch: AppSettings): void {
  window.gege.updateSettings(patch).catch(() => {})
}

/** Links let go here: a listing main sent before it heard so would bring them back. */
const letGo = new Set<string>()

export const useAppStore = create<AppStore>((set, get) => ({
  interfaces: [],
  interfacesStatus: 'idle',
  interfacesError: null,
  networkPreferences: initial.networkPreferences,
  themeSource: initial.themeSource,

  homeDir: initial.homeDir,
  downloadsDir: initial.downloadsDir,

  downloads: {},
  history: [],
  view: { name: 'list' },
  downloadFilter: 'all',
  setDownloadFilter: (downloadFilter) => set({ downloadFilter }),
  downloadCategory: 'all',
  setDownloadCategory: (downloadCategory) => set({ downloadCategory }),
  downloadSort: 'default',
  setDownloadSort: (downloadSort) => set({ downloadSort }),
  downloadSearch: '',
  setDownloadSearch: (downloadSearch) => set({ downloadSearch }),
  mainTab: 'downloads',
  setMainTab: (mainTab) => set({ mainTab }),
  grabber: [],
  grabberSort: null,
  setGrabberSort: (grabberSort) =>
    set((state) => ({
      grabberSort,
      grabber: grabberSort ? sortGrabberLinks(state.grabber, grabberSort) : state.grabber
    })),
  addToGrabber: (urls) => {
    for (const url of urls) {
      // Open each link and dig out the real download link(s) before listing it: a page URL that
      // hides the file behind a redirect, an attachment or an embedded player resolves here.
      void (async () => {
        let targets = [url]
        try {
          const resolved = await window.gege.resolveLinks(url)
          if (resolved.links.length > 0) targets = resolved.links.map((link) => link.url)
        } catch {
          // Keep the link as given; probing it reports whatever is wrong with it.
        }
        const known = new Set(get().grabber.map((link) => link.url))
        const fresh = targets.filter((target) => !known.has(target))
        if (fresh.length === 0) return
        const entries: GrabberLink[] = fresh.map((target) => ({
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          url: target,
          fileName: fileNameFromPath(target) || target,
          host: sourceOf(target),
          totalBytes: null,
          status: 'checking'
        }))
        const patch = (id: string, fields: Partial<GrabberLink>): void =>
          set((state) => {
            const grabber = state.grabber.map((link) =>
              link.id === id ? { ...link, ...fields } : link
            )
            return {
              grabber: state.grabberSort ? sortGrabberLinks(grabber, state.grabberSort) : grabber
            }
          })
        set((state) => {
          const grabber = [...state.grabber, ...entries]
          return {
            grabber: state.grabberSort ? sortGrabberLinks(grabber, state.grabberSort) : grabber,
            mainTab: 'grabber'
          }
        })
        // Check a few at a time: a page can yield hundreds, and probing them all at once would
        // open hundreds of sockets at the server.
        let next = 0
        const worker = async (): Promise<void> => {
          while (next < entries.length) {
            const entry = entries[next++]
            try {
              const probe = await window.gege.probeUrl(entry.url)
              patch(entry.id, {
                status: 'ready',
                probe,
                fileName: probe.suggestedFileName,
                totalBytes: probe.totalBytes,
                host: sourceOf(probe.finalUrl)
              })
            } catch (error) {
              patch(entry.id, {
                status: 'error',
                error: error instanceof Error ? error.message : String(error)
              })
            }
          }
        }
        await Promise.all(Array.from({ length: Math.min(6, entries.length) }, worker))
      })()
    }
  },
  removeFromGrabber: (ids) =>
    set((state) => ({ grabber: state.grabber.filter((link) => !ids.includes(link.id)) })),
  clearGrabber: () => set({ grabber: [] }),
  moveGrabberLink: (id, direction) =>
    set((state) => {
      const grabber = [...state.grabber]
      const from = grabber.findIndex((link) => link.id === id)
      if (from < 0) return {}
      const to = direction === 'up' ? from - 1 : from + 1
      if (to < 0 || to >= grabber.length) return {}
      const [moved] = grabber.splice(from, 1)
      grabber.splice(to, 0, moved)
      return { grabber, grabberSort: null }
    }),
  downloadSchedule: initial.downloadSchedule,
  newDownloadOpen: false,
  downloadsAtOnce: initial.downloadsAtOnce,
  speedLimit: initial.speedLimit,
  slowMode: initial.slowMode,
  slowModeSpeed: initial.slowModeSpeed,
  speedUnit: initial.speedUnit,
  onDownloadComplete: initial.onDownloadComplete,
  whenQueueFinishes: initial.whenQueueFinishes,
  networkMode: initial.networkMode,

  draftUrl: '',
  links: [],
  shownId: null,
  formKey: 0,
  startedUrl: '',
  destinationDir: initial.destinationDir ?? initial.downloadsDir,

  loadInterfaces: async () => {
    // A re-scan keeps showing the last result rather than flashing back to 'loading'.
    if (get().interfacesStatus !== 'ready') set({ interfacesStatus: 'loading' })
    set({ interfacesError: null })
    try {
      get().receiveInterfaces(await window.gege.listInterfaces())
    } catch (error) {
      set({
        interfacesStatus: 'error',
        interfacesError: error instanceof Error ? error.message : String(error)
      })
    }
  },

  receiveInterfaces: (interfaces) =>
    set({ interfaces, interfacesStatus: 'ready', interfacesError: null }),

  // An explicit `undefined` in `patch` clears that field; main drops an entry left with neither.
  setNetworkPreference: (id, patch) => {
    const networkPreferences = {
      ...get().networkPreferences,
      [id]: { ...get().networkPreferences[id], ...patch }
    }
    set({ networkPreferences })
    persist({ networkPreferences })
  },

  setThemeSource: (themeSource) => {
    set({ themeSource })
    persist({ themeSource })
  },

  receiveDownloadUpdate: (update) => {
    const { downloads, history } = get()
    // Finished already: an update that arrives late mustn't bring it back.
    if (history.some((entry) => entry.id === update.state.id)) return
    const previous = downloads[update.state.id] ?? null
    const download = applyDownloadUpdate(previous, update)
    if (!download || download === previous) return
    set({ downloads: { ...downloads, [download.id]: download } })
  },

  receiveHistory: (history) => {
    const downloads = { ...get().downloads }
    for (const entry of history) delete downloads[entry.id]
    set({ history, downloads })
  },

  forgetDownload: (id) => {
    const { [id]: removed, ...downloads } = get().downloads
    void removed
    set({ downloads, history: get().history.filter((entry) => entry.id !== id) })
  },

  setView: (view) => set({ view }),

  openNewDownload: (link) =>
    set(link === undefined ? { newDownloadOpen: true } : { newDownloadOpen: true, draftUrl: link }),

  closeNewDownload: () => {
    const { links, shownId } = get()
    if (shownId) return get().finishLink(shownId, false)
    if (links.length > 0) return get().showLink(links[links.length - 1].id)
    set({ newDownloadOpen: false })
  },

  receiveLinks: async () => {
    // main lists every link still waiting, so a window that was closed or reloaded gets them back.
    const pending = await window.gege.pendingLinks().catch(() => [])
    const known = new Set(get().links.map((link) => link.id))
    const arrived = pending.filter((link) => !known.has(link.id) && !letGo.has(link.id))
    if (arrived.length === 0) return
    set({ links: [...get().links, ...arrived], newDownloadOpen: true })
    get().showLink(arrived[arrived.length - 1].id)
  },

  showLink: (id) => {
    const link = get().links.find((candidate) => candidate.id === id)
    if (link) set({ shownId: id, draftUrl: link.url, formKey: get().formKey + 1 })
  },

  finishLink: (id, started) => {
    const wasShown = get().shownId === id
    get().dropLink(id, started)
    if (!wasShown) return
    const left = get().links
    set({ draftUrl: '' })
    if (left.length > 0) get().showLink(left[left.length - 1].id)
    else set({ newDownloadOpen: false })
  },

  dropLink: (id, started) => {
    const { links, shownId } = get()
    if (!links.some((link) => link.id === id)) return
    letGo.add(id)
    // Started, main has already forgotten its sign-in.
    if (!started) void window.gege.dismissLink(id).catch(() => {})
    set({
      links: links.filter((link) => link.id !== id),
      ...(shownId === id && { shownId: null })
    })
  },

  setDownloadsAtOnce: (downloadsAtOnce) => {
    set({ downloadsAtOnce })
    persist({ downloadsAtOnce })
  },

  setSpeedLimit: (speedLimit) => {
    set({ speedLimit })
    persist({ speedLimit })
  },

  setSlowMode: (slowMode) => {
    set({ slowMode })
    persist({ slowMode })
  },

  setSlowModeSpeed: (slowModeSpeed) => {
    set({ slowModeSpeed })
    persist({ slowModeSpeed })
  },

  setSpeedUnit: (speedUnit) => {
    set({ speedUnit })
    persist({ speedUnit })
  },

  setOnDownloadComplete: (onDownloadComplete) => {
    set({ onDownloadComplete })
    persist({ onDownloadComplete })
  },

  setWhenQueueFinishes: (whenQueueFinishes) => {
    set({ whenQueueFinishes })
    persist({ whenQueueFinishes })
  },

  setNetworkMode: (networkMode) => {
    set({ networkMode })
    persist({ networkMode })
  },

  setDraftUrl: (draftUrl) => set({ draftUrl }),
  setDestinationDir: (destinationDir) => {
    set({ destinationDir })
    persist({ destinationDir })
  }
}))
