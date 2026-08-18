import { describe, expect, it } from 'vitest'

import { relayFromUrl, relayLink } from '../src/hooks/useRelay'

// An operator's whole setup is pasting a link into an OBS dock. Nobody types a
// token, nobody opens a settings screen, and OBS remembers the dock URL, so it is
// a once-ever step. That makes this parsing load-bearing: get it wrong and the
// failure is an operator who appears to be connected to nothing.

describe('reading a room from a link', () => {
  it('takes the relay, the room and the key', () => {
    expect(relayFromUrl('https://studio.example.com/?relay=wss://relay.example.com&room=friday&key=abc#/')).toEqual({
      url: 'wss://relay.example.com',
      room: 'friday',
      token: 'abc',
    })
  })

  it('reads them out of the hash too, for anyone who writes it that way', () => {
    expect(relayFromUrl('https://studio.example.com/#/?relay=wss://r.example.com&room=friday')).toMatchObject({
      url: 'wss://r.example.com',
      room: 'friday',
    })
  })

  it('needs an address, since a room with nowhere to be is not a room', () => {
    expect(relayFromUrl('https://studio.example.com/?room=friday&key=abc#/')).toBeNull()
  })

  it('lets everything else be optional, for a studio that names its own room', () => {
    expect(relayFromUrl('https://studio.example.com/?relay=wss://r.example.com#/')).toEqual({
      url: 'wss://r.example.com',
      room: undefined,
      token: undefined,
    })
  })

  it('finds nothing in an ordinary URL rather than inventing a room', () => {
    expect(relayFromUrl('https://studio.example.com/#/source/scoreboard')).toBeNull()
    expect(relayFromUrl('')).toBeNull()
  })

  it('survives a URL it cannot parse', () => {
    expect(relayFromUrl('%%%not a url%%%')).toBeNull()
  })

  it('is not confused by the other parameters a source URL already carries', () => {
    // Browser-source URLs carry `layer-name` for OBS. A board link and a source
    // link are the same origin and the same app.
    expect(relayFromUrl('https://studio.example.com/?layer-name=Demo%20scoreboard&relay=wss://r.example.com&room=friday#/source/scoreboard')).toMatchObject({
      url: 'wss://r.example.com',
      room: 'friday',
    })
  })
})

describe('building a link to send somebody', () => {
  it('is the studio, with the room on it', () => {
    // Not a link to the relay: what an operator needs is the board, and the room
    // is how it finds its way home. One thing to send.
    const link = relayLink({ url: 'wss://relay.example.com', room: 'friday', token: 'abc', base: 'https://studio.example.com/' })

    expect(relayFromUrl(link)).toEqual({ url: 'wss://relay.example.com', room: 'friday', token: 'abc' })
    expect(link.startsWith('https://studio.example.com/')).toBe(true)
  })

  it('lands on the board rather than wherever the link was built from', () => {
    const link = relayLink({ url: 'wss://r.example.com', room: 'friday', base: 'https://studio.example.com/#/source/ticker' })

    expect(link.endsWith('#/')).toBe(true)
  })

  it('leaves out what it was not given', () => {
    const link = relayLink({ url: 'wss://r.example.com', base: 'https://studio.example.com/' })

    expect(link).not.toContain('key=')
    expect(link).not.toContain('room=')
  })

  it('round-trips a room name that needs escaping', () => {
    const link = relayLink({ url: 'wss://r.example.com', room: 'friday night', token: 'a b/c', base: 'https://studio.example.com/' })

    expect(relayFromUrl(link)).toMatchObject({ room: 'friday night', token: 'a b/c' })
  })
})
