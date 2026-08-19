// Two machines, one show.
//
// The stage-2 claim from docs/collaboration.md: two browser profiles converge
// through a running relay. Playwright contexts are the profiles -- each gets its
// own storage partition, so each gets its own SharedWorker and its own IndexedDB,
// which is exactly the boundary a second operator's laptop sits behind.
//
// Runs against the ordinary build. No relay is baked in: the host is pointed at
// one by hand, the way whoever runs the show would, and the second machine arrives
// on an invite link with nothing configured at all.
//
//   pnpm demo:build && pnpm demo:preview
//   node apps/demo/e2e/relay.mjs

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

import { createRelay } from '../../../packages/relay/src/node.js'

/** A file in the demo's public folder, anchored to this script rather than the cwd. */
const asset = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url))

const BASE = process.argv[2] ?? 'http://localhost:4173'
const PORT = Number(process.env.RELAY_PORT ?? 0)

let failed = 0
const check = (ok, message) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${message}`)
  if (!ok) failed += 1
}

const becomes = async (page, fn, arg = null, timeout = 8000) => {
  try {
    await page.waitForFunction(fn, arg, { timeout })
    return true
  } catch {
    return false
  }
}

/**
 * Plain CSS, because these run inside the page.
 *
 * Playwright's `:has-text()` is a Playwright selector and means nothing to
 * `document.querySelector` -- it throws rather than returning null, so a check
 * using one fails instantly and looks exactly like the feature being broken.
 */
const HOME_NAME = '.ss-field input[placeholder="Kestrel Corps"]'
const SCORE = '.ss-stepper output'

const storage = await mkdtemp(join(tmpdir(), 'ss-relay-'))
const ADMIN = 'let-me-in'
let relay = createRelay({ storage, admin: ADMIN })
let running = await relay.listen(PORT)
// Pinned after the first listen: a restart has to come back on the same port, or
// the peers reconnecting is not the thing being tested.
const port = running.port

console.log(`  relay on ws://127.0.0.1:${port}, storing in ${storage}`)

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })

/** A separate profile: its own IndexedDB, its own SharedWorker. A second laptop. */
const machine = async (label, at = `${BASE}/#/`) => {
  const context = await browser.newContext({ reducedMotion: 'no-preference' })
  const page = await context.newPage()

  page.on('pageerror', (error) => console.log(`[${label} pageerror]`, error.message))
  await page.goto(at)
  await page.waitForSelector('.ss-panel')

  return { context, page, label }
}

/**
 * Commit by clicking, not by Ctrl+S.
 *
 * The keyboard route needs the page focused, and bringToFront() does not reliably
 * give focus across *contexts* the way it does across tabs of one -- which is the
 * whole point of using contexts here. A missed keypress presents as the other
 * machine never receiving the edit, which reads exactly like a broken relay.
 */
const save = async (machine) => {
  await machine.page.locator('.ss-save button[data-pending="true"]').click()
  await machine.page.waitForSelector('.ss-save button[data-pending="false"]')
}

const nameField = (machine) => machine.page.locator(HOME_NAME).first()
const scoreOf = (machine) => machine.page.locator(SCORE).first()

const host = await machine('host')

// The one person with no link to arrive on: whoever runs the show, through the
// dialog a streamer half an hour before doors would actually find. Runtime, not
// build time -- a studio deploys as static files, and an address baked into the
// build cannot be changed without a redeploy.
await host.page.locator('.ss-collaborate-open').click()
await host.page.locator('.ss-collaborate-dialog input[aria-label="Project URL"]').fill(`ws://127.0.0.1:${port}`)
await host.page.locator('.ss-collaborate-dialog input[aria-label="Room name"]').fill('friday')
await host.page.locator('.ss-collaborate-dialog .ss-collaborate-go').click()

check(
  await becomes(host.page, () => document.querySelector('.ss-sync-status')?.dataset.state === 'connected', null, 20000),
  'a board can be pointed at a room from the dialog, without rebuilding anything',
)

// Go rewrites the URL and reloads, which is the point: a dock's URL is the only
// thing OBS remembers, so the room has to live there rather than only in storage.
const dockUrl = await host.page.evaluate(() => location.href)

console.log(`  dock URL after setup: ${dockUrl}`)
check(/[?&]relay=/.test(dockUrl) && /[?&]room=friday/.test(dockUrl), 'and the room ends up in the dock URL, where OBS will remember it')

// And everyone else: paste a link into an OBS dock. That is the whole of it --
// no token typed, no settings screen, and OBS remembers the URL.
const invite = `${BASE}/?relay=${encodeURIComponent(`ws://127.0.0.1:${port}`)}&room=friday#/`
const operator = await machine('operator', invite)

