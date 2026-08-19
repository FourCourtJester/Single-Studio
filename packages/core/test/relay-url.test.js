import { describe, expect, it } from 'vitest'

import { packRoom, relayFromUrl, relayLink, resolveRelay, unpackRoom } from '../src/hooks/useRelay'
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
    const secret = 'Zm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyaGk'
    const link = relayLink({ url: 'https://x.supabase.co', room: 'friday', token: 'anon', secret, base: 'https://studio.example.com/' })
    const [before, after] = link.split('#')

    expect(relayFromUrl(link)?.secret).toBe(secret)
    expect(after).toContain(secret)
    expect(before).not.toContain(secret)
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

    expect(link).toContain('#/?')
    expect(link).not.toContain('/source/ticker')
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

describe('what an operator actually has to hand', () => {
  // Supabase's dashboard used to show a "Project URL" to copy. It shows a Project
  // ID now, and the URL is built from it. Rather than send somebody hunting for a
  // label that has moved once and may move again, take either.

  it('builds a project URL from a reference', () => {
    expect(resolveRelay('abcdefghijklmnopqrst')).toBe('https://abcdefghijklmnopqrst.supabase.co')
  })

  it('leaves a URL alone, whatever its scheme', () => {
    expect(resolveRelay('https://abcdefghijklmnopqrst.supabase.co')).toBe('https://abcdefghijklmnopqrst.supabase.co')
    expect(resolveRelay('wss://relay.example.com')).toBe('wss://relay.example.com')
    expect(resolveRelay('ws://127.0.0.1:4444')).toBe('ws://127.0.0.1:4444')
  })

  it('tidies a trailing slash, since a copied URL often has one', () => {
    expect(resolveRelay('https://abc.supabase.co/')).toBe('https://abc.supabase.co')
  })

  it('does not guess at anything else', () => {
    // A hostname is not a reference, and inventing a scheme for it would be picking
    // between ws and https on somebody's behalf. Hand it back and let it fail where
    // it can be seen.
    expect(resolveRelay('relay.example.com')).toBe('relay.example.com')
    expect(resolveRelay('')).toBe('')
    expect(resolveRelay(undefined)).toBe('')
  })

  it('tolerates the whitespace that comes with a paste', () => {
    expect(resolveRelay('  abcdefghijklmnopqrst  ')).toBe('https://abcdefghijklmnopqrst.supabase.co')
  })

  it('expands a reference found in a link, so an invite can carry either', () => {
    expect(relayFromUrl('https://studio.example.com/?relay=abcdefghijklmnopqrst&room=friday#/')?.url).toBe('https://abcdefghijklmnopqrst.supabase.co')
  })
})

describe('the whole room as one value', () => {
  // Four parameters was four things to get wrong and a URL nobody could read. One
  // token is shorter and is one thing to copy -- and putting it after the `#` keeps
  // the room name and the project key away from whoever serves the page, which the
  // room key already was.

  const room = {
    url: 'https://abcdefghijklmnopqrst.supabase.co',
    room: 'friday-night-7x2k9',
    token: 'sb_publishable_0123456789abcdefghij',
    secret: 'Zm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyaGk',
  }

  it('round-trips everything it was given', () => {
    expect(unpackRoom(packRoom(room))).toEqual(room)
  })

  it('is url-safe, since its whole job is to live in a link', () => {
    // `,` separates, and `%` is there for the parts that needed escaping -- a room
    // name with a space in it, say.
    expect(packRoom(room)).toMatch(/^[A-Za-z0-9_.~%,-]+$/)
  })

  it('survives a room name with the separator in it', () => {
    // The reason the separator is a comma: `encodeURIComponent` escapes one, and
    // leaves `~` alone. With `~` this room split into pieces.
    const awkward = { ...room, room: 'friday, night ~ late' }

    expect(unpackRoom(packRoom(awkward))).toEqual(awkward)
  })

  it('is shorter than the parameters it replaces', () => {
    // Not decoration: most of the old length was percent-encoding and parameter
    // names, and a Supabase address collapses to the reference it was built from.
    const before = `?relay=${encodeURIComponent(room.url)}&room=${room.room}&key=${room.token}#/?k=${room.secret}`
    const after = `#/?j=${packRoom(room)}`

    expect(after.length).toBeLessThan(before.length)
  })

  it('puts the whole thing after the hash, and nothing before it', () => {
    const [before, after] = relayLink({ ...room, base: 'https://studio.example.com/' }).split('#')

    expect(before).toBe('https://studio.example.com/')
    expect(after).toContain('j=')
    // The things that used to travel to the page's host, now not travelling.
    expect(before).not.toContain(room.room)
    expect(before).not.toContain(room.token)
  })

  it('round-trips through a built link', () => {
    expect(relayFromUrl(relayLink({ ...room, base: 'https://studio.example.com/' }))).toEqual(room)
  })

  it('still reads a link written the old way', () => {
    // OBS remembers a dock's URL for as long as the dock exists, so an operator set
    // up before this change must not have to be set up again.
    expect(
      relayFromUrl('https://studio.example.com/?relay=https://x.supabase.co&room=friday&key=anon#/?k=Zm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyaGk'),
    ).toEqual({
      url: 'https://x.supabase.co',
      room: 'friday',
      token: 'anon',
      secret: 'Zm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyaGk',
    })
  })

  it('manages a room with no key and no token', () => {
    const bare = { url: 'wss://relay.example.com', room: 'friday' }

    expect(unpackRoom(packRoom(bare))).toEqual({ url: 'wss://relay.example.com', room: 'friday', token: undefined, secret: undefined })
  })

  it('refuses nonsense rather than inventing a room', () => {
    // A mistyped token becoming a room that points confidently at nothing is worse
    // than a link that plainly does not work.
    expect(unpackRoom('')).toBeNull()
    expect(unpackRoom('rubbish')).toBeNull()
    expect(unpackRoom('not a url,friday')).toBeNull()
    expect(relayFromUrl('https://studio.example.com/#/?j=rubbish')).toBeNull()
  })
})
