// Integration smoke test for the whole stack.
//
// Unit tests cover the store in isolation; this covers the parts that only exist
// in a browser -- SharedWorker startup, BroadcastChannel fan-out between tabs,
// IndexedDB persistence, and animation timing. It is the test that catches wiring
// bugs a unit test cannot see, like a channel-name mismatch that leaves the UI
// looking connected while talking to nobody, or a transition that swaps its
// content at the wrong moment.
//
// Usage: pnpm demo:build && pnpm demo:preview   (one shell)
//        pnpm e2e                                (another)
//
// Takes the base URL as an argument, defaulting to the preview server's.

import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

/**
 * A file in the demo's public folder, as an absolute path.
 *
 * Anchored to this script rather than to the working directory. Relative paths
 * worked only when the test happened to be run from the repository root, and failed
 * under the `pnpm e2e` that the README tells you to use -- pnpm runs a package
 * script from the package directory.
 */
const asset = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url))

const BASE = process.argv[2] ?? 'http://localhost:4173'
let failed = 0
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${msg}`)
  if (!ok) failed += 1
}

/**
 * Poll for a condition instead of sleeping and hoping.
 *
 * Positive assertions ("this becomes true") race worker round-trips and a 300ms
 * transition cycle, so a fixed sleep either flakes or wastes time -- this one
 * flaked. Negative assertions ("this must never happen") keep their fixed waits
 * below, because there is nothing to poll for: you have to wait a bounded time and
 * then confirm nothing arrived.
 */
const becomes = async (page, fn, arg = null) => {
  try {
    await page.waitForFunction(fn, arg, { timeout: 5000 })
    return true
  } catch {
    return false
  }
}

/** Runs in the page; the needle arrives as becomes()'s argument. */
const sceneHas = (needle) => document.querySelector('.ss-scene')?.innerText.toLowerCase().includes(needle)

// CHROMIUM_PATH lets a sandbox point at a preinstalled browser; otherwise
// Playwright resolves its own.
const executablePath = process.env.CHROMIUM_PATH || undefined
const browser = await chromium.launch({ executablePath })
// Pinned explicitly: the stylesheet collapses transitions to 1ms under
// prefers-reduced-motion, which would make the timing assertions meaningless.
// Clipboard permission so the Copy button can be checked for what it actually put
// there, rather than only that it changed its label.
const context = await browser.newContext({ reducedMotion: 'no-preference', permissions: ['clipboard-read', 'clipboard-write'] })

const control = await context.newPage()
control.on('pageerror', (e) => console.log('[control pageerror]', e.message))
await control.goto(`${BASE}/#/`)
await control.waitForSelector('text=Clocks')
await control.waitForFunction(() => document.querySelectorAll('.ss-stepper output').length > 0)
await control.waitForTimeout(1000)

const homeName = control.locator('.ss-field:has-text("Home") input').first()
const saveButton = control.locator('.ss-save button').last()
/**
 * Ctrl+S on the control page.
 *
 * bringToFront() is load-bearing. Unlike click() and fill(), page.keyboard does not
 * focus the page first, so a keypress aimed at a background tab can be dropped --
 * and this test drives three tabs. Without it the save silently does nothing and a
 * later assertion fails somewhere unrelated, which is exactly how this flaked.
 */
const save = async () => {
  await control.bringToFront()
  await control.keyboard.press('Control+s')
}

// A graphic in a separate tab: same browser, therefore same SharedWorker.
const source = await context.newPage()
source.on('pageerror', (e) => console.log('[source pageerror]', e.message))
await source.goto(`${BASE}/#/source/scoreboard`)
await source.waitForSelector('.ss-scene')
await source.waitForTimeout(1200)

// innerText reflects CSS text-transform, so compare case-insensitively.
const scoreboardText = () =>
  source
    .locator('.ss-scene')
    .innerText()
    .then((t) => t.replace(/\s+/g, ' ').trim().toLowerCase())

// -- Staged edits ------------------------------------------------------------
// Typing must not reach air. An operator revises mid-word, and every intermediate
// state of that would otherwise be on screen.
await homeName.fill('Broncos')
await control.waitForTimeout(700)
check(!(await scoreboardText()).includes('broncos'), 'typing does not reach the graphic before a save')
// Save and Discard are icons, so the state lives in an attribute rather than in
// the label. A text assertion here would have to read a floppy disk.
check((await saveButton.getAttribute('data-pending')) === 'true', 'the board reports an unsaved change')
check(await control.locator('.ss-save .ss-discard').isVisible(), 'a discard appears alongside it')

await save()
check(await becomes(source, sceneHas, 'broncos'), 'Ctrl+S commits the edit to the graphic')
check(
  await becomes(control, () => document.querySelector('.ss-save button:last-of-type')?.dataset.pending === 'false'),
  'the board reports itself saved again',
)
check(!(await control.locator('.ss-save .ss-discard').isVisible()), 'and the discard goes away with nothing left to discard')

