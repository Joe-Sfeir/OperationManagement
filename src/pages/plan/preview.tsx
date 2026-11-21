// Standalone entry for looking at the Plan page on its own (preview-plan.html).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import { PlanPage } from './PlanPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlanPage />
  </StrictMode>,
);
