/**
 * HiGHS for the browser. The WebAssembly binary is imported with `?url&inline`,
 * so Vite puts it inside the JavaScript as a base64 data: URL and the loader
 * reads it from there. Nothing is fetched over the network or from disk at run
 * time, which is what lets the built site run from an unzipped folder, where
 * fetch() of a local .wasm file is refused. The binary sits in its own chunk
 * and is only read when the Plan page first solves.
 *
 * (The loader's `wasmBinary` option is typed but this build ignores it, so the
 * binary is handed over through `locateFile` instead.)
 */
import highsLoader from 'highs';
import { setHighsLoader } from './model';

let installed = false;

/** Point model.ts at the inlined binary. Safe to call more than once. */
export function installInlinedHighs(): void {
  if (installed) return;
  installed = true;
  setHighsLoader(async () => {
    const { default: wasm } = await import('highs/runtime?url&inline');
    return highsLoader({ locateFile: () => wasm });
  });
}
