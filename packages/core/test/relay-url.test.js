import { describe, expect, it } from 'vitest'

import { packRoom, relayFromUrl, relayLink, resolveRelay, unpackRoom } from '../src/hooks/useRelay'

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
    expect(
      relayFromUrl('https://studio.example.com/?relay=https://x.supabase.co&room=friday&key=anon#/?k=Zm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyaGk'),
    ).toMatchObject({
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

describe('what the link costs', () => {
  // Measured, because compression was tried here and lost. Three quarters of the
  // payload is a random project reference, a random project key and a random room
  // key, and randomness does not compress -- deflate on the joined string came out
  // longer than the string, and so did packing it into binary first, because
  // base64's third-on-top costs more than either saves.
  //
  // What was left was content: fifteen characters of constant key prefix, and a
  // room key twice as long as it needed to be.

  const room = {
    url: 'https://abcdefghijklmnopqrst.supabase.co',
    room: 'friday-night-7x2k9',
    token: 'sb_publishable_Xy7Kq2mNp4RtVw9zAb3CdE',
    secret: 'AAAAAAAAAAAAAAAAAAAAAA',
  }

  it('stands a dot in for the prefix every publishable key begins with', () => {
    const packed = packRoom(room)

    expect(packed).not.toContain('sb_publishable_')
    expect(packed).toContain(',.Xy7Kq2mNp4RtVw9zAb3CdE,')
    expect(unpackRoom(packed).token).toBe(room.token)
  })

  it('leaves a legacy key alone, since it does not begin that way', () => {
    const legacy = { ...room, token: 'eyJhbGciOiJIUzI1NiJ9.legacy' }

    expect(packRoom(legacy)).toContain('eyJhbGciOiJIUzI1NiJ9.legacy')
    expect(unpackRoom(packRoom(legacy)).token).toBe(legacy.token)
  })

  it('is a third shorter than the parameters it started as', () => {
    // Stated as the saving rather than a round number, because the round number is
    // arbitrary and the saving is the point. Against the four separate parameters,
    // percent-encoded, with the full key prefix and a 256-bit room key.
    const before = `?relay=${encodeURIComponent(room.url)}&room=${room.room}&key=${room.token}#/?k=${'A'.repeat(43)}`
    const after = `#/?j=${packRoom(room)}`

    expect(after.length).toBeLessThan(before.length * 0.7)
  })
})

describe('a link with no room in it', () => {
  // The room is derived from the key now, so nothing made today carries one. The
  // slot stays because the parts are positional: drop it and an older link's
  // `ref,friday,key` reads as `ref,<token>,…` and sends a board somewhere it has no
  // business being.

  const room = {
    url: 'https://abcdefghijklmnopqrst.supabase.co',
    token: 'sb_publishable_Xy7Kq2mNp4RtVw9zAb3CdE',
    secret: 'AAAAAAAAAAAAAAAAAAAAAA',
  }

  it('keeps the slot empty rather than shifting everything left', () => {
    expect(packRoom(room)).toBe('abcdefghijklmnopqrst,,.Xy7Kq2mNp4RtVw9zAb3CdE,AAAAAAAAAAAAAAAAAAAAAA')
  })

  it('round-trips with no room at all', () => {
    expect(unpackRoom(packRoom(room))).toEqual({ url: room.url, room: undefined, token: room.token, secret: room.secret })
  })

  it('still reads an older link that names one', () => {
    const named = packRoom({ ...room, room: 'friday-night-7x2k9' })

    expect(unpackRoom(named)).toEqual({ ...room, room: 'friday-night-7x2k9' })
  })

  it('costs less than the link that carried a room', () => {
    // The whole of the saving, and it is the room name's length exactly.
    expect(packRoom(room).length).toBe(packRoom({ ...room, room: 'friday-night-7x2k9' }).length - 'friday-night-7x2k9'.length)
  })
})
