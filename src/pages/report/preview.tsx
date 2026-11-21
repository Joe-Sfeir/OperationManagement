/**
 * Standalone entry for the Redesign and Report pages (preview-pages.html).
 * Mirrors the app shell: a 48 px bar, then the page in a scroll container.
 * ?page=redesign or ?page=report picks the page; ?t=<minute> sets the clock.
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import { clock, useTwin } from '../../app/store';
import { useClock } from '../../app/useClock';
import { Segmented } from '../../ui/kit';
import { RedesignPage } from '../redesign/RedesignPage';
import { ReportPage } from './ReportPage';

type PageId = 'redesign' | 'report';
const q = new URLSearchParams(location.search);
if (q.has('t')) {
  clock.t = Number(q.get('t'));
  useTwin.setState({ tUi: clock.t });
}

function Preview() {
  useClock();
  const [page, setPage] = useState<PageId>(q.get('page') === 'report' ? 'report' : 'redesign');
  return (
    <div className="fixed inset-0 overflow-hidden bg-canvas">
      <header className="flex h-12 items-center gap-3 border-b border-hairline bg-panel px-3 md:px-4">
        <h1 className="truncate text-14 font-semibold">NTG Machine 3700</h1>
        <span className="hidden text-12 text-textMuted sm:inline">page preview</span>
        <div className="ml-auto">
          <Segmented<PageId>
            label="Page"
            value={page}
            onChange={setPage}
            options={[
              { value: 'redesign', label: 'Redesign' },
              { value: 'report', label: 'Report' },
            ]}
          />
        </div>
      </header>
      <div className="absolute inset-0 top-12 overflow-auto">{page === 'redesign' ? <RedesignPage /> : <ReportPage />}</div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
