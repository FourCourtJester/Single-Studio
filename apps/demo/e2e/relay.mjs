// Two machines, one show.
//
// STATUS: one check in here does not pass, and it is a real failure, not a flaky
// test. See "Known issue" in docs/collaboration.md for everything established so
// far. In short: two *browser* velcro hosts diverge on a value replace, while the
// same code converges in every other combination that has been tried, including
// two velcro hosts in Node against this same relay. The relay is not the suspect.
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
let relay = createRelay({ storage })
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

await nameField(host).fill('Freeholders')
await save(host)

check(
  await becomes(graphic, () => /freeholders/i.test(document.querySelector('.ss-scene')?.innerText ?? '')),
  'the graphic keeps working with the relay gone',
)

await nameField(operator).fill('Ashfall')
await save(operator)
await operator.page.waitForTimeout(500)

check(
  await becomes(host.page, (at) => document.querySelector(at)?.value === 'Freeholders', HOME_NAME),
  'the host keeps its own edit while nothing can reach it',
)

// -- Getting it back ---------------------------------------------------------
relay = createRelay({ storage })
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

      return mine === 'Ashfall' || mine === 'Freeholders'
    },
    HOME_NAME,
    30000,
  ),
  'the peers reconnect on their own, without a reload',
)

await host.page.waitForTimeout(2000)

const settled = async (machine) => (await nameField(machine).inputValue()).trim()
const [onHost, onOperator] = await Promise.all([settled(host), settled(operator)])

console.log(`  after reconnect: host "${onHost}", operator "${onOperator}"`)
check(onHost === onOperator, 'and converge on one value rather than staying split')

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
