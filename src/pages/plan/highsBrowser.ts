/**
 * HiGHS for the browser. The WebAssembly binary is imported with `?inline`, so
 * Vite puts it inside the JavaScript as base64 and nothing is fetched at run
 * time. That is what lets the built site run from an unzipped folder, where
 * fetch() of a local .wasm file is refused. The binary sits in its own chunk
 * and is only read when the Plan page first solves.
 */
import highsLoader from 'highs';
import { setHighsLoader } from './model';

function decodeDataUrl(url: string): Uint8Array {
  const text = atob(url.slice(url.indexOf(',') + 1));
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return bytes;
}

let installed = false;

/** Point model.ts at the inlined binary. Safe to call more than once. */
export function installInlinedHighs(): void {
  if (installed) return;
  installed = true;
  setHighsLoader(async () => {
    const { default: wasm } = await import('highs/runtime?inline');
    // Vite gives a data: URL. If a build ever hands back a plain URL, fetch it instead.
    const wasmBinary = wasm.startsWith('data:') ? decodeDataUrl(wasm) : new Uint8Array(await (await fetch(wasm)).arrayBuffer());
    return highsLoader({ wasmBinary });
  });
}
