import { Menu } from '@base-ui/react/menu'
import { Check, ChevronDown, ListFilter } from 'lucide-react'
import type { DownloadCategory } from '../store/useAppStore'
import { CATEGORIES } from '../utils/categories'

/** Narrows the list to one kind of file, the way IDM's category folders do. Mirrors
 * DownloadFilterMenu's shape so the two read as siblings. */
export function DownloadCategoryMenu({
  value,
  counts,
  onChange
}: {
  value: DownloadCategory
  counts: Record<DownloadCategory, number>
  onChange: (value: DownloadCategory) => void
}): React.JSX.Element {
  const label = CATEGORIES.find((category) => category.value === value)!.label
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Filter by type: ${label}`}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 font-sans text-[13px] leading-none font-medium text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:text-foreground"
      >
        <ListFilter aria-hidden className="size-3.5" />
        {label}
        <ChevronDown aria-hidden className="size-3.5 opacity-70" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="start" sideOffset={8} className="isolate z-50">
          <Menu.Popup className="w-52 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg outline-none">
            <Menu.RadioGroup
              value={value}
              onValueChange={onChange}
              aria-label="Filter by type"
              className="flex flex-col gap-0.5"
            >
              {CATEGORIES.map((category) => (
                <Menu.RadioItem
                  key={category.value}
                  value={category.value}
                  label={category.label}
                  closeOnClick
                  className="flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] outline-none data-checked:bg-muted data-highlighted:bg-muted"
                >
                  <span className="size-4 shrink-0">
                    <Menu.RadioItemIndicator>
                      <Check aria-hidden className="size-4 text-primary" />
                    </Menu.RadioItemIndicator>
                  </span>
                  <span className="flex-1">{category.label}</span>
                  <span className="font-mono text-[11.5px] text-muted-foreground tabular-nums">
                    {counts[category.value]}
                  </span>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
