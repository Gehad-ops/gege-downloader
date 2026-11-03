import { cn } from 'cn'
import {
  ChevronDown,
  ChevronUp,
  Link2,
  ListPlus,
  Play,
  Trash2,
  X,
  type LucideIcon
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useAppStore, type GrabberSortKey } from '../store/useAppStore'
import { acceptedLinks, formatBytes } from '../utils/format'
import { Button } from '../components/ui/button'
import { Checkbox } from '../components/ui/checkbox'
import { Input } from '../components/ui/input'

// JDownloader's LinkGrabber: links are collected and checked here first. Nothing downloads until
// "Download" hands the selected ones to New download, where the folder, networks and Alternate are
// chosen.

const GRID = 'grid grid-cols-[24px_44px_minmax(180px,1fr)_110px_130px_96px] items-center gap-4'

function GrabberButton({
  icon: Icon,
  label,
  disabled,
  onClick
}: {
  icon?: LucideIcon
  label: string
  disabled?: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 items-center gap-2 rounded-[10px] border border-[var(--card-border)] bg-[var(--card)] px-3.5 text-[13px] font-medium text-[var(--text)] outline-none hover:bg-[var(--hover-bg)] disabled:pointer-events-none disabled:opacity-40"
    >
      {Icon && <Icon aria-hidden className="size-4" />}
      {label}
    </button>
  )
}

