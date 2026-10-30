import { Buffer } from 'buffer';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// The OPFS chunk-store adapter uses Buffer when reading stored pieces.
if (!(globalThis as typeof globalThis & { Buffer?: typeof Buffer }).Buffer) {
  Object.assign(globalThis, { Buffer });
}

createRoot(document.getElementById('root')!).render(<App />);
