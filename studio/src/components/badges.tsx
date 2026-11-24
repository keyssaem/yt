import { OWNER_LABEL, type Owner } from '../lib/stages'
import { SERIES, type SeriesName } from '../lib/meta'

export function OwnerBadge({ owner, className = '' }: { owner: Owner; className?: string }) {
  const style =
    owner === 'human'
      ? 'bg-accent/15 text-accent border-accent/40'
      : 'bg-fact/15 text-fact border-fact/40'
  return (
    <span className={`inline-flex items-center shrink-0 whitespace-nowrap px-1.5 py-0.5 rounded border text-[11px] font-semibold ${style} ${className}`}>
      {OWNER_LABEL[owner]}
    </span>
  )
}

export function SeriesDot({ series }: { series: SeriesName }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className="w-2 h-2 rounded-full" style={{ background: SERIES[series].color }} />
      {series}
    </span>
  )
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-1 rounded bg-line overflow-hidden">
      <div className="h-full bg-accent" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  )
}
