import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { TokenSheet } from './design/TokenSheet';
import { DebugPage } from './pages/DebugPage';

// ?tokens shows the design-token sheet; ?debug shows the simulator's raw event log and KPIs.
const query = new URLSearchParams(location.search);
const page = query.has('tokens') ? <TokenSheet /> : query.has('debug') ? <DebugPage /> : <App />;
createRoot(document.getElementById('root')!).render(<StrictMode>{page}</StrictMode>);
