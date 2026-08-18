import { describe, expect, it } from 'vitest'

import { layerNameFromUrl } from '../src/toolkits/url'

describe('layerNameFromUrl', () => {
  it('reads the query string before the hash', () => {
    // The important case. Hash routing puts the route after the `#`, so this is the
    // only part of a source's URL that differs where OBS looks.
    expect(layerNameFromUrl('http://localhost:4173/?layer-name=Demo%20scoreboard#/source/scoreboard')).toBe('Demo scoreboard')
  })

  it('reads a query inside the hash too', () => {
    expect(layerNameFromUrl('http://localhost:4173/#/source/scoreboard?layer-name=Scoreboard')).toBe('Scoreboard')
  })

  it('prefers the real query string when both are present', () => {
    expect(layerNameFromUrl('http://localhost:4173/?layer-name=Outer#/source/x?layer-name=Inner')).toBe('Outer')
  })

  it('returns nothing when there is no name to read', () => {
    expect(layerNameFromUrl('http://localhost:4173/#/source/scoreboard')).toBe(null)
    expect(layerNameFromUrl('http://localhost:4173/?theme=dark#/source/x')).toBe(null)
    expect(layerNameFromUrl('')).toBe(null)
  })

  it('survives a URL it cannot parse rather than taking the page down with it', () => {
    expect(layerNameFromUrl('%%%not a url%%%')).toBe(null)
  })
})
