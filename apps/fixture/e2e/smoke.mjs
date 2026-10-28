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

// In CI, a failure is also a GitHub annotation. The job's log is not always
// readable from where the failure gets diagnosed -- an agent's proxy refused it
// outright on 2026-10-27 -- but annotations come through the checks API, so a red
// run names the check that failed instead of only "exit code 1".
const annotate = (msg) => {
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=e2e::${String(msg).split('\n')[0].slice(0, 300)}`)
}

const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${msg}`)
  if (!ok) {
    failed += 1
    annotate(msg)
  }
}

// A throw ends the suite before any check can fail by name, so it is annotated too.
process.on('uncaughtException', (error) => {
  annotate(`crashed: ${error?.message ?? error}`)
  console.error(error)
  process.exit(1)
})

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
 * Open the board's settings menu.
 *
 * The cog is revealed rather than resident -- it has no width until the bar is
 * hovered, focused into, or something is waiting to be saved -- so a bare click on
 * it times out on a zero-width element. Hovering first is what an operator does and
 * what the test has to do; this exists so that fact is stated once rather than
 * five times.
 */
const openMenu = async () => {
  await control.locator('.ss-control-bar').hover()
  await control.locator('.ss-menu-open').click()
}
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

// -- The board's tools are revealed, not resident -----------------------------
/*
 * Save, discard and the cog have no width until something asks for them. The dock
 * is often a narrow column beside a preview and that width belongs to the show.
 *
 * Four triggers, and the two that are not hover are the ones worth guarding: an
 * unsaved edit has to pin them open with the pointer nowhere near, or an operator
 * who types and looks away loses the button that would commit it -- and a keyboard
 * has to reach them at all, or the cog, and with it Plugins and Browser sources,
 * is mouse-only.
 */
const toolShown = (selector) =>
  control.evaluate((sel) => {
    const el = document.querySelector(sel)

    return Boolean(el) && Number(getComputedStyle(el).opacity) > 0.5 && el.getBoundingClientRect().width > 1
  }, selector)

// Somewhere the bar is not. hover() on another element is not enough on its own:
// the pointer has to actually leave.
const pointerAway = async () => {
  await control.mouse.move(4, 640)
  await control.waitForTimeout(320)
}

await pointerAway()
check(!(await toolShown('.ss-menu-open')), 'at rest the cog takes no room')
check(!(await toolShown('.ss-save')), 'and neither does the save')

await control.locator('.ss-control-bar').hover()
await control.waitForTimeout(320)
check(await toolShown('.ss-menu-open'), 'hovering the bar brings the cog back')
check(await toolShown('.ss-save'), 'and the save with it')

await pointerAway()
check(!(await toolShown('.ss-menu-open')), 'and they go again when the pointer leaves')

// The one that matters on the night.
await homeName.fill('Pinned')
await pointerAway()
check(await toolShown('.ss-save'), 'an unsaved edit keeps the save on screen with the pointer elsewhere')
check(await toolShown('.ss-menu-open'), 'and the cog alongside it, so the pair does not split')

await save()
await pointerAway()
check(!(await toolShown('.ss-save')), 'saving lets them go again')

// Reachable without a mouse at all.
await control.locator('.ss-menu-open').focus()
await control.waitForTimeout(320)
check(await toolShown('.ss-menu-open'), 'a keyboard can reach the cog, which is the only route to Plugins')
await control.evaluate(() => document.activeElement?.blur())
await pointerAway()

// The title keeps the room the tools are not using, and still ellipses.
check(
  await control.evaluate(() => {
    const h1 = document.querySelector('.ss-control-bar h1')

    return getComputedStyle(h1).textOverflow === 'ellipsis' && getComputedStyle(h1).whiteSpace === 'nowrap'
  }),
  'the studio name still truncates rather than wrapping the bar to a second row',
)

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

// One press arms, it does not swap. The guard is the point: a mis-aimed click puts
// both names and both scores on the wrong side of a live scoreboard, and the
// operator's next ten seconds go on working out what happened rather than on the
// show.
await control.locator('.ss-swap').click()
await control.waitForTimeout(600)
check(JSON.stringify(await sides()) === JSON.stringify(sidesBefore), 'one press on a swap arms it rather than trading the sides')
check(
  await becomes(control, () => /click to confirm/i.test(document.querySelector('.ss-swap')?.textContent ?? '')),
  'and says a second press is what finishes it',
)

await control.locator('.ss-swap').click()
await control.waitForTimeout(600)
const sidesAfter = await sides()

console.log(`  swap: ${JSON.stringify(sidesBefore)} -> ${JSON.stringify(sidesAfter)}`)
check(sidesAfter.home === sidesBefore.away && sidesAfter.away === sidesBefore.home, 'swapping trades the two names')
check(sidesAfter.homeScore === sidesBefore.awayScore && sidesAfter.awayScore === sidesBefore.homeScore, 'and the two scores, not a name onto a score')

// Back again, which both proves it is its own inverse and leaves the board as this
// section found it -- everything below reads the same values.
await control.locator('.ss-swap').click()
await control.locator('.ss-swap').click()
await control.waitForTimeout(600)
check(JSON.stringify(await sides()) === JSON.stringify(sidesBefore), 'and swapping again puts every value back where it started')

// -- Fitting a long name -----------------------------------------------------
/*
 * The scoreboard's name sits in a `w-56` box, centred, as an unstretched flex item
 * -- which is to say a box sized by its own text. `Fit` measured that box and asked
 * whether the text fitted inside itself, the answer was always yes, and `fit` did
 * nothing whatsoever. Silently: no warning, no partial effect, and invisible until
 * somebody enters a long name on air. Every use of it in the first real show was
 * inert, and so was this one, in our own fixture, the whole time.
 *
 * Measured rather than eyeballed, because "it looks smaller" is exactly the
 * impression the broken version also gives when the name happens to be short.
 */
const fitted = () =>
  source.evaluate(() => {
    const fit = document.querySelector('.home-name .ss-fit')
    const box = document.querySelector('.home-name')?.parentElement

    if (!fit || !box) return null

    const style = getComputedStyle(box)
    const room = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)

    return { width: Math.round(fit.scrollWidth), room: Math.round(room), size: parseFloat(getComputedStyle(fit).fontSize) }
  })

await homeName.fill('Kim')
await save()
await source.waitForFunction(() => /Kim/.test(document.querySelector('.home-name')?.textContent ?? ''))
await source.waitForTimeout(300)

const short = await fitted()

check(short.width <= short.room, `a name that already fits is left alone (${short.width}px in ${short.room}px at ${short.size}px)`)

await homeName.fill('Vandersteen-Rodriguez')
await save()
await source.waitForFunction(() => /Vandersteen/.test(document.querySelector('.home-name')?.textContent ?? ''))
await source.waitForTimeout(400)

const long = await fitted()

console.log(`  fit: ${short.size}px for "Kim", ${long.size}px for "Vandersteen-Rodriguez"`)
check(long.width <= long.room + 1, `a long name is brought inside its box (${long.width}px in ${long.room}px)`)
check(long.size < short.size, `by shrinking it, rather than by overflowing quietly (${long.size}px against ${short.size}px)`)

// Put it back, so the section below still watches the value it was written for.
await homeName.fill('Broncos')
await save()
await source.waitForFunction(() => /Broncos/.test(document.querySelector('.home-name')?.textContent ?? ''))

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

// The lower third's name is a `fit` inside a plain block, so the Variable's own span
// is inline there -- and an inline element's width is 0. Fit took that span for its
// box and shrank a 30px name to 0.0586px. The scoreboard never showed it because its
// names sit in a flex row, which makes the span a block.
const lowerName = () =>
  lower.evaluate(() => {
    const fit = document.querySelector('.ss-scene .ss-fit')
    const box = fit?.closest('.text-3xl')

    return fit && box ? { size: parseFloat(getComputedStyle(fit).fontSize), width: fit.scrollWidth, room: box.clientWidth } : null
  })

await lower.waitForTimeout(800)
const plainName = await lowerName()
check(plainName?.size === 30, `a fitted name in a plain block keeps its size when it fits (${plainName?.size}px)`)

await control.locator('.ss-field:has-text("Title") input').first().fill('Bartholomew Vandersteen-Rodriguez the Third of Many Names')
await save()
await becomes(lower, () => parseFloat(getComputedStyle(document.querySelector('.ss-scene .ss-fit')).fontSize) < 30)
await lower.waitForTimeout(800)
const longName = await lowerName()
console.log(`  lower third fit: ${JSON.stringify(longName)}`)
check(
  longName && longName.width <= longName.room && longName.size > 12,
  `and a long one shrinks to its box rather than to nothing (${longName?.width}px in ${longName?.room}px at ${longName?.size}px)`,
)

await control.locator('.ss-field:has-text("Title") input').first().fill('Jane Doe')
await save()
await becomes(lower, sceneHas, 'jane doe')

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
    const spills = [...document.querySelectorAll('.ss-panel-body > *, .ss-row > *')]
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

// -- Rows ---------------------------------------------------------------------
// A Row is the board's one layout promise: stacked in a slim dock, side by side once
// there is room, and side by side the controls line up along their inputs. Each of
// those has been wrong in a way that still looked like a working board -- a
// stepper's buttons 4px short of the field beside them, an image picker's dropdown
// 12px lower than its neighbours' -- so they are measured rather than eyeballed.
const rowsAt = async (width, measure) => {
  const sized = await browser.newContext({ viewport: { width, height: 900 } })
  const dock = await sized.newPage()
  await dock.goto(`${BASE}/#/`)
  await dock.waitForSelector('text=Clocks')
  await dock.waitForTimeout(400)
  const found = await dock.evaluate(measure)
  await sized.close()
  return found
}

