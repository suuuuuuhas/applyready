import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateOutputSize, calculateSourceRect } from './image-tools'

test('preserves aspect ratio when only one output dimension is supplied', () => {
  assert.deepEqual(calculateOutputSize(1200, 800, 600), { width: 600, height: 400 })
  assert.deepEqual(calculateOutputSize(1200, 800, undefined, 400), { width: 600, height: 400 })
})

test('rejects invalid or unsafe output dimensions before canvas allocation', () => {
  for (const invalid of [0, -1, NaN, Infinity, 9000, 1.5]) {
    assert.throws(() => calculateOutputSize(1200, 800, invalid, 400), /dimensions/)
  }
})

test('cover mode returns a centered crop while contain keeps the full source', () => {
  assert.deepEqual(calculateSourceRect(1200, 800, 600, 600, 'contain'), { x: 0, y: 0, width: 1200, height: 800 })
  assert.deepEqual(calculateSourceRect(1200, 800, 600, 600, 'cover'), { x: 200, y: 0, width: 800, height: 800 })
})