// Buttons stay immediate -- a stepper is one deliberate act with no half-typed state.
await control.locator('button[aria-label="Increase Home score"]').click()
await control.locator('button[aria-label="Increase Home score"]').click()
check(await becomes(control, () => document.querySelector('.ss-stepper output')?.textContent.trim() === '2'), 'two increments read as 2 on the control surface')
check(await becomes(source, sceneHas, '2'), 'button presses reach the graphic with no save')

// -- Transition ordering -----------------------------------------------------
// The regression that matters: content must swap at the *bottom* of the cycle. If
// it swaps on the way out, the new value shows inside the old value's outgoing
// animation -- it changes, then fades out, then fades in.
await source.evaluate(() => {
  const element = document.querySelector('.home-name')

  window.__frames = []

  const record = () => window.__frames.push([element.dataset.state, element.textContent.trim()])

  record()
  new MutationObserver(record).observe(element, { attributes: true, childList: true, subtree: true, characterData: true })
})

await homeName.fill('Vandals')
await save()
await source.waitForFunction(() => document.querySelector('.home-name')?.dataset.state === 'active' && /Vandals/i.test(document.body.textContent), null, {
  timeout: 5000,
})
await source.waitForTimeout(200)

const frames = await source.evaluate(() => window.__frames)
const seen = (state, text) => frames.some(([s, t]) => s === state && new RegExp(text, 'i').test(t))

console.log(`  transition: ${JSON.stringify(frames)}`)
check(seen('exiting', 'Broncos'), 'the old value is what fades out')
check(!seen('exiting', 'Vandals'), 'the new value never appears during the exit')
check(seen('active', 'Vandals'), 'the new value ends up active')

// -- Other graphics ----------------------------------------------------------
const lower = await context.newPage()
await lower.goto(`${BASE}/#/source/lowerthird`)
await lower.waitForSelector('.ss-scene')
await control.locator('.ss-field:has-text("Title") input').first().fill('Jane Doe')
await save()
await control.locator('button:has-text("Show lower third")').click()
check(await becomes(lower, sceneHas, 'jane doe'), 'toggle reveals the lower third with its text')

// Leaderboard: a paste drives the standings graphic, which reads the whole board
// from one subscription.
const standings = await context.newPage()
await standings.goto(`${BASE}/#/source/standings`)
await standings.waitForSelector('.ss-scene')

await control.locator('button:has-text("Show standings")').click()
await control.locator('.ss-leaderboard textarea').fill('Kim\t12\nAlvarez\t9\nOkafor\t7')
await save()
check(await becomes(standings, sceneHas, 'okafor'), 'standings graphic receives the pasted board')

const standingsText = (await standings.locator('.ss-scene').innerText()).replace(/\s+/g, ' ').trim()
console.log(`  standings: ${JSON.stringify(standingsText)}`)
check(/Kim/.test(standingsText) && /Alvarez/.test(standingsText) && /Okafor/.test(standingsText), 'leaderboard paste reaches the standings graphic')
check(/12/.test(standingsText) && /9/.test(standingsText), 'leaderboard scores parse into their own column')

// Table view edits the same single path.
await control.locator('.ss-leaderboard button:has-text("Table")').click()
await control.locator('.ss-leaderboard input[aria-label="Place 1 name"]').fill('Nakamura')
await save()
check(await becomes(standings, sceneHas, 'nakamura'), 'table view writes back to the same path')

// The place column is one or two digits doing one job. Measured rather than eyed,
// because a grid template is exactly the sort of thing that gets widened by
// accident and never noticed.
const place = await control.evaluate(() => {
  const row = document.querySelector('.ss-leaderboard .grid')

  return { columns: getComputedStyle(row).gridTemplateColumns, gap: getComputedStyle(row).columnGap }
})

console.log(`  standings grid: ${JSON.stringify(place)}`)
check(parseFloat(place.columns) <= 24, `the place column is narrow (${place.columns.split(' ')[0]})`)

// Escape abandons a single field's edit rather than committing it.
await homeName.fill('Typo')
await homeName.press('Escape')
check(await becomes(control, () => document.querySelector('.ss-field input')?.value === 'Vandals'), 'Escape reverts a field to the stored value')

// Image: the team name drives the logo through slugify.
check((await source.locator('.ss-image img').first().getAttribute('src')) === './logos/vandals.svg', 'team name resolves a logo through slugify')

// ResetButton unsets rather than blanking, so the source falls back to its default.
await control.locator('button:has-text("Reset scores")').click()
check(await becomes(source, () => /\b0\b/.test(document.querySelector('.ss-scene')?.innerText ?? '')), 'reset clears the score back to its fallback')

// Reload: state must come back from IndexedDB.
await source.reload()
await source.waitForSelector('.ss-scene')
// This is the assertion that flaked on a fixed sleep: after a reload the value
// arrives, then has to travel a full 300ms exit/enter cycle before it is on screen.
check(await becomes(source, sceneHas, 'vandals'), 'state survived a source reload')