// Each panel's measurements, by its heading: where every input line in it starts
// and ends. "Input line" is the one row every control has after its label -- an
// input, a select, a joined group, a switch.
const lines = () => {
  const panel = (title) => [...document.querySelectorAll('.ss-panel')].find((el) => el.querySelector('h2')?.textContent.trim().toLowerCase() === title)
  const edges = (el) => {
    const box = el.getBoundingClientRect()
    return {
      top: Math.round(box.top),
      bottom: Math.round(box.bottom),
      left: Math.round(box.left),
      right: Math.round(box.right),
      width: Math.round(box.width),
    }
  }
  const lineOf = (control) =>
    control.matches('.ss-unlabelled')
      ? control
      : control.querySelector(':scope > .ss-input-group, :scope > input, :scope > select, :scope > input + *, :scope > div')
  const row = (title) => [...panel(title).querySelectorAll('.ss-row > *')].map((control) => edges(lineOf(control) ?? control))
  const cells = (title) => [...panel(title).querySelectorAll('.ss-row > *')].map(edges)
  return {
    sponsor: row('sponsor'),
    guest: row('guest'),
    guestCells: cells('guest'),
    guestRow: edges(panel('guest').querySelector('.ss-row')),
    standings: cells('standings').slice(0, 2),
    standingsRow: edges(panel('standings').querySelector('.ss-row')),
    third: row('lower third'),
    match: cells('match').slice(0, 5),
    gap: parseFloat(getComputedStyle(panel('guest').querySelector('.ss-row')).columnGap),
  }
}

const wide = await rowsAt(1280, lines)
const level = (row) => new Set(row.map((edge) => edge.top)).size === 1 && new Set(row.map((edge) => edge.bottom)).size === 1
console.log(`  sponsor input lines at 1280px: ${wide.sponsor.map((edge) => `${edge.top}-${edge.bottom}`).join(', ')}`)
check(wide.sponsor.length === 4 && level(wide.sponsor), 'side by side, a picker, a field, a colour and a switch share one input line')
check(wide.guest.length === 4 && level(wide.guest), 'and so do a headshot, two fields and a switch')
check(level(wide.third), 'a switch beside labelled fields sits level with their inputs, not with their labels')

// Left alone, five share the line equally -- what a twelve-column grid could not do,
// which gave 3, 3, 2, 2, 2.
console.log(`  five buttons in a row: ${wide.match.map((edge) => edge.width).join(', ')}px`)
check(
  new Set(wide.match.map((edge) => edge.top)).size === 1 && Math.max(...wide.match.map((e) => e.width)) - Math.min(...wide.match.map((e) => e.width)) <= 1,
  'five in a row share the line equally',
)

// Within a pixel, because widths are fractions of a pixel and the edges are rounded.
const near = (a, b) => Math.abs(a - b) <= 1

// `md:col-span-8` and `md:col-span-4`, as boards written for 0.10 size them: two
// thirds and a third of the line, the gap counted in, and nothing left over.
const [heading, standingsSwitch] = wide.standings
console.log(`  8 and 4 of twelve: ${heading.width} + ${standingsSwitch.width}px in ${wide.standingsRow.width}px, gap ${wide.gap}px`)
check(
  near(heading.width, 2 * standingsSwitch.width + wide.gap) && near(standingsSwitch.right, wide.standingsRow.right),
  'col-span-8 beside col-span-4 is two thirds and a third, filling the line',
)

// `lg:row-cols-4` with the switch `lg:col-auto`: one line, the switch at its own
// width and the three others sharing everything else, so nothing is left empty at
// the end of the line.
const [, , , guestSwitch] = wide.guestCells
const others = wide.guestCells.slice(0, 3).map((edge) => edge.width)
console.log(`  guest row at 1280px: ${wide.guestCells.map((edge) => edge.width).join(', ')}px in ${wide.guestRow.width}px`)
check(
  level(wide.guest) && guestSwitch.width < others[0] / 2 && Math.max(...others) - Math.min(...others) <= 1 && near(guestSwitch.right, wide.guestRow.right),
  'a col-auto control keeps its own width and the others take the rest of the line',
)

// `sm:row-cols-2`, between 640px and 1024px: two to a line, and the switch beside
// a field on the second line still level with the field's input.
const middle = await rowsAt(800, lines)
const pairs = middle.guestCells
console.log(`  guest row at 800px: ${pairs.map((edge) => `${edge.left}+${edge.width}@${edge.top}`).join(', ')}`)
check(
  pairs.length === 4 &&
    pairs[0].top === pairs[1].top &&
    pairs[2].top > pairs[0].top &&
    pairs[0].left === pairs[2].left &&
    near(pairs[0].width, pairs[1].width) &&
    near(pairs[1].right, middle.guestRow.right),
  'at a middle width the same row is two to a line',
)
check(level(middle.guest.slice(2)), 'and the switch beside the field on the second line sits level with its input')

const slim = await rowsAt(380, lines)
console.log(`  sponsor row at 380px: ${slim.sponsor.map((edge) => `${edge.left}+${edge.width}@${edge.top}`).join(', ')}`)
check(
  new Set(slim.sponsor.map((edge) => edge.left)).size === 1 && slim.sponsor.every((edge, i, all) => i === 0 || edge.top > all[i - 1].bottom),
  'in a slim dock the same row stacks, one control under the next',
)
check(
  new Set(slim.guestCells.map((edge) => edge.left)).size === 1 && slim.guestCells.every((edge, i, all) => i === 0 || edge.top > all[i - 1].bottom),
  'and so does the row that is two to a line at a middle width',
)

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
//
// Waited on before it is read. The picker fills from the library a beat after the
// tiles do, so a bare `evaluate` here samples whatever the dropdown happened to
// hold and fails on the group's *contents* while passing on the group itself --
// which is exactly how it failed, intermittently, and reads as a grouping bug
// rather than a test that did not wait.
await becomes(control, () =>
  [...(document.querySelector('.ss-image-picker select')?.querySelectorAll('optgroup option') ?? [])].some((o) => o.textContent === 'rifleman'),
)

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

  /**
   * Type a number into a stepper and wait for it to land.
   *
   * The waiting is the point. A stepper skips a write whose value equals the one it
   * is already showing -- a no-op write is not a write -- so a number typed before
   * the previous one has come back through the store reads as exactly that and is
   * dropped. Asserting on the *scene* is not enough: that is a different page with
   * its own subscription, and the board can still be a render behind. This failed
   * in CI and not here, which is what a race that only loses under load looks like.
   */
  const set = async (label, to) => {
    const input = control.locator(`.ss-stepper input[aria-label="${label}"]`)

    await input.fill(String(to))
    await input.press('Enter')

    return becomes(control, (want) => document.querySelector(`.ss-stepper input[aria-label="${want.label}"]`)?.value === String(want.to), { label, to })
  }

  check(await set('Home objectives', 3), 'a typed count lands on the board')
  check(await becomes(scene, () => document.querySelectorAll('.ss-tally').length > 0, null, 8000), 'a tally reaches the scene')

  check(
    await becomes(scene, () => document.querySelector('.tally-objectives')?.querySelectorAll('.ss-tally-mark').length === 3),
    'a count of three draws three marks',
  )

  // Zero is an empty space rather than a placeholder: the row *is* the count.
  await set('Home objectives', 0)
  check(await becomes(scene, () => !document.querySelector('.tally-objectives')), 'and nothing at all at zero')

  // A stuck key costs a clamp, not the layout -- but clamping quietly would put a
  // wrong number on air, so the real one is still on the element.
  await set('Home objectives', 40)
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
  await set('Home objectives', 2)
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

  await set('Home objectives', 3)
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

  await set('Home objectives', 0)
  await scene.close()
}

