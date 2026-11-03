import type { SpeedUnit } from '@shared/types'
import { cn } from 'cn'
import { useFormatSpeed, useFormatSpeedLimit } from '../hooks/useFormatSpeed'
import { useDownloadSchedule } from '../hooks/useDownloadSchedule'
import { useAppStore } from '../store/useAppStore'
import { ThemeToggle } from './ThemeToggle'
import { Switch } from './ui/switch'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { UpdateIndicator } from './UpdateIndicator'

/** MB/s or Mbps for every speed in the app; a view preference, so it lives in the footer. */
function SpeedUnitToggle(): React.JSX.Element {
  const speedUnit = useAppStore((store) => store.speedUnit)
  const setSpeedUnit = useAppStore((store) => store.setSpeedUnit)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <ToggleGroup
            aria-label="Speed units"
            value={[speedUnit]}
            onValueChange={(values) => {
              // Clicking the pressed one would unpress it; one unit is always on.
              if (values[0] !== undefined) setSpeedUnit(values[0] as SpeedUnit)
            }}
            size="xs"
            spacing={0.5}
            className="h-7 rounded-[8px] border border-[var(--card-border)] bg-[var(--card)] p-0.5 [-webkit-app-region:no-drag]"
          >
            {(['bytes', 'bits'] as const).map((unit) => (
              <ToggleGroupItem
                key={unit}
                value={unit}
                className="h-full rounded-[6px] px-2 font-mono text-[11px] font-medium text-[var(--text-secondary)] aria-pressed:bg-[var(--bg-tertiary)] aria-pressed:text-[var(--text)]"
              >
                {unit === 'bytes' ? 'MB/s' : 'Mbps'}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      />
      <TooltipContent>Speed units</TooltipContent>
    </Tooltip>
  )
}

/** Along the bottom of the window: what is moving now, and the set-once view preferences. */
export function StatusBar(): React.JSX.Element {
  const formatSpeed = useFormatSpeed()
  const formatSpeedLimit = useFormatSpeedLimit()
  const { message } = useDownloadSchedule()
  const active = useAppStore(
    (store) => Object.values(store.downloads).filter((d) => d.status === 'downloading').length
  )
  const totalSpeed = useAppStore((store) =>
    Object.values(store.downloads).reduce(
      (sum, download) =>
        sum +
        (download.status === 'downloading'
          ? download.networks.reduce(
              (networkSum, network) => networkSum + network.speedBytesPerSec,
              0
            )
          : 0),
      0
    )
  )
  const slowMode = useAppStore((store) => store.slowMode)
  const slowModeSpeed = useAppStore((store) => store.slowModeSpeed)
  const setSlowMode = useAppStore((store) => store.setSlowMode)

  return (
    <footer className="flex h-10 shrink-0 items-center justify-between gap-4 border-t border-[var(--border-subtle)] bg-[var(--panel)] px-[18px] text-[12px] text-[var(--text-secondary)]">
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className={cn(
            'size-2 shrink-0 rounded-full',
            active > 0 ? 'live-dot' : 'bg-[var(--text-tertiary)]'
          )}
        />
        <span className="truncate">
          {active > 0 ? `${active} active · ${formatSpeed(totalSpeed)}` : 'No active downloads'}
        </span>
        {message && (
          <>
            <span className="text-[var(--text-tertiary)]">·</span>
            <span className="truncate text-[var(--text-tertiary)]">{message}</span>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <UpdateIndicator />
        <Tooltip>
          <TooltipTrigger
            render={
              <label className="flex items-center gap-2">
                Slow mode
                <Switch checked={slowMode} onCheckedChange={setSlowMode} />
              </label>
            }
          />
          <TooltipContent>Limit downloads to {formatSpeedLimit(slowModeSpeed)}</TooltipContent>
        </Tooltip>
        <SpeedUnitToggle />
        <ThemeToggle />
      </div>
    </footer>
  )
}
