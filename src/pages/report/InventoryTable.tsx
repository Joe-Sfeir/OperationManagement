/**
 * Data inventory: every row of data/NTG_Data_Inventory_v1.xlsx, searchable and
 * filterable, so any number in the twin can be traced to where it came from.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { SourceBadge } from '../../design/SourceBadge';
import { provenance, type ProvenanceTag } from '../../design/tokens';
import { inventoryRows, inventorySources, type InventoryRow } from '../../data/params';
import { Button } from '../../ui/kit';
import { T, Td } from './parts';

const TAGS: ProvenanceTag[] = ['N', 'V', 'C', 'S'];
const STAGES = [...new Set(inventoryRows.map((r) => r.stage))];
const haystack = (r: InventoryRow) => [r.row, r.stage, r.parameter, r.value, r.unit, r.status, r.source, r.confidence, r.usedIn, r.replacedBy, r.notes].join(' ').toLowerCase();
const HAY = new Map(inventoryRows.map((r) => [r.row, haystack(r)]));

export function InventoryTable({ focus }: { focus: { row: number; n: number } | null }) {
  const uid = useId();
  const [q, setQ] = useState('');
  const [tags, setTags] = useState<ProvenanceTag[]>([]);
  const [stage, setStage] = useState('');
  const [marked, setMarked] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return inventoryRows.filter((r) => {
      if (tags.length > 0 && !tags.includes(r.tag as ProvenanceTag)) return false;
      if (stage && r.stage !== stage) return false;
      const h = HAY.get(r.row)!;
      return words.every((w) => (/^#?\d+$/.test(w) ? String(r.row) === w.replace('#', '') || h.includes(w) : h.includes(w)));
    });
  }, [q, tags, stage]);

  // A row reference elsewhere in the report was pressed: clear the filters and show that row.
  useEffect(() => {
    if (!focus) return;
    setQ('');
    setTags([]);
    setStage('');
    setMarked(focus.row);
    const t = window.setTimeout(() => {
      const el = document.getElementById(`inv-row-${focus.row}`);
      const box = scroller.current;
      if (!el || !box) return;
      box.scrollIntoView({ block: 'start' });
      box.scrollTop = Math.max(0, el.offsetTop - 48);
      el.focus({ preventScroll: true });
    }, 30);
    return () => window.clearTimeout(t);
  }, [focus]);

  const counts = useMemo(() => Object.fromEntries(TAGS.map((t) => [t, inventoryRows.filter((r) => r.tag === t).length])) as Record<ProvenanceTag, number>, []);
  const filtered = q !== '' || tags.length > 0 || stage !== '';
  const toggle = (t: ProvenanceTag) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
    <div>
      <div className="rp-controls flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="grid min-w-[220px] flex-1 gap-1 md:max-w-[360px]">
          <label htmlFor={`${uid}-q`} className="text-12 text-textMuted">
            Search the inventory (a word, a number or a row)
          </label>
          <input
            id={`${uid}-q`}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="oven, 28.5, Form 2, row number"
            className="rounded-control border border-hairlineStrong bg-canvas px-2.5 py-1.5 text-14 text-text placeholder:text-textFaint"
          />
        </div>
        <fieldset className="grid gap-1">
          <legend className="text-12 text-textMuted">Source tag</legend>
          <div className="flex flex-wrap gap-1.5">
            {TAGS.map((t) => (
              <Button key={t} active={tags.includes(t)} aria-pressed={tags.includes(t)} onClick={() => toggle(t)} title={provenance[t].label} className="!py-1.5">
                <span className="num">{t}</span> {provenance[t].label.split(' ')[0]} <span className="num">{counts[t]}</span>
              </Button>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-1">
          <label htmlFor={`${uid}-stage`} className="text-12 text-textMuted">
            Stage
          </label>
          <select id={`${uid}-stage`} value={stage} onChange={(e) => setStage(e.target.value)} className="max-w-[260px] rounded-control border border-hairlineStrong bg-canvas px-2 py-1.5 text-14 text-text">
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <Button
          onClick={() => {
            setQ('');
            setTags([]);
            setStage('');
            setMarked(null);
          }}
          disabled={!filtered}
          className="!py-1.5"
        >
          Clear filters
        </Button>
      </div>
      <p className="mt-2 text-12 text-textMuted" role="status" aria-live="polite">
        Showing <span className="num text-text">{rows.length}</span> of <span className="num text-text">{inventoryRows.length}</span> rows.
        {rows.length === 0 ? ' Nothing matches: clear a filter.' : ''}
      </p>

      <div
        ref={scroller}
        role="region"
        aria-label="Data inventory table. Scroll with the arrow keys"
        tabIndex={0}
        className={`${T.wrap} rp-scroll relative mt-2 max-h-[70vh] scroll-mt-4 overflow-auto`}
      >
        <table className={T.table}>
          <caption className="sr-only">Data inventory: every parameter with its value, source tag, source, confidence and where it is used</caption>
          <thead className={`${T.thead} md:sticky md:top-0 md:z-10 md:bg-panel`}>
            <tr>
              {['Row', 'Stage', 'Parameter', 'Value', 'Tag', 'Source', 'Confidence', 'Used in'].map((h) => (
                <th key={h} scope="col" className={T.th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={T.tbody}>
            {rows.map((r) => (
              <tr key={r.row} id={`inv-row-${r.row}`} tabIndex={-1} className={`${T.tr} ${marked === r.row ? 'rp-marked bg-hairline' : ''}`}>
                <Td label="Row" className="num text-textMuted md:w-[52px]">
                  {r.row}
                </Td>
                <Td label="Stage" className="text-12 text-textMuted md:w-[150px]">
                  {r.stage.replace(/^\d+\.\s*/, '')}
                </Td>
                <Td label="Parameter" className="md:w-[21%]">
                  {r.parameter}
                </Td>
                <Td label="Value" className="md:w-[24%]">
                  <span className="num">{String(r.value)}</span>
                  {r.unit && r.unit !== '—' ? <span className="text-12 text-textMuted"> {r.unit}</span> : null}
                  {r.notes && <span className="mt-1 block text-12 text-textMuted">Note: {r.notes}</span>}
                </Td>
                <Td label="Tag" className="md:w-[44px]">
                  <SourceBadge tag={r.tag as ProvenanceTag} title={`${provenance[r.tag as ProvenanceTag].label}. Status in the workbook: ${r.status}`} />
                </Td>
                <Td label="Source" className="text-12 text-textMuted">
                  {r.source}
                  {r.replacedBy && <span className="mt-1 block">To be replaced by: {r.replacedBy}</span>}
                </Td>
                <Td label="Confidence" className="text-12 md:w-[84px]">
                  {r.confidence}
                </Td>
                <Td label="Used in" className="text-12 text-textMuted md:w-[13%]">
                  {r.usedIn}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="mt-3 text-12 text-textMuted">
        <summary className="cursor-pointer rounded-control text-text">Research sources cited in the inventory (R1 to R{inventorySources.length})</summary>
        <ul className="mt-2 grid gap-1">
          {inventorySources.map((s) => (
            <li key={s.id}>
              <span className="num text-text">{s.id}</span> {s.reference}
              {s.link && (
                <>
                  {' '}
                  <a href={s.link} target="_blank" rel="noreferrer" className="rp-link underline decoration-hairlineStrong underline-offset-2 hover:decoration-text">
                    link
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