// -- Out of a fixed number ----------------------------------------------------
// The other shape: as many marks as it takes to win, the won ones filled. The row
// holds its width from the first frame, so nothing beside it moves as it fills.
{
  const scene = await context.newPage()

  await scene.goto(`${BASE}/#/source/match`)
  await scene.waitForSelector('.ss-scene')

  const set = async (label, to) => {
    const input = control.locator(`.ss-stepper input[aria-label="${label}"]`)

    await input.fill(String(to))
    await input.press('Enter')

    return becomes(control, (want) => document.querySelector(`.ss-stepper input[aria-label="${want.label}"]`)?.value === String(want.to), { label, to })
  }
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

  await set('Home games', 0)

  const empty = await becomes(scene, () => {
    const row = document.querySelector('.tally-series')

    return row && row.querySelectorAll('.ss-tally-mark').length > 1 && row.querySelectorAll('.ss-tally-mark[data-filled]').length === 0
  })

  check(empty, 'a race draws its whole length before anything is won')

  const before = await race().boundingBox()

  check(await set('Home games', 1), 'a win lands on the board')
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
  // Which ones, specifically: the picture that comes on has to be decoded *at the
  // moment it comes on*. Asserting that the list neighbour is decoded proves
  // nothing -- the window used to be built from indices, so that held by
  // construction -- and it is not what a shuffled show asks for, where the next
  // picture is wherever the deal put it.
  //
  // Watched rather than sampled, for the same reason as the tally: polling either
  // side of a change reads the state at the wrong instant. <Image> renders nothing
  // until it has decoded, so "did the slide contain a picture the moment it was
  // switched on" is exactly the question, and a mutation record answers it.
  await slides.evaluate(() => {
    window.__ons = []

    const show = document.querySelector('.ss-slideshow')
    const watch = new MutationObserver((records) => {
      for (const record of records) {
        if (!record.target.hasAttribute('data-on')) continue

        const all = [...show.querySelectorAll('.ss-slide')]

        window.__ons.push({ at: all.indexOf(record.target), had: Boolean(record.target.querySelector('img')) })
      }
    })

    watch.observe(show, { attributes: true, attributeFilter: ['data-on'], subtree: true })
  })

  await slides.waitForTimeout(11000)

  const ons = await slides.evaluate(() => window.__ons)

  console.log(`  slides coming on: ${ons.map((o) => `${o.at}${o.had ? '' : ' (BLANK)'}`).join(', ')}`)
  check(ons.length >= 4, `it advances on its own (${ons.length} changes in 11s)`)
  check(
    ons.every((o) => o.had),
    `every picture was decoded at the moment it came on, so a change is a fade rather than a wait (${ons.filter((o) => o.had).length}/${ons.length})`,
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

// Narrow the library before picking. By this point it holds several groups, the
// tile grid scrolls, and a tile below the fold ends up under the dialog's own
// header -- the click then hit-tests onto the dialog rather than the button and
// retries until it times out. That is the flake this suite has now seen twice, and
// the mechanism is read off the CI log rather than reproduced here.
//
// Filtering is what an operator does with a hundred images anyway, and it puts the
// tile at a predictable place instead of forcing a click at an unpredictable one.
const pick = control.locator('.ss-asset-dialog .ss-asset-tile button[title*="vandals"]').first()

await control.locator('.ss-asset-dialog input[aria-label="Filter images"]').fill('vandals')
await pick.waitFor({ state: 'visible' })
await pick.click()
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

// And it asks, without being told to. The prop existed from the start and defaulted
// to off, which is a guard nobody opts into -- so a mis-aimed press cleared a board
// on air with no undo. The fixture passes no `confirm`; this is the default.
const reset = control.locator('.ss-reset').first()

await reset.click()
check(await becomes(control, () => /click to confirm/i.test(document.querySelector('.ss-reset')?.textContent ?? '')), 'a reset asks before it clears, unasked')

// Blur disarms, so the board is left exactly as this section found it.
await control.locator('.ss-panel').first().click()
check(
  await becomes(control, () => /Reset draft/.test(document.querySelector('.ss-reset')?.textContent ?? '')),
  'and looking away disarms it rather than leaving one live under the cursor',
)

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
await openMenu()
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
  await openMenu()
  await control.locator('.ss-menu-images').click()
  await control.waitForSelector('.ss-asset-dialog[open] .ss-asset-library')
  // The tiles come out of IndexedDB a beat after the dialog does, so a count taken
  // on the dialog appearing is a count of nothing.
  await control.waitForSelector('.ss-asset-dialog[open] .ss-asset-tile')
}

const closeLibrary = () => control.locator('.ss-asset-dialog[open] button[aria-label="Close the image library"]').click()
const tiles = () => control.locator('.ss-asset-dialog[open] .ss-asset-tile').count()

/*
 * Loading the show while the show is on air.
 *
 * The first people to use `Slideshow` hit this within a day: pictures dropped on
 * the board mid-programme never reached a graphic already playing, and came back on
 * a reload -- so the bytes had been there the whole time. The library's index
 * replicates and was arriving; what did not was the local half, "do I hold this?",
 * which only re-read when the page that did the writing said so. A browser source
 * is a different page, so nothing ever told it.
 *
 * Two pages on purpose. Checking on the board alone passes either way, since that
 * page notifies itself, and is exactly the shape of test that let this ship.
 *
 * Down here rather than beside the upload that fills the group, because this adds
 * to the library and every check that counts tiles has run by now -- and the two
 * counts still ahead of it, the reset's and the purge's, are both taken below.
 */
{
  const playing = await context.newPage()

  playing.on('pageerror', (error) => crashes.push(`standby (playing): ${error.message}`))
  await playing.goto(`${BASE}/#/source/standby`)
  await playing.waitForSelector('.ss-slide[data-on]')

  const held = await playing.evaluate(() => document.querySelectorAll('.ss-slide').length)

  // Two files, so the name field means "group": one would make `units` the name of
  // a single asset rather than a folder to file it under.
  await library.locator('input[aria-label="Asset name"]').fill('units')
  await library.locator('input[aria-label="Add image files"]').setInputFiles([asset('maps/ashfall.svg'), asset('maps/redline.svg')])

  check(
    await becomes(playing, (n) => document.querySelectorAll('.ss-slide').length === n + 2, held, 20000),
    `a picture added to the group mid-show reaches a graphic already on air (${held} -> ${held + 2}, no reload)`,
  )

  await playing.close()
}

await openLibrary()
const before = await tiles()
await closeLibrary()

const scoreNow = () => control.locator('.ss-stepper input[aria-label="Home score"]').inputValue()

await openMenu()
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
await openMenu()
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
// `attached`, not visible: the bar's tools have no width until something asks for
// them, and what is being read here is an attribute rather than anything on screen.
await control.waitForSelector('.ss-save', { state: 'attached' })
check(
  await becomes(control, () => document.querySelector('.ss-save button[aria-keyshortcuts]')?.getAttribute('aria-keyshortcuts') === 'F8'),
  'the rebound key is still bound after a reload',
)

// Put it back, so everything below still saves the way it expects to.
await openMenu()
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
await openMenu()
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

/*
 * Folded away until asked for.
 *
 * A studio with six plugins is a scroll, and reading this panel -- is everything
 * up? -- is what an operator does with it far more often than editing it. So the
 * light, the name and the status word stay out, and the rest is behind the row.
 */
check(
  await becomes(control, () => !document.querySelector('.ss-plugin[data-plugin="feed"] .ss-plugin-body')),
  'a connected plugin starts folded away, so a panel of them is a list rather than a scroll',
)

/*
 * And one that is not connected opens itself.
 *
 * The fixture registers Rocket League as well, pointed at a game that is not
 * running here -- which is the case this rule is for. A panel opened *because*
 * something is wrong should not then ask which row to look in: the settings worth
 * changing are the ones behind the plugin that is not talking.
 *
 * Not driven by a contrived plugin, because the honest version was already in the
 * fixture: a real socket plugin with nothing at the other end.
 */
check(
  await becomes(control, () => document.querySelector('.ss-plugin[data-plugin="rocket-league"]')?.dataset.status !== 'connected'),
  'the second plugin is not connected, there being no game here',
)
check(
  await becomes(control, () => Boolean(document.querySelector('.ss-plugin[data-plugin="rocket-league"] .ss-plugin-body'))),
  'and so it opens itself, rather than hiding the settings somebody came here to change',
)

// This page is on localhost, and so is the game, so the browser has nothing to
// gate -- and the panel must not blame it. The public-site case is near the end.
check(
  !(await control.locator('.ss-plugin[data-plugin="rocket-league"] .ss-local-access').count()),
  'a studio served from this computer is not told the browser is blocking it',
)
check((await row.locator('.ss-plugin-toggle').textContent()).includes('Demo feed'), 'and still says which plugin it is while folded')
check(
  (await row.locator('.ss-plugin-toggle').textContent()).includes('Connected'),
  'and whether it is talking, which is the question being asked most of the time',
)

/*
 * The light, and where it sits.
 *
 * It used to sit at the head of the row with a ▶ closing it off, and the triangle
 * read as a play button -- on a plugin that was not running, as an offer to start
 * it. So the triangle is gone and the light took its place at the end. Asserted
 * here because the light is now the only thing in a folded row that is a colour
 * rather than a word, and because a swap like this is exactly the kind that gets
 * quietly reverted by the next person tidying the header.
 */
const headerTail = await row.locator('.ss-plugin-toggle').evaluate((el) => ({
  last: el.lastElementChild?.className ?? '',
  glyphs: el.textContent,
}))

check(headerTail.last.includes('ss-plugin-light'), 'the light closes the row, where the triangle used to')
check(!/[▶►]/.test(headerTail.glyphs), 'and nothing in the row looks like a play button any more')
check(
  await becomes(control, () => document.querySelector('.ss-plugin[data-plugin="feed"] .ss-plugin-light')?.classList.contains('bg-emerald-500')),
  'and it is green for the plugin that is talking',
)
check(
  await becomes(control, () => !document.querySelector('.ss-plugin[data-plugin="rocket-league"] .ss-plugin-light')?.classList.contains('bg-emerald-500')),
  'and is not for the one that is not',
)

await row.locator('.ss-plugin-toggle').click()
check(
  await becomes(control, () => Boolean(document.querySelector('.ss-plugin[data-plugin="feed"] .ss-plugin-body'))),
  'opening the row brings out what it can be asked',
)

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

/*
 * And folding the row away does not take the reason with it.
 *
 * The save's own message lives beside the button, which is right while the button
 * is on screen and useless once it is not. Collapsing hands back to the plugin's
 * standing reason -- the same sentence, suppressed until now. Without that the row
 * would fold up quiet about a plugin that is refusing to run, which is the state
 * this panel exists to get away from.
 */
await row.locator('.ss-plugin-toggle').click()
check(
  await becomes(control, () => /more than zero/i.test(document.querySelector('.ss-plugin[data-plugin="feed"] .ss-plugin-reason')?.textContent ?? '')),
  'a folded row still says why it is not running',
)
check(await becomes(control, () => !document.querySelector('.ss-plugin[data-plugin="feed"] .ss-plugin-body')), 'with everything else out of the way')

await row.locator('.ss-plugin-toggle').click()

// Put it back, so the rest of the run is not driven by a stopped plugin.
await rate.fill('120')
await pluginSave.click()
await becomes(control, () => document.querySelector('.ss-plugin[data-plugin="feed"]')?.dataset.status === 'connected')
await control.keyboard.press('Escape')
await becomes(control, () => !document.querySelector('.ss-plugins-dialog[open]'))

// -- A button that fails ----------------------------------------------------
// A studio mutation that throws after writing. None of it may reach air -- a
// mutation happens completely or not at all -- and the board has to say which
// button failed, because otherwise it is a button that silently stopped working.
// Changes nothing by design, but kept late all the same.
{
  const scoreboard = await context.newPage()

  await scoreboard.goto(`${BASE}/#/source/scoreboard`)
  await scoreboard.waitForSelector('.home-name')
  await scoreboard.waitForTimeout(600)

  const nameBefore = (await scoreboard.locator('.home-name').innerText()).trim()
  const fumble = control.locator('.fixture-fumble')
  const notice = control.locator('.ss-mutation-trouble')

  check((await notice.count()) === 0, 'no failure notice before anything has failed')

  await fumble.click()

  check(await becomes(control, () => Boolean(document.querySelector('.ss-mutation-trouble'))), 'a mutation that throws puts a notice on the board')
  check((await notice.getAttribute('role')) === 'alert', 'as an alert, so a screen reader hears it too')
  check((await control.locator('.ss-mutation-name').innerText()) === 'demo:fumble', 'naming the mutation that failed')
  check(/fumbles on purpose/.test(await control.locator('.ss-mutation-reason').innerText()), 'with the reason it gave')

  await scoreboard.waitForTimeout(800)

  const nameAfter = (await scoreboard.locator('.home-name').innerText()).trim()

  check(nameAfter === nameBefore && !/FUMBLED/.test(nameAfter), `and none of what it wrote reached air (home name still "${nameAfter}")`)

  await fumble.click()

  check(
    await becomes(control, () => /2 times/.test(document.querySelector('.ss-mutation-count')?.textContent ?? '')),
    'a repeat is counted rather than stacked',
  )
  check((await notice.count()) === 1, 'still one notice')

  await control.locator('.ss-mutation-dismiss').click()

  check(await becomes(control, () => !document.querySelector('.ss-mutation-trouble')), 'dismissing it puts it away')

  await scoreboard.close()
}

// -- Counting to a new number -------------------------------------------------
// `transition="number"` on the probe page's copy of the home score. Every frame is
// recorded from inside the page, from before the first paint, so a count that
// should not have happened cannot hide between two samples.
{
  const score = control.locator('.ss-stepper input[aria-label="Home score"]')
  const setScore = async (value) => {
    await score.fill(String(value))
    await score.press('Enter')
  }

  await setScore(1000)
  await becomes(control, () => document.querySelector('.ss-stepper input[aria-label="Home score"]')?.value === '1000')

  const counter = await context.newPage()

  await counter.addInitScript(() => {
    window.__frames = []

    const record = () => {
      const text = document.querySelector('.probe-count')?.textContent

      if (text) window.__frames.push(text)
      requestAnimationFrame(record)
    }

    requestAnimationFrame(record)
  })
  await counter.goto(`${BASE}/#/source/spacing`)
  await counter.waitForSelector('.probe-count .ss-count')
  await counter.waitForTimeout(800)

  const frames = () => counter.evaluate(() => window.__frames.map(Number))
  const restart = () => counter.evaluate(() => (window.__frames = []))

  const arrival = await frames()

  check(arrival.length > 0 && arrival.every((value) => value === 1000), `a counting number does not count on arrival (saw ${[...new Set(arrival)].join(', ')})`)

  const width = await counter.locator('.probe-count').evaluate((el) => getComputedStyle(el).fontVariantNumeric)

  check(width === 'tabular-nums', 'and its figures are tabular, so it does not shimmer sideways')

  await restart()
  await setScore(1500)
  await counter.waitForTimeout(1800)

  const up = await frames()
  const between = new Set(up.filter((value) => value > 1000 && value < 1500))

  check(between.size >= 5, `a change counts through the numbers between (${between.size} in between)`)
  check(
    up.every((value, i) => i === 0 || value >= up[i - 1]),
    'in order, never backwards',
  )
  check(up.at(-1) === 1500 && Math.max(...up) === 1500, `and lands exactly on the new value (ended on ${up.at(-1)})`)

  // Mid-count, a new target. The count has to turn around where it is, not jump
  // back to where it started or to where it was heading.
  await restart()
  await setScore(2000)
  await counter.waitForTimeout(300)
  await setScore(1200)
  await counter.waitForTimeout(1800)

  const turn = await frames()
  const peak = Math.max(...turn)
  const after = turn.slice(turn.indexOf(peak))

  check(peak > 1500 && peak < 2000, `a change mid-count turns around where it is (turned at ${peak})`)
  check(
    after.every((value, i) => i === 0 || value <= after[i - 1]),
    'and heads straight for the new value from there',
  )
  // Downhill all the way is not enough on its own: a count that restarted from 1500
  // is downhill too, it just gets there by a jump. The first frame after turning
  // has to be nearer where it turned than where the last count began.
  check(after[1] > (peak + 1500) / 2, `without jumping to get there (${peak} then ${after[1]})`)
  check(turn.at(-1) === 1200, `ending on it (${turn.at(-1)})`)

  await counter.close()
}

// -- Buttons on a plugin's panel ---------------------------------------------
// A plugin can declare actions and keep a notice current -- what Sign in with Twitch
// is built on. The fixture's feed offers Pause or Resume and reports its tick count,
// so this presses one, watches it be replaced by the other, and watches the notice
// move while nobody touches anything. Leaves the feed running, as it found it.
{
  await openMenu()
  await control.locator('.ss-menu-plugins').click()
  await becomes(control, () => Boolean(document.querySelector('.ss-plugins-dialog[open] .ss-plugin[data-plugin="feed"]')))

  const feedRow = control.locator('.ss-plugin[data-plugin="feed"]')
  const noticeText = () => feedRow.locator('.ss-plugin-notice-text').innerText()

  check(
    await becomes(control, () => /ticks so far/.test(document.querySelector('.ss-plugin[data-plugin="feed"] .ss-plugin-notice')?.textContent ?? '')),
    'a plugin’s notice is on its row, even folded',
  )

  const before = await noticeText()

  await control.waitForTimeout(2200)

  const after = await noticeText()

  check(before !== after, `and an open panel keeps reading it, rather than showing what was true when it opened ("${before}" then "${after}")`)

  await feedRow.locator('.ss-plugin-toggle').click()

  check((await feedRow.locator('.ss-plugin-action').count()) === 1, 'only the buttons the plugin offers right now are shown')
  check((await feedRow.locator('.ss-plugin-action').innerText()) === 'Pause', 'which here is Pause, not Resume')

  // The refresh must not undo an operator's typing. It used to copy the stored
  // values into the form whenever they arrived, which with a read every second
  // would wipe a half-typed field once a second.
  const label = feedRow.locator('input[type="text"]').first()
  const typed = 'Half typed'

  await label.fill(typed)
  await control.waitForTimeout(2200)
  check((await label.inputValue()) === typed, 'a field being typed in survives the panel re-reading the plugin')

  await feedRow.locator('.ss-plugin-action[data-action="pause"]').click()

  check(
    await becomes(control, () => document.querySelector('.ss-plugin[data-plugin="feed"] .ss-plugin-action')?.dataset.action === 'resume'),
    'pressing Pause replaces it with Resume',
  )
  check(/Paused from the panel/.test(await noticeText()), 'and the notice says what happened')

  // Pausing saved a value into the plugin's own settings, so the stored values the
  // panel reads have changed while the label field still holds half a word. A
  // sign-in finishing while somebody types a channel name is the same moment.
  await control.waitForTimeout(1500)
  check((await label.inputValue()) === typed, 'and the half-typed field survives the plugin saving its own settings underneath it')

  await feedRow.locator('.ss-plugin-action[data-action="resume"]').click()
  check(
    await becomes(control, () => /ticks so far/.test(document.querySelector('.ss-plugin[data-plugin="feed"] .ss-plugin-notice')?.textContent ?? '')),
    'and Resume puts it back',
  )

  // The real thing, signed out: it says what is missing and offers the one button
  // that fixes it. Not pressed -- that reaches Twitch, which is the manual check.
  check(
    await becomes(control, () =>
      /Not signed in to Twitch/.test(document.querySelector('.ss-plugin[data-plugin="twitch"] .ss-plugin-reason')?.textContent ?? ''),
    ),
    'Twitch, signed out, says that is what is wrong',
  )
  check(
    await becomes(
      control,
      () => [...document.querySelectorAll('.ss-plugin[data-plugin="twitch"] .ss-plugin-action')].map((button) => button.dataset.action).join() === 'signIn',
    ),
    'and offers Sign in with Twitch, and nothing else',
  )

  await control.keyboard.press('Escape')
  await becomes(control, () => !document.querySelector('.ss-plugins-dialog[open]'))
}

// -- Twitch chat -------------------------------------------------------------
// Chat has its own graphic rather than the lower third, and each message moves the
// rest down a line. Twitch itself is the manual check, so this sends what the
// plugin's handler sends -- the same mutation, into the same worker -- by opening a
// port of its own with the arguments the page used.
{
  const chat = await context.newPage()

  await chat.addInitScript(() => {
    const Real = window.SharedWorker

    window.SharedWorker = class extends Real {
      constructor(url, options) {
        super(url, options)
        window.__velcroWorker = { url: String(url), options }
      }
    }
  })
  await chat.goto(`${BASE}/#/source/twitch-chat`)
  await chat.waitForSelector('.twitch-chat')

  const lines = () => chat.evaluate(() => [...document.querySelectorAll('.twitch-line')].map((line) => line.textContent.trim()))

  await chat.evaluate(() => {
    const { url, options } = window.__velcroWorker
    const worker = new SharedWorker(url, options)

    worker.port.start()
    for (let i = 1; i <= 7; i += 1) worker.port.postMessage({ type: 'mutate', name: 'twitch:chat', payload: { name: `viewer${i}`, text: `message ${i}` } })
  })

  check(
    await becomes(chat, () => /viewer7/.test(document.querySelector('.twitch-line[data-line="0"]')?.textContent ?? '')),
    'a chat message lands on the bottom line of the Twitch box',
  )

  const shown = await lines()
  console.log(`  twitch chat: ${JSON.stringify(shown)}`)
  check(
    shown.join('|') === 'viewer3 message 3|viewer4 message 4|viewer5 message 5|viewer6 message 6|viewer7 message 7',
    'and the five before it move up, oldest dropped off the top',
  )
  check(!(await lower.locator('.ss-scene').innerText()).includes('viewer'), 'and the lower third is left to the operator')

  await chat.close()
}

// -- A studio on a public site, reaching this computer ------------------------
// Chrome (142+) blocks that until the user allows it, and a plugin cannot be the one
// to ask: its socket is a WebSocket, which never prompts, in a worker, which cannot.
// The board can -- a plain request from the page brings the prompt up -- so the
// panel explains and offers Allow. Both halves were checked in Chrome 154.
//
// The Chromium here (141) knows the permission but does not enforce it, so this
// stands in for one that does: the fixture is served under a name that is not
// local, and the permission's answer is the test's. What is under test is the
// panel deciding from that answer, and the request it makes.
{
  const served = new URL(BASE)
  const PUBLIC = BASE.replace(served.hostname, 'studio.test')
  // Mapped to whatever name the suite already reaches the server by, never to an
  // address. On GitHub's runner the preview listens on ::1, so 'studio.test' mapped
  // to 127.0.0.1 was refused there while every other page in the run loaded; here,
  // with no IPv6 at all, it worked. Resolving the same name the same way cannot
  // disagree with the rest of the suite.
  const elsewhere = await chromium.launch({
    executablePath,
    args: [`--host-resolver-rules=MAP studio.test ${served.hostname}`, `--unsafely-treat-insecure-origin-as-secure=${PUBLIC}`],
  })
  // The browser's answer, and the user accepting the prompt when asked. `__asked`
  // counts the board asking at all.
  const standIn = () => {
    let state = 'prompt'
    const heard = new Set()
    const status = {
      get state() {
        return state
      },
      addEventListener: (_type, listener) => heard.add(listener),
      removeEventListener: (_type, listener) => heard.delete(listener),
    }
    const query = navigator.permissions.query.bind(navigator.permissions)

    window.__asked = 0
    navigator.permissions.query = async (descriptor) => {
      if (descriptor.name !== 'loopback-network') return query(descriptor)
      window.__asked += 1

      return status
    }

    const fetch = window.fetch.bind(window)

    window.__prompted = []
    window.fetch = (url, init) => {
      if (!String(url).startsWith('http://localhost:49124')) return fetch(url, init)

      // The user accepting the prompt.
      window.__prompted.push({ url: String(url), mode: init?.mode })
      state = 'granted'
      for (const listener of heard) listener()

      return Promise.reject(new TypeError('Failed to fetch'))
    }
  }
  const openPlugins = async (page) => {
    await page.goto(`${PUBLIC}/#/`)
    await page.waitForSelector('text=Clocks')
    await page.locator('.ss-control-bar').hover()
    await page.locator('.ss-menu-open').click()
    await page.locator('.ss-menu-plugins').click()
  }
  const board = await (await elsewhere.newContext()).newPage()

  await board.addInitScript(standIn)
  await openPlugins(board)

  const blocked = (plugin) => `.ss-plugin[data-plugin="${plugin}"] .ss-local-access`

  check(
    await becomes(board, (selector) => /programs on this computer/.test(document.querySelector(selector)?.textContent ?? ''), blocked('rocket-league')),
    'a studio on a public site is told the browser is blocking the game on this computer',
  )
  check(!(await board.locator(blocked('twitch')).count()), 'and not about a plugin that talks to the internet')

  await board.locator(`${blocked('rocket-league')} .ss-local-access-allow`).click()

  const prompted = await board.evaluate(() => window.__prompted)

  console.log(`  local access: ${JSON.stringify(prompted)}`)
  check(
    prompted.length === 1 && prompted[0].url === 'http://localhost:49124' && prompted[0].mode === 'no-cors',
    'Allow makes the one plain request that brings up the prompt, at the game’s own port',
  )
  check(
    await becomes(board, (selector) => !document.querySelector(selector), blocked('rocket-league')),
    'and once it is granted, the panel stops blaming the browser',
  )

  // Inside OBS the same board must not blame the browser. OBS 33's Chromium lets a
  // plugin's socket through but still answers `prompt`, and has no prompt to show,
  // so an Allow there is a button that does nothing beside a plugin that is down for
  // another reason. Seen in the 33 beta, with the game closed. OBS is told by the
  // user agent it sets in docks and sources.
  const dock = await (
    await elsewhere.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.7871.0 OBS/33.0.0 Safari/537.36',
    })
  ).newPage()

  await dock.addInitScript(standIn)
  await openPlugins(dock)
  await dock.waitForSelector('.ss-plugin[data-plugin="rocket-league"]')
  // Longer than the first board took to ask and show the notice, so a board that
  // was going to ask has had the chance.
  await dock.waitForTimeout(1500)

  const inObs = await dock.evaluate(() => ({
    status: document.querySelector('.ss-plugin[data-plugin="rocket-league"]')?.dataset.status,
    asked: window.__asked,
    notice: document.querySelectorAll('.ss-local-access').length,
  }))

  console.log(`  inside OBS: ${JSON.stringify(inObs)}`)
  check(inObs.status !== 'connected' && inObs.asked === 0 && inObs.notice === 0, 'inside OBS, a game that is not connected is not blamed on the browser')

  await elsewhere.close()
}

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

  // A value inside a sentence.
  //
  // Not a check on where the element ended up: React builds the DOM through
  // createElement rather than by parsing markup, so a block child stays nested
  // inside the <p> instead of the parser closing it early. What actually breaks is
  // the *line* -- a block element takes the full width and puts the words either
  // side of it on their own rows, so the sentence comes apart visually while every
  // structural assertion still passes.
  const sentence = await spacing.evaluate(() => {
    const value = document.querySelector('.probe-inline')
    const line = parseFloat(getComputedStyle(document.querySelector('.probe-sentence')).lineHeight)

    return {
      tag: value?.tagName.toLowerCase(),
      display: getComputedStyle(value).display,
      // How many line-heights tall the paragraph is: one if it reads as a sentence.
      lines: Math.round(document.querySelector('.probe-sentence').getBoundingClientRect().height / line),
      reads: document.querySelector('.probe-sentence')?.innerText.replace(/\s+/g, ' ').trim(),
    }
  })

  console.log(`  a value in a sentence: ${JSON.stringify(sentence)}`)
  check(sentence.tag === 'span', `a value renders inline by default (got <${sentence.tag}>)`)
  check(sentence.lines === 1, `and sits on the line it was written on rather than breaking it (${sentence.lines} lines tall)`)
  check(sentence.reads === 'Playing A tonight', 'so the sentence reads as written')

  await spacing.close()
}

