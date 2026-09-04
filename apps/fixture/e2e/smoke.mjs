// Integration smoke test for the whole stack.
//
// Unit tests cover the store in isolation; this covers the parts that only exist
// in a browser -- SharedWorker startup, BroadcastChannel fan-out between tabs,
// IndexedDB persistence, and animation timing. It is the test that catches wiring
// bugs a unit test cannot see, like a channel-name mismatch that leaves the UI
// looking connected while talking to nobody, or a transition that swaps its
// content at the wrong moment.
//
// Usage: pnpm fixture:build && pnpm fixture:preview   (one shell)
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
const becomes = async (page, fn, arg = null, timeout = 5000) => {
  try {
    await page.waitForFunction(fn, arg, { timeout })
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

/**
 * Uncaught errors from any page in this context, failed at the end rather than logged.
 *
 * These used to be per-page `pageerror` handlers that only printed, on three of the
 * dozen pages this test opens -- which meant a graphic could throw on air and the
 * suite would still say every check passed. One listener on the context catches every
 * page, including the ones opened later, and the assertion at the bottom is what makes
 * it a test rather than a log line.
 */
const crashes = []
context.on('weberror', (error) => crashes.push(`${new URL(error.page().url()).hash || '#/'} — ${error.error().message}`))

const control = await context.newPage()
await control.goto(`${BASE}/#/`)
await control.waitForSelector('text=Clocks')
await control.waitForFunction(() => document.querySelectorAll('.ss-stepper input').length > 0)
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
check(await becomes(control, () => document.querySelector('.ss-save button:last-of-type')?.dataset.pending === 'false'), 'the board reports itself saved again')
check(!(await control.locator('.ss-save .ss-discard').isVisible()), 'and the discard goes away with nothing left to discard')

// Buttons stay immediate -- a stepper is one deliberate act with no half-typed state.
await control.locator('button[aria-label="Increase Home score"]').click()
await control.locator('button[aria-label="Increase Home score"]').click()
check(await becomes(control, () => document.querySelector('.ss-stepper input')?.value === '2'), 'two increments read as 2 on the control surface')
check(await becomes(source, sceneHas, '2'), 'button presses reach the graphic with no save')

// -- A textarea has to take a line break -------------------------------------
// The draft handler commits on Enter, which is right for a one-line field and made
// the newline key unreachable in a box that has lines. An operator typing a second
// line of a crawlBox committed the first instead.
const crawlBox = control.locator('.ss-field:has-text("Crawl text") textarea')

await crawlBox.fill('first line')
await crawlBox.press('Enter')
await crawlBox.type('second line')

check((await crawlBox.inputValue()).includes('\n'), 'Enter inserts a line break in a TextArea rather than saving')
check((await crawlBox.inputValue()) === 'first line\nsecond line', 'and the text either side of it survives')
check((await saveButton.getAttribute('data-pending')) === 'true', 'the edit is still staged, not committed by the Enter')

// Escape still abandons it, and Ctrl+S still commits -- a textarea loses one way to
// save, not the ability to save.
await crawlBox.press('Escape')
check(await becomes(control, () => !document.querySelector('.ss-field textarea')?.value?.includes('second line')), 'Escape still abandons a multi-line edit')

// And a one-line field keeps committing on Enter, which is the whole reason the two
// behave differently.
await homeName.fill('Broncos')
await homeName.press('Enter')
check(await becomes(source, sceneHas, 'broncos'), 'Enter still commits in a single-line Field')

// -- Swapping sides ----------------------------------------------------------
// Locators, not evaluate: `:has-text()` is a Playwright selector and means nothing
// to document.querySelector, which throws rather than returning null.
const awayName = control.locator('.ss-field:has-text("Away") input').first()
// Both halves of the list are written the same way round, and the halves trade
// position for position. Getting this backwards puts a name onto a score.
await awayName.fill('Vandals')
await save()
await control.locator('button[aria-label="Increase Away score"]').click()

const sides = async () => ({
  home: await homeName.inputValue(),
  away: await awayName.inputValue(),
  homeScore: await control.locator('.ss-stepper input').nth(0).inputValue(),
  awayScore: await control.locator('.ss-stepper input').nth(1).inputValue(),
})

// Wait for that increment to land before snapshotting. Reading straight after the
// click captured the away score as it was *before* the press, and the swap then
// looked wrong against a "before" that never existed on screen.
check(await becomes(control, () => document.querySelectorAll('.ss-stepper input')[1]?.value === '1'), 'the away score reaches 1 before the sides are read')

const sidesBefore = await sides()
await control.locator('.ss-swap').click()
await control.waitForTimeout(600)
const sidesAfter = await sides()

console.log(`  swap: ${JSON.stringify(sidesBefore)} -> ${JSON.stringify(sidesAfter)}`)
check(sidesAfter.home === sidesBefore.away && sidesAfter.away === sidesBefore.home, 'swapping trades the two names')
check(sidesAfter.homeScore === sidesBefore.awayScore && sidesAfter.awayScore === sidesBefore.homeScore, 'and the two scores, not a name onto a score')

// Back again, which both proves it is its own inverse and leaves the board as this
// section found it -- everything below reads the same values.
await control.locator('.ss-swap').click()
await control.waitForTimeout(600)
check(JSON.stringify(await sides()) === JSON.stringify(sidesBefore), 'and swapping again puts every value back where it started')

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
await lower.goto(`${BASE}/#/source/lower-third`)
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
    // Where the text starts relative to where the clipping starts. `overflow`
    // cuts at the padding box; the text begins at the content box.
    pad: parseFloat(getComputedStyle(viewport).paddingLeft) || 0,
    from: parseFloat(style.getPropertyValue('--ss-ticker-from')),
    to: parseFloat(style.getPropertyValue('--ss-ticker-to')),
    duration: parseFloat(style.animationDuration),
  }
})