check(
  await becomes(operator.page, () => document.querySelector('.ss-sync-status')?.dataset.state === 'connected', null, 15000),
  'and an operator joins by opening a link, with nothing configured',
)

// Which machine sets the room's clock. It is a property of the machine, not the
// room, so it must not ride along on the link: the invite *is* the host's own dock
// URL, and anything in it would be true of everybody who opened it.
check(!/[?&]clock=/.test(dockUrl), 'the clock role stays off the dock URL, so an invite cannot hand it out')

const clockBox = async (machine) => {
  await machine.page.locator('.ss-collaborate button, .ss-collaborate-open').first().click()

  const checked = await machine.page.locator('.ss-clock-role input[type="checkbox"]').isChecked()

  await machine.page.locator('.ss-collaborate-dialog button[aria-label="Close"]').click()

  return checked
}

check(await clockBox(host), 'the machine that set the room up is the one everyone sets their watch by')
check((await clockBox(operator)) === false, 'and a machine that arrived on a link is not')

await host.page.waitForTimeout(1500)

// -- The basic claim ---------------------------------------------------------
await nameField(host).fill('Vanguard')
await save(host)

check(await becomes(operator.page, (at) => document.querySelector(at)?.value === 'Vanguard', HOME_NAME), 'an edit on the host reaches the operator')

await nameField(operator).fill('Redline')
await save(operator)

check(await becomes(host.page, (at) => document.querySelector(at)?.value === 'Redline', HOME_NAME), 'and an edit on the operator reaches the host')

// -- The one that matters ----------------------------------------------------
// Two operators tapping +1 inside the replication window must produce +2. Under a
// last-write-wins map this is +1: a scoreboard quietly lying on air, which is the
// worst failure this system has. It is pinned in a unit test between two docs and
// in a relay test across a fake wire; this is the same claim through a real
// browser, a real SharedWorker, a real socket and a real relay.
const startingScore = Number(await scoreOf(host).textContent())

await Promise.all([
  host.page.locator('button[aria-label="Increase Home score"]').click(),
  operator.page.locator('button[aria-label="Increase Home score"]').click(),
])

const expected = startingScore + 2
const landed = async (machine) => becomes(machine.page, (want) => document.querySelector('.ss-stepper output')?.textContent.trim() === String(want), expected)

check(await landed(host), `concurrent increments add up on the host (expected ${expected})`)
check(await landed(operator), 'and to the same number on the operator')

// -- Status and presence -----------------------------------------------------
// An operator working a show from another building has to know, without asking,
// whether what they are typing is going anywhere. Ambiguity is worse than being
// plainly disconnected: someone who knows they are offline fixes it, and someone
// who does not spends a segment wondering why nobody is reacting.
const indicator = (machine) => machine.page.locator('.ss-sync-status')

check(await becomes(host.page, () => document.querySelector('.ss-sync-status')?.dataset.state === 'connected'), 'the board says it is connected')

await host.page.locator('.ss-operator input').fill('Dez')
await operator.page.locator('.ss-operator input').fill('Sam')

check(
  await becomes(host.page, () => /2/.test(document.querySelector('.ss-sync-peers')?.textContent ?? '')),
  'and counts the other operator once they name themselves',
)

// Field-level presence: the staged-edit model already makes an edit local until
// saved, so this is a warning rather than a lock. A lock is something that can
// strand a board when somebody closes a laptop with a field open.
await nameField(operator).fill('Ashfall')

check(
  await becomes(host.page, () => document.querySelector('.ss-field-busy')?.textContent.includes('Sam')),
  'a field being edited elsewhere says who has it',
)

await save(operator)

check(
  await becomes(host.page, () => !document.querySelector('.ss-field-busy')),
  'and stops saying so once they save',
)

// -- The image library -------------------------------------------------------
// The index replicates; the bytes do not. Without this the failure is silent and
// lands on air: an operator picks a headshot from their own library, the reference
// replicates fine, the machine running OBS has no bytes for it, and the graphic
// goes out showing its fallback while the operator's screen shows the photo.
//
// The rule that removes it: files are added on the machine running OBS, URLs by
// anybody. A file's bytes exist only where they were dropped; a URL is a reference
// every machine fetches for itself.
check(
  (await host.page.locator('.ss-asset-library input[aria-label="Add image files"]').count()) === 1,
  'the machine running OBS is offered a file input',
)

