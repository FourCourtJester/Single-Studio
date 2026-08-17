// Integration smoke test for the whole stack.
//
// Unit tests cover the store in isolation; this covers the parts that only exist
// in a browser -- SharedWorker startup, BroadcastChannel fan-out between tabs,
// and IndexedDB persistence across a reload. It is the test that catches wiring
// bugs a unit test cannot see, like a channel-name mismatch that leaves the UI
// looking connected while talking to nobody.
//
// Usage: pnpm --filter @single-studio/demo build && pnpm --filter @single-studio/demo preview
//        node apps/demo/e2e/smoke.mjs http://localhost:4173

import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:4173'
let failed = 0
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}: ${msg}`); if (!ok) failed += 1 }

// CHROMIUM_PATH lets a sandbox point at a preinstalled browser; otherwise
// Playwright resolves its own.
const executablePath = process.env.CHROMIUM_PATH || undefined
const browser = await chromium.launch({ executablePath })
const context = await browser.newContext()

const control = await context.newPage()
control.on('pageerror', (e) => console.log('[control pageerror]', e.message))
await control.goto(`${BASE}/#/`)
await control.waitForSelector('text=Teams')
// Wait for the host handshake before driving the UI.
await control.waitForFunction(() => document.querySelectorAll('.ss-stepper output').length > 0)
await control.waitForTimeout(1000)

const homeName = control.locator('.ss-field:has-text("Home") input').first()
const homeScore = control.locator('.ss-stepper').filter({ hasText: 'Home score' }).locator('output')

await homeName.fill('Broncos')
await control.locator('button[aria-label="Increase Home score"]').click()
await control.locator('button[aria-label="Increase Home score"]').click()
await control.waitForTimeout(800)

check((await homeScore.innerText()).trim() === '2', 'two increments read as 2 on the control surface')

// A graphic in a separate tab: same browser, therefore same SharedWorker.
const source = await context.newPage()
source.on('pageerror', (e) => console.log('[source pageerror]', e.message))
await source.goto(`${BASE}/#/source/scoreboard`)
await source.waitForSelector('.ss-scene')
await source.waitForTimeout(1500)

// innerText reflects CSS text-transform, so compare case-insensitively.
const board = () => source.locator('.ss-scene').innerText().then((t) => t.replace(/\s+/g, ' ').trim().toLowerCase())
console.log(`  scoreboard: ${JSON.stringify(await board())}`)
check((await board()).includes('broncos'), 'source received the team name across tabs')
check(/\b2\b/.test(await board()), 'source received the score across tabs')

// Live propagation while both pages are open.
await homeName.fill('Vandals')
await control.waitForTimeout(900)
check((await board()).includes('vandals'), 'edits propagate live to an open source')

// Toggle drives a second graphic.
const lower = await context.newPage()
await lower.goto(`${BASE}/#/source/lowerthird`)
await lower.waitForSelector('.ss-scene')
await control.locator('.ss-field:has-text("Title") input').first().fill('Jane Doe')
await control.locator('button:has-text("Show lower third")').click()
await control.waitForTimeout(1200)
check((await lower.locator('.ss-scene').innerText()).toLowerCase().includes('jane doe'), 'toggle reveals the lower third with its text')

// Reload: state must come back from IndexedDB.
await source.reload()
await source.waitForSelector('.ss-scene')
await source.waitForTimeout(1500)
check((await board()).includes('vandals'), 'state survived a source reload (IndexedDB)')

await browser.close()
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exitCode = failed ? 1 : 0