// -- Unload / reload cycles --------------------------------------------------
// OBS sources can be set to unload when hidden, so a graphic is destroyed and
// rebuilt every time its scene comes back. Two things have to hold every time:
// nothing wrong is ever painted, and the state comes back.
//
// The recorder is installed with addInitScript so it runs before page scripts on
// every navigation, capturing everything the source ever displayed rather than
// just what it settled on.
await source.addInitScript(() => {
  window.__painted = []

  const record = () => {
    const text = document.body.innerText.replace(/\s+/g, ' ').trim()

    if (text && window.__painted.at(-1) !== text) window.__painted.push(text)
  }

  addEventListener('DOMContentLoaded', () => {
    record()
    new MutationObserver(record).observe(document.body, { childList: true, subtree: true, characterData: true })
  })
})

for (let cycle = 1; cycle <= 4; cycle += 1) {
  await source.reload()
  const back = await becomes(source, sceneHas, 'vandals')

  if (!back) {
    check(false, `state came back on reload cycle ${cycle}`)
    break
  }

  if (cycle === 4) check(true, 'state came back on four consecutive unload/reload cycles')
}

const painted = await source.evaluate(() => window.__painted)
console.log(`  first paint: ${JSON.stringify(painted[0] ?? null)}`)

// "Home" is the home-name fallback and must never reach air, because the store
// holds Vandals. ("Away" legitimately shows -- that path was never set.)
check(!painted.some((frame) => /\bHOME\b/i.test(frame)), 'the fallback never flashes on air during a reload')
check(painted.length > 0 && /vandals/i.test(painted[0]), 'the first thing painted already has real values in it')

// -- Ticker geometry ---------------------------------------------------------
// A percentage transform resolves against the element's own width, so the crawl
// used to start one text-width in from the left -- visibly partway across for a
// short message -- and travel a different distance than its duration assumed.
const ticker = await context.newPage()
await control.locator('.ss-field:has-text("Crawl text") textarea').fill('Short message')
await save()
await ticker.goto(`${BASE}/#/source/ticker`)
await ticker.waitForSelector('.ss-ticker-track', { timeout: 5000 })

const crawl = await ticker.evaluate(() => {
  const viewport = document.querySelector('.ss-ticker')
  const track = document.querySelector('.ss-ticker-track')
  const style = getComputedStyle(track)

  return {
    across: viewport.clientWidth,
    content: track.scrollWidth,
    from: style.getPropertyValue('--ss-ticker-from').trim(),
    to: style.getPropertyValue('--ss-ticker-to').trim(),
    duration: parseFloat(style.animationDuration),
  }
})

console.log(`  ticker: ${JSON.stringify(crawl)}`)
check(crawl.from === `${crawl.across}px`, 'the crawl starts one full viewport-width off the right edge')
check(crawl.to === `${-crawl.content}px`, 'the crawl ends one full text-width off the left edge')
// speed is 120px/s in the demo, and distance must match the duration or the crawl
// moves at the wrong rate for its length.
check(Math.abs(crawl.duration - (crawl.across + crawl.content) / 120) < 0.05, 'duration matches the distance actually travelled')

// -- Narrow dock -------------------------------------------------------------
// An OBS dock can be a narrow column. Nothing may overflow it horizontally --
// a board you have to scroll sideways during a show is unusable.
const narrow = await browser.newContext({ viewport: { width: 260, height: 900 } })
const dock = await narrow.newPage()
await dock.goto(`${BASE}/#/`)
await dock.waitForSelector('text=Clocks')
await dock.waitForTimeout(900)

const overflow = await dock.evaluate(() => {
  const root = document.documentElement
  const widest = [...document.querySelectorAll('.ss-panel, .ss-panel-body > *')]
    .map((el) => Math.round(el.getBoundingClientRect().right))
    .reduce((max, right) => Math.max(max, right), 0)

  return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, widestRight: widest }
})

console.log(`  narrow dock: ${JSON.stringify(overflow)}`)
check(overflow.scrollWidth <= overflow.clientWidth + 1, 'a 260px dock has no horizontal scroll')
check(overflow.widestRight <= overflow.clientWidth + 1, 'no control escapes a 260px dock')

await narrow.close()

// -- Asset library -----------------------------------------------------------
// Images arrive two ways and both become a named entry: a URL gets pasted, a file
// gets dropped. A graphic then points at the key rather than at a hash or a link.
await control.locator('.ss-asset-library input[aria-label="Image URL"]').fill(`${BASE}/logos/broncos.svg`)
await control.locator('.ss-asset-library input[aria-label="Asset name"]').fill('home-badge')
await control.locator('.ss-asset-library button:has-text("Add URL")').click()

check(
  await becomes(control, () => [...document.querySelectorAll('.ss-asset-tile')].some((tile) => /home-badge/.test(tile.textContent))),
  'a pasted URL becomes a named library entry',
)

