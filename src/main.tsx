import { Buffer } from 'buffer';
import process from 'process';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// WebTorrent and its chunk-store dependencies expect Node-style globals.
// Initialize each global independently so Buffer being present never skips process.
const runtime = globalThis as typeof globalThis & {
  Buffer?: typeof Buffer;
  process?: typeof process;
};
runtime.Buffer ??= Buffer;
runtime.process ??= process;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Torrentwide could not find its application root element.');
}

createRoot(rootElement).render(<App />);
