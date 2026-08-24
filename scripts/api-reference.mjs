#!/usr/bin/env node
// Generate docs/api.md from the types the package actually ships.
//
// Written rather than hand-maintained for one reason: a reference that is typed out
// by hand is wrong the first time somebody renames a prop and does not think to open
// the docs. This reads the emitted `.d.ts` files, which are generated from the JSDoc
// on the components, which is the same text an editor shows on hover. One source,
// three places it turns up, no way for them to disagree.
//
// Run `pnpm build` first -- this reads `dist/types`, not `src`.
//
//   node scripts/api-reference.mjs [--check]
//
// `--check` fails instead of writing, for CI: it means the reference has drifted from
// the code and needs regenerating.

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const types = join(root, 'packages/core/dist/types/components')
const out = join(root, 'docs/api.md')
const check = process.argv.includes('--check')

if (!existsSync(types)) {
  console.error('No dist/types. Run `pnpm build` first.')
  process.exit(1)
}

/**
 * What a studio author writes, and what the framework renders for them.
 *
 * Deliberately a list rather than "everything exported". `Menu`, `SyncStatus`,
 * `RelayAdmin`, `SaveButton` and the dialogs are real components with real props,
 * and none of them is something a studio author places -- `ControlPage` renders
 * them, and there is only ever one of each. Documenting them here would pad the page
 * with things nobody can use and bury the ones they can.
 */
const AUTHORED = {
  control: [
    'Field',
    'TextArea',
    'Stepper',
    'Select',
    'Cycle',
    'ColorPicker',
    'ImagePicker',
    'ImageSelect',
    'ImageToggle',
    'ToggleButton',
    'SwapButton',
    'ResetButton',
    'Countdown',
    'CountdownTo',
    'Stopwatch',
    'Leaderboard',
    'Panel',
    'Break',
    'Confirm',
  ],
  source: ['Scene', 'Variable', 'Image', 'ImageList', 'Toggle', 'Timer', 'Ticker', 'Clock'],
}

/** First sentence of a doc comment: what the thing is, before why it is that way. */
function summarise(text) {
  // Blank lines are kept: the opening paragraph ends at one, and that paragraph is
  // what a reference entry wants -- what the thing is, before the pages of why it is
  // shaped that way that the source rightly carries and a reader here does not want.
  const body = text.split('\n').map((line) => line.replace(/^\s*\/?\*+\/?\s?/, '').trimEnd())

  const first = body.findIndex((line) => line.trim() && !line.trim().startsWith('@'))

  if (first === -1) return ''

  const paragraph = []

  for (const raw of body.slice(first)) {
    // A one-line doc comment -- `/** Text. */` -- leaves a trailing asterisk once the
    // leader is stripped, and it landed at the end of every summary taken from one.
    const line = raw.replace(/\s*\*+\/?$/, '').trim()

    if (!line || line.startsWith('@')) break

    paragraph.push(line)
  }

  return paragraph.join(' ')
}

/**
 * `@example` blocks, in the order they were written.
 *
 * An example is worth more than a prop table for a component somebody has not met:
 * the table says what may be passed, and the example says what a real line looks
 * like. Two or three each, chosen to show the common case first and the reason the
 * other props exist second.
 */
function examplesIn(text) {
  const found = []
  let current = null

  for (const raw of text.split('\n')) {
    const line = raw.replace(/^\s*\*\s?/, '').replace(/\s*\*\/\s*$/, '')

    if (line.trim().startsWith('@example')) {
      if (current) found.push(current.join('\n').trim())
      current = []
      continue
    }

    if (current === null) continue
    if (line.trim().startsWith('@')) {
      found.push(current.join('\n').trim())
      current = null
      continue
    }

    current.push(line)
  }

  if (current) found.push(current.join('\n').trim())

  return found.filter(Boolean)
}

/** Props out of an emitted `export type XProps = { … }` block. */
function propsOf(source, component) {
  const start = source.indexOf(`export type ${component}Props = {`)

  if (start === -1) return null

  const end = source.indexOf('\n};', start)
  const block = source.slice(start, end)
  const props = []

  // Entries alternate: a doc comment, then the member it belongs to.
  //
  // The type is read by balancing brackets rather than by stopping at the first
  // semicolon, because an inline object type contains semicolons of its own. Doing
  // it the easy way truncated `Array<string | { value: string, label: string }>` to
  // `Array<string | { value: string` -- which still rendered, still looked like a
  // type, and was wrong in a way only somebody who already knew the answer would
  // catch.
  const pattern = /\/\*\*\s*\n((?:\s*\*.*\n)*?)\s*\*\/\s*\n\s*(\w+)(\??):\s*/g

  for (const match of block.matchAll(pattern)) {
    const [, comment, name, optional] = match
    const from = match.index + match[0].length
    let depth = 0
    let at = from

    while (at < block.length) {
      const char = block[at]

      // Angle brackets are deliberately not counted. `>` is the second half of `=>`
      // as often as it closes a generic, and counting it sent `() => void` to depth
      // -1, where the terminating semicolon never matched and the type ran on to
      // swallow every remaining member of the object. Braces and parens are enough:
      // a generic contains no top-level semicolon to stop at.
      if ('{(['.includes(char)) depth += 1
      else if ('})]'.includes(char)) depth -= 1
      else if (char === ';' && depth === 0) break

      at += 1
    }

    props.push({
      name,
      required: optional !== '?',
      type: block
        .slice(from, at)
        .replace(/\s*\n\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/import\("react"\)\./g, '')
        .replace(/; \}/g, ' }')
        .replace(/;/g, ',')
        .trim(),
      description: comment
        .split('\n')
        .map((line) => line.replace(/^\s*\*\s?-?\s?/, '').trim())
        .filter(Boolean)
        .join(' '),
    })
  }

  return props
}

