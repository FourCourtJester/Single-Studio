import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const page = await browser.newPage()
for (const url of ['http://localhost:4173/#/source/guest', 'http://localhost:4173/#/source/lower-thirds/guest']) {
  await page.goto(url)
  await page.waitForTimeout(2500)
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 60)
  console.log(`${url.split('#')[1]}  ->  ${text || '(empty)'}`)
}
await browser.close()
