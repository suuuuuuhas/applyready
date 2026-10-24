import assert from 'node:assert/strict'
import test from 'node:test'
import { generateFeeSafeLetter, getFeeSafeStatus } from './feesafe'

test('FeeSafe letter stays editable, factual, and avoids an entitlement guarantee', () => {
  const letter = generateFeeSafeLetter({
    studentName: 'Aarav Reddy',
    collegeName: 'Example College',
    applicationPath: 'post-matric scholarship fresh registration',
    status: getFeeSafeStatus('unknown'),
    unresolved: 'The exact portal wording still needs confirmation.',
    date: '24 October 2026',
  })
  assert.match(letter, /Aarav Reddy/)
  assert.match(letter, /exact portal wording still needs confirmation/)
  assert.match(letter, /does not establish|authoritative status|official portal/i)
  assert.doesNotMatch(letter, /guarantee reimbursement|legal entitlement/i)
})
