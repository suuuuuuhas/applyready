import { test, expect } from '@playwright/test'
import { deflateSync } from 'node:zlib'
import fs from 'node:fs/promises'
import JSZip from 'jszip'

// Generate fixtures without personal images or network dependencies.
function crc32(data: Buffer) {
  let crc = 0xffffffff
  for (const byte of data) { crc ^= byte; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0) }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}
function png(width = 500, height = 350, noise = true) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2
  const pixels = Buffer.alloc((width * 3 + 1) * height)
  let seed = 47
  for (let y = 0; y < height; y++) for (let x = 0; x < width * 3; x++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; pixels[y * (width * 3 + 1) + 1 + x] = noise ? (seed >>> 24) : 240 }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))])
}
const noisePng = png()
const input = (name = 'student-test.png', buffer = noisePng, mimeType = 'image/png') => ({ name, mimeType, buffer })

test('single image: failure → correction → verified JPEG download; no data requests', async ({ page }, info) => {
  const errors: string[] = []; const outside: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (!request.url().startsWith(info.project.use.baseURL as string) && /^https?:/.test(request.url())) outside.push(request.url()) })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Fix the file/ })).toBeVisible()
  await page.getByLabel('Choose image file').setInputFiles(input())
  await expect(page.getByRole('heading', { name: '0 of 1 pass file checks' })).toBeVisible()
  await expect(page.getByText(/Convert to JPEG/)).toBeVisible()
  await page.getByRole('button', { name: 'Fix this image', exact: true }).click()
  await expect(page.getByRole('heading', { name: '1 of 1 pass file checks' })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download JPEG', exact: true }).click()
  const bytes = await fs.readFile((await (await download).path())!)
  expect(bytes[0]).toBe(0xff); expect(bytes[1]).toBe(0xd8); expect(bytes.length).toBeLessThanOrEqual(30 * 1024)
  expect(errors).toEqual([]); expect(outside).toEqual([])
  await page.screenshot({ path: info.outputPath('corrected.png'), fullPage: true })
})

test('minimum-size failure cannot be falsely fixed; changing targets clears results', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Application & cycle').selectOption('neet-ug-images-2026')
  await expect(page.getByRole('note')).toContainText('not been verified for 2027')
  await page.getByLabel('Choose image file').setInputFiles(input('tiny.png', png(32, 32, false)))
  await expect(page.locator('.file-issues')).toContainText('below the 10,240 byte minimum')
  await page.getByRole('button', { name: 'Fix this image' }).click()
  await expect(page.getByText('Manual help needed', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download JPEG', exact: true })).toHaveCount(0)
  await page.getByLabel('Upload field').selectOption('neet-ug-images-2026-signature')
  await expect(page.getByRole('region', { name: 'File results' })).toHaveCount(0)
})

test('mixed batch: errors remain in report, duplicate filenames produce separate JPEGs, ZIP is valid', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Batch · up to 100' }).click()
  await page.getByLabel('Choose batch files').setInputFiles([input('same.png'), input('same.png'), input('bad.jpg', Buffer.from('not an image'), 'image/jpeg')])
  await expect(page.getByText('Checked 3 images', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Fix correctable files' }).click()
  await expect(page.getByRole('heading', { name: '2 of 3 pass file checks' })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Download ZIP/ }).click()
  const zip = await JSZip.loadAsync(await fs.readFile((await (await download).path())!))
  const images = Object.keys(zip.files).filter(name => name.endsWith('.jpg'))
  expect(images).toHaveLength(2); expect(new Set(images).size).toBe(2)
  for (const name of images) { const bytes = await zip.file(name)!.async('uint8array'); expect(bytes[0]).toBe(0xff); expect(bytes.length).toBeLessThanOrEqual(30 * 1024) }
  const csv = await zip.file('report.csv')!.async('string')
  expect(csv).toContain('bad.jpg'); expect(csv).toContain('error'); expect(csv).toContain('telangana-epass-fresh-2026-27')
  expect(await zip.file('REVIEW-BEFORE-UPLOADING.txt')!.async('string')).toContain('not proof')
})

test('100-image batch completes under CPU throttling and every output is represented', async ({ page }, info) => {
  test.setTimeout(300_000)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Batch · up to 100' }).click()
  const started = Date.now()
  await fs.mkdir(info.outputPath('fixtures'), { recursive: true })
  const fixturePaths = await Promise.all(Array.from({ length: 100 }, async (_, i) => {
    const path = info.outputPath('fixtures', `fixture-${i}.png`)
    await fs.writeFile(path, noisePng)
    return path
  }))
  await page.getByLabel('Choose batch files').setInputFiles(fixturePaths)
  await expect(page.getByText('Checked 100 images', { exact: false })).toBeVisible({ timeout: 120_000 })
  const inspectedMs = Date.now() - started
  await page.getByRole('button', { name: 'Fix correctable files' }).click()
  await expect(page.getByRole('heading', { name: '100 of 100 pass file checks' })).toBeVisible({ timeout: 240_000 })
  const correctedMs = Date.now() - started - inspectedMs
  await expect(page.locator('.batch-table tbody tr')).toHaveCount(100)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Download ZIP/ }).click()
  const zip = await JSZip.loadAsync(await fs.readFile((await (await download).path())!))
  expect(Object.keys(zip.files).filter(name => name.endsWith('.jpg'))).toHaveLength(100)
  await fs.writeFile(info.outputPath('benchmark.json'), JSON.stringify({ files: 100, fixture: '100 synthetic 500x350 seeded-noise PNGs, identical pixel content, distinct names', inputBytes: noisePng.length * 100, cpuThrottle: 4, inspectedMs, correctedMs, note: 'Synthetic CPU-throttled browser test, not a real low-end-PC or student pilot.' }, null, 2))
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
})

