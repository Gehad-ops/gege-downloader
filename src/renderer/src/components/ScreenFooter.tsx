import { cn } from 'cn'

/** The bottom bar every screen ends on — border, background and padding are fixed, `className`
 * only tunes per-screen gap/alignment. */
export function ScreenFooter({
  className,
  children
}: {
  className?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-3 border-t border-t-[var(--border-subtle)] bg-[var(--panel)] px-[18px] py-1.5',
        className
      )}
    >
      {children}
    </div>
  )
}
