// Generates the demo's placeholder art.
//
// The demo is modelled on a squad-based RTS broadcast -- two commanders, two
// factions, a map, an army composition -- because that show uses every component
// the framework has at once. It ships generated SVGs rather than real game art:
// nothing here is anyone's intellectual property, and every file is a stand-in you
// are meant to overwrite.
//
// To use your own, drop files with the same names into apps/fixture/public/<set>/ and
// leave everything else alone -- the sources template their paths off the stored
// value, so no code changes when the art does.
//
//   node apps/fixture/scripts/placeholders.mjs

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

/** Stable hue per name, so a file keeps its colour across regenerations. */
function hue(name) {
  let h = 0

  for (const char of name) h = (h * 31 + char.charCodeAt(0)) % 360

  return h
}

const initials = (label) =>
  label
    .split(/[\s-]+/)
    .map((word) => word.at(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img">${body}</svg>\n`

/** A crest: shield outline, band, initials. */
function faction(label) {
  const h = hue(label)

  return svg(
    `<path d="M64 6 118 26v44c0 30-22 46-54 52-32-6-54-22-54-52V26Z" fill="hsl(${h} 55% 22%)" stroke="hsl(${h} 80% 60%)" stroke-width="5"/>` +
      `<path d="M10 62h108v14H10Z" fill="hsl(${h} 80% 60%)" opacity="0.85"/>` +
      `<text x="64" y="56" text-anchor="middle" font-family="system-ui, sans-serif" font-size="34" font-weight="700" fill="hsl(${h} 90% 85%)">${initials(label)}</text>` +
      `<text x="64" y="104" text-anchor="middle" font-family="system-ui, sans-serif" font-size="13" fill="hsl(${h} 60% 80%)">${label}</text>`,
  )
}

/** A portrait: bust silhouette on a ringed disc. */
function commander(label) {
  const h = hue(label)

  return svg(
    `<circle cx="64" cy="64" r="60" fill="hsl(${h} 45% 18%)" stroke="hsl(${h} 85% 62%)" stroke-width="4"/>` +
      `<circle cx="64" cy="50" r="20" fill="hsl(${h} 70% 55%)"/>` +
      `<path d="M24 116a40 34 0 0 1 80 0Z" fill="hsl(${h} 70% 55%)"/>` +
      `<text x="64" y="57" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="hsl(${h} 40% 15%)">${initials(label)}</text>`,
  )
}

/** A unit icon: chevron plate with initials. */
function unit(label) {
  const h = hue(label)

  return svg(
    `<rect x="8" y="8" width="112" height="112" rx="18" fill="hsl(${h} 40% 16%)" stroke="hsl(${h} 80% 58%)" stroke-width="4"/>` +
      `<path d="M64 26 100 62 88 74 64 50 40 74 28 62Z" fill="hsl(${h} 80% 58%)"/>` +
      `<text x="64" y="106" text-anchor="middle" font-family="system-ui, sans-serif" font-size="26" font-weight="700" fill="hsl(${h} 70% 80%)">${initials(label)}</text>`,
  )
}

/** A map thumb: grid, two spawn markers, name plate. */
function map(label) {
  const h = hue(label)
  const lines = Array.from({ length: 7 }, (_, i) => {
    const at = 16 + i * 16

    return `<path d="M${at} 8V120M8 ${at}H120" stroke="hsl(${h} 60% 40%)" stroke-width="1" opacity="0.5"/>`
  }).join('')

  return svg(
    `<rect x="8" y="8" width="112" height="112" rx="10" fill="hsl(${h} 35% 14%)" stroke="hsl(${h} 70% 55%)" stroke-width="4"/>` +
      lines +
      `<circle cx="36" cy="92" r="10" fill="hsl(200 85% 60%)"/><circle cx="92" cy="36" r="10" fill="hsl(0 80% 60%)"/>` +
      `<rect x="8" y="96" width="112" height="24" fill="hsl(${h} 45% 10%)" opacity="0.85"/>` +
      `<text x="64" y="113" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" fill="hsl(${h} 70% 85%)">${label}</text>`,
  )
}

/**
 * A tally mark: a small solid emblem, and the hollow version of it.
 *
 * Deliberately plain. These are read at a glance, several in a row, at the size of
 * a full stop on a broadcast -- an icon with detail in it is a smudge.
 */
function mark(label) {
  const h = hue(label)
  const hollow = label.endsWith('empty')

  return svg(
    `<path d="M64 10 118 64 64 118 10 64Z" fill="${hollow ? 'none' : `hsl(${h} 85% 60%)`}" stroke="hsl(${h} 80% ${hollow ? 45 : 75}%)" stroke-width="10"/>`,
  )
}

export const FACTIONS = ['Vanguard', 'Syndicate', 'Freeholders']
export const COMMANDERS = ['Kestrel', 'Vulcan', 'Wren', 'Solomon', 'Iris', 'Ash']
export const UNITS = ['Rifleman', 'Missile Squad', 'Scout Bike', 'Battle Tank', 'Artillery', 'Gunship', 'Sniper', 'Engineer']
export const MAPS = ['Dry Harbour', 'Redline', 'Ashfall']
export const MARKS = ['objective', 'won', 'empty']

const slug = (label) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const SETS = [
  ['factions', FACTIONS, faction],
  ['commanders', COMMANDERS, commander],
  ['units', UNITS, unit],
  ['maps', MAPS, map],
  ['marks', MARKS, mark],
]

async function main() {
  let count = 0

  for (const [folder, labels, draw] of SETS) {
    await mkdir(join(ROOT, folder), { recursive: true })

    for (const label of labels) {
      await writeFile(join(ROOT, folder, `${slug(label)}.svg`), draw(label))
      count += 1
    }
  }

  console.log(`wrote ${count} placeholder files under ${ROOT}`)
}

main()
