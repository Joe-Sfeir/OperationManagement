/**
 * Standalone entry for the Sourcing page (preview-sourcing.html).
 * The page scrolls with the document here; in the app it sits in a scroll
 * container under the 48 px top bar.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import { SourcingPage } from './SourcingPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SourcingPage />
  </StrictMode>,
);
