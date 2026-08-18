// The demo's pick lists.
//
// One module, imported by both the control board and the scene, because the two
// have to agree: the control writes a slug and the scene templates a file path off
// it. Keeping the list in one place is what makes `./units/:value:.svg` safe.
//
// The art is generated -- see scripts/placeholders.mjs. Swap the files, or edit
// these lists and regenerate; nothing else in the demo knows the names.

const toSlug = (label) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** `['Kestrel']` -> `[{ value: 'kestrel', label: 'Kestrel', image: './commanders/kestrel.svg' }]` */
const roster = (folder, labels) =>
  labels.map((label) => {
    const value = toSlug(label)

    return { value, label, image: `./${folder}/${value}.svg` }
  })

export const FACTIONS = roster('factions', ['Vanguard', 'Syndicate', 'Freeholders'])
export const COMMANDERS = roster('commanders', ['Kestrel', 'Vulcan', 'Wren', 'Solomon', 'Iris', 'Ash'])
export const UNITS = roster('units', ['Rifleman', 'Missile Squad', 'Scout Bike', 'Battle Tank', 'Artillery', 'Gunship', 'Sniper', 'Engineer'])
export const MAPS = roster('maps', ['Dry Harbour', 'Redline', 'Ashfall'])

/** How many units make an army. The control caps the grid; the scene caps the row. */
export const ARMY_SIZE = 5

export const labelOf = (options, value) => options.find((option) => option.value === value)?.label ?? ''
