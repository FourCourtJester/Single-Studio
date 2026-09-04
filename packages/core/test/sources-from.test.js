import { describe, expect, it } from 'vitest'

import { sourcesFrom } from '../src/studio/sourcesFrom'

// Adding a graphic should be adding a file. The keys this produces are what a URL,
// an OBS layer name and a page title are all derived from, so getting them wrong is
// not cosmetic -- it is a browser source pointing at nothing.

const load = () => Promise.resolve({})

describe('naming sources from their files', () => {
  it('names a graphic after its file, not its folder', () => {
    expect(Object.keys(sourcesFrom({ './sources/Scoreboard.jsx': load }))).toEqual(['scoreboard'])
  })

  it('breaks a React-shaped filename into a URL-shaped key', () => {
    // `LowerThird.jsx` is how the component is named and `lower-third` is how the
    // URL wants it. Slugging alone gives `lowerthird`, which reads as one word
    // everywhere it surfaces -- including the OBS scene list.
    expect(Object.keys(sourcesFrom({ './sources/LowerThird.jsx': load }))).toEqual(['lower-third'])
  })

  it('keeps a folder as a group', () => {
    const keys = Object.keys(
      sourcesFrom({
        './sources/lower-thirds/Single.jsx': load,
        './sources/lower-thirds/Double.jsx': load,
        './sources/game/Scoreboard.jsx': load,
      }),
    )

    expect(keys).toEqual(['lower-thirds/single', 'lower-thirds/double', 'game/scoreboard'])
  })

  it('does not care which folder was globbed', () => {
    expect(Object.keys(sourcesFrom({ './scenes/Match.jsx': load }))).toEqual(['match'])
  })

  it('names a graphic the same however far up the glob had to reach', () => {
    // A studio whose definition lives in src/studio globs `../sources/**`, and the
    // `..` must not be mistaken for the folder to drop. This is what the shipped
    // template does, so getting it wrong breaks every URL in a new studio.
    expect(Object.keys(sourcesFrom({ '../sources/Scoreboard.jsx': load }))).toEqual(['scoreboard'])
    expect(Object.keys(sourcesFrom({ '../../sources/lower-thirds/Guest.jsx': load }))).toEqual(['lower-thirds/guest'])
  })

  it('handles a file with no folder above it', () => {
    // Dropping "the folder that was globbed" must not drop the only segment there
    // is, or a flat glob names everything the empty string.
    expect(Object.keys(sourcesFrom({ './Match.jsx': load }))).toEqual(['match'])
  })

  it('keeps the loader untouched, so nothing is imported until it is asked for', () => {
    const sources = sourcesFrom({ './sources/Scoreboard.jsx': load })

    expect(sources.scoreboard).toBe(load)
  })

  it('refuses two files that would answer to one URL', () => {
    // Silently keeping the last would leave a graphic that is registered, listed in
    // the operator's browser sources, and never the one that loads.
    expect(() => sourcesFrom({ './sources/LowerThird.jsx': load, './sources/lower-third.jsx': load })).toThrow(/both be "lower-third"/)
  })

  it('takes nothing at all without complaining', () => {
    expect(sourcesFrom()).toEqual({})
    expect(sourcesFrom({})).toEqual({})
  })
})
