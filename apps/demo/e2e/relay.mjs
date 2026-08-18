// Two machines, one show.
//
// The stage-2 claim from docs/collaboration.md: two browser profiles converge
// through a running relay. Playwright contexts are the profiles -- each gets its
// own storage partition, so each gets its own SharedWorker and its own IndexedDB,
// which is exactly the boundary a second operator's laptop sits behind.
//
// Run against a build made with a relay URL, since the SharedWorker cannot read
// the page's URL and takes it as a build-time constant:
//
//   VITE_RELAY_URL=ws://127.0.0.1:1234 pnpm demo:build
//   pnpm demo:preview
//   node apps/demo/e2e/relay.mjs
//
// `pnpm e2e:relay` does all of that.

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { chromium } from 'playwright'

import { createRelay } from '../../../packages/relay/src/node.js'

const BASE = process.argv[2] ?? 'http://localhost:4173'
const PORT = Number(process.env.RELAY_PORT ?? 1234)

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

console.log(`  relay on ws://127.0.0.1:${running.port}, storing in ${storage}`)

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })

/** A separate profile: its own IndexedDB, its own SharedWorker. A second laptop. */
const machine = async (label) => {
  const context = await browser.newContext({ reducedMotion: 'no-preference' })
  const page = await context.newPage()

  page.on('pageerror', (error) => console.log(`[${label} pageerror]`, error.message))
  await page.goto(`${BASE}/#/`)
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
const operator = await machine('operator')

// Both boards have to be attached before anything is asserted about convergence.
await host.page.waitForTimeout(2000)

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
running = await relay.listen(PORT)
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

const secret = await host.page.locator('.ss-minted').textContent()

console.log(`  minted a token for Sam: ${secret.slice(0, 8)}…`)
check(Boolean(secret?.trim()), 'inviting an operator produces a secret to send them')
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
const latecomer = await machine('latecomer')

check(
  await becomes(latecomer.page, (want) => document.querySelector('.ss-field input[placeholder="Kestrel Corps"]')?.value === want, onHost, 30000),
  'a board opened afterwards is handed the show as it stands',
)

await browser.close()
await running.close()
await rm(storage, { recursive: true, force: true })

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)
