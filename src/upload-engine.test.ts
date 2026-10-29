import assert from 'node:assert/strict'
import test from 'node:test'
import { checkImageConstraints, validateBatch, batchCsv, feedbackUrl, safeOutputName } from './upload-engine'
import { eapcetImagePack, ePassFreshPack, getRulePack, reviewOverdue, uploadPacks } from './rules'
import type { UploadRow } from './upload-engine'

test('checks every byte boundary including strict EAPCET upper limit and NTA minimum', () => {
  for (const pack of uploadPacks) for (const target of pack.imageConstraints) {
    const image = { name: 'x.jpg', mime: 'image/jpeg', width: 400, height: 300, bytes: target.maxBytes! }
    assert.equal(checkImageConstraints(image, target).length, 0)
    assert.ok(checkImageConstraints({ ...image, bytes: target.maxBytes! + 1 }, target).length)
    if (target.minBytes) {
      assert.equal(checkImageConstraints({ ...image, bytes: target.minBytes }, target).length, 0)
      assert.match(checkImageConstraints({ ...image, bytes: target.minBytes - 1 }, target).join(), /minimum/)
    }
    assert.match(checkImageConstraints({ ...image, mime: 'image/png' }, target).join(), /JPEG/)
  }
  assert.equal(eapcetImagePack.imageConstraints[0].maxBytes, 50 * 1024 - 1)
  assert.equal(getRulePack('neet-ug-images-2026').imageConstraints[1].maxBytes, 100 * 1024)
  assert.equal(getRulePack('cuet-ug-images-2026').imageConstraints[1].maxBytes, 50 * 1024)
})

test('rejects oversized batches as a whole', () => {
  const file = new File(['x'], 'x.png', { type: 'image/png' })
  assert.doesNotThrow(() => validateBatch(Array(100).fill(file)))
  assert.throws(() => validateBatch(Array(101).fill(file)), /100/)
  assert.throws(() => validateBatch([]), /at least/)
  assert.throws(() => validateBatch([{ size: 101 * 1024 * 1024 } as File]), /100 MB/)
})

test('export names cannot collide or become paths; CSV neutralizes formula filenames', () => {
  assert.notEqual(safeOutputName('photo.jpg', 0), safeOutputName('photo.jpg', 1))
  assert.match(safeOutputName('../../CON.jpg', 0), /^001-[a-zA-Z0-9_-]+-ready.jpg$/)
  const row: UploadRow = { id: 0, file: new File(['x'], '=HYPERLINK("bad").jpg'), status: 'error', issues: ['Bad header'], changed: false, resized: false }
  const csv = batchCsv([row], ePassFreshPack, ePassFreshPack.imageConstraints[0])
  assert.match(csv, /"'=HYPERLINK/)
  assert.match(csv, /Bad header/)
})

test('feedback only includes explicit rule metadata and never session images or filenames', () => {
  const url = new URL(feedbackUrl(ePassFreshPack, ePassFreshPack.imageConstraints[0], 'Official requirements changed'))
  assert.equal(url.hostname, 'github.com')
  assert.equal(url.pathname, '/suuuuuuhas/applyready/issues/new')
  assert.match(url.searchParams.get('body')!, /Version: 1.0.0/)
  assert.throws(() => feedbackUrl(ePassFreshPack, ePassFreshPack.imageConstraints[0], 'private student text'), /category/)
})

test('review reminders and archived cycles do not silently become current', () => {
  assert.equal(reviewOverdue(ePassFreshPack, new Date('2026-11-24T23:59:59Z')), false)
  assert.equal(reviewOverdue(ePassFreshPack, new Date('2026-11-25T00:00:00Z')), true)
  assert.equal(getRulePack('neet-ug-images-2026').cycleStatus, 'archived')
})
