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
const scoreboardText = () => source.locator('.ss-scene').innerText().then((t) => t.replace(/\s+/g, ' ').trim().toLowerCase())
console.log(`  scoreboard: ${JSON.stringify(await scoreboardText())}`)
check((await scoreboardText()).includes('broncos'), 'source received the team name across tabs')
check(/\b2\b/.test(await scoreboardText()), 'source received the score across tabs')

// Live propagation while both pages are open.
await homeName.fill('Vandals')
await control.waitForTimeout(900)
check((await scoreboardText()).includes('vandals'), 'edits propagate live to an open source')

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
check((await scoreboardText()).includes('vandals'), 'state survived a source reload (IndexedDB)')

// Leaderboard: a paste into the raw view drives the standings graphic, which reads
// the whole board from one subscription.
const standings = await context.newPage()
await standings.goto(`${BASE}/#/source/standings`)
await standings.waitForSelector('.ss-scene')

await control.locator('button:has-text("Show standings")').click()
await control.locator('.ss-leaderboard textarea').fill('Kim\t12\nAlvarez\t9\nOkafor\t7')
await control.waitForTimeout(900)

const standingsText = (await standings.locator('.ss-scene').innerText()).replace(/\s+/g, ' ').trim()
console.log(`  standings: ${JSON.stringify(standingsText)}`)
check(/Kim/.test(standingsText) && /Alvarez/.test(standingsText) && /Okafor/.test(standingsText), 'leaderboard paste reaches the standings graphic')
check(/12/.test(standingsText) && /9/.test(standingsText), 'leaderboard scores parse into their own column')

// Table view edits the same single path, so the graphic follows either way.
await control.locator('.ss-leaderboard button:has-text("Table")').click()
await control.locator('.ss-leaderboard input[aria-label="Place 1 name"]').fill('Nakamura')
await control.waitForTimeout(900)
check(/Nakamura/.test(await standings.locator('.ss-scene').innerText()), 'table view writes back to the same path')

// Image: the team name drives the logo through slugify.
const logo = source.locator('.ss-image img').first()
check((await logo.getAttribute('src')) === './logos/vandals.svg', 'team name resolves a logo through slugify')

// ResetButton unsets rather than blanking, so the source falls back to its default.
await control.locator('button[title="Reset scores"]').click()
await control.waitForTimeout(800)
check(/\b0\b/.test(await scoreboardText()), 'reset clears the score back to its fallback')

// The capability guard. Simulate a browser whose SharedWorker predates the options
// object -- it coerces { type: 'module' } to a name and loads the script as a
// classic worker, which is the silent failure the guard exists to convert into a
// visible one.
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
check(!/Teams/.test(legacyText), 'guard replaces the board rather than rendering a dead one')

await browser.close()
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exitCode = failed ? 1 : 0
