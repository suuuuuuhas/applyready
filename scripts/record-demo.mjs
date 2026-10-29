import { chromium } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('docs/screenshots')
await fs.mkdir(path.join(output, 'frames'), { recursive: true })
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
const page = await browser.newPage({ viewport: { width: 1200, height: 950 } })
try {
  await page.goto(process.env.TEST_BASE_URL || 'http://127.0.0.1:4175')
  await page.screenshot({ path: path.join(output, 'landing-desktop.png') })
  await page.screenshot({ path: path.join(output, 'frames/00.png') })
  await page.getByRole('button', { name: 'Try the synthetic demo' }).click()
  await page.getByRole('button', { name: 'Fix this image' }).waitFor({ state: 'visible' })
  await page.locator('.results-toolbar').scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(output, 'frames/01.png') })
  await page.getByRole('button', { name: 'Fix this image' }).click()
  await page.getByRole('heading', { name: '1 of 1 pass file checks' }).waitFor()
  await page.locator('.image-review').scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(output, 'frames/02.png') })
  await page.screenshot({ path: path.join(output, 'upload-desktop.png') })
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download JPEG', exact: true }).click()
  await (await download).saveAs(path.join(output, 'synthetic-demo-output.jpg'))
  await page.screenshot({ path: path.join(output, 'frames/03.png') })
  await page.getByText('Rule sources, review dates & coverage', { exact: true }).click()
  await page.locator('.pack-evidence').scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(output, 'frames/04.png') })
  await page.setViewportSize({ width: 390, height: 1000 })
  await page.goto(process.env.TEST_BASE_URL || 'http://127.0.0.1:4175')
  await page.screenshot({ path: path.join(output, 'landing-mobile.png'), fullPage: true })
} finally { await browser.close() }