// Polled rather than read once: the operator learns the role from the host's
// awareness state, so there is a moment after joining where it does not yet know
// anybody has claimed it. Erring open during that moment is the right default --
// see useOwner -- which is exactly why the test has to wait for the answer instead
// of catching the board mid-question.
// Polled rather than read once: the operator learns the role from the host's
// awareness state, so there is a moment after joining where it does not yet know
// anybody has claimed it. Erring open during that moment is the right default --
// see useOwner -- which is exactly why the test has to wait for the answer instead
// of catching the board mid-question.
check(
  await becomes(operator.page, () => !document.querySelector('.ss-asset-library input[aria-label="Add image files"]'), null, 15000),
  'and a machine that cannot display the bytes is not offered one at all',
)

check(
  await becomes(operator.page, () => Boolean(document.querySelector('.ss-files-elsewhere'))),
  'and is told why, as a fact about where the file is rather than a permission withheld',
)

// The half that must stay open. Pasting a link is the common case on a board, and
// there is nothing about it a remote operator cannot do correctly.
await operator.page.locator('.ss-asset-library input[aria-label="Image URL"]').fill(`${BASE}/logos/vandals.svg`)
await operator.page.locator('.ss-asset-library input[aria-label="Asset name"]').fill('operator-added')

check(await operator.page.locator('.ss-asset-library button:has-text("Add URL")').isEnabled(), 'but can still add a URL, which needs no bytes to travel')

await operator.page.locator('.ss-asset-library button:has-text("Add URL")').click()

check(
  await becomes(host.page, () => {
    const tile = [...document.querySelectorAll('.ss-asset-tile')].find((it) => /operator-added/.test(it.textContent))

    return Boolean(tile) && !tile.classList.contains('ss-elsewhere')
  }),
  'and it lands on the machine going to air ready to draw, not marked as missing',
)

await host.page.locator('.ss-asset-library input[aria-label="Image URL"]').fill(`${BASE}/logos/broncos.svg`)
await host.page.locator('.ss-asset-library input[aria-label="Asset name"]').fill('sponsor-logo')
await host.page.locator('.ss-asset-library button:has-text("Add URL")').click()

check(
  await becomes(operator.page, () => [...document.querySelectorAll('.ss-asset-tile')].some((tile) => /sponsor-logo/.test(tile.textContent))),
  'an image added on one machine appears in the library on the other',
)

// A URL entry is showable everywhere by definition -- the bytes are wherever they
// always were.
check(
  await becomes(operator.page, () => {
    const tile = [...document.querySelectorAll('.ss-asset-tile')].find((it) => /sponsor-logo/.test(it.textContent))

    return tile && !tile.classList.contains('ss-elsewhere')
  }),
  'and a pasted URL is usable there too, because its bytes never moved',
)

// A file is different: its bytes live on the machine it was added to. Which is why
// only this machine can add one -- and why, even here, the other end has to be told
// it cannot draw it.
await host.page.locator('.ss-asset-library input[aria-label="Add image files"]').setInputFiles(asset('logos/vandals.svg'))

check(
  await becomes(operator.page, () => {
    const tile = [...document.querySelectorAll('.ss-asset-tile')].find((it) => /vandals/.test(it.textContent))

    return Boolean(tile)
  }),
  'a file added on the OBS machine is known about on the other',
)

check(
  await becomes(operator.page, () => {
    const tile = [...document.querySelectorAll('.ss-asset-tile')].find((it) => /vandals/.test(it.textContent))

    return tile?.classList.contains('ss-elsewhere')
  }),
  'and marked as one this machine cannot show, rather than offered as if it could',
)

// -- Losing the relay --------------------------------------------------------
// The local-first promise. A relay dying mid-show costs collaboration, never the
// broadcast: the host keeps rendering, edits queue, and everything converges when
// it comes back. A server-authoritative design turns this into blank graphics.
const graphic = await host.context.newPage()

await graphic.goto(`${BASE}/#/source/scoreboard`)
await graphic.waitForSelector('.ss-scene')
await graphic.waitForTimeout(800)

await running.close()
console.log('  relay stopped')

// The claim stage 3 exists for: an operator sees the room go away, without a
// reload and without having to wonder.
check(
  await becomes(host.page, () => ['error', 'connecting'].includes(document.querySelector('.ss-sync-status')?.dataset.state), null, 20000),
  'the board notices the relay going away, with no reload',
)

await nameField(host).fill('Freeholders')
await save(host)

check(
  await becomes(graphic, () => /freeholders/i.test(document.querySelector('.ss-scene')?.innerText ?? '')),
  'the graphic keeps working with the relay gone',
)

await nameField(operator).fill('Dry Harbour')
await save(operator)
await operator.page.waitForTimeout(500)

