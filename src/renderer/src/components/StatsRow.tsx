import { cn } from 'cn'
import { useAppStore } from '../store/useAppStore'
import { formatSpeed } from '../utils/format'

const SAMPLES = 24

/** The live speed card: the total now, and the last few seconds as a filled sparkline. */
function LiveSpeedCard(): React.JSX.Element {
  const downloads = useAppStore((store) => store.downloads)
  const speedUnit = useAppStore((store) => store.speedUnit)

  const active = Object.values(downloads).filter((download) => download.status === 'downloading')
  const total = active.reduce(
    (sum, download) =>
      sum +
      download.networks.reduce((networkSum, network) => networkSum + network.speedBytesPerSec, 0),
    0
  )

  // Each series' newest sample is now, so line them up from the right before adding them.
  const series = active.flatMap((download) =>
    Object.values(download.speedHistory ?? {}).map((history) => history.slice(-SAMPLES))
  )
  const points = Array.from({ length: SAMPLES }, (_, index) =>
    series.reduce((sum, history) => sum + (history[index] ?? 0), 0)
  )

  const width = 320
  const height = 84
  const top = Math.max(1, ...points)
  const step = width / (SAMPLES - 1)
  const line = points
    .map((value, index) => {
      const x = index * step
      const y = height - 2 - (value / top) * (height - 4)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const area = `0,${height} ${line} ${width},${height}`

  const formatted = formatSpeed(total, speedUnit)
  const split = formatted.lastIndexOf(' ')
  const value = split > 0 ? formatted.slice(0, split) : formatted
  const unit = split > 0 ? formatted.slice(split + 1) : ''

  return (
    <div
      className="relative h-[168px] overflow-hidden rounded-[18px] border border-[var(--card-border)] p-5"
      style={{ background: 'var(--live-card-bg)' }}
    >
      <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--text-secondary)]">
        <span className="live-dot size-2 rounded-full" aria-hidden />
        Live speed
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-mono text-[40px] leading-none font-semibold tracking-[-0.03em]">
          {value}
        </span>
        <span className="text-[14px] text-[var(--text-secondary)]">{unit}</span>
      </div>
      <svg
        className="absolute inset-x-0 bottom-0 h-[84px] w-full"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="gege-live-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--chart-teal)" stopOpacity={0.35} />
            <stop offset="1" stopColor="var(--chart-teal)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#gege-live-fill)" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--chart-teal)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  tone
}: {
  label: string
  value: number
  sub: string
  tone?: string
}): React.JSX.Element {
  return (
    <div className="flex h-[168px] flex-col justify-between rounded-[18px] border border-[var(--card-border)] bg-[var(--card)] px-[22px] py-5">
      <div className="text-[12px] font-medium text-[var(--text-secondary)]">{label}</div>
      <div
        className={cn('font-mono text-[40px] leading-none font-semibold tracking-[-0.03em]', tone)}
      >
        {value}
      </div>
      <div className="text-[12px] text-[var(--text-secondary)]">{sub}</div>
    </div>
  )
}

/** The four cards over the list: what's moving now, and the three states at a glance. */
export function StatsRow({
  active,
  finished,
  errors
}: {
  active: number
  finished: number
  errors: number
}): React.JSX.Element {
  return (
    <div className="stats-row flex gap-4 overflow-x-auto pb-0.5">
      <div className="min-w-[300px] flex-[1.9]">
        <LiveSpeedCard />
      </div>
      <div className="min-w-[150px] flex-1">
        <StatCard label="Active" value={active} sub="Unfinished downloads" />
      </div>
      <div className="min-w-[150px] flex-1">
        <StatCard
          label="Finished"
          value={finished}
          sub="Completed downloads"
          tone="text-[var(--color-success)]"
        />
      </div>
      <div className="min-w-[150px] flex-1">
        <StatCard
          label="Errors"
          value={errors}
          sub={errors === 0 ? 'All clear' : 'Need attention'}
          tone={errors > 0 ? 'text-[var(--color-danger)]' : undefined}
        />
      </div>
    </div>
  )
}
