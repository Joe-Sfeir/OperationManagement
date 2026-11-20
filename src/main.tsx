import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { TokenSheet } from './design/TokenSheet';

// M0: the app shows the design-token sheet. The Machine scene replaces it from M2.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TokenSheet />
  </StrictMode>,
);