console.log(`  ticker: ${JSON.stringify(crawl)}`)

// Stated as the two edges rather than as the formula, because the formula was
// what was wrong: it read plausibly while leaving a padding's worth of text on
// screen at the wrap, which is seen as a stutter rather than as an offset.
check(crawl.from + crawl.pad === crawl.across, 'the crawl starts with its first letter exactly at the clipping edge')
check(crawl.to + crawl.pad + crawl.content === 0, 'and ends with its last letter exactly at the other one')
check(crawl.pad > 0, 'with padding in play, which is the case that used to be wrong')
// speed is 120px/s in the demo, and distance must match the duration or the crawl
// moves at the wrong rate for its length.
check(Math.abs(crawl.duration - (crawl.across + crawl.content) / 120) < 0.05, 'duration matches the distance actually travelled')

// -- Every width, not just the narrow one -------------------------------------
// A dock is whatever width somebody dragged it to, and the interesting failures
// are not at the extremes. A Reset button used to hang outside its panel at
// exactly 680px -- the one width where three clocks fit on a row and each is
// barely wide enough to hold its own contents -- which is invisible to a test that
// checks a narrow dock and a full screen and nothing between.
//
// So: sweep, and ask two questions at each stop. Does the page scroll sideways
// (a board you have to scroll during a show is unusable), and does any control
// hold more than it has room for (which is how something escapes its panel).
const widths = [260, 320, 380, 440, 500, 560, 620, 680, 740, 820, 960, 1180]
const breaks = []

for (const width of widths) {
  const sized = await browser.newContext({ viewport: { width, height: 900 } })
  const dock = await sized.newPage()

  await dock.goto(`${BASE}/#/`)
  await dock.waitForSelector('text=Clocks')
  await dock.waitForTimeout(400)

  const found = await dock.evaluate(() => {
    const root = document.documentElement
    const spills = [...document.querySelectorAll('.ss-panel-body > *')]
      .filter((el) => el.scrollWidth - el.clientWidth > 1)
      .map(
        (el) =>
          el.className
            .toString()
            .split(' ')
            .find((c) => c.startsWith('ss-')) ?? el.tagName,
      )

    return { sideways: root.scrollWidth > root.clientWidth + 1, spills: [...new Set(spills)] }
  })

  if (found.sideways) breaks.push(`${width}px scrolls sideways`)
  if (found.spills.length) breaks.push(`${width}px: ${found.spills.join(', ')} overflows`)

  await sized.close()
}

console.log(`  widths swept: ${widths.length}, breaks: ${breaks.length ? breaks.join(' | ') : 'none'}`)
check(!breaks.length, `no control escapes its panel at any width (${widths[0]}-${widths.at(-1)}px)`)

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

// Waited on by *count*, not by the group merely existing. A batch is added one
// file at a time -- each is read, hashed and written to IndexedDB in turn -- so the
// group appears as soon as the first one lands, and a check that fires then reads a
// half-filled list and calls it a lost file. The failure looked exactly like the
// deduplication racing itself, which is a considerably more alarming thing to go
// looking for than a test that did not wait.
const inUnits = (want) =>
  becomes(
    control,
    (n) =>
      [...document.querySelectorAll('.ss-asset-group')]
        .find((group) => group.querySelector('h3')?.textContent.startsWith('units'))
        ?.querySelectorAll('.ss-asset-name').length === n,
    want,
  )

check(await inUnits(units.length), 'a batch files itself under the group that was typed')

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
check(await becomes(control, () => document.querySelectorAll('.ss-asset-tile').length === 1), 'filtering narrows the library to what was asked for')

await filterBox.fill('')
check(await becomes(control, () => document.querySelectorAll('.ss-asset-tile').length > 1), 'and clearing it brings everything back')

// -- Folders -----------------------------------------------------------------
// A real directory pick, not a multi-select standing in for one: setInputFiles on a
// webkitdirectory input populates webkitRelativePath the way the browser does, so
// this exercises the path the operator actually takes.
const folderInput = library.locator('input[aria-label="Add a folder of images"]')

check((await folderInput.getAttribute('webkitdirectory')) !== null, 'the folder input asks the browser for a directory')

await folderInput.setInputFiles(fileURLToPath(new URL('../public/maps', import.meta.url)))

const fromFolder = await becomes(control, () => [...document.querySelectorAll('.ss-asset-group h3')].some((heading) => heading.textContent.startsWith('maps')))

check(fromFolder, 'a folder files itself under its own name, with no typing at all')

// And a typed group renames that folder rather than nesting under it -- otherwise
// "players" plus a folder called "Headshots 2024" buries everything two deep.
await library.locator('input[aria-label="Asset name"]').fill('crests')
await folderInput.setInputFiles(fileURLToPath(new URL('../public/factions', import.meta.url)))

// Poll for the group being *finished*, not merely present. The heading appears as
// soon as the first of the three files lands, so waiting on the heading and then
// counting in the same tick is a race -- it read one name instead of three, which
// looks like the rename having dropped files rather than the read having been early.
check(
  await becomes(control, () => {
    const section = [...document.querySelectorAll('.ss-asset-group')].find((group) => group.querySelector('h3')?.textContent.startsWith('crests'))

    return section?.querySelectorAll('.ss-asset-name').length === 3
  }),
  'a typed group appears as its own heading',
)