check(
  await becomes(host.page, (at) => document.querySelector(at)?.value === 'Freeholders', HOME_NAME),
  'the host keeps its own edit while nothing can reach it',
)

// -- Getting it back ---------------------------------------------------------
relay = createRelay({ storage, admin: ADMIN })
running = await relay.listen(port)
console.log('  relay restarted')

// y-websocket backs off, so this is the slowest wait in the file by design.
// Convergence, not a particular winner: both edits were made while nothing could
// carry them, so last-write-wins picks one and the only claim worth making is that
// the two boards stop disagreeing.
check(
  await becomes(
    host.page,
    (at) => {
      const mine = document.querySelector(at)?.value

      return mine === 'Dry Harbour' || mine === 'Freeholders'
    },
    HOME_NAME,
    30000,
  ),
  'the peers reconnect on their own, without a reload',
)

await host.page.waitForTimeout(2000)

check(
  await becomes(host.page, () => document.querySelector('.ss-sync-status')?.dataset.state === 'connected', null, 30000),
  'and notices it coming back',
)

check((await indicator(host).count()) === 1, 'the indicator is one control, not one per state')

const settled = async (machine) => (await nameField(machine).inputValue()).trim()
const [onHost, onOperator] = await Promise.all([settled(host), settled(operator)])

console.log(`  after reconnect: host "${onHost}", operator "${onOperator}"`)
check(onHost === onOperator, 'and converge on one value rather than staying split')

// -- Removing an operator ----------------------------------------------------
// Productions lose people, and it has to be one click from the board, mid-show,
// with no redeploy. The one moment this must work is the moment somebody is
// removed *during* a show, so the socket goes immediately rather than at their
// next reconnect -- otherwise they keep editing until they happen to refresh.
await host.page.locator('.ss-relay-admin input[aria-label="Relay admin secret"]').fill(ADMIN)
await host.page.locator('.ss-relay-admin input[aria-label="Relay admin secret"]').blur()

// Waiting for the *invite* control specifically: the panel renders either a
// secret prompt or the operator list, and asserting the panel exists would pass
// in both. The relay is a different origin from the board, always -- without CORS
// on the token API this fetch is blocked and the panel silently stays a prompt.
check(
  await becomes(host.page, () => !!document.querySelector('.ss-relay-admin input[aria-label="New operator name"]')),
  'the board can reach the relay it is connected to',
)

await host.page.locator('.ss-relay-admin input[aria-label="New operator name"]').fill('Sam')
await host.page.locator('.ss-relay-admin button:has-text("Invite")').click()

const link = (await host.page.locator('.ss-minted').textContent()).trim()

console.log(`  invite: ${link.replace(/key=[^&#]+/, 'key=…')}`)

// A link, not a token. What an operator receives is the thing they were going to
// need anyway -- the board -- with the room on it, so their whole setup is pasting
// it into an OBS dock.
check(link.startsWith(BASE), 'inviting an operator produces a link to the studio')
check(/[?&]relay=/.test(link) && /[?&]room=/.test(link) && /[?&]key=/.test(link), 'carrying the relay, the room and their key')

const invited = await machine('invited', link)

check(
  await becomes(invited.page, () => document.querySelector('.ss-sync-status')?.dataset.state === 'connected', null, 15000),
  'and opening it is the whole of their setup',
)
// Generous on purpose: this machine has to boot a page, start a worker, open a
// socket and sync, on a host already running two other browsers. The connect check
// beside it needs 15s for the same reason.
check(
  await becomes(invited.page, (at) => (document.querySelector(at)?.value ?? '') !== '', HOME_NAME, 25000),
  'they arrive with the show already on their board',
)
check(
  await becomes(host.page, () => [...document.querySelectorAll('.ss-operator-token')].some((row) => row.textContent.includes('Sam'))),
  'and they appear in the list',
)


host.page.on('dialog', (dialog) => dialog.accept())
await host.page.locator('.ss-relay-admin button[aria-label^="Remove"]').first().click()

check(
  await becomes(host.page, () => [...document.querySelectorAll('.ss-operator-token')].some((row) => /removed/i.test(row.textContent))),
  'removing them marks them removed rather than quietly forgetting them',
)

// -- A late joiner -----------------------------------------------------------
// Straight from storage: the room outlived the process that was serving it.
// Whether a guarded room refuses a keyless client is settled in the relay's own
// tests, deterministically and in a fraction of a second. Asserting it again
// through three browsers adds no coverage and plenty of timing.

await browser.close()
await running.close()
await rm(storage, { recursive: true, force: true })

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)
