import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { TokenSheet } from './design/TokenSheet';

const tokens = new URLSearchParams(location.search).has('tokens');
createRoot(document.getElementById('root')!).render(<StrictMode>{tokens ? <TokenSheet /> : <App />}</StrictMode>);