await control.locator('.ss-asset-library input[aria-label="Add image files"]').setInputFiles(asset('logos/vandals.svg'))
check(
  await becomes(control, () => [...document.querySelectorAll('.ss-asset-tile')].some((tile) => /vandals/.test(tile.textContent))),
  'a dropped file becomes a named library entry',
)

// Adding the same file again keeps both entries distinct rather than clobbering the
// first -- the same photo can legitimately be filed under two names.
await control.locator('.ss-asset-library input[aria-label="Add image files"]').setInputFiles(asset('logos/vandals.svg'))
check(
  await becomes(control, () => [...document.querySelectorAll('.ss-asset-tile')].some((tile) => /vandals-2/.test(tile.textContent))),
  'a second copy gets its own key rather than colliding',
)

// -- Groups ------------------------------------------------------------------
// A hundred images in one flat list is a scroll an operator has to read. The key
// is a path, so the part before the last slash is a group, and the name field
// means "group" when more than one file arrives at once.
const library = control.locator('.ss-asset-library')

await library.locator('input[aria-label="Asset name"]').fill('units')
// The whole set, not a token two: the progress readout and the filter both only
// exist above a threshold, and a batch small enough to skip them proves nothing.
const units = ['artillery', 'battle-tank', 'engineer', 'gunship', 'missile-squad', 'rifleman', 'scout-bike', 'sniper']

await library.locator('input[aria-label="Add image files"]').setInputFiles(units.map((unit) => asset(`units/${unit}.svg`)))

check(
  await becomes(control, () => document.querySelectorAll('.ss-asset-group').length >= 2),
  'a batch files itself under the group that was typed',
)

const filed = await control.evaluate(() => {
  const section = [...document.querySelectorAll('.ss-asset-group')].find((group) => group.querySelector('h3')?.textContent.startsWith('units'))

  return section ? [...section.querySelectorAll('.ss-asset-name')].map((name) => name.textContent).sort() : null
})

console.log(`  grouped: ${JSON.stringify(filed)}`)
check(filed?.length === units.length, `every file in the batch lands in the same group (${filed?.length} of ${units.length})`)
check(filed?.includes('rifleman'), 'and the tile shows the name inside the group, not the whole path')

// The dropdown is where this pays for itself: an optgroup is a menu you aim at
// rather than a list you read.
const options = await control.evaluate(() => {
  const select = document.querySelector('.ss-image-picker select')

  return {
    groups: [...select.querySelectorAll('optgroup')].map((group) => group.label),
    grouped: [...select.querySelectorAll('optgroup option')].map((option) => option.textContent),
    loose: [...select.children].filter((child) => child.tagName === 'OPTION').map((option) => option.textContent),
  }
})

console.log(`  optgroups: ${JSON.stringify(options.groups)}`)
check(options.groups.includes('units'), 'the picker dropdown groups by the key path')
check(options.grouped.includes('rifleman'), 'a grouped option reads as its short name')
check(
  options.loose.some((label) => label.includes('home-badge')),
  'an ungrouped entry stays loose rather than being filed under a heading of its own',
)

// The filter only appears once there is enough to lose something in.
const filterBox = library.locator('input[aria-label="Filter images"]')

check(await filterBox.isVisible(), 'a filter appears once the library is big enough to need one')

await filterBox.fill('gunship')
check(
  await becomes(control, () => document.querySelectorAll('.ss-asset-tile').length === 1),
  'filtering narrows the library to what was asked for',
)

await filterBox.fill('')
check(await becomes(control, () => document.querySelectorAll('.ss-asset-tile').length > 1), 'and clearing it brings everything back')

// -- Picking from the library ------------------------------------------------
const sponsor = await context.newPage()
await sponsor.goto(`${BASE}/#/source/sponsor`)
await sponsor.waitForSelector('.ss-scene')

const sponsorPicker = control.locator('.ss-image-picker').filter({ hasText: 'Logo' })
await sponsorPicker.locator('select').selectOption('asset:home-badge')
await control.locator('.ss-field:has-text("Sponsor name") input').fill('Acme')
await control.waitForTimeout(500)

check(!(await sponsor.locator('.ss-scene').innerText()).includes('Acme'), 'a selection does not reach air before a save')

await save()
await control.locator('button:has-text("Show sponsor")').click()
check(
  await becomes(sponsor, (url) => document.querySelector('.sponsor-image img')?.src === url, `${BASE}/logos/broncos.svg`),
  'a URL entry resolves to its URL on the graphic',
)

// A colour the operator controls reaches a CSS custom property, so anything the
// stylesheet can express is drivable without a component for it. Typed as text
// here; the swatch and the presets write the same path.
const accent = control.locator('.ss-color-picker').filter({ hasText: 'Accent' })
await accent.locator('input[type="text"], input:not([type])').fill('rgb(240, 169, 60)')
await save()
check(
  await becomes(sponsor, () => getComputedStyle(document.querySelector('.ss-scene')).getPropertyValue('--accent').trim() === 'rgb(240, 169, 60)'),
  'an operator value drives a CSS custom property through Scene vars',
)

