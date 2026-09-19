/**
 * Impact / effort / confidence indicators.
 *
 * Deliberately never a number, a bar or a percentage — those read as a score,
 * which is the one thing this product does not produce. A word plus a shape,
 * so the meaning never depends on colour alone (§42).
 */

import type { Confidence, Effort, Impact } from '@/lib/analysis/types';
import { CONFIDENCE_LABEL, EFFORT_LABEL, IMPACT_LABEL } from '@/lib/analysis/pipeline';

function Chip({ label, tone, glyph }: { label: string; tone: string; glyph: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      <span aria-hidden className="shrink-0">{glyph}</span>
      {label}
    </span>
  );
}

/** Three filled bars for high, two for medium, one for low. */
function Bars({ level, className }: { level: 1 | 2 | 3; className: string }) {
  return (
    <span className="flex items-end gap-[2px]" aria-hidden>
      {([1, 2, 3] as const).map((i) => (
        <span
          key={i}
          className={`w-[3px] rounded-[1px] ${i <= level ? className : 'bg-current opacity-25'}`}
          style={{ height: `${4 + i * 2}px` }}
        />
      ))}
    </span>
  );
}

export function ImpactIndicator({ impact }: { impact: Impact }) {
  const map = {
    high: { tone: 'bg-accent-wash text-accent-ink', level: 3 as const },
    medium: { tone: 'bg-sunken text-ink-muted', level: 2 as const },
    low: { tone: 'bg-sunken text-ink-subtle', level: 1 as const },
  }[impact];
  return <Chip label={IMPACT_LABEL[impact]} tone={map.tone} glyph={<Bars level={map.level} className="bg-current" />} />;
}

export function EffortIndicator({ effort }: { effort: Effort }) {
  const glyph = { easy: '○', moderate: '◑', involved: '●' }[effort];
  return (
    <Chip
      label={EFFORT_LABEL[effort]}
      tone="bg-sunken text-ink-muted"
      glyph={<span className="text-[10px] leading-none">{glyph}</span>}
    />
  );
}

export function ConfidenceIndicator({ confidence }: { confidence: Confidence }) {
  const map = {
    high: { tone: 'bg-good-wash text-good-ink', level: 3 as const },
    medium: { tone: 'bg-sunken text-ink-muted', level: 2 as const },
    low: { tone: 'bg-warn-wash text-warn-ink', level: 1 as const },
  }[confidence];
  return (
    <Chip
      label={CONFIDENCE_LABEL[confidence]}
      tone={map.tone}
      glyph={<Bars level={map.level} className="bg-current" />}
    />
  );
}
