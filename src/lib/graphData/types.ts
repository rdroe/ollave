// Shared chart-data types.
//
// This module deliberately has NO imports: chart data files (minor.ts, and a
// future major.ts) import it, and graphh.ts re-exports both the type and the
// charts. Keeping the type here rather than in graphh.ts is what stops the
// chart data from depending on the translator that consumes it.

export type ProgressionGraphNode = {
  name: string // may be a function name (V64 / Aug6 / N6)
  next: string[]
  dotted?: string[]
  // arrival context: which chords may precede this node. Realized into the
  // `enabler` of every edge the node emits.
  prev?: string[]
}

export type ProgressionChart = { [name: string]: ProgressionGraphNode[] }
