import { TITLE_BAR_HEIGHT } from '../theme'

const isMac = window.gege.platform === 'darwin'

/** The window's title bar, the same on every OS: the mark and name at the left, on a strip the
 * window is dragged by. The OS's own controls sit over it (see main/index.ts). */
export function TitleBar({ onEpic }: { onEpic?: () => void }): React.JSX.Element {
  return (
    <div
      style={{ height: TITLE_BAR_HEIGHT }}
      className={`flex shrink-0 items-center border-b border-[var(--border-subtle)] bg-[var(--bg)] [-webkit-app-region:drag] ${
        isMac ? 'pr-3 pl-[94px]' : 'pr-[140px] pl-3.5'
      }`}
    >
      <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text-secondary)]">
        <span
          aria-hidden
          className="size-3.5 rounded-[5px] bg-[linear-gradient(135deg,var(--chart-teal),var(--chart-blue))]"
        />
        Gege Downloader
      </div>
      {onEpic && (
        <button
          onClick={onEpic}
          className="ml-3 rounded px-2 py-0.5 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          Epic
        </button>
      )}
    </div>
  )
}