// A preset is one click and a save, for the operator who does not know their hex.
// A custom property holds the token it was given rather than a computed colour, so
// this reads back the hex exactly as written.
await accent.locator('.ss-color-preset[title="#22c55e"]').click()
await save()
check(
  await becomes(sponsor, () => getComputedStyle(document.querySelector('.ss-scene')).getPropertyValue('--accent').trim() === '#22c55e'),
  'a colour preset writes the same path as the field',
)

// The swatch only accepts #rrggbb, so it has to fall back rather than go blank on
// the rgb() string typed above -- and pick up a real hex when there is one. Polled,
// because a save clears the draft here before the committed value has come back
// round through the worker, and a single read can land in that gap.
check(
  await becomes(control, () => document.querySelector('.ss-color-picker input[type="color"]')?.value === '#22c55e'),
  'the swatch reflects the stored colour',
)

// -- The board's own affordances ---------------------------------------------
// Pasting a link is the common case -- a logo lives somewhere already -- so the URL
// row comes first and the file button sits under it.
const libraryOrder = await control.evaluate(() => {
  const library = document.querySelector('.ss-asset-library')
  const url = library.querySelector('input[aria-label="Image URL"]')
  const file = [...library.querySelectorAll('button')].find((button) => /choose files/i.test(button.textContent))

  // 4 === Node.DOCUMENT_POSITION_FOLLOWING
  return Boolean(url.compareDocumentPosition(file) & 4)
})

check(libraryOrder, 'the file button sits below the URL row, not in front of it')

// Picking a whole folder is the answer to "a hundred images, one at a time?".
check(await control.locator('.ss-choose-folder').isVisible(), 'a folder can be added in one go, not file by file')

// Tailwind's reset leaves a button at `cursor: default`, so nothing on the board
// looked pressable until this was put back.
const cursors = await control.evaluate(() => {
  const read = (selector) => {
    const element = document.querySelector(selector)

    return element ? getComputedStyle(element).cursor : null
  }

  // The save button is deliberately not the sample here: with nothing staged it is
  // disabled, and a disabled control should read `default`. Which it does -- that
  // is the second check.
  return { enabled: read('.ss-reset'), disabled: read('.ss-save button:disabled'), name: read('.ss-asset-name'), select: read('.ss-image-picker select') }
})

console.log(`  cursors: ${JSON.stringify(cursors)}`)
check(cursors.enabled === 'pointer', 'a control on the board says it can be pressed')
check(cursors.select === 'pointer', 'and so does a dropdown')
check(cursors.disabled === 'default', 'a disabled control does not pretend otherwise')
check(cursors.name === 'text', 'a click-to-rename name says it can be edited instead')

// -- Uploads on air ----------------------------------------------------------
// The podcast case: a guest headshot arrives minutes before air. The magnifier
// opens the same library as a modal, so a picker is a chooser without leaving the
// board.
const guest = await context.newPage()
await guest.goto(`${BASE}/#/source/guest`)
await guest.waitForSelector('.ss-scene')

const guestPicker = control.locator('.ss-image-picker').filter({ hasText: 'Headshot' })
await guestPicker.locator('.ss-browse').click()
check(await becomes(control, () => document.querySelector('.ss-asset-dialog')?.open === true), 'Browse opens the library as a modal')

// Sized by insets, so it fills the viewport but never touches its edges. A dialog
// is centred by `margin: auto` in the UA stylesheet, which quietly beats the insets
// and leaves the box at its content size in the middle -- the failure looks like
// nothing happened rather than like a broken rule.
const modal = await control.evaluate(() => {
  const box = document.querySelector('.ss-asset-dialog').getBoundingClientRect()

  return { left: box.left, top: box.top, right: innerWidth - box.right, bottom: innerHeight - box.bottom, width: box.width, height: box.height }
})

check(
  [modal.left, modal.top, modal.right, modal.bottom].every((gap) => gap > 4 && gap < 60),
  `the modal keeps an even margin off every edge (${JSON.stringify(modal)})`,
)
check(modal.height > 400, 'and takes the height it is given rather than hugging its content')

await control.locator('.ss-asset-dialog .ss-asset-tile button[title*="vandals"]').first().click()
check(await becomes(control, () => document.querySelector('.ss-asset-dialog')?.open !== true), 'picking an entry closes the modal')

await control.locator('.ss-field:has-text("Guest name") input').fill('Ada Okafor')
await save()
await control.locator('button:has-text("Show guest")').click()

check(
  await becomes(guest, () => (document.querySelector('.guest-photo img')?.src ?? '').startsWith('blob:')),
  'a stored upload resolves to an image on the graphic',
)
check(await becomes(guest, sceneHas, 'ada okafor'), 'the guest name lands alongside it')

