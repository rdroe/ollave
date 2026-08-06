// user-tables opens an IndexedDB connection at module scope; back it with an
// in-memory implementation under node.
import 'fake-indexeddb/auto'

// src/core/mem.ts assigns window.mem__ at module load; provide a window
// object so lib modules can be imported under node-based tests.
if (typeof (globalThis as any).window === 'undefined') {
  ;(globalThis as any).window = globalThis
}
