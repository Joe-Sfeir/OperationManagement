import { provenance, type ProvenanceTag } from './tokens';

/**
 * Provenance badge shown next to every number (hard rule 2, bible rule 5).
 * Neutral on purpose: the letter carries the meaning. S (estimate) is dashed
 * so it reads as less certain without adding a colour.
 */
export function SourceBadge({ tag, title }: { tag: ProvenanceTag; title?: string }) {
  const p = provenance[tag];
  return (
    <abbr
      title={title ?? p.label}
      aria-label={`Source: ${p.label}`}
      className={[
        'num inline-flex h-4 w-4 items-center justify-center rounded-control border text-12 leading-none no-underline',
        p.dashed ? 'border-dashed border-textMuted text-textMuted' : 'border-hairlineStrong text-text',
      ].join(' ')}
    >
      {tag}
    </abbr>
  );
}