const renamed = await control.evaluate(() => {
  const section = [...document.querySelectorAll('.ss-asset-group')].find((group) => group.querySelector('h3')?.textContent.startsWith('crests'))

  return section ? [...section.querySelectorAll('.ss-asset-name')].map((name) => name.textContent).sort() : null
})

console.log(`  folder renamed to a group: ${JSON.stringify(renamed)}`)
check(renamed?.length === 3, 'a typed group takes the place of the folder name')
check(renamed?.includes('vanguard'), 'and the filenames inside it survive intact')
check(
  await control.evaluate(() => ![...document.querySelectorAll('.ss-asset-group h3')].some((h) => h.textContent.startsWith('crests/factions'))),
  'the folder name is replaced, not nested under',
)

// -- A count said in icons ----------------------------------------------------
// Three objectives is three marks, not the word three. `source` is already open on
// the match scene, so this drives the board and watches what goes to air.
{
  // `source` is open on the scoreboard; the tallies are on the match scene.
  const scene = await context.newPage()

  await scene.goto(`${BASE}/#/source/match`)
  await scene.waitForSelector('.ss-scene')

  const objectives = control.locator('.ss-stepper input[aria-label="Home objectives"]')
  const set = async (locator, to) => {
    await locator.fill(String(to))
    await locator.press('Enter')
  }

  await set(objectives, 3)
  check(await becomes(scene, () => document.querySelectorAll('.ss-tally').length > 0, null, 8000), 'a tally reaches the scene')

  check(
    await becomes(scene, () => document.querySelector('.tally-objectives')?.querySelectorAll('.ss-tally-mark').length === 3),
    'a count of three draws three marks',
  )

  // Zero is an empty space rather than a placeholder: the row *is* the count.
  await set(objectives, 0)
  check(await becomes(scene, () => !document.querySelector('.tally-objectives')), 'and nothing at all at zero')

  // A stuck key costs a clamp, not the layout -- but clamping quietly would put a
  // wrong number on air, so the real one is still on the element.
  await set(objectives, 40)
  check(
    await becomes(scene, () => document.querySelector('.tally-objectives')?.querySelectorAll('.ss-tally-mark').length === 12),
    'an unreadable count is clamped',
  )
  check(
    await becomes(scene, () => document.querySelector('.tally-objectives')?.dataset.count === '40'),
    'and the row still carries what the count really was, so a studio can say so',
  )
  check(await becomes(scene, () => document.querySelector('.tally-objectives')?.hasAttribute('data-over')), 'and marks itself as having overflowed')

  // Only what changed animates. A row that re-animates in full every time the
  // count moves reads as the graphic glitching rather than as something having
  // happened -- and it is what wrapping the whole row in one transition gets you.
  await set(objectives, 2)
  await becomes(scene, () => document.querySelector('.tally-objectives')?.querySelectorAll('.ss-tally-mark').length === 2)
  await scene.waitForTimeout(500)

  // Watched rather than sampled. The entrance is two frames wide, so polling for a
  // mark caught mid-animation is a race that passes or fails on timing. Every phase
  // change is recorded instead, and the assertion is about which marks changed at
  // all -- which is the actual claim.
  await scene.evaluate(() => {
    window.__phases = []

    const row = document.querySelector('.tally-objectives')
    const watch = new MutationObserver((records) => {
      const marks = [...row.querySelectorAll('.ss-tally-mark')]

      for (const record of records) {
        // Marks only. <Image> is a transition of its own and carries data-state
        // too, so an unfiltered observer reports the picture inside a mark fading
        // in as though a mark had moved.
        if (!record.target.classList.contains('ss-tally-mark')) continue

        window.__phases.push({ at: marks.indexOf(record.target), state: record.target.dataset.state })
      }
    })

    watch.observe(row, { attributes: true, attributeFilter: ['data-state'], subtree: true })
  })

  await set(objectives, 3)
  await becomes(scene, () => document.querySelector('.tally-objectives')?.querySelectorAll('.ss-tally-mark').length === 3)
  await scene.waitForTimeout(600)

  const phases = await scene.evaluate(() => window.__phases)

  console.log(`  phase changes on a 2 -> 3: ${JSON.stringify(phases)}`)
  check(
    phases.some((phase) => phase.at === 2),
    'the mark that was added animates in',
  )
  check(
    phases.every((phase) => phase.at === 2),
    'and the two already on screen are left alone, rather than the whole row re-animating',
  )

  await set(objectives, 0)
  await scene.close()
}

