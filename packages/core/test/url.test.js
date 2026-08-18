import { describe, expect, it } from 'vitest'

import { titleFromUrl } from '../src/toolkits/url'

describe('titleFromUrl', () => {
  it('reads the query string before the hash', () => {
    // The important case. Hash routing puts the route after the `#`, so this is the
    // only part of a source's URL that differs where a URL-namer can see it.
    expect(titleFromUrl('http://localhost:4173/?title=Demo%20scoreboard#/source/scoreboard')).toBe('Demo scoreboard')
  })

  it('reads a query inside the hash too', () => {
    expect(titleFromUrl('http://localhost:4173/#/source/scoreboard?title=Scoreboard')).toBe('Scoreboard')
  })

  it('prefers the real query string when both are present', () => {
    expect(titleFromUrl('http://localhost:4173/?title=Outer#/source/x?title=Inner')).toBe('Outer')
  })

  it('returns nothing when there is no title to read', () => {
    expect(titleFromUrl('http://localhost:4173/#/source/scoreboard')).toBe(null)
    expect(titleFromUrl('http://localhost:4173/?theme=dark#/source/x')).toBe(null)
    expect(titleFromUrl('')).toBe(null)
  })

  it('survives a URL it cannot parse rather than taking the page down with it', () => {
    expect(titleFromUrl('%%%not a url%%%')).toBe(null)
  })
})
