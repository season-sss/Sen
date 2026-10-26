import { cn } from '@/lib/cn';
import { useState } from 'react';

export function ProgressBar({ value, className, tone = 'lavender', label }: { value: number; className?: string; tone?: 'lavender' | 'sky' | 'success' | 'warning'; label?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const color = { lavender: 'bg-lavender', sky: 'bg-sky', success: 'bg-success', warning: 'bg-warning' }[tone];
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-2', className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn('h-full rounded-full transition-[width] duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export interface RingSegment {
  value: number;
  color: string;
  label: string;
}

/** Interactive progress ring: hover/tap a segment (or focus with keyboard) to see its label. */
export function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  segments,
  center,
  caption,
}: {
  value?: number;
  size?: number;
  stroke?: number;
  segments?: RingSegment[];
  center?: React.ReactNode;
  caption?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const segs = segments ?? [{ value: value ?? 0, color: 'rgb(var(--lavender))', label: `${Math.round((value ?? 0) * 100)}%` }];
  const [active, setActive] = useState<number | null>(null);
  let offset = 0;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={caption ?? segs.map((s) => s.label).join(', ')}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth={stroke} />
        {segs.map((s, i) => {
          const len = Math.max(0, Math.min(1, s.value)) * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={active === i ? stroke + 3 : stroke}
              strokeLinecap={segs.length === 1 ? 'round' : 'butt'}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              className="cursor-pointer transition-all duration-500 focus:outline-none"
              tabIndex={segs.length > 1 ? 0 : -1}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onClick={() => setActive(active === i ? null : i)}
            >
              <title>{s.label}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        {active !== null ? <span className="px-2 text-xs font-semibold text-ink">{segs[active].label}</span> : center}
      </div>
    </div>
  );
}