// -- Out of a fixed number ----------------------------------------------------
// The other shape: as many marks as it takes to win, the won ones filled. The row
// holds its width from the first frame, so nothing beside it moves as it fills.
{
  const scene = await context.newPage()

  await scene.goto(`${BASE}/#/source/match`)
  await scene.waitForSelector('.ss-scene')

  const games = control.locator('.ss-stepper input[aria-label="Home games"]')
  const race = () => scene.locator('.tally-series').first()

  // Off "None" and onto three, which is what wins a best-of-five. A cycle steps
  // through its options, so that is three presses rather than one.
  const length = control.locator('.ss-cycle:has-text("Games to win")')

  for (let i = 0; i < 3; i += 1) await length.click()

  const filled = () =>
    scene.evaluate(() => {
      const row = document.querySelector('.tally-series')

      return row ? { marks: row.querySelectorAll('.ss-tally-mark').length, on: row.querySelectorAll('.ss-tally-mark[data-filled]').length } : null
    })

  await games.fill('0')
  await games.press('Enter')

  const empty = await becomes(scene, () => {
    const row = document.querySelector('.tally-series')

    return row && row.querySelectorAll('.ss-tally-mark').length > 1 && row.querySelectorAll('.ss-tally-mark[data-filled]').length === 0
  })

  check(empty, 'a race draws its whole length before anything is won')

  const before = await race().boundingBox()

  await games.fill('1')
  await games.press('Enter')
  check(
    await becomes(scene, () => document.querySelector('.tally-series')?.querySelectorAll('.ss-tally-mark[data-filled]').length === 1),
    'and fills one as one is won',
  )

  const after = await race().boundingBox()

  // The whole reason a race draws its empties: the name above it must not move.
  check(Math.abs(before.width - after.width) < 1, 'without the row changing width, so nothing beside it shifts')

  console.log(`  race: ${JSON.stringify(await filled())}, width ${Math.round(before.width)} -> ${Math.round(after.width)}`)
  await scene.close()
}

// -- A folder of pictures, playing --------------------------------------------
// The eight units filed under `units/` just above are the show. Nothing in the
// studio lists them; the graphic asks the library for the group -- which is why
// this sits next to the upload that puts them there, rather than after the section
// further down that empties the library out again.
{
  const on = () => [...document.querySelectorAll('.ss-slide')].findIndex((slide) => slide.hasAttribute('data-on'))

  // `context.newPage()`, not `browser.newPage()`: the latter opens a fresh context
  // with its own empty IndexedDB, so the library the graphic reads would be bare
  // and the slideshow would correctly have nothing to play.
  const slides = await context.newPage()

  slides.on('pageerror', (error) => crashes.push(`standby: ${error.message}`))
  await slides.goto(`${BASE}/#/source/standby`)

  check(await becomes(slides, () => document.querySelectorAll('.ss-slide').length === 8), 'every picture in the group gets a slide')
  check(await becomes(slides, () => document.querySelectorAll('.ss-slide[data-on]').length === 1), 'and exactly one of them is on')

  // Only the near ones hold a decoded image. A full-frame decode is megabytes and
  // a folder can be hundreds, so the element is always there -- keeping nth-child
  // stable -- and the picture inside it is not.
  check(
    await becomes(slides, () => document.querySelectorAll('.ss-slide img').length === 3),
    'only the current picture and its neighbours are decoded, not the whole folder',
  )
  check(
    await becomes(slides, () => {
      const all = [...document.querySelectorAll('.ss-slide')]
      const at = all.findIndex((slide) => slide.hasAttribute('data-on'))

      return all[at].querySelector('img') && all[(at + 1) % all.length].querySelector('img')
    }),
    'and the one coming next is among them, so a change is a fade rather than a wait',
  )

  const first = await slides.evaluate(on)

  check(
    await becomes(slides, (was) => [...document.querySelectorAll('.ss-slide')].findIndex((s) => s.hasAttribute('data-on')) !== was, first, 4000),
    'it advances on its own',
  )

  // The claim the whole design rests on. Two browser sources on one graphic --
  // programme and preview, or two machines -- run their own render loops and share
  // no state. If the picture came off a counter they would drift apart within
  // minutes; it comes off the clock, so they cannot.
  const second = await context.newPage()

  second.on('pageerror', (error) => crashes.push(`standby (second): ${error.message}`))
  await second.goto(`${BASE}/#/source/standby`)
  await second.waitForSelector('.ss-slide[data-on]')

  let agreed = 0
  let disagreed = 0

  for (let i = 0; i < 12; i += 1) {
    const [a, b] = await Promise.all([slides.evaluate(on), second.evaluate(on)])

    if (a === b) agreed += 1
    else disagreed += 1
    await slides.waitForTimeout(350)
  }

  console.log(`  two outputs sampled 12 times: ${agreed} agreed, ${disagreed} did not`)
  // Not "always": a sample can straddle a boundary the two pages cross a few
  // milliseconds apart. Drift would fail this outright, and a counter opened
  // seconds later would disagree on nearly every sample.
  check(disagreed <= 1, 'a second output opened later shows the same picture, having agreed with nobody')

  await slides.close()
  await second.close()
}

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
// A grouped key, with a slash in it. The route is a splat rather than a single
// segment, so a studio can file its graphics the way it thinks about them --
// `lower-thirds/guest`, `game/scoreboard` -- instead of flattening everything into
// one list. This 404'd before the route changed.
await guest.goto(`${BASE}/#/source/lower-thirds/guest`)
await guest.waitForSelector('.ss-scene')

const guestPicker = control.locator('.ss-image-picker').filter({ hasText: 'Headshot' })
// `force` because this button summons a modal that covers it. Playwright dispatches
// the click, the dialog opens over the button, and its own follow-up actionability
// check then finds the element covered -- so it retries, into a state its first
// click created, until it times out. Nothing is wrong with the page: the dialog is
// open by then, which is what the next line asserts.
await guestPicker.locator('.ss-browse').click({ force: true })
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
check((await control.locator('.ss-reset').first().textContent()).trim() === 'Reset draft', 'a reset button names the thing it resets')