// The bytes live in IndexedDB beside the document, so a rebuilt source still finds
// them -- the case a data URI in the doc would have solved expensively.
await guest.reload()
await guest.waitForSelector('.ss-scene')
check(await becomes(guest, () => (document.querySelector('.guest-photo img')?.src ?? '').startsWith('blob:')), 'an uploaded image survives a source reload')

// -- One scene, three clocks, pictures as controls ---------------------------
// The demo scene an esports show actually runs: two drafts, a map, and all three
// kinds of clock in one browser source. These checks exist because the image
// controls and the count-up clock have no other coverage -- a dropdown writing the
// wrong path is obvious, a tile grid writing the wrong path is not.
const match = await context.newPage()
match.on('pageerror', (e) => console.log('[match pageerror]', e.message))
await match.goto(`${BASE}/#/source/match`)
await match.waitForSelector('.ss-scene')

const seconds = (text) => text.split(':').reduce((total, part) => total * 60 + Number(part), 0)
const sceneAttr = (selector) => match.locator(`.ss-scene ${selector}`).first().getAttribute('src')
const picker = (label, index = 0) => control.locator('.ss-image-select').filter({ hasText: label }).nth(index)

// A tile is a button, so it goes to air on click like every other button.
await picker('Faction').locator('button[data-value="vanguard"]').click()
check(await becomes(match, () => !!document.querySelector('.ss-scene img[src*="factions/vanguard"]')), 'an image pick reaches the graphic with no save')

await picker('Commander').locator('button[data-value="kestrel"]').click()
check(await becomes(match, sceneHas, 'kestrel'), 'the picked commander names itself on the scene')
check((await sceneAttr('img[src*="commanders"]')) === './commanders/kestrel.svg', 'the stored slug templates the portrait path')

// Away side writes its own paths -- the same component twice must not collide.
await picker('Faction', 1).locator('button[data-value="syndicate"]').click()
check(await becomes(match, () => !!document.querySelector('.ss-scene img[src*="factions/syndicate"]')), 'the away picker writes the away path')

// -- Army composition (multi-select) -----------------------------------------
const army = picker('Army')

for (const unit of ['rifleman', 'battle-tank', 'gunship', 'sniper', 'engineer']) await army.locator(`button[data-value="${unit}"]`).click()

check(await becomes(control, () => document.querySelectorAll('.ss-image-select button[aria-pressed="true"]').length >= 5), 'five units register as picked')
check(await army.locator('button[data-value="artillery"]').isDisabled(), 'a full army blocks the sixth pick rather than dropping it silently')
check((await army.locator('button[data-value="battle-tank"] span:last-child').textContent()) === '2', 'picks are numbered in the order they were made')

await control.locator('button:has-text("Show armies")').click()
check(
  await becomes(match, () => document.querySelectorAll('.ss-scene .ss-image-list img').length === 5, null),
  'the whole army reaches the scene as a row of images',
)

// Clicking a picked unit takes it back off and frees the slot.
await army.locator('button[data-value="sniper"]').click()
check(
  await becomes(control, () => !document.querySelector('.ss-image-select button[data-value="artillery"]')?.disabled),
  'removing a unit frees the slot again',
)

// A red button reading "draft" says it is dangerous but not what it does.
check(
  (await control.locator('.ss-reset').first().textContent()).trim() === 'Reset draft',
  'a reset button names the thing it resets',
)

// -- Map ---------------------------------------------------------------------
await control.locator('.ss-image-select').filter({ hasText: 'Map' }).locator('button[data-value="redline"]').click()
await control.locator('button:has-text("Show map")').click()
check(await becomes(match, sceneHas, 'redline'), 'the map card names the picked map')
check((await sceneAttr('img[src*="maps"]')) === './maps/redline.svg', 'the map graphic follows the same slug')

// -- Three clocks ------------------------------------------------------------
// Duration countdown.
const round = control.locator('.ss-timer-button').filter({ hasText: 'Round' })
await round.locator('input').fill('4:30')
await round.locator('button:has-text("Start")').click()
check(await becomes(match, () => /0[45]:\d\d/.test(document.querySelector('.ss-scene')?.innerText ?? '')), 'the duration countdown reaches the scene')

// Count-up. Nothing ticks in the store -- both pages derive the same number from
// the same stored origin.
await control.locator('.ss-stopwatch button:has-text("Start")').click()

// Read immediately, inside the first second: counting up floors, so a stopwatch
// that has just been pressed has not completed a second and must say so. Rounding
// up -- right for a countdown -- shows 00:01 the instant it starts, which is a
// whole second the show never had.
const first = (await control.locator('.ss-stopwatch output').textContent()).trim()
check(first === '00:00', `a stopwatch reads 00:00 for its first second (got ${first})`)

await control.locator('button:has-text("Show elapsed")').click()
check(await becomes(control, () => /00:0[1-9]/.test(document.querySelector('.ss-stopwatch output')?.textContent ?? '')), 'the count-up clock advances')