test('cancel and clear prevent late work restoring private data', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Batch · up to 100' }).click()
  await page.getByLabel('Choose batch files').setInputFiles(Array.from({ length: 40 }, (_, i) => input(`private-${i}.png`)))
  await page.getByRole('button', { name: 'Clear session', exact: true }).click()
  await expect(page.getByRole('region', { name: 'File results' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Single image', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => page.locator('body').innerText()).not.toContain('private-')
})

test('feedback is opt-in, metadata only, and resets on target change', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Rejected anyway? Report a rule problem.', { exact: true }).click()
  await expect(page.getByRole('link', { name: /Open issue draft/ })).toHaveCount(0)
  await page.getByRole('checkbox', { name: /I reviewed this metadata/ }).check()
  const url = new URL((await page.getByRole('link', { name: /Open issue draft/ }).getAttribute('href'))!)
  expect(url.hostname).toBe('github.com'); expect(url.searchParams.get('body')).not.toContain('student-test.png')
  await page.getByLabel('Application & cycle').selectOption('cuet-ug-images-2026')
  await page.getByText('Rejected anyway? Report a rule problem.', { exact: true }).click()
  await expect(page.getByRole('checkbox', { name: /I reviewed this metadata/ })).not.toBeChecked()
})

for (const width of [1440, 390, 320]) test(`responsive upload flow at ${width}px, no overflow or runtime errors`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 })
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the synthetic demo' }).click()
  await expect(page.getByRole('button', { name: 'Fix this image' })).toBeEnabled()
  await page.getByRole('button', { name: 'Fix this image' }).click()
  await expect(page.getByRole('heading', { name: '1 of 1 pass file checks' })).toBeVisible()
  const metrics = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(metrics.scroll).toBeLessThanOrEqual(metrics.client); expect(errors).toEqual([])
  await page.screenshot({ path: info.outputPath(`upload-${width}.png`), fullPage: true })
})

test('over-limit file count is rejected without truncation; already valid output is unchanged', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Batch · up to 100' }).click()
  await page.getByLabel('Choose batch files').setInputFiles(Array.from({ length: 101 }, (_, i) => input(`fixture-${i}.png`, png(10, 10, false))))
  await expect(page.getByRole('alert')).toContainText('up to 100')
  await expect(page.getByRole('region', { name: 'File results' })).toHaveCount(0)
  await page.getByLabel('Choose batch files').setInputFiles([input()])
  await expect(page.getByText('Checked 1 image', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Fix correctable files' }).click()
  await expect(page.getByRole('heading', { name: '1 of 1 pass file checks' })).toBeVisible()
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download JPEG', exact: true }).click()
  const jpeg = await fs.readFile((await (await downloaded).path())!)
  await page.getByLabel('Choose batch files').setInputFiles(input('passing.jpg', jpeg, 'image/jpeg'))
  await expect(page.getByText('Original already passes — kept unchanged')).toBeVisible()
  const unchanged = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download JPEG', exact: true }).click()
  expect(await fs.readFile((await (await unchanged).path())!)).toEqual(jpeg)
})
