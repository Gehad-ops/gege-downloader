import { Search, X } from 'lucide-react'
import { Input } from './ui/input'

/** Free-text filter over the list: a download's name, its link, or its host. */
export function DownloadSearchInput({
  value,
  onChange
}: {
  value: string
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <div className="relative flex h-9 w-[260px] max-w-[40vw] min-w-[7rem] shrink items-center">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 size-[15px] text-[var(--text-tertiary)]"
      />
      <Input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Filter the list..."
        aria-label="Search downloads"
        spellCheck={false}
        className="h-9 rounded-[10px] border-[var(--card-border)] bg-[var(--card)] pr-8 pl-9 text-[13px] shadow-none"
      />
      {value.length > 0 && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-2 rounded p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