// The complaint this fixes was about *when* the number changes, not what it says.
// The old loop chased the next second with one setTimeout, and computed the delay
// for a count-up as the time since the last boundary rather than until the next --
// so the value was always right whenever it rendered, and it rendered at genuinely
// arbitrary moments. Nothing that samples the text alone can see that. Watching the
// element and timing the gaps between changes can.
const gaps = await control.evaluate(async () => {
  const output = document.querySelector('.ss-stopwatch output')
  const changes = []
  let last = output.textContent
  const started = performance.now()

  while (performance.now() - started < 6500) {
    await new Promise((resolve) => setTimeout(resolve, 40))

    if (output.textContent === last) continue

    last = output.textContent
    changes.push(performance.now())
  }

  return changes.slice(1).map((at, index) => Math.round(at - changes[index]))
})

// Bounds chosen from both implementations measured over this window. The old one
// produced 805, 563, 1329, 1449, 967, 886; this one holds 966-1007. Note that the
// *mean* cannot tell them apart -- the value changes once a second either way, so
// the error is entirely in the spread. An average would have called the bug fine.
const spread = Math.max(...gaps) - Math.min(...gaps)

console.log(`  stopwatch tick gaps: ${gaps.join('ms, ')}ms (spread ${spread}ms)`)
check(gaps.length >= 4, 'the clock ticked often enough to measure')
check(
  gaps.every((gap) => gap > 850 && gap < 1150),
  'every tick lands about a second after the last, none stretched or bunched',
)
check(spread < 250, `ticks are evenly spaced rather than merely correct on average (spread ${spread}ms)`)
check(
  await becomes(match, () => /elapsed\s+00:0\d/i.test(document.querySelector('.ss-scene')?.innerText ?? '')),
  'the count-up clock reads the same on the scene',
)

await control.locator('.ss-stopwatch button:has-text("Pause")').click()
const held = (await control.locator('.ss-stopwatch output').textContent()).trim()
await control.waitForTimeout(1500)
check((await control.locator('.ss-stopwatch output').textContent()).trim() === held, 'pausing holds the elapsed time instead of losing it')

await control.locator('.ss-stopwatch button:has-text("Resume")').click()
await control.waitForTimeout(1200)
const resumed = (await control.locator('.ss-stopwatch output').textContent()).trim()

// Comparing against the held value, not merely against "it changed": a clock that
// restarted from zero on resume would also change, and that is the bug.
console.log(`  stopwatch: held ${held}, resumed ${resumed}`)
check(seconds(resumed) > seconds(held), 'resuming carries on from the held time rather than restarting')

// Wall-clock countdown.
await control.locator('.ss-countdown input[type="time"]').fill('23:59')
await control.locator('.ss-countdown button:has-text("Start")').click()
await control.locator('button:has-text("Show pre-show")').click()
check(await becomes(match, () => /starting in/i.test(document.querySelector('.ss-scene')?.innerText ?? '')), 'the pre-show card appears')
check(
  await becomes(match, () => !/soon/i.test(document.querySelector('.ss-scene')?.innerText ?? '')),
  'the wall-clock countdown shows a real time, not its fallback',
)

// -- Transition variants -----------------------------------------------------
// The state machine sets three phase classes and never touches a transform, so a
// variant is only ever CSS. These checks are here because a mistyped class name
// fails silently: the graphic still appears, it just stops moving.
const styleOf = (selector) =>
  match.evaluate((sel) => {
    const element = document.querySelector(sel)

    if (!element) return null

    const style = getComputedStyle(element)

    return {
      state: element.dataset.state,
      transform: style.transform,
      opacity: style.opacity,
      clipPath: style.clipPath,
      duration: style.transitionDuration,
      ease: style.transitionTimingFunction,
      animation: style.animationName,
    }
  }, selector)

// Hidden, the map card is parked 12rem off the left edge and stays fully opaque,
// because `opaque` makes it a slide rather than a fade.
//
// Measuring this while hidden is only meaningful because --ss-shift is a length. A
// percentage would resolve against the collapsed box and read as no movement at
// all -- which is how the demo was written first, and what this caught.
await control.locator('button:has-text("Hide map")').click()
check(await becomes(match, () => document.querySelector('.ss-slide-right')?.dataset.state === 'inactive'), 'the map card goes inactive when hidden')