/**
 * Component name -> the declarations that contain it.
 *
 * Keyed by what each file *declares* rather than by what it is called, because the
 * two stopped agreeing: <TextArea> is <Field> with a taller box and lives beside it
 * in Field.jsx. Keying by filename quietly rendered "Not found in dist/types" for a
 * component that was right there, which reads like a rename gone wrong rather than
 * a lookup that was never going to find it.
 */
const files = new Map()

for (const kind of ['control', 'source']) {
  for (const file of readdirSync(join(types, kind))) {
    if (!file.endsWith('.d.ts')) continue

    const source = readFileSync(join(types, kind, file), 'utf8')

    for (const [, name] of source.matchAll(/export declare function (\w+)\s*\(/g)) files.set(name, source)
  }
}

function render(component) {
  const source = files.get(component)

  if (!source) return `### ${component}\n\n_Not found in dist/types — was it renamed?_\n`

  const declaration = source.indexOf(`export declare function ${component}(`)
  const before = source.lastIndexOf('/**', declaration)
  const doc = before === -1 ? '' : source.slice(before, declaration)
  const summary = summarise(doc)
  const examples = examplesIn(doc)
  // Alphabetical, because a reader looking for one prop is scanning rather than
  // reading. Declaration order means something to whoever wrote the component and
  // nothing to somebody trying to remember whether it is `slug` or `slugify`.
  const props = (propsOf(source, component) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name))

  const lines = [`### ${component}`, '', '---', '', summary]

  for (const example of examples) lines.push('', '```jsx', example, '```')

  if (props.length) {
    lines.push(
      '',
      '| Prop | Type | Required | Description |',
      '| --- | --- | --- | --- |',
      // A union type contains pipes, and a pipe inside a markdown table cell ends
      // the cell. Escaped rather than reformatted, so the type printed is the type.
      //
      // Required gets a column of its own rather than a marker beside the name. It
      // is the first thing somebody needs from the table -- what do I have to pass
      // -- and appended to the name it competed with the name for the same glance.
      ...props.map((p) => `| \`${p.name}\` | \`${p.type.replace(/\|/g, '\\|')}\` | ${p.required ? 'Yes' : ''} | ${p.description} |`),
    )
  }

  return `${lines.join('\n')}\n`
}

const link = (name) => `[\`${name}\`](#${name.toLowerCase()})`

const page = `<!-- Generated by scripts/api-reference.mjs. Edit the JSDoc on the components instead. -->

# Component reference

Every piece of state has two components — one on the operator's dashboard, one on
air — and they meet at a path. That pairing is the whole mental model:

| What it is       | Dashboard | Source |
| ---------------- | --------- | ------ |
| Text             | ${link('Field')}, ${link('TextArea')} | ${link('Variable')} |
| Number           | ${link('Stepper')} | ${link('Variable')} |
| One of a list    | ${link('Select')}, ${link('Cycle')} | ${link('Variable')} |
| A yes/no         | ${link('Cycle')} with one option | ${link('Variable')} |
| Colour           | ${link('ColorPicker')} | ${link('Scene')} \`vars\` |
| A picture        | ${link('ImagePicker')}, ${link('ImageSelect')} | ${link('Image')} |
| Several pictures | ${link('ImageSelect')} \`multiple\` | ${link('ImageList')} |
| On or off        | ${link('ToggleButton')}, ${link('ImageToggle')} | ${link('Toggle')} |
| Counting down    | ${link('Countdown')}, ${link('CountdownTo')} | ${link('Timer')} |
| Counting up      | ${link('Stopwatch')} | ${link('Timer')} |
| A table          | ${link('Leaderboard')} | _yours_ |
| Scrolling text   | ${link('TextArea')} | ${link('Ticker')} |
| Wall clock       | — | ${link('Clock')} |
| Grouping         | ${link('Panel')}, ${link('Break')} | ${link('Scene')} |

Every component takes a \`name\`, and knows for itself where that name lives: values
under \`variables\`, on/off ones under \`toggles\`, clocks under \`timers\`. So a studio
author writes \`name="home.score"\` and never has to think about it — each component's
\`name\` row says which. The two that act on several values at once, ${link('ResetButton')} and
${link('SwapButton')}, take \`paths\` for the rare case of reaching outside \`variables\`.

Every component passes anything it does not recognise through to the DOM, so
\`style\`, \`data-*\` and the rest stay available.

## Dashboard

What the operator drives the show from. These render in \`src/control/Control.jsx\`,
which is an ordinary React component — put controls in a ${link('Panel')} and it arranges
them. Anything you *type* stages until you save, so a half-finished name never
reaches air; anything you *press* takes effect at once. Each entry below says which.

${AUTHORED.control.map((name) => `- ${link(name)}`).join('\n')}

${AUTHORED.control.map(render).join('\n')}
## Source

What goes on air. Each of these lives in a graphic under \`src/sources/\`, one file
per OBS browser source, wrapped in a ${link('Scene')}. They read the same paths the
dashboard writes and render nothing until the value has arrived, so a graphic
reopening mid-show never flashes a placeholder over the programme.

${AUTHORED.source.map((name) => `- ${link(name)}`).join('\n')}

${AUTHORED.source.map(render).join('\n')}`

if (check) {
  const existing = existsSync(out) ? readFileSync(out, 'utf8') : ''

  if (existing !== page) {
    console.error('docs/api.md is out of date. Run `pnpm api:reference`.')
    process.exit(1)
  }

  console.log('docs/api.md matches the shipped types')
} else {
  writeFileSync(out, page)
  console.log(`wrote ${out}`)
}
