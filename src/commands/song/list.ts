import { Module } from 'peprn/util'
import { browser } from 'user-tables'
import z from 'zod'

import { fetchLatestSongAndTracks } from '../../lib/fetch'
import { trackRecordSchema } from '../../lib/schemas'

// list songs by fetching their names from the database
export const listSongs = {
  fn: async () => {
    const songs = await (await browser.userTables.where('song', {})).toArray()
    return {
      formatted: {
        songs: songs.map(({ id, data }) => ({ id, name: data.name })),
      },
    }
  },
}

export const listTracks = {
  fn: async () => {
    const tracks = await (await browser.userTables.where('track', {})).toArray()
    return tracks
  },
}

export const latestSong = {
  fn: async () => {
    return fetchLatestSongAndTracks()
  },
}

export const deleteAllSongsAndTracks = {
  fn: async () => {
    const songs = await (await browser.userTables.where('song', {})).toArray()
    const songListInitLength = songs.length
    // delete them all
    await Promise.all(
      songs.map((song) => {
        return browser.userTables.delete('song', { id: song.id })
      })
    )

    const songListAfterDeletionLength = (
      await (await browser.userTables.where('song', {})).toArray()
    ).length

    const tracks = await (await browser.userTables.where('track', {})).toArray()
    const trackListInitLength = tracks.length
    // delete them all
    await Promise.all(
      tracks.map((track) => {
        return browser.userTables.delete('track', { id: track.id })
      })
    )
    const tracksListAfterDeletionLength = (
      await (await browser.userTables.where('track', {})).toArray()
    ).length

    // same for phases; fetch and delete all
    const phases = await (await browser.userTables.where('phase', {})).toArray()
    const phaseListInitLength = phases.length
    await Promise.all(
      phases.map((phase) => {
        return browser.userTables.delete('phase', { id: phase.id })
      })
    )
    const phaseListAfterDeletionLength = (
      await (await browser.userTables.where('phase', {})).toArray()
    ).length

    return {
      formatted: {
        songListInitLength,
        songListAfterDeletionLength,
        trackListInitLength,
        tracksListAfterDeletionLength,
        phaseListInitLength,
        phaseListAfterDeletionLength,
      },
    }
  },
}

export const deleteSongAndRelatedTracksAndPhasesBySongId: Module = {
  fn: async ({ positionalNonCommands }) => {
    const [songId] = positionalNonCommands
    if (typeof songId !== 'number') {
      return { formatted: { error: 'song id is not a number' } }
    }
    // first get the track ids
    const song = await (
      await browser.userTables.where('song', { id: songId })
    ).first()
    if (!song) {
      return { formatted: { error: 'song not found' } }
    }
    const trackIds = z
      .object({ 'track-ids': z.array(z.tuple([z.number(), z.number()])) })
      .parse(song.data)
      ['track-ids'].map(([trackId]) => trackId)

    // fetch the tracks
    const tracks = await Promise.all(
      trackIds.map(async (trackId) => {
        return (
          await browser.userTables.where('track', { id: trackId })
        ).first()
      })
    )
    const phaseIds = tracks.flatMap(
      (track) => trackRecordSchema.parse(track.data)['phase-ids']
    )
    // fetch the phases
    const phases = await Promise.all(
      phaseIds.map(async (phaseId) => {
        return (
          await browser.userTables.where('phase', { id: phaseId })
        ).first()
      })
    )

    // delete the song
    const songDeletion = await browser.userTables.delete('song', { id: songId })
    // delete the tracks
    const trackDeletions = await Promise.all(
      tracks.map((track) => {
        return browser.userTables.delete('track', { id: track.id })
      })
    )
    // delete the song's bar templates. Keyed by songId in the indexed `a`
    // column (see barTemplates/fetch.ts); without this they outlived their
    // song as unreachable rows. The table name is inlined rather than
    // imported from lib/barTemplates to keep this command free of that
    // module's import graph.
    const barTemplateRows = await (
      await browser.userTables.where('barTemplate', { a: String(songId) })
    ).toArray()
    const barTemplateDeletions = await Promise.all(
      barTemplateRows.map((row) => {
        return browser.userTables.delete('barTemplate', { id: row.id })
      })
    )
    // delete the phases
    const phaseDeletions = await Promise.all(
      phases.map((phase) => {
        return browser.userTables.delete('phase', { id: phase.id })
      })
    )
    return {
      formatted: {
        songDeletion,
        trackDeletions,
        phaseDeletions,
        barTemplateDeletions,
      },
    }
  },
}