const parked = await styleOf('.ss-slide-right')
console.log(`  slide-right parked: ${JSON.stringify(parked)}`)
check(/^matrix\(/.test(parked.transform) && parseFloat(parked.transform.split(',').at(4)) <= -192, 'a hidden slide is parked off-screen, not just transparent')
check(parked.opacity === '1', 'opaque keeps a slide from fading as well as moving')
check(parked.duration === '0.45s', 'the studio -- not the framework -- owns the duration')

await control.locator('button:has-text("Show map")').click()
check(
  await becomes(match, () => getComputedStyle(document.querySelector('.ss-slide-right')).transform === 'none'),
  'showing it slides the card back to its resting place',
)

// The keyframe variant: the machine reads animation duration as well as
// transition duration, so the content swap still waits for the bounce to land.
const bounced = await styleOf('.ss-bounce')
console.log(`  bounce: ${JSON.stringify(bounced)}`)
check(bounced.animation === 'ss-bounce-in', 'the bounce variant runs a keyframe animation, not a transition')

// Leaving has to be animated too. An entrance animation ends with `both`, so its
// final transform is filled in by the animation -- take the animation away on the
// way out and the element drops straight to the off-phase transform with nothing
// to interpolate from. It teleports to the top of its travel and fades there. The
// giveaway is that the transform is *already* at its full offset on the first
// frame of exiting, which is exactly what this samples.
await control.locator('button:has-text("Hide pre-show")').click()

const leaving = await match.evaluate(async () => {
  const element = document.querySelector('.ss-bounce')
  const frames = []

  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve))

    const style = getComputedStyle(element)
    frames.push({ state: element.dataset.state, animation: style.animationName, y: Math.round(new DOMMatrix(style.transform).m42) })
  }

  return frames
})

console.log(`  bounce exit: ${JSON.stringify(leaving)}`)
check(leaving[0].animation === 'ss-bounce-out', 'the bounce runs its own exit animation rather than snapping back')
check(Math.abs(leaving[0].y) < 20, `the exit starts from where the card was resting, not from the end of its travel (y=${leaving[0].y})`)

// Easing is a class, and it is the difference between mechanical and produced.
const overshoot = await styleOf('.ss-slide-up')
check(/cubic-bezier\(0.34, 1.56/.test(overshoot.ease), 'ease-back resolves to an overshooting curve')

// A wipe reveals rather than fades, so it overrides the phase opacity.
const wiped = await styleOf('.ss-wipe')
console.log(`  wipe: ${JSON.stringify(wiped)}`)
check(wiped.clipPath.startsWith('inset('), 'a wipe is clipped rather than faded')
check(wiped.opacity === '1', 'a wipe stays fully opaque throughout')

// -- Browser-source URLs -----------------------------------------------------
// Hash routing means every source shares one origin and one path, so OBS -- which
// names a browser source from its URL -- sees a dozen identical pages and produces
// a scene full of "localhost", "localhost (2)". The name rides in `?layer-name=`,
// ahead of the hash, because that is where OBS looks.
//
// Shown and linked are deliberately different: the encoded parameter roughly
// doubles every line for something nobody reads off the screen.
const listed = await control.evaluate(() =>
  [...document.querySelectorAll('section:has(> h2) a[href*="/source/"]')].map((link) => ({ shown: link.textContent.trim(), href: link.href })),
)

console.log(`  source urls: ${listed.length} listed, first ${listed[0]?.href}`)
check(listed.length >= 6, 'every registered source is listed for OBS')
check(
  listed.every((row) => /\?layer-name=[^#]+#\/source\//.test(row.href)),
  'each link carries a layer name ahead of the hash',
)
check(
  listed.every((row) => !row.shown.includes('layer-name')),
  'and the URL on screen stays readable, without it',
)
check(new Set(listed.map((row) => row.href.split('#')[0])).size === listed.length, 'no two links are the same page as far as OBS is concerned')

// Copy has to carry the parameter even though the text does not -- the clipboard is
// how the URL actually reaches OBS.
await control.locator('section:has(> h2) li:has-text("scoreboard") button:has-text("Copy")').first().click()
const copiedUrl = await control.evaluate(() => navigator.clipboard.readText())

console.log(`  copied: ${copiedUrl}`)
check(copiedUrl.includes('layer-name=Demo%20scoreboard'), 'Copy puts the named URL on the clipboard, not the bare one')

// The page has to actually honour it, or the parameter is decoration.
const titled = await context.newPage()
await titled.goto(listed.find((row) => row.href.includes('scoreboard')).href)
await titled.waitForSelector('.ss-scene')
check(await becomes(titled, () => document.title === 'Demo scoreboard'), `the source names itself from the URL (got "${await titled.title()}")`)
await titled.close()

// -- Capability guard --------------------------------------------------------
// Simulate a browser whose SharedWorker predates the options object -- it coerces
// { type: 'module' } to a name and loads the script as a classic worker, which is
// the silent failure the guard exists to convert into a visible one.
const legacy = await context.newPage()
await legacy.addInitScript(() => {
  const Real = window.SharedWorker

  window.SharedWorker = class {
    constructor(url, nameOrOptions) {
      // Never reads .type, exactly as a pre-2020 implementation would not.
      return new Real(url, String(nameOrOptions))
    }
  }
})
await legacy.goto(`${BASE}/#/`)
await legacy.waitForTimeout(1200)
const legacyText = await legacy.locator('body').innerText()
check(/can.?t run/i.test(legacyText), 'guard shows a clear message on a browser without module shared workers')
check(/114/.test(legacyText), 'guard names the minimum versions')
check(!/Clocks/.test(legacyText), 'guard replaces the board rather than rendering a dead one')

await browser.close()
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exitCode = failed ? 1 : 0