// -- Map ---------------------------------------------------------------------
await control.locator('.ss-image-select').filter({ hasText: 'Map' }).locator('button[data-value="redline"]').click()
await control.locator('button:has-text("Show map")').click()
check(await becomes(match, sceneHas, 'redline'), 'the map card names the picked map')
check((await sceneAttr('img[src*="maps"]')) === './maps/redline.svg', 'the map graphic follows the same slug')

// -- Three clocks ------------------------------------------------------------
// Duration countdown.
const round = control.locator('.ss-countdown').filter({ hasText: 'Round' })
await round.locator('input').fill('4:30')
await round.locator('button:has-text("Start")').click()
check(await becomes(match, () => /0[45]:\d\d/.test(document.querySelector('.ss-scene')?.innerText ?? '')), 'the duration countdown reaches the scene')

// And it rests on the zero it was counting towards. A countdown used to vanish the
// instant it ran out, so the number the whole thing exists to reach was the one
// frame nobody ever saw. Two seconds, watched all the way down and then held.
// The graphic has to be the foreground tab for this one. rAF is suspended in a
// background tab, so a clock there does not repaint and neither does Playwright's
// poll -- every check that needs a *change* on this page would fail for reasons
// that have nothing to do with the clock. (The checks above pass backgrounded
// because they are already true on the first poll.)
await control.locator('button[aria-label="Stop Round"]').click()
await round.locator('input').fill('2')
await round.locator('button:has-text("Start")').click()
await match.bringToFront()
// Stopping and restarting inside one animation is a quarter of a second of
// operator, and it used to strand the graphic mid-exit showing the old clock for
// the rest of the show -- see Transition. Doing it deliberately here is the cheapest
// place that case will ever be covered.
check(
  await becomes(match, () => /00:0[12]/.test(document.querySelector('.ss-scene')?.innerText ?? ''), null, 4000),
  'a short countdown counts down where it can be seen',
)
check(
  await becomes(match, () => /00:00/.test(document.querySelector('.ss-scene')?.innerText ?? ''), null, 6000),
  'and shows 00:00 rather than skipping the number it was counting to',
)

// And then leaves, without being asked. A graphic that waits to be dismissed is one
// somebody has to remember mid-show, and remembering it is worth nothing: the
// countdown is over and everybody watching can see that it is over.
check(
  await becomes(match, () => /--:--/.test(document.querySelector('.ss-scene')?.innerText ?? ''), null, 4000),
  'and then takes itself off air, without an operator doing anything',
)

await control.bringToFront()
check(
  await becomes(control, () => !!document.querySelector('.ss-countdown input')),
  'and the control is back to offering a fresh duration, with nothing left to dismiss',
)

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
await control.locator('.ss-countdown-to input[type="time"]').fill('23:59')
await control.locator('.ss-countdown-to button:has-text("Start")').click()
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

