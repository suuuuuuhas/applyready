import assert from 'node:assert/strict'
import test from 'node:test'
import { ApplicantDetails, initialDetails, parseIsoDate, runChecks } from './engine'
import { ePassFreshPack, eapcetImagePack } from './rules'

const details = (overrides: Partial<ApplicantDetails> = {}): ApplicantDetails => ({
  applicantName: 'Aarav Reddy',
  documentName: 'Aarav Reddy',
  applicantDob: '2002-02-14',
  documentDob: '2002-02-14',
  certificateDate: '2025-05-18',
  category: 'Other',
  incomeCertificate: 'available',
  bankAccount: 'available',
  ...overrides,
})

test('normalises exact names but keeps reordered names uncertain', () => {
  assert.equal(runChecks(details({ applicantName: '  AARAV   REDDY ' }), ePassFreshPack)[0].state, 'passed')
  const reordered = runChecks(details({ applicantName: 'Reddy, Aarav' }), ePassFreshPack)[0]
  assert.equal(reordered.id, 'name-order-review')
  assert.equal(reordered.state, 'needs_verification')
})

test('initials and close spelling differences do not become automatic passes', () => {
  const initials = runChecks(details({ applicantName: 'A Reddy' }), ePassFreshPack)[0]
  assert.equal(initials.state, 'needs_verification')
  const spelling = runChecks(details({ documentName: 'Aarav Reddyx' }), ePassFreshPack)[0]
  assert.equal(spelling.id, 'name-difference')
  assert.equal(spelling.state, 'warning')
})

test('validates real calendar dates including leap days', () => {
  assert.ok(parseIsoDate('2024-02-29'))
  assert.equal(parseIsoDate('2025-02-29'), null)
  assert.equal(runChecks(details({ applicantDob: '2025-02-29' }), ePassFreshPack)[1].id, 'dob-invalid')
})

test('applies the verified certificate cutoff strictly after 01 Apr 2025', () => {
  assert.equal(runChecks(details({ certificateDate: '2025-04-01' }), ePassFreshPack)[2].state, 'failed')
  assert.equal(runChecks(details({ certificateDate: '2025-04-02' }), ePassFreshPack)[2].state, 'passed')
  assert.equal(runChecks(details({ category: 'unknown', certificateDate: '2025-04-02' }), ePassFreshPack)[2].state, 'needs_verification')
})

test('separates missing and unknown document declarations', () => {
  const missing = runChecks(details({ incomeCertificate: 'not_available' }), ePassFreshPack)
  assert.equal(missing[3].state, 'missing_information')
  const unknown = runChecks(details({ incomeCertificate: 'unknown' }), ePassFreshPack)
  assert.equal(unknown[3].state, 'needs_verification')
})

test('keeps the EBC bank exception as a verification item', () => {
  const findings = runChecks(details({ category: 'EBC', bankAccount: 'not_available' }), ePassFreshPack)
  assert.equal(findings[4].id, 'bank-ebc-exception')
  assert.equal(findings[4].state, 'needs_verification')
})

test('does not leak ePASS rules into an unverified pack', () => {
  const findings = runChecks(details({ certificateDate: '2020-01-01' }), { ...eapcetImagePack, availability: 'unverified' })
  assert.equal(findings.length, 1)
  assert.equal(findings[0].id, 'pack-unavailable')
  assert.equal(findings[0].state, 'needs_verification')
})

test('verified EAPCET pack does not apply scholarship certificate and bank rules', () => {
  const findings = runChecks(details({ certificateDate: '2020-01-01', incomeCertificate: 'not_available', bankAccount: 'not_available' }), eapcetImagePack)
  assert.equal(findings.length, 2)
  assert.ok(findings.every((finding) => finding.state === 'passed'))
  assert.equal(eapcetImagePack.imageConstraints.length, 2)
  assert.equal(eapcetImagePack.imageConstraints[0].maxBytes, 50 * 1024 - 1)
  assert.equal(eapcetImagePack.imageConstraints[1].maxBytes, 30 * 1024 - 1)
})

test('new sessions contain no prefilled identity details or available declarations', () => {
  const fresh = initialDetails()
  assert.equal(fresh.applicantName, '')
  assert.equal(fresh.documentName, '')
  assert.equal(fresh.bankAccount, 'unknown')
  assert.equal(fresh.incomeCertificate, 'unknown')
})

test('dotted initials remain uncertain and future or invalid dates cannot pass', () => {
  const initials = runChecks(details({ applicantName: 'K. Suresh', documentName: 'Kandula Suresh' }), ePassFreshPack)
  assert.equal(initials[0].state, 'needs_verification')
  assert.equal(runChecks(details({ applicantDob: '2099-01-01', documentDob: '2099-01-01' }), ePassFreshPack)[1].id, 'dob-future')
  assert.equal(runChecks(details({ certificateDate: '2099-01-01' }), ePassFreshPack)[2].id, 'certificate-future')
  assert.equal(runChecks(details({ certificateDate: '2025-02-30' }), ePassFreshPack)[2].id, 'certificate-invalid')
})
