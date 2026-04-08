/** Mock song layout: abstract timeline units (e.g. beats) or epoch-ms offsets for calendar-style demos. Phases = lanes; segments = notes/events. */

import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from './timeGranularity'

function formatRelativeSpanMs(span: number): string {
  if (!Number.isFinite(span) || span <= 0) return '0'
  if (span >= MS_PER_DAY) return `${(span / MS_PER_DAY).toFixed(1)} d`
  if (span >= MS_PER_HOUR) return `${(span / MS_PER_HOUR).toFixed(1)} h`
  return `${Math.max(1, Math.round(span / MS_PER_MINUTE))} min`
}

export type MockPhase = {
  id: string
  name: string
}

export type MockNoteSegment = {
  phaseId: string
  /** inclusive start on timeline */
  start: number
  /** exclusive end on timeline */
  end: number
  label: string
}

/** How to interpret numeric `start` / `end` / `totalLength`. */
export type MockSongGanttTimeline =
  | { kind: 'abstractBeats' }
  /**
   * Timeline values are milliseconds **relative to** `epochAnchorMs`
   * (i.e. the visible span is `[epochAnchorMs, epochAnchorMs + totalLength)` in absolute time).
   */
  | { kind: 'epochMs'; epochAnchorMs: number }

export type MockSongGantt = {
  title: string
  /** timeline runs [0, totalLength) in abstract beats or relative ms */
  totalLength: number
  phases: MockPhase[]
  segments: MockNoteSegment[]
  timeline?: MockSongGanttTimeline
}

export const MOCK_SONG_GANTT: MockSongGantt = {
  title: 'Mock arrangement',
  totalLength: 64,
  phases: [
    { id: 'intro', name: 'Intro' },
    { id: 'verse_a', name: 'Verse A' },
    { id: 'chorus', name: 'Chorus' },
    { id: 'verse_b', name: 'Verse B' },
    { id: 'bridge', name: 'Bridge' },
    { id: 'outro', name: 'Outro' },
  ],
  segments: [
    { phaseId: 'intro', start: 0, end: 8, label: 'pad swell' },
    { phaseId: 'intro', start: 4, end: 8, label: 'hat fill' },
    { phaseId: 'verse_a', start: 8, end: 24, label: 'vox + arp' },
    { phaseId: 'verse_a', start: 16, end: 20, label: 'bass bump' },
    { phaseId: 'chorus', start: 24, end: 40, label: 'full stack' },
    { phaseId: 'chorus', start: 32, end: 36, label: 'break' },
    { phaseId: 'verse_b', start: 40, end: 48, label: 'vox strip' },
    { phaseId: 'bridge', start: 48, end: 56, label: 'filter sweep' },
    { phaseId: 'bridge', start: 52, end: 56, label: 'lead' },
    { phaseId: 'outro', start: 56, end: 64, label: 'fade' },
  ],
}

export type GenerateMockSongGanttParams =
  | {
      mode: 'abstractBeats'
      /** Override total length; segment positions are scaled from {@link MOCK_SONG_GANTT}. */
      totalLength?: number
    }
  | {
      mode: 'datetime'
      /**
       * Absolute UTC instant for timeline t = 0. Defaults to the latest UTC midnight
       * not after “now” (stable day boundary for demos).
       */
      epochAnchorMs?: number
      /** Span of the mock timeline in milliseconds (relative axis still [0, totalLength)). */
      durationMs: number
    }

/** Snap to UTC day start. */
function utcDayStartMs(ms: number): number {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/**
 * Builds a {@link MockSongGantt}: either the default beat map (optionally stretched) or a
 * **datetime** mock whose numeric axis is milliseconds relative to `epochAnchorMs`.
 */
export function generateMockSongGantt(params: GenerateMockSongGanttParams): MockSongGantt {
  if (params.mode === 'abstractBeats') {
    const total = params.totalLength ?? MOCK_SONG_GANTT.totalLength
    const scale = total / MOCK_SONG_GANTT.totalLength
    return {
      title: MOCK_SONG_GANTT.title,
      totalLength: total,
      timeline: { kind: 'abstractBeats' },
      phases: MOCK_SONG_GANTT.phases.map((p) => ({ ...p })),
      segments: MOCK_SONG_GANTT.segments.map((s) => ({
        ...s,
        start: s.start * scale,
        end: s.end * scale,
      })),
    }
  }

  const epochAnchorMs = params.epochAnchorMs ?? utcDayStartMs(Date.now())
  const durationMs = params.durationMs
  const scale = durationMs / MOCK_SONG_GANTT.totalLength

  return {
    title: 'Mock calendar span',
    totalLength: durationMs,
    timeline: { kind: 'epochMs', epochAnchorMs },
    phases: MOCK_SONG_GANTT.phases.map((p) => ({ ...p })),
    segments: MOCK_SONG_GANTT.segments.map((s) => ({
      ...s,
      start: s.start * scale,
      end: s.end * scale,
      label: `${s.label} (${formatRelativeSpanMs((s.end - s.start) * scale)})`,
    })),
  }
}