// `inactive` is set when the card starts leaving, not when it has left: the
// transform animates over 450ms after that. Reading the moment the state flips
// catches it at the beginning of its travel, still at zero, which is
// indistinguishable from a card that never moved -- exactly the bug this check
// exists to catch. So wait for the travel to finish rather than for the state.
await becomes(match, () => {
  const transform = getComputedStyle(document.querySelector('.ss-slide-right')).transform

  return /^matrix\(/.test(transform) && parseFloat(transform.split(',').at(4)) <= -192
})

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
// Behind the header menu now, with the room and the image store. Wiring OBS is a
// once-ever job, and a panel for it was spending every show after that taking up
// the space under the controls an operator actually uses.
await control.locator('.ss-menu-open').click()
await control.locator('.ss-menu-sources').click()
await control.waitForSelector('.ss-sources-dialog a[href*="/source/"]')

const listed = await control.evaluate(() =>
  [...document.querySelectorAll('.ss-sources-dialog a[href*="/source/"]')].map((link) => ({ shown: link.textContent.trim(), href: link.href })),
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
await control.locator('.ss-sources-dialog li:has-text("Scoreboard") button:has-text("Copy")').first().click()
const copiedUrl = await control.evaluate(() => navigator.clipboard.readText())

console.log(`  copied: ${copiedUrl}`)
check(copiedUrl.includes(`layer-name=${encodeURIComponent('SS - Demo - Scoreboard')}`), 'Copy puts the named URL on the clipboard, not the bare one')

// The page has to actually honour it, or the parameter is decoration.
const titled = await context.newPage()
await titled.goto(listed.find((row) => row.href.includes('scoreboard')).href)
await titled.waitForSelector('.ss-scene')
check(await becomes(titled, () => document.title === 'SS - Demo - Scoreboard'), `the source names itself from the URL (got "${await titled.title()}")`)

// The name OBS shows is derived from the key rather than declared beside it, so a
// key written for a URL still reads as English in a scene list.
const derived = listed.find((row) => row.href.includes('/source/lower-third'))

check(Boolean(derived), 'a source key can carry hyphens for the words it contains')
check(decodeURIComponent(derived?.href ?? '').includes('SS - Demo - Lower Third'), 'and its OBS name is title-cased from that key, not a second copy of it')
check(derived?.shown.includes('lower-third'), 'while the URL keeps the key as written')
await titled.close()

// The tooltip on a dialog's close button used to appear the moment the dialog did:
// `showModal()` moves focus to the first focusable thing it finds, and a plain
// focus rule fired on that. Focus-visible is the distinction -- a keyboard user
// still gets the label, somebody who clicked a menu item does not.
check(
  await control.evaluate(() => {
    const bubble = document.querySelector('.ss-sources-dialog .ss-tooltip-bubble')

    return bubble ? getComputedStyle(bubble).opacity === '0' : false
  }),
  'opening a dialog does not pop the tooltip on its close button',
)

await control.locator('.ss-sources-dialog button[aria-label="Close the source list"]').click()

// -- Typing a number into a stepper -----------------------------------------
// The buttons add, because two operators tapping +1 at once have to come to +2.
// The field sets, because going from 3 to 10 by pressing + seven times is not a
// control. Both write to the same path and the difference is the intention.
const score = control.locator('.ss-stepper input[aria-label="Home score"]')

await score.fill('3')
await score.press('Enter')
check(
  await becomes(control, () => document.querySelector('.ss-stepper input[aria-label="Home score"]')?.value === '3'),
  'a stepper takes a number typed straight in',
)

// And the buttons still add to it rather than replacing it, which is the property
// the typed field could quietly have broken.
await control.locator('.ss-stepper button[aria-label="Increase Home score"]').click()
check(
  await becomes(control, () => document.querySelector('.ss-stepper input[aria-label="Home score"]')?.value === '4'),
  'and the buttons still add to what was typed',
)

// Escape abandons, the same bargain a text field makes. A half-typed number must
// not reach air just because somebody clicked away mid-thought.
await score.fill('99')
await score.press('Escape')
check(
  await becomes(control, () => document.querySelector('.ss-stepper input[aria-label="Home score"]')?.value === '4'),
  'and Escape abandons an edit rather than committing it',
)

// -- Starting over -----------------------------------------------------------
// Destructive, so it asks -- and it asks inside the page rather than through
// window.confirm, which an OBS dock may never draw. One click arms, a second does
// it, and a lone click has to be provably harmless.
//
// Counted inside the open dialog, not on the page: an ImagePicker renders a library
// of its own, so a bare `.ss-asset-tile` count is the pickers plus the dialog and
// answers a question nobody asked.
const openLibrary = async () => {
  await control.locator('.ss-menu-open').click()
  await control.locator('.ss-menu-images').click()
  await control.waitForSelector('.ss-asset-dialog[open] .ss-asset-library')
  // The tiles come out of IndexedDB a beat after the dialog does, so a count taken
  // on the dialog appearing is a count of nothing.
  await control.waitForSelector('.ss-asset-dialog[open] .ss-asset-tile')
}

const closeLibrary = () => control.locator('.ss-asset-dialog[open] button[aria-label="Close the image library"]').click()
const tiles = () => control.locator('.ss-asset-dialog[open] .ss-asset-tile').count()

await openLibrary()
const before = await tiles()
await closeLibrary()

const scoreNow = () => control.locator('.ss-stepper input[aria-label="Home score"]').inputValue()

await control.locator('.ss-menu-open').click()
await control.locator('.ss-menu-reset').click()
await control.waitForSelector('.ss-reset-dialog[open]')

await control.locator('.ss-reset-show').click()
check(
  await becomes(control, () => /click to confirm/i.test(document.querySelector('.ss-reset-show')?.textContent ?? '')),
  'one click on a reset arms it and says so rather than doing it',
)
const armedScore = await scoreNow()

check(armedScore === '4', `and the show is still there after that first click (score ${armedScore})`)

await control.locator('.ss-reset-show').click()
check(await becomes(control, () => document.querySelector('.ss-stepper input[aria-label="Home score"]')?.value === '0'), 'a second click resets the show')

await control.locator('.ss-reset-dialog button[aria-label="Close"]').click()

// The whole reason the reset takes an exception rather than clearing everything:
// the show is what happened tonight, the library is what somebody spent an
// afternoon filing, and one button that loses both is one nobody dares press.
await openLibrary()
check((await tiles()) === before, `and leaves the ${before} images alone (found ${await tiles()})`)

// -- Emptying the library ----------------------------------------------------
// Its own button, in with the images, because it is the only one of these whose
// blast radius is a thing you are looking at.
const purge = control.locator('.ss-asset-dialog[open] .ss-asset-purge .ss-confirm')

check(new RegExp(`Remove all ${before}`).test((await purge.textContent()) ?? ''), 'the library offers to empty itself, and counts what that means')

await purge.click()
check(
  await becomes(control, () => /click to confirm/i.test(document.querySelector('.ss-asset-purge .ss-confirm')?.textContent ?? '')),
  'one click arms that one too',
)
check((await tiles()) === before, 'and removes nothing on its own')

await purge.click()
check(
  await becomes(control, () => {
    const library = document.querySelector('.ss-asset-dialog[open] .ss-asset-library')

    return library?.querySelectorAll('.ss-asset-tile').length === 0 && /Nothing here yet/.test(library?.textContent ?? '')
  }),
  'a second click empties it, back to the empty state rather than an empty grid',
)

await closeLibrary()

// -- Rebindable shortcuts ----------------------------------------------------
// The save key is the operator's, not the framework's. What matters here is that a
// rebind actually moves it: the new chord saves, and the old one stops.
await control.bringToFront()
await control.locator('.ss-menu-open').click()
await control.locator('.ss-menu-hotkeys').click()
check(await becomes(control, () => Boolean(document.querySelector('.ss-hotkeys-dialog[open]'))), 'the menu opens the shortcut settings')

const saveRow = control.locator('.ss-hotkey-row').first()
const saveSetter = saveRow.locator('.ss-hotkey-set')
check((await saveSetter.getAttribute('data-chord')) === 'Ctrl+S', 'save starts on Ctrl+S')

await saveSetter.click()
check((await saveSetter.getAttribute('data-recording')) === 'true', 'the setter listens for a key rather than asking you to spell one')

await control.keyboard.press('F8')
check(await becomes(control, () => document.querySelector('.ss-hotkeys-dialog[open] .ss-hotkey-set')?.dataset.chord === 'F8'), 'pressing a key binds it')

// Escape has to keep meaning "close this", or a recorder that swallowed it would
// trap somebody in the dialog.
await control.keyboard.press('Escape')
check(await becomes(control, () => !document.querySelector('.ss-hotkeys-dialog[open]')), 'Escape still closes the dialog')

// The real test: the show, through the new key.
const rebound = control.locator('.ss-field:has-text("Home") input').first()
await rebound.fill('Rebound')
check((await control.locator('.ss-save button[data-pending]').getAttribute('data-pending')) === 'true', 'an edit is staged, waiting for whichever key saves')

await control.keyboard.press('Control+s')
await control.waitForTimeout(300)
check((await control.locator('.ss-save button[data-pending]').getAttribute('data-pending')) === 'true', 'the old chord no longer saves')

await control.keyboard.press('F8')
check(await becomes(control, () => document.querySelector('.ss-save button[data-pending]')?.dataset.pending === 'false'), 'the newly bound key does')
check(await becomes(source, sceneHas, 'rebound'), 'and the edit reached the graphic')

// The reason these moved out of localStorage: a studio's durable state is
// IndexedDB, and that is what an export carries to another machine. A setting left
// in localStorage would be the one thing that did not travel.
const where = await control.evaluate(async () => {
  const dbs = await indexedDB.databases()

  return {
    local: Object.keys(localStorage).filter((key) => key.includes('hotkey')),
    databases: dbs.map((db) => db.name).filter(Boolean),
  }
})
console.log(`  settings: localStorage ${JSON.stringify(where.local)}, databases ${JSON.stringify(where.databases)}`)
check(where.local.length === 0, 'no shortcut is left behind in localStorage')
check(
  where.databases.some((name) => name.endsWith(':settings')),
  'the settings database exists, so an export has something to carry',
)

// And it has to survive the trip. The read is asynchronous while the snapshot is
// not, so a reload is the case where a board could plausibly come back on the
// defaults and nobody would notice until a show.
await control.reload()
await control.waitForSelector('.ss-save')
check(
  await becomes(control, () => document.querySelector('.ss-save button[aria-keyshortcuts]')?.getAttribute('aria-keyshortcuts') === 'F8'),
  'the rebound key is still bound after a reload',
)

// Put it back, so everything below still saves the way it expects to.
await control.locator('.ss-menu-open').click()
await control.locator('.ss-menu-hotkeys').click()
await control.locator('.ss-hotkey-reset').click()
check(
  await becomes(control, () => document.querySelector('.ss-hotkeys-dialog[open] .ss-hotkey-set')?.dataset.chord === 'Ctrl+S'),
  'restoring defaults puts save back on Ctrl+S',
)
await control.keyboard.press('Escape')
await becomes(control, () => !document.querySelector('.ss-hotkeys-dialog[open]'))

// -- Plugins -----------------------------------------------------------------
// The seam end to end: the worker reports what is installed, the board renders the
// config a plugin declared, and saving restarts it against the new values. The
// fixture's plugin talks to nothing on purpose -- what is under test is the wiring,
// not any particular game.
await control.bringToFront()
await control.locator('.ss-menu-open').click()
await control.locator('.ss-menu-plugins').click()
check(await becomes(control, () => Boolean(document.querySelector('.ss-plugins-dialog[open]'))), 'the menu opens the plugin settings')

// Waited for rather than counted. The dialog opens immediately and the list does
// not: the panel asks the worker over postMessage and renders "Asking the worker..."
// until the answer comes back, so a count taken the instant the dialog appears is
// reading the loading state and calling it a missing plugin.
check(
  await becomes(control, () => document.querySelectorAll('.ss-plugin[data-plugin="feed"]').length === 1),
  'the worker reports the plugin the studio registered',
)
check(await becomes(control, () => document.querySelector('.ss-plugin[data-plugin="feed"]')?.dataset.status === 'connected'), 'and says it is running')

// The fields came from the plugin's declaration, not from anything the board knows.
// Safe to read directly now: the row above is rendered, so these are with it.
// Scoped to the row under test. There is more than one plugin installed now, so a
// bare `.ss-plugin-save` is two buttons and a bare `.ss-help-toggle` is two links --
// the demo feed's and Rocket League's. Which is the point of the scoping rather than
// an annoyance: a panel with one plugin in it never proved anything about a panel.
const row = control.locator('.ss-plugin[data-plugin="feed"]')
const pluginSave = row.locator('.ss-plugin-save')

const label = control.locator('#ss-plugin-field-label')
const rate = control.locator('#ss-plugin-field-rate')
check((await label.inputValue()) === 'Feed', 'a declared text field arrives at its default')
check((await rate.inputValue()) === '120', 'and a declared number field does too')

// Nothing to save until something changes.
check((await pluginSave.isDisabled()) === true, 'saving is offered only once something has changed')

await label.fill('Rehearsal')
// Polled, because the button follows a React render rather than the keystroke.
check(
  await becomes(control, () => document.querySelector('.ss-plugin[data-plugin="feed"] .ss-plugin-save')?.disabled === false),
  'and offered as soon as it has',
)

await pluginSave.click()
check(await becomes(control, () => document.querySelector('#ss-plugin-field-label')?.value === 'Rehearsal'), 'the new value is stored and read back')

// The real proof: the plugin was rebuilt against it, and its events still reach the
// studio's handler, which writes through the ordinary mutation path.
check(await becomes(match, sceneHas, 'rehearsal'), 'the restarted plugin drives the graphic with the new config')

// Help is written by whoever knows how the thing works and shown where the question
// gets asked. It crosses postMessage from the worker, so it is data rather than
// markup -- a plugin cannot put HTML on an operator's board.
check(
  (await control.locator('.ss-plugin[data-plugin="feed"] .ss-plugin-summary').textContent()).includes('Ticks on a timer'),
  'a plugin says in one line what it is',
)
check((await row.locator('.ss-help').count()) === 0, 'setup instructions stay out of the way until asked for')

await row.locator('.ss-help-toggle').click()
check(
  await becomes(control, () => /talks to nothing/.test(document.querySelector('.ss-plugin[data-plugin="feed"] .ss-help')?.textContent ?? '')),
  'and open when they are',
)
check((await row.locator('.ss-help-steps li').count()) === 3, 'numbered steps render as steps')
check((await row.locator('.ss-help-note').count()) === 1, 'and a warning renders as one')

await row.locator('.ss-help-toggle').click()
check(await becomes(control, () => !document.querySelector('.ss-plugin[data-plugin="feed"] .ss-help')), 'and close again')

// A value it will not start on is reported rather than swallowed.
await rate.fill('0')
await pluginSave.click()
check(
  await becomes(control, () => /more than zero/i.test(document.querySelector('.ss-plugin[data-plugin="feed"] .ss-plugin-problem')?.textContent ?? '')),
  'a config the plugin refuses says why, on the board',
)
// Once. The manifest is read back after every save, so a rejected one arrives as
// the plugin's standing reason as well as the save's -- and the same sentence in
// two places reads as two problems.
check((await row.locator('.ss-plugin-reason').count()) === 0, 'and says it once, not twice')

// Put it back, so the rest of the run is not driven by a stopped plugin.
await rate.fill('120')
await pluginSave.click()
await becomes(control, () => document.querySelector('.ss-plugin[data-plugin="feed"]')?.dataset.status === 'connected')
await control.keyboard.press('Escape')
await becomes(control, () => !document.querySelector('.ss-plugins-dialog[open]'))

// -- Capability guard --------------------------------------------------------
// Simulate a browser whose SharedWorker predates the options object -- it coerces
// { type: 'module' } to a name and loads the script as a classic worker, which is
// -- A toggle that is off still holds its place -------------------------------
// An empty box has no size, so anything laid out around a toggle used to move when
// it turned on and move back when it turned off. Worse, a percentage transform
// measured against a collapsed box is zero, which parks a slide exactly where it
// should have landed -- a fault that looks fine until the take where it matters.
{
  const spacing = await context.newPage()

  await spacing.goto(`${BASE}/#/source/spacing`)
  await spacing.waitForSelector('.marker-below')
  await spacing.waitForTimeout(600)

  const box = await spacing.locator('.probe-toggle').boundingBox()
  const opacity = await spacing.locator('.probe-toggle').evaluate((el) => getComputedStyle(el).opacity)

  check(Math.round(box.height) === 96, 'a toggle that is off still occupies its space')
  check(opacity === '0', 'and is hidden rather than removed')

  // `cut` is a variant like any other -- the component knows nothing about it, so
  // what proves it works is what the element computes to.
  const cut = await spacing.locator('.probe-cut').evaluate((el) => getComputedStyle(el).transitionDuration)
  const fade = await spacing.locator('.probe-fade').evaluate((el) => getComputedStyle(el).transitionDuration)

  check(parseFloat(cut) === 0, 'transition="cut" computes to no duration at all')
  check(parseFloat(fade) > 0, 'while the default still fades')

  await spacing.close()
}

// -- A graphic that crashes ---------------------------------------------------
// On air it must paint nothing. A missing lower third reads as a cue that did not
// fire; a red error box reads as the broadcast being broken. `?debug` -- which an
// author types and which the Browser sources list never puts in a URL -- shows it
// instead.
//
// Its own context, because a crash here would otherwise land in the `crashes` list
// that every other page shares and fail the run at the bottom.
{
  const broken = await context.browser().newContext()
  const onAir = await broken.newPage()

  await onAir.goto(`${BASE}/#/source/broken`)
  await onAir.waitForTimeout(1200)

  check((await onAir.locator('body').innerText()).trim() === '', 'a crashed graphic paints nothing on air')
  check((await onAir.locator('.ss-source-crashed').count()) === 0, 'and shows no error card over the scene')

  const desk = await broken.newPage()

  await desk.goto(`${BASE}/#/source/broken?debug`)
  await desk.waitForTimeout(1200)

  check(await becomes(desk, () => Boolean(document.querySelector('.ss-source-crashed'))), 'the same graphic shows the crash under ?debug')
  check(/cannot read properties/i.test(await desk.locator('.ss-source-crashed').innerText()), 'with the error that actually happened')

  await broken.close()
}

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

// The legacy page is the one place a throw would be expected, and its guard renders
// rather than throwing -- so anything collected here is a real fault on a real page.
for (const crash of crashes) console.log(`  ${crash}`)
check(crashes.length === 0, `no page threw an uncaught error (${crashes.length} collected)`)

await browser.close()
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exitCode = failed ? 1 : 0