// -- A sequence ---------------------------------------------------------------
// Slides of anything, each on screen for its own duration. What is checked is what
// an audience would see: the order, how long each one holds, that one leaves as the
// next arrives, that the box does not jump, and that it starts from the top.
//
// Watched rather than sampled where timing matters, as the slideshow is: polling
// either side of a change reads the state at the wrong instant.
{
  /** Every phase change of a sequence's items, with when it happened and what the others were doing. */
  const watch = (selector) => {
    const box = document.querySelector(selector)
    const items = [...box.querySelectorAll(':scope > .ss-sequence-item')]
    const log = []

    window.__sequence = { ...window.__sequence, [selector]: log }

    new MutationObserver((records) => {
      for (const record of records) {
        if (!items.includes(record.target) || record.target.dataset.state === record.oldValue) continue

        log.push({
          at: items.indexOf(record.target),
          state: record.target.dataset.state,
          t: performance.now(),
          others: items.filter((item) => item !== record.target).map((item) => item.dataset.state),
        })
      }
    }).observe(box, { attributes: true, attributeFilter: ['data-state'], attributeOldValue: true, subtree: true })
  }

  const arrivals = (log) => log.filter((entry) => entry.state === 'entering')

  const rotation = await context.newPage()

  await rotation.goto(`${BASE}/#/source/sequence`)
  await rotation.waitForSelector('.probe-rotation > .ss-sequence-item')
  await rotation.evaluate(watch, '.probe-rotation')

  // Sampled alongside the watch: how many items are on, and how tall the box is.
  const samples = []

  for (let i = 0; i < 44; i += 1) {
    samples.push(
      await rotation.evaluate(() => {
        const items = [...document.querySelectorAll('.probe-rotation > .ss-sequence-item')]

        return {
          on: items.filter((item) => ['entering', 'active'].includes(item.dataset.state)).length,
          height: Math.round(document.querySelector('.probe-rotation').getBoundingClientRect().height),
        }
      }),
    )
    await rotation.waitForTimeout(150)
  }

  const log = await rotation.evaluate(() => window.__sequence['.probe-rotation'])
  const came = arrivals(log)
  const order = came.map((entry) => entry.at)

  console.log(`  rotation, items coming on: ${order.join(', ')}`)
  check(came.length >= 5, `a sequence with no toggle plays on its own (${came.length} items in about 7s)`)
  check(
    order.every((at, i) => i === 0 || at === { 0: 2, 2: 3, 3: 0 }[order[i - 1]]),
    'in order, going round again after the last, and skipping the item whose duration is nought',
  )
  check(!order.includes(1), 'the item of no duration never comes on')
  check(order.includes(2), 'a plain child plays as an item, held for the sequence’s duration')

  const motions = await rotation.evaluate(() =>
    [...document.querySelectorAll('.probe-rotation > .ss-sequence-item')].map((item) =>
      ['ss-slide-up', 'ss-cut'].filter((name) => item.classList.contains(name)).join(),
    ),
  )

  console.log(`  rotation, motions: ${motions.join(' | ')}`)
  check(
    motions[0] === 'ss-slide-up' && motions[2] === 'ss-slide-up' && motions[3] === 'ss-cut',
    'an item with no transition of its own, or a null one, moves as the sequence says, and one with its own keeps it',
  )

  // Item to item, the gap is the outgoing item's duration and nothing else: its exit
  // happens on the next one's time.
  const held = { 0: 1200, 2: 800, 3: 1000 }
  const gaps = came.slice(1).map((entry, i) => ({ item: came[i].at, ms: Math.round(entry.t - came[i].t) }))

  console.log(`  rotation, held for: ${gaps.map((gap) => `${gap.item}:${gap.ms}ms`).join(', ')}`)
  check(
    gaps.length >= 4 && gaps.every((gap) => Math.abs(gap.ms - held[gap.item]) <= 150),
    'each item is on for its own duration, its exit not counted, so one loop is the durations added up',
  )

  check(
    came.slice(1).every((entry) => entry.others.includes('exiting')),
    'each item comes in while the one before is still going out, so the default is a cross-fade',
  )
  check(
    samples.every((sample) => sample.on === 1),
    `exactly one item is on at any moment (${samples.filter((sample) => sample.on === 1).length}/${samples.length})`,
  )

  const heights = [...new Set(samples.map((sample) => sample.height))]

  console.log(`  rotation heights: ${heights.join(', ')}`)
  check(heights.length === 1 && heights[0] === 96, 'the box is the size of the largest item throughout, so nothing around it moves')

  // From its own mount, not off a clock in the room: a page that mounts it later
  // starts from the first item, and holds that for its full duration. Read by a
  // script that is in the page before the app is, because by the time a test could
  // look the first item may be over. An observer rather than animation frames: the
  // first frame after the items went in came 300ms late on a page still loading,
  // which read as the first item being short.
  const second = await context.newPage()

  await second.addInitScript(() => {
    let mounted

    new MutationObserver(() => {
      const items = [...document.querySelectorAll('.probe-rotation > .ss-sequence-item')]

      if (!items.length || window.__mount?.next) return

      const now = performance.now()
      const on = items.findIndex((item) => ['entering', 'active'].includes(item.dataset.state))

      mounted ??= now
      window.__mount ??= {}
      if (on !== -1) window.__mount.first ??= { at: on, ms: Math.round(now - mounted) }
      if (on !== -1 && window.__mount.first.at !== on) window.__mount.next = { at: on, ms: Math.round(now - mounted) }
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state'] })
  })
  await second.goto(`${BASE}/#/source/sequence`)
  await becomes(second, () => window.__mount?.next)

  const mount = await second.evaluate(() => window.__mount)

  console.log(`  mounted later: ${JSON.stringify(mount)}`)
  check(
    mount.first?.at === 0 && mount.next?.at === 2 && Math.abs(mount.next.ms - 1200) <= 200,
    'a page that mounts it later starts from the first item, rather than joining wherever another output is',
  )

  await second.close()

  // The intro: nothing until the operator says, then once through, holding the last.
  const intro = () => [...document.querySelectorAll('.probe-intro > .ss-sequence-item')].map((item) => item.dataset.state)

  check(
    (await rotation.evaluate(intro)).every((state) => state === 'inactive'),
    'a sequence on a toggle shows nothing while the toggle is off',
  )

  await rotation.evaluate(watch, '.probe-intro')
  await control.locator('button:has-text("Show intro")').click()
  await rotation.waitForTimeout(2600)

  const played = arrivals(await rotation.evaluate(() => window.__sequence['.probe-intro']))

  console.log(`  intro, items coming on: ${played.map((entry) => entry.at).join(', ')}`)
  check(played.map((entry) => entry.at).join() === '0,1,2', 'turning the toggle on plays it from the first item, once')
  check((await rotation.evaluate(intro)).join() === 'inactive,inactive,active', 'and it holds the last item rather than going round again')

  await control.locator('button:has-text("Hide intro")').click()
  check(
    await becomes(rotation, () => [...document.querySelectorAll('.probe-intro > .ss-sequence-item')].every((item) => item.dataset.state === 'inactive')),
    'turning it off takes the sequence off',
  )

  await rotation.evaluate(watch, '.probe-intro')
  await control.locator('button:has-text("Show intro")').click()
  check(await becomes(rotation, () => window.__sequence['.probe-intro'].some((entry) => entry.state === 'entering')), 'turning it on again plays it again')
  check(
    (await rotation.evaluate(() => window.__sequence['.probe-intro'].find((entry) => entry.state === 'entering').at)) === 0,
    'from the top, rather than from wherever it was when it went off',
  )

  await control.locator('button:has-text("Hide intro")').click()
  await rotation.close()
}

// -- A panel's header: folding, and actions on its line ------------------------
// Everything here is local to the page -- a fold, a counter, a plain input -- so the
// show is left exactly as the checks after it expect.
const fold = control.locator('.fixture-fold')
const foldState = () =>
  control.evaluate(() => {
    const panel = document.querySelector('.fixture-fold')
    const body = panel.querySelector('.ss-panel-body')

    return {
      expanded: panel.querySelector('.ss-panel-fold').getAttribute('aria-expanded'),
      shown: body.getBoundingClientRect().height > 0,
      says: panel.querySelector('.fixture-fold-says')?.textContent,
      presses: panel.querySelector('.fixture-fold-press')?.textContent,
    }
  })

let state = await foldState()
check(state.expanded === 'false' && !state.shown, 'a collapsible panel starts folded, its controls off the board')
check(state.says === 'folded', 'and actions given as a function are told it is folded')

await fold.locator('.fixture-fold-press').click()
state = await foldState()
check(state.presses === 'Pressed 1' && !state.shown, 'an action in the header works while the panel is folded, and pressing it does not open it')

await fold.locator('.ss-panel-fold').click()
check(
  await becomes(control, () => document.querySelector('.fixture-fold .fixture-fold-says')?.textContent === 'open'),
  'pressing the title opens it, and the actions hear about it',
)
state = await foldState()
check(state.expanded === 'true' && state.shown, 'with its controls back on the board')

await fold.locator('.fixture-fold-input').fill('still here')
await fold.locator('.ss-panel-fold').click()
await fold.locator('.ss-panel-fold').click()
check(
  (await fold.locator('.fixture-fold-input').inputValue()) === 'still here',
  'folding hides the controls without unmounting them, so what was typed survives',
)

check(
  (await control.locator('.ss-panel-fold').count()) === 2,
  'and only the panels that ask to be collapsible fold -- every other panel on the board is as it was',
)

// Not remembered: a page that loads now starts folded, though this one is open.
const reloaded = await context.newPage()
await reloaded.goto(`${BASE}/#/`)
await reloaded.waitForSelector('.fixture-fold')
check(
  (await reloaded.locator('.fixture-fold .ss-panel-fold').getAttribute('aria-expanded')) === 'false',
  'a fold is not remembered: another load of the board starts folded while this one is open',
)
await reloaded.close()

// Back to folded, as the board loads, for whatever comes after.
await fold.locator('.fixture-fold-input').fill('')
await fold.locator('.ss-panel-fold').click()

const headers = await control.evaluate(() => {
  const untitled = document.querySelector('.fixture-untitled')
  const bare = document.querySelector('.fixture-bare')

  return {
    untitledHeading: untitled.querySelector('h2') !== null,
    untitledAction: untitled.querySelector('.ss-panel-actions .fixture-untitled-action') !== null,
    untitledFold: untitled.querySelector('.ss-panel-fold')?.getAttribute('aria-label'),
    untitledOpen: untitled.querySelector('.ss-panel-body').getBoundingClientRect().height > 0,
    bareHeader: bare.querySelector('.ss-panel-header') !== null,
  }
})
check(!headers.untitledHeading && headers.untitledAction, 'a panel without a title has no heading, and its actions still have their line')
check(headers.untitledFold === 'Fold panel' && headers.untitledOpen, 'its fold is a chevron with a name of its own, and defaultOpen starts it open')
check(!headers.bareHeader, 'a panel with nothing for a header to hold has no header at all')

// The title line in both shapes of dock. Wide, the actions sit at the right of the
// title; slim, they take a line of their own rather than squeezing it, and nothing
// pokes out of the panel.
const titleLine = () => {
  const panel = document.querySelector('.fixture-fold')
  const box = (el) => el.getBoundingClientRect()
  const title = box(panel.querySelector('h2'))
  const tools = box(panel.querySelector('.ss-panel-actions'))
  const edge = box(panel)

  return {
    beside: tools.top < title.bottom && tools.left >= title.right,
    under: tools.top >= title.bottom,
    inside: tools.right <= edge.right && title.right <= edge.right,
    titleLines: Math.round(title.height / parseFloat(getComputedStyle(panel.querySelector('h2')).lineHeight)),
  }
}
const wideLine = await rowsAt(1280, titleLine)
check(wideLine.beside && wideLine.inside, 'on a wide board the actions sit on the title line, at its right')
const slimLine = await rowsAt(380, titleLine)
check(
  slimLine.under && slimLine.inside && slimLine.titleLines === 1,
  'in a slim dock they drop under the title, which keeps its line, and stay inside the panel',
)

// -- The board's own look: stripes, a dark scheme, header-sized buttons ---------
await control.locator('.fixture-small-mount').click()
await control.waitForSelector('.fixture-small-md')
const look = await control.evaluate(() => {
  const board = document.querySelector('.ss-control')
  const panels = [...board.querySelectorAll('.ss-panel')].filter((panel) => !panel.parentElement.closest('.ss-panel'))
  const fill = (el) => getComputedStyle(el).backgroundColor
  const box = (el) => el.getBoundingClientRect()
  const small = [...document.querySelectorAll('.fixture-small .ss-panel-actions > *')]

  return {
    fills: panels.slice(0, 4).map(fill),
    scheme: getComputedStyle(board).colorScheme,
    smallHeights: small.map((el) => Math.round(box(el).height)),
    smallText: small.map((el) => getComputedStyle(el).fontSize),
    regular: Math.round(box(document.querySelector('.fixture-small-md')).height),
  }
})
console.log(`  panel fills: ${look.fills.join(' | ')}`)
check(
  look.fills[0] !== look.fills[1] && look.fills[0] === look.fills[2] && look.fills[1] === look.fills[3],
  'panels are striped, every other one a shade lighter, without the studio asking',
)
check(look.scheme === 'dark', 'the board tells the browser it is dark, so native pickers and scrollbars draw dark')

const plain = await context.newPage()
await plain.goto(`${BASE}/#/source/sequence`)
await plain.waitForSelector('.ss-source')
check((await plain.evaluate(() => getComputedStyle(document.documentElement.querySelector('.ss-source')).colorScheme)) === 'normal', 'and a graphic does not')
await plain.close()

console.log(`  header buttons: ${look.smallHeights.join(', ')}px tall, ${[...new Set(look.smallText)].join(', ')}; on a row ${look.regular}px`)
check(
  look.smallHeights.length === 7 && look.smallHeights.every((height) => height >= 24 && height < look.regular),
  'a header button at size="sm" is smaller than its row-sized self, and never under the 24px a pointer needs, even squeezed',
)
check(
  look.smallText.every((size) => size === '12px'),
  'with smaller text, on every button that takes the size, whichever way it renders',
)
await control.locator('.fixture-small-mount').click()

// A card folded with core's own hook and chevron, as a studio folds one.
const card = control.locator('.fixture-card')
const cardState = () =>
  card.evaluate((el) => ({
    expanded: el.querySelector('.fixture-card-fold').getAttribute('aria-expanded'),
    shown: el.querySelector('.fixture-card-body').getBoundingClientRect().height > 0,
    turned: el.querySelector('.ss-chevron').classList.contains('-rotate-90'),
  }))
let folded = await cardState()
check(folded.expanded === 'false' && !folded.shown && folded.turned, 'useCollapsed starts a card folded, and Chevron turns to say so')
await card.locator('.fixture-card-fold').click()
folded = await cardState()
check(folded.expanded === 'true' && folded.shown && !folded.turned, 'and one press opens it, the chevron pointing down')
await card.locator('.fixture-card-fold').click()

// -- A stepper fills its cell ---------------------------------------------------
// A stepper's field used to stop at 4rem, so a stepper was 160px in any cell and the
// rest of the cell sat empty -- 414px of 574 at 640px wide. Measured across the
// widths a dock and a board take, for every stepper and stopwatch on a Row.
const fills = () => {
  const edge = (el) => el.getBoundingClientRect()
  const short = (cell, last) => Math.round(edge(cell).right - edge(last).right)
  const steppers = [...document.querySelectorAll('.ss-row > .ss-stepper:not(.col-auto)')]
  const watches = [...document.querySelectorAll('.ss-row > .ss-stopwatch')]
  const auto = document.querySelector('.fixture-auto .ss-stepper')

  return {
    steppers: steppers.map((cell) => short(cell, [...cell.querySelectorAll('button')].at(-1))),
    watches: watches.map((cell) => short(cell, [...cell.querySelectorAll('button')].at(-1))),
    auto: Math.round(edge(auto).width),
  }
}
for (const width of [380, 800, 1280]) {
  const measured = await rowsAt(width, fills)
  console.log(
    `  at ${width}px: steppers short of their cell by ${measured.steppers.join(', ')}px; stopwatch ${measured.watches.join(', ')}px; col-auto stepper ${measured.auto}px`,
  )
  check(
    measured.steppers.length >= 4 && measured.steppers.every((gap) => Math.abs(gap) <= 1),
    `at ${width}px every stepper on a Row reaches the edge of its cell, with nothing empty beside it`,
  )
  check(measured.watches.length >= 1 && measured.watches.every((gap) => Math.abs(gap) <= 1), `and so does a stopwatch, at ${width}px`)
  check(Math.abs(measured.auto - 160) <= 1, `while a col-auto stepper keeps its own 160px, at ${width}px`)
}

// -- The board's spacing is the studio's to set ---------------------------------
// It stepped at 640px through utilities in the markup, which a studio could only
// beat with CSS aimed at the framework's own classes. Now properties, with the same
// values and the same step by default, which a studio sets on .ss-control.
const spacing = () => {
  const px = (el, prop) => Math.round(parseFloat(getComputedStyle(el)[prop]))
  const panel = document.querySelector('.ss-panel')
  const board = document.querySelector('.ss-board') ?? document.querySelector('.ss-control > main')
  const bar = document.querySelector('.ss-control-bar')

  return {
    named: board.classList.contains('ss-board') && board.parentElement.classList.contains('ss-control'),
    panel: px(panel, 'paddingTop'),
    board: px(board, 'paddingTop'),
    gap: px(board, 'rowGap'),
    barX: px(bar, 'paddingLeft'),
    barY: px(bar, 'paddingTop'),
  }
}
const studioSets = () => {
  const style = document.createElement('style')
  style.textContent = '.ss-control { --ss-panel-pad: 20px; --ss-board-pad: 20px; --ss-board-gap: 20px; --ss-bar-pad-x: 20px; --ss-bar-pad-y: 20px; }'
  document.head.append(style)
  const px = (el, prop) => Math.round(parseFloat(getComputedStyle(el)[prop]))
  const board = document.querySelector('.ss-board') ?? document.querySelector('.ss-control > main')
  const bar = document.querySelector('.ss-control-bar')

  return [px(document.querySelector('.ss-panel'), 'paddingTop'), px(board, 'paddingTop'), px(board, 'rowGap'), px(bar, 'paddingLeft'), px(bar, 'paddingTop')]
}
const slimSpacing = await rowsAt(380, spacing)
const wideSpacing = await rowsAt(1280, spacing)
console.log(`  spacing at 380px: ${JSON.stringify(slimSpacing)}; at 1280px: ${JSON.stringify(wideSpacing)}`)
check(slimSpacing.named, "the board's <main> has a class of its own, .ss-board")
check(
  [slimSpacing.panel, slimSpacing.board, slimSpacing.gap, slimSpacing.barX, slimSpacing.barY].join() === '12,12,12,12,10' &&
    [wideSpacing.panel, wideSpacing.board, wideSpacing.gap, wideSpacing.barX, wideSpacing.barY].join() === '16,16,16,16,12',
  'left alone, the board keeps the spacing it always had, and its step at 640px',
)
const setSlim = await rowsAt(380, studioSets)
const setWide = await rowsAt(1280, studioSets)
check(
  [...setSlim, ...setWide].every((value) => value === 20),
  'a studio that sets the spacing on .ss-control gets it at every width, step and all',
)

// -- A col-auto picker stops at a width -------------------------------------------
// An ImagePicker is as wide as the longest name in the library. col-auto let it take
// that, however long, out of the field beside it.
await control.locator('.ss-asset-library input[aria-label="Image URL"]').fill(`${BASE}/logos/broncos.svg`)
await control.locator('.ss-asset-library input[aria-label="Asset name"]').fill('northwind-esports-primary-logo-2026')
await control.locator('.ss-asset-library button:has-text("Add URL")').click()
check(
  await becomes(control, () => [...document.querySelectorAll('.fixture-capped option')].some((option) => /northwind/.test(option.textContent))),
  'a long name reaches the picker',
)
const capped = () => {
  const width = (el) => Math.round(el.getBoundingClientRect().width)
  const row = document.querySelector('.fixture-capped')

  const picker = row.querySelector('.ss-image-picker').getBoundingClientRect()
  const field = row.querySelector('.ss-field').getBoundingClientRect()

  return {
    picker: Math.round(picker.width),
    field: Math.round(field.width),
    row: width(row),
    gap: Math.round(parseFloat(getComputedStyle(row).columnGap)),
    shared: Math.abs(picker.top - field.top) < 1,
  }
}
const viewport = control.viewportSize()
await control.setViewportSize({ width: 1024, height: 900 })
await control.waitForTimeout(300)
const capWide = await control.evaluate(capped)
await control.setViewportSize({ width: 380, height: 900 })
await control.waitForTimeout(300)
const capSlim = await control.evaluate(capped)
await control.setViewportSize(viewport)
console.log(`  at 1024px: picker ${capWide.picker}px, field ${capWide.field}px of ${capWide.row}px; at 380px: picker ${capSlim.picker}px of ${capSlim.row}px`)
check(
  capWide.shared && capWide.picker === 148 && capWide.field === capWide.row - capWide.picker - capWide.gap,
  'a col-auto picker with a long name stops at 9.25rem, and the field on its line keeps the rest',
)
check(capSlim.picker === capSlim.row, 'below its breakpoint the same picker has its line to itself, uncapped')

// -- Fit on more than one line ----------------------------------------------------
// The same long name in identical 360px boxes of 48px text, wrapped to one line and
// to two. Two lines should let it stay larger, take two lines and no more, and
// overflow nothing; and it should be the largest size that does, not merely a size.
const linesPage = await context.newPage()
await linesPage.goto(`${BASE}/#/source/lines`)
await linesPage.waitForSelector('.lines-variable .ss-fit')
await linesPage.waitForTimeout(600)
const wrapped = await linesPage.evaluate(() => {
  const linesOf = (element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0).sort((a, b) => a.top - b.top)
    let count = 0
    let floor = -Infinity
    for (const rect of rects) {
      if (rect.top >= floor) {
        count += 1
        floor = rect.top + rect.height / 2
      }
    }
    return count
  }
  const read = (selector) => {
    const fit = document.querySelector(`${selector} .ss-fit`)
    const box = fit.closest(selector)
    const size = parseFloat(getComputedStyle(fit).fontSize)
    const room = box.clientWidth
    const now = { size: Math.round(size * 10) / 10, lines: linesOf(fit), inside: fit.scrollWidth <= room }

    // The largest that fits: five percent larger has to break one of the two rules.
    const was = fit.style.fontSize
    fit.style.fontSize = `${size * 1.05}px`
    now.largest = fit.scrollWidth > room || linesOf(fit) > (selector === '.lines-word' ? 3 : 2)
    fit.style.fontSize = was

    return now
  }
  return {
    one: read('.lines-one'),
    two: read('.lines-two'),
    short: read('.lines-short'),
    word: read('.lines-word'),
    variable: read('.lines-variable'),
  }
})
await linesPage.close()
console.log(
  `  fit: one line ${wrapped.one.size}px; two lines ${wrapped.two.size}px over ${wrapped.two.lines}; word ${wrapped.word.size}px; Variable ${wrapped.variable.size}px over ${wrapped.variable.lines}`,
)
check(wrapped.one.lines === 1 && wrapped.one.inside, 'Fit with no lines keeps a long name on one line, inside its box, as before')
check(
  wrapped.two.lines === 2 && wrapped.two.inside && wrapped.two.size > wrapped.one.size * 1.3,
  'lines={2} wraps it onto two lines and keeps it much larger than one line allows',
)
check(wrapped.two.largest, 'at the largest size that fits two lines: five percent more would not')
check(wrapped.short.size === 48 && wrapped.short.lines === 1, 'text that already fits is left at its own size, on one line')
check(wrapped.word.inside && wrapped.word.size < 48 && wrapped.word.largest, 'a single word wider than the box shrinks until it fits, since wrapping cannot help')
check(
  wrapped.variable.lines === 2 && Math.abs(wrapped.variable.size - wrapped.two.size) < 0.2,
  "a Variable's lines reaches its Fit, and fits the same as Fit itself",
)

// -- The image store folds its groups --------------------------------------------
// A season of slides is one group of hundreds, and loose images used to sort below
// every group. Now loose ones come first and named groups start folded, on every
// load, unless a filter, a picker's current image, or a fresh upload opens one.
const store = control.locator('.ss-asset-library').first()
// Several files under a typed group, not the folder input: a folder upload this far
// down the suite stalls, as AGENTS.md describes for the asset library, and the
// typed group files them identically.
const fileUnder = async (group, folder, names) => {
  await store.locator('input[aria-label="Asset name"]').fill(group)
  await store.locator('input[aria-label="Add image files"]').setInputFiles(names.map((name) => asset(`${folder}/${name}.svg`)))
}
await fileUnder('commanders', 'commanders', ['ash', 'iris', 'kestrel', 'solomon', 'vulcan', 'wren'])
await becomes(control, () => [...document.querySelectorAll('.ss-asset-group')].some((group) => /commanders/.test(group.textContent)))
await fileUnder('maps', 'maps', ['ashfall', 'dry-harbour', 'redline'])
check(
  await becomes(control, () => {
    const maps = [...document.querySelectorAll('.ss-asset-library .ss-asset-group')].find((group) =>
      /^\s*maps/i.test(group.querySelector('h3')?.textContent ?? ''),
    )

    return maps?.dataset.open === 'true' && [...maps.querySelectorAll('.ss-asset-tile')].every((tile) => tile.getBoundingClientRect().height > 0)
  }),
  'a group just uploaded shows open, so what arrived is on screen',
)

const fresh = await context.newPage()
await fresh.goto(`${BASE}/#/`)
await fresh.waitForSelector('.ss-asset-library .ss-asset-group')
await fresh.waitForTimeout(600)
const groupsNow = () =>
  [...document.querySelectorAll('.ss-asset-library')][0]
    ? [...[...document.querySelectorAll('.ss-asset-library')][0].querySelectorAll('.ss-asset-group')].map((group) => ({
        name: group.querySelector('.ss-asset-group-fold')?.textContent.replace(/\d+$/, '').trim() || '',
        open: group.dataset.open ?? 'loose',
        shown: [...group.querySelectorAll('.ss-asset-tile')].filter((tile) => tile.getBoundingClientRect().height > 0).length,
        tiles: group.querySelectorAll('.ss-asset-tile').length,
      }))
    : []
const loaded = await fresh.evaluate(groupsNow)
console.log(`  groups on load: ${loaded.map((group) => `${group.name || 'loose'}:${group.open}:${group.shown}/${group.tiles}`).join(', ')}`)
check(
  loaded[0]?.open === 'loose' && loaded[0].shown === loaded[0].tiles && loaded[0].tiles > 0,
  'on a fresh load the loose images come first, and are on screen',
)
check(
  loaded.length >= 3 && loaded.slice(1).every((group) => group.open === 'false' && group.shown === 0 && group.tiles > 0),
  'and every named group starts folded, its images kept but hidden',
)

const lib = fresh.locator('.ss-asset-library').first()
await lib.locator('.ss-asset-group-fold', { hasText: 'maps' }).click()
const opened = await fresh.evaluate(groupsNow)
check(
  opened.find((group) => group.name === 'maps')?.shown === 3 && opened.find((group) => group.name === 'commanders')?.open === 'false',
  'pressing a group opens that group and no other',
)

await lib.locator('input[aria-label="Filter images"]').fill('kestrel')
const filtered = await fresh.evaluate(groupsNow)
check(filtered.find((group) => group.name === 'commanders')?.shown === 1, 'a filter shows a match inside a folded group')
await lib.locator('input[aria-label="Filter images"]').fill('')
const cleared = await fresh.evaluate(groupsNow)
check(
  cleared.find((group) => group.name === 'commanders')?.open === 'false' && cleared.find((group) => group.name === 'maps')?.open === 'true',
  'and clearing it puts every group back as it was',
)

// A chooser opens on the group its current image is in.
await fresh.locator('.fixture-capped select').selectOption('asset:commanders/wren')
await fresh.locator('button[aria-label="Browse images for Crest"]').click()
await fresh.waitForSelector('dialog[open] .ss-asset-library')
const chooser = await fresh.evaluate(() => {
  const dialog = document.querySelector('dialog[open] .ss-asset-library')

  return [...dialog.querySelectorAll('.ss-asset-group')].map((group) => ({
    name: group.querySelector('.ss-asset-group-fold')?.textContent.replace(/\d+$/, '').trim() || '',
    open: group.dataset.open ?? 'loose',
  }))
})
check(
  chooser.find((group) => group.name === 'commanders')?.open === 'true' && chooser.find((group) => group.name === 'maps')?.open === 'false',
  'a picker opens the store on the group its current image is in, and leaves the rest folded',
)
await fresh.close()

// -- The OBS check page ----------------------------------------------------------
// A diagnostic to load in OBS as a dock and as a source, which reports what
// window.obsstudio really answers there. Checked here against a stand-in, because a
// diagnostic that misreads silence as an answer, or calls something that changes
// OBS, would be worse than none.
const outside = await context.newPage()
await outside.goto(`${BASE}/obs-check.html`)
const outsideReport = await outside.evaluate(() => window.__obsCheck)
check(
  !outsideReport.obsstudio && Object.values(outsideReport.calls).every((said) => said === 'absent'),
  'outside OBS the check page says so, and calls nothing',
)
await outside.close()

const inside = await context.newPage()
await inside.addInitScript(() => {
  window.__changed = []
  const change = (name) => () => window.__changed.push(name)
  window.obsstudio = {
    pluginVersion: '2.99.0',
    getControlLevel: (cb) => setTimeout(() => cb(4), 50),
    getStatus: () => {
      throw new Error('stand-in refuses')
    },
    // getCurrentScene and the rest of the readers never call back, as a dock's are
    // expected not to.
    getCurrentScene: () => {},
    // Below its level a source calls back with null, as OBS 33 did on a default
    // source: that is a refusal, not an answer.
    getScenes: (cb) => setTimeout(() => cb(null), 50),
    getTransitions: () => {},
    getCurrentTransition: () => {},
    setCurrentScene: change('setCurrentScene'),
    startStreaming: change('startStreaming'),
    startRecording: change('startRecording'),
  }
})
await inside.goto(`${BASE}/obs-check.html`)
await inside.evaluate(() => window.dispatchEvent(new CustomEvent('obsSceneChanged', { detail: { name: 'Gameplay' } })))
await inside.waitForTimeout(3500)
const stood = await inside.evaluate(() => ({ report: window.__obsCheck, changed: window.__changed, text: document.body.innerText }))
check(
  stood.report.calls.getControlLevel?.answered === 4 && /4 \(ADVANCED\)/.test(stood.text),
  'in OBS it shows an answer as an answer, with the permission level named',
)
check(stood.report.calls.getCurrentScene === 'no answer' && stood.report.calls.getTransitions === 'no answer', 'and silence as silence, after three seconds')
check(
  stood.report.calls.getScenes?.refused === null && stood.report.calls.getScenes?.needs === 2 && /refused: null, needs level 2 \(READ_USER\)/.test(stood.text),
  'and a null from a read the level does not allow as a refusal, naming the level it needs',
)
check(stood.report.calls.getStatus?.threw === 'stand-in refuses', 'and a call that throws as one that threw')
check(stood.changed.length === 0 && stood.report.present.setCurrentScene === true, 'it lists what could change OBS without ever calling it')
check(
  stood.report.events.some((event) => event.name === 'obsSceneChanged' && event.detail?.name === 'Gameplay'),
  'and logs an OBS event as it arrives',
)
// In a small browser source the events list used to grow over Copy report, so in
// OBS's Interact window it could not be reached. Measured in a source-sized window
// after eighty events, scrolled to the bottom as an operator would.
await inside.setViewportSize({ width: 400, height: 300 })
await inside.evaluate(() => {
  for (let n = 1; n <= 80; n += 1) window.dispatchEvent(new CustomEvent('obsSceneChanged', { detail: { n } }))
  window.scrollTo(0, document.body.scrollHeight)
})
const small = await inside.evaluate(() => {
  const copy = document.getElementById('copy').getBoundingClientRect()
  const rows = [...document.querySelectorAll('#events tr')]

  return {
    reachable:
      copy.top >= 0 && copy.bottom <= window.innerHeight && document.elementFromPoint(copy.left + copy.width / 2, copy.top + copy.height / 2)?.id === 'copy',
    shown: rows.length,
    newest: rows[0]?.textContent.includes('"n":80'),
    kept: window.__obsCheck.events.length,
  }
})
check(small.reachable, 'in a small source with a long event log, Copy report is still on screen and clickable')
check(small.shown === 50 && small.newest && small.kept === 81, 'with the newest event first, fifty shown, and every event kept for the report')

// A browser source is refused the clipboard in OBS 33. Refused here the same way,
// the report must open where the button is, selected, rather than at the foot of
// the page under the events.
await inside.evaluate(() => {
  navigator.clipboard.writeText = () => Promise.reject(new Error('refused'))
})
await inside.locator('#copy').click()
const refused = await inside.evaluate(() => {
  const box = document.getElementById('report')
  const visible = () => {
    const at = box?.getBoundingClientRect()

    return Boolean(at) && at.top >= 0 && at.bottom <= window.innerHeight
  }
  // Selecting it scrolls the page to it, so on screen where it lands proves
  // nothing. Wherever the operator has scrolled to -- top or foot -- it has to be
  // in view, which only the pinned header gives it.
  const selection = [box?.selectionStart, box?.selectionEnd]
  window.scrollTo(0, 0)
  const atTop = visible()
  window.scrollTo(0, document.body.scrollHeight)
  const atFoot = visible()
  box?.setSelectionRange(...selection)

  return {
    onScreen: atTop && atFoot,
    selected: document.activeElement === box && box.selectionStart === 0 && box.selectionEnd === box.value.length,
    whole: box ? JSON.parse(box.value).events.length === window.__obsCheck.events.length : false,
    says: document.getElementById('copied').textContent,
  }
})
check(
  refused.onScreen && refused.selected && refused.whole && /Ctrl\+C/.test(refused.says),
  'refused the clipboard, as a source is, it opens the whole report under the button, selected for Ctrl+C',
)
await inside.close()

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
