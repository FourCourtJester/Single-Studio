import { describe, expect, it } from 'vitest'

import { relayFromUrl, relayLink } from '../src/hooks/useRelay'
import { nextRoom } from '../src/components/control/Collaborate'

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

describe('the room key in a link', () => {
  // The key rides the fragment because the fragment is not sent to a server. That
  // is the entire reason an encrypted show can still be set up by pasting one link:
  // GitHub Pages serves the page without ever seeing the key, and Supabase relays
  // the show without ever seeing it either.

  it('is read from the fragment', () => {
    expect(relayFromUrl('https://studio.example.com/?relay=https://x.supabase.co&room=friday&key=anon#/?k=Zm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyaGk')).toMatchObject({
      url: 'https://x.supabase.co',
      room: 'friday',
      token: 'anon',
      secret: 'Zm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyaGk',
    })
  })

  it('is ignored when it turns up in the query instead', () => {
    // The one rule that makes the fragment worth anything. A key before the `#` has
    // already been sent to whoever served the page, so honouring it would bless
    // exactly the mistake this design exists to prevent -- and it would do so
    // invisibly, because the show would work perfectly either way.
    expect(relayFromUrl('https://studio.example.com/?relay=https://x.supabase.co&room=friday&k=leaked#/')?.secret).toBeUndefined()
  })

  it('is absent from a link for a show that is not encrypted', () => {
    expect(relayFromUrl('https://studio.example.com/?relay=https://x.supabase.co&room=friday#/')?.secret).toBeUndefined()
  })

  it('goes into the fragment when a link is built, never the query', () => {
    const link = relayLink({
      url: 'https://x.supabase.co',
      room: 'friday',
      token: 'anon',
      secret: 'Zm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyaGk',
      base: 'https://studio.example.com/',
    })

    const [before, after] = link.split('#')

    expect(after).toContain('Zm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyaGk')
    expect(before).not.toContain('Zm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyaGk')
  })

  it('round-trips, so a link this builds is a link this reads', () => {
    const secret = 'Zm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyaGk'
    const made = relayLink({ url: 'https://x.supabase.co', room: 'friday', token: 'anon', secret, base: 'https://studio.example.com/' })

    expect(relayFromUrl(made)).toMatchObject({ url: 'https://x.supabase.co', room: 'friday', token: 'anon', secret })
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

describe('rotating a room to shut somebody out', () => {
  // The only revocation there is. Nobody can be un-told a key they already have, so
  // removing a person means a room they have no key to -- and the name it lands on
  // has to be one an operator still recognises as the same show at three minutes to
  // air. The key is what keeps anybody out; the name only has to be different.

  it('steps a plain name', () => {
    expect(nextRoom('friday-night-7x2k9')).toBe('friday-night-7x2k9-2')
  })

  it('counts up rather than stacking suffixes', () => {
    expect(nextRoom('friday-2')).toBe('friday-3')
    expect(nextRoom(nextRoom(nextRoom('friday')))).toBe('friday-4')
  })

  it('does not mistake a number inside the name for a count', () => {
    expect(nextRoom('week-1-finals')).toBe('week-1-finals-2')
  })

  it('has something to say even with nothing to work from', () => {
    expect(nextRoom('')).toBe('show-2')
    expect(nextRoom(undefined)).toBe('show-2')
  })
})
