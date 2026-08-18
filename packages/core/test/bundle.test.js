import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// Yjs must not be inside the built package.
//
// It owns identity: a document created by one copy and updated by another
// integrates structs whose `instanceof` checks all fail against the other copy's
// classes. Nothing throws. Updates arrive byte-perfect, apply, and land as deleted
// placeholders -- so a value replaced by a remote peer does not go stale on the
// receiving side, it goes *missing*, on air.
//
// A studio's worker loads Yjs a second time through its sync provider, so bundling
// a copy here is enough to cause it. This cost a day to find, and it is invisible
// to every other kind of test: unit tests import the source, not the build, and the
// browser tests only catch it once two peers are actually replicating.

/** A string from Yjs's own source, not from ours. */
const YJS_INTERNALS = 'Integer out of Range'

const built = () => {
  const dir = fileURLToPath(new URL('../dist', import.meta.url))

  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith('.js'))
      .map((name) => ({ name, source: readFileSync(`${dir}/${name}`, 'utf8') }))
  } catch {
    // No build here. `pnpm test` runs on a clean checkout too, and a missing dist
    // is not a wrong one.
    return []
  }
}

describe('the built package', () => {
  it('imports yjs rather than containing it', () => {
    const files = built()

    if (!files.length) return

    for (const { name, source } of files) {
      expect(source, `${name} has a copy of Yjs bundled into it`).not.toContain(YJS_INTERNALS)
    }

    expect(
      files.some(({ source }) => /from\s*["']yjs["']/.test(source)),
      'nothing imports yjs at all',
    ).toBe(true)
  })

  it('leaves react alone too, for the same reason', () => {
    const files = built()

    if (!files.length) return

    for (const { name, source } of files) {
      expect(source, `${name} looks like it bundled React`).not.toContain('react-dom/client')
    }
  })
})