export function LinkGrabberView(): React.JSX.Element {
  const grabber = useAppStore((store) => store.grabber)
  const sort = useAppStore((store) => store.grabberSort)
  const setGrabberSort = useAppStore((store) => store.setGrabberSort)
  const addToGrabber = useAppStore((store) => store.addToGrabber)
  const removeFromGrabber = useAppStore((store) => store.removeFromGrabber)
  const clearGrabber = useAppStore((store) => store.clearGrabber)
  const moveGrabberLink = useAppStore((store) => store.moveGrabberLink)
  const openNewDownload = useAppStore((store) => store.openNewDownload)
  const [draft, setDraft] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<string | null>(null)
  // Shift-click selects everything between the last plain click and this one.
  const anchorId = useRef<string | null>(null)
  const shiftPressed = useRef(false)

  // The queue is already in the shown order: sorting reorders it in the store, so what is
  // shown is also what downloads first.
  const display = grabber

  const toggleSort = (key: GrabberSortKey): void =>
    setGrabberSort(
      sort?.key === key ? { key, descending: !sort.descending } : { key, descending: false }
    )

  /** A column header: click to sort by it, click again to reverse. */
  const header = (label: string, key: GrabberSortKey): React.JSX.Element => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className="flex items-center gap-1 text-left outline-none hover:text-[var(--text)] focus-visible:text-[var(--text)]"
    >
      {label}
      <span className={cn('text-[9px]', sort?.key === key ? 'opacity-100' : 'opacity-0')}>
        {sort?.descending ? '▼' : '▲'}
      </span>
    </button>
  )

  const toggle = (id: string, on: boolean): void =>
    setSelected((previous) => {
      const next = new Set(previous)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  /** Selects one row, or with Shift every row between the anchor and it. */
  const selectRow = (id: string, on: boolean): void => {
    const anchor = anchorId.current
    const from = anchor === null ? -1 : display.findIndex((link) => link.id === anchor)
    const to = display.findIndex((link) => link.id === id)
    if (!shiftPressed.current) {
      anchorId.current = id
      toggle(id, on)
      return
    }
    shiftPressed.current = false
    if (from < 0 || to < 0) {
      toggle(id, on)
      return
    }
    const [start, end] = from < to ? [from, to] : [to, from]
    setSelected((previous) => {
      const next = new Set(previous)
      for (let index = start; index <= end; index += 1) next.add(display[index].id)
      return next
    })
  }

  const addFromDraft = (): void => {
    const links = acceptedLinks(draft)
    if (links.length === 0) return
    addToGrabber(links)
    setDraft('')
  }

  /** Read the first link's page and collect every link it points at. */
  const grabPage = async (): Promise<void> => {
    const [target] = acceptedLinks(draft)
    if (!target) return
    setStatus('Reading the page…')
    try {
      const page = await window.plexo.extractLinks(target)
      addToGrabber(page.links.map((link) => link.url))
      setDraft('')
      setStatus(`Found ${page.links.length} links${page.title ? ` on “${page.title}”` : ''}.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    }
  }

  /** Crawl the link's site for files when one page holds none (JDownloader's deep analysis). */
  const deepAnalyze = async (): Promise<void> => {
    const targets = acceptedLinks(draft)
    if (targets.length === 0) return
    setStatus('Crawling the site…')
    let total = 0
    for (const target of targets) {
      try {
        const result = await window.plexo.deepResolve(target)
        if (result.links.length > 0) {
          addToGrabber(result.links.map((link) => link.url))
          total += result.links.length
        }
      } catch {
        // Move on to the next target.
      }
    }
    setDraft('')
    setStatus(total > 0 ? `Found ${total} files.` : 'Nothing found on that site.')
  }

  /** Hands the selected links to New download, so the folder, networks and Alternate are chosen
   * there — with the same controls any other download gets — before anything is queued. */
  const downloadSelected = (): void => {
    const chosen = grabber.filter((link) => selected.has(link.id))
    if (chosen.length === 0) return
    removeFromGrabber(chosen.map((link) => link.id))
    setSelected(new Set())
    openNewDownload(chosen.map((link) => link.url).join('\n'))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addFromDraft()
            }
          }}
          placeholder="Paste one link or a list of links"
          aria-label="Links to add"
          spellCheck={false}
          className="h-9 min-w-[200px] flex-1 rounded-[10px] border-[var(--card-border)] bg-[var(--card)] font-mono text-[12.5px]"
        />
        <GrabberButton icon={ListPlus} label="Add links" onClick={addFromDraft} />
        <GrabberButton label="Grab page" onClick={() => void grabPage()} />
        <GrabberButton label="Deep analysis" onClick={() => void deepAnalyze()} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={downloadSelected}
            className="accent-gradient flex h-9 items-center gap-2 rounded-[10px] px-3.5 text-[13px] font-semibold text-[#06231f] outline-none hover:opacity-95 disabled:pointer-events-none disabled:opacity-40"
          >
            <Play aria-hidden className="size-4" />
            Download{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
          <GrabberButton
            label="Remove"
            disabled={selected.size === 0}
            onClick={() => {
              removeFromGrabber([...selected])
              setSelected(new Set())
            }}
          />
          <GrabberButton
            icon={Trash2}
            label="Clear"
            disabled={grabber.length === 0}
            onClick={() => {
              clearGrabber()
              setSelected(new Set())
            }}
          />
        </div>
      </div>

      {status && <div className="shrink-0 text-[12px] text-[var(--text-secondary)]">{status}</div>}

      {grabber.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-[18px] border border-[var(--card-border)] bg-[var(--card)] px-6 py-16 text-center">
          <p className="text-[18px] font-semibold">No links yet</p>
          <p className="max-w-[420px] text-[13px] leading-[1.6] text-[var(--text-secondary)]">
            Paste links above (one or many), or use Grab page to collect everything a page points
            at. They’re checked here, then Download opens New download to set the folder, networks
            and Alternate.
          </p>
        </div>
      ) : (
        <div role="table" className="min-h-0 flex-1 overflow-auto">
          <div className="min-w-[820px] px-1 pb-4">
            <div
              role="row"
              className={cn(
                GRID,
                'sticky top-0 z-10 px-4 py-2 text-[11px] font-semibold tracking-[0.08em] text-[var(--text-tertiary)] uppercase'
              )}
              style={{ background: 'var(--bg)' }}
            >
              <Checkbox
                aria-label="Select all links"
                checked={grabber.length > 0 && selected.size === grabber.length}
                indeterminate={selected.size > 0 && selected.size < grabber.length}
                onCheckedChange={(on) => {
                  anchorId.current = null
                  setSelected(on ? new Set(display.map((link) => link.id)) : new Set())
                }}
              />
              <span aria-hidden />
              {header('File Name', 'name')}
              {header('Size', 'size')}
              {header('Status', 'status')}
              <span aria-hidden />
            </div>
            <div className="flex flex-col gap-0.5">
              {display.map((link, index) => (
                <div
                  role="row"
                  key={link.id}
                  data-selected={selected.has(link.id) || undefined}
                  className={cn(
                    GRID,
                    'cursor-default rounded-[14px] border px-4 py-3',
                    selected.has(link.id)
                      ? 'border-[var(--active-ring)] bg-[var(--card)]'
                      : 'border-transparent hover:border-[var(--card-border)] hover:bg-[var(--card)]'
                  )}
                >
                  <Checkbox
                    aria-label={`Select ${link.fileName}`}
                    checked={selected.has(link.id)}
                    onPointerDown={(event) => {
                      shiftPressed.current = event.shiftKey
                    }}
                    onCheckedChange={(on) => selectRow(link.id, on)}
                  />
                  <span
                    aria-hidden
                    className="grid size-11 place-items-center rounded-[12px]"
                    style={{
                      background: 'var(--type-documents-bg)',
                      color: 'var(--type-documents-text)'
                    }}
                  >
                    <Link2 className="size-5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold" title={link.url}>
                      {link.fileName}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[12px] text-[var(--text-tertiary)]">
                      {link.host}
                    </span>
                  </span>
                  <span className="font-mono text-[12px] text-[var(--text-secondary)] tabular-nums">
                    {link.totalBytes !== null ? formatBytes(link.totalBytes) : '—'}
                  </span>
                  <span
                    className="flex h-6 w-max items-center rounded-full px-2.5 text-[12px] font-medium"
                    style={
                      link.status === 'error'
                        ? {
                            background: 'var(--status-error-bg)',
                            color: 'var(--status-error-text)'
                          }
                        : link.status === 'checking'
                          ? {
                              background: 'var(--status-paused-bg)',
                              color: 'var(--status-paused-text)'
                            }
                          : {
                              background: 'var(--status-finished-bg)',
                              color: 'var(--status-finished-text)'
                            }
                    }
                    title={link.error}
                  >
                    {link.status === 'checking'
                      ? 'Checking'
                      : link.status === 'error'
                        ? 'Error'
                        : 'Ready'}
                  </span>
                  <div className="flex items-center justify-end gap-0.5">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Move ${link.fileName} up`}
                      disabled={index === 0}
                      onClick={() => moveGrabberLink(link.id, 'up')}
                      className="text-[var(--text-secondary)]"
                    >
                      <ChevronUp />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Move ${link.fileName} down`}
                      disabled={index === display.length - 1}
                      onClick={() => moveGrabberLink(link.id, 'down')}
                      className="text-[var(--text-secondary)]"
                    >
                      <ChevronDown />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove ${link.fileName}`}
                      onClick={() => removeFromGrabber([link.id])}
                      className="text-[var(--text-secondary)]"
                    >
                      <X />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
