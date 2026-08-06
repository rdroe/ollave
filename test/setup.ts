// user-tables opens an IndexedDB connection at module scope; back it with an
// in-memory implementation under node.
import 'fake-indexeddb/auto'

// src/core/mem.ts assigns window.mem__ at module load; provide a window
// object so lib modules can be imported under node-based tests.
if (typeof (globalThis as any).window === 'undefined') {
  ;(globalThis as any).window = globalThis
}

// The compile step reached by addChord dispatches a CustomEvent, which the
// node environment does not define (Event exists; CustomEvent does not). The
// events are fire-and-forget notifications to browser listeners, so a subclass
// of Event that simply accepts the constructor call is enough for any test
// that exercises a code path reaching them.
if (typeof (globalThis as any).CustomEvent === 'undefined') {
  ;(globalThis as any).CustomEvent = class extends Event {
    constructor(type: string, init?: EventInit) {
      super(type, init)
    }
  }
}
