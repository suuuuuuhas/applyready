import { RulePack } from './rules'

export type ResultState = 'passed' | 'failed' | 'warning' | 'missing_information' | 'needs_verification'

export type DocumentStatus = 'available' | 'unknown' | 'not_available'
export type ApplicantCategory = 'EBC' | 'Other' | 'unknown'

export type ApplicantDetails = {
  applicantName: string
  documentName: string
  applicantDob: string
  documentDob: string
  certificateDate: string
  category: ApplicantCategory
  incomeCertificate: DocumentStatus
  bankAccount: DocumentStatus
}

export type Finding = {
  id: string
  state: ResultState
  title: string
  observed: string
  expected: string
  explanation: string
  nextAction: string
  sourceIds: string[]
  inputId: keyof ApplicantDetails | null
}

type ParsedIsoDate = { year: number; month: number; day: number; timestamp: number }

export function normaliseName(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

function nameTokens(value: string) {
  return normaliseName(value).replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean)
}

function sortedTokens(value: string) {
  return [...nameTokens(value)].sort()
}

function isInitialMatch(left: string, right: string) {
  const leftTokens = nameTokens(left)
  const rightTokens = nameTokens(right)
  if (leftTokens.length !== rightTokens.length || leftTokens.length < 2) return false
  return leftTokens.every((token, index) => {
    const other = rightTokens[index]
    return token === other || (token.length === 1 && other?.startsWith(token)) || (other?.length === 1 && token.startsWith(other))
  })
}

function levenshtein(left: string, right: string) {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => index)
  for (let row = 1; row <= right.length; row += 1) {
    let previous = rows[0]
    rows[0] = row
    for (let column = 1; column <= left.length; column += 1) {
      const current = rows[column]
      rows[column] = right[row - 1] === left[column - 1]
        ? previous
        : Math.min(rows[column - 1] + 1, rows[column] + 1, previous + 1)
      previous = current
    }
  }
  return rows[left.length]
}

export function parseIsoDate(value: string): ParsedIsoDate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return { year, month, day, timestamp }
}

export function formatDate(value: string) {
  const date = parseIsoDate(value)
  if (!date) return 'Not entered'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(date.timestamp))
}

function sourceIdsFor(pack: RulePack, preferred?: string) {
  if (preferred && pack.sources.some((source) => source.id === preferred)) return [preferred]
  return pack.sources.slice(0, 1).map((source) => source.id)
}

function finding(pack: RulePack, value: Omit<Finding, 'sourceIds'> & { sourceId?: string }) : Finding {
  const { sourceId, ...rest } = value
  return { ...rest, sourceIds: sourceIdsFor(pack, sourceId) }
}

function compareNameFinding(details: ApplicantDetails, pack: RulePack): Finding {
  const left = details.applicantName
  const right = details.documentName
  if (!left.trim() || !right.trim()) {
    return finding(pack, {
      id: 'name-missing',
      state: 'missing_information',
      title: 'Name comparison cannot run',
      observed: left.trim() || right.trim() ? 'One name is missing' : 'Both names are missing',
      expected: 'Names entered from both documents',
      explanation: 'A cross-document comparison needs both values. Similarity is not treated as legal equivalence.',
      nextAction: 'Enter the name as it appears on each document, or mark the source document as unavailable.',
      inputId: 'applicantName',
    })
  }

  if (normaliseName(left) === normaliseName(right)) {
    return finding(pack, {
      id: 'name-match',
      state: 'passed',
      title: 'Names match after spacing and case normalisation',
      observed: `${left} / ${right}`,
      expected: 'Same normalised name',
      explanation: 'The entered values match after removing extra whitespace and ignoring case.',
      nextAction: 'No action for this implemented check.',
      inputId: 'applicantName',
    })
  }

  if (sortedTokens(left).join(' ') === sortedTokens(right).join(' ')) {
    return finding(pack, {
      id: 'name-order-review',
      state: 'needs_verification',
      title: 'Names contain the same words in a different order',
      observed: `${left} / ${right}`,
      expected: 'Same name and order as shown on the source documents',
      explanation: 'Surname-first and surname-last formats can be equivalent, but the checker cannot establish legal identity from word order alone.',
      nextAction: 'Compare the originals and confirm that the order is only a transcription convention.',
      inputId: 'applicantName',
    })
  }

  if (isInitialMatch(left, right) || isInitialMatch(right, left)) {
    return finding(pack, {
      id: 'name-initial-review',
      state: 'needs_verification',
      title: 'One name uses initials',
      observed: `${left} / ${right}`,
      expected: 'Full names or an officially accepted equivalent',
      explanation: 'Initials can hide a different given name or surname. They are shown as an uncertain review item rather than an automatic pass.',
      nextAction: 'Check the original instructions and confirm the full name before submission.',
      inputId: 'applicantName',
    })
  }

  const distance = levenshtein(normaliseName(left), normaliseName(right))
  return finding(pack, {
    id: 'name-difference',
    state: 'warning',
    title: distance <= 2 ? 'Names may contain a spelling difference' : 'Names differ between entries',
    observed: `${left} / ${right}`,
    expected: 'Same name after a manual comparison',
    explanation: distance <= 2
      ? 'The values are close after normalisation, but a spelling similarity cannot establish that the documents refer to the same person.'
      : 'This is a detected difference, not a finding about document authenticity, eligibility, or approval.',
    nextAction: 'Compare the original documents and correct a transcription error if there is one.',
    inputId: 'applicantName',
  })
}

function compareDobFinding(details: ApplicantDetails, pack: RulePack): Finding {
  const left = details.applicantDob
  const right = details.documentDob
  if (!left || !right) {
    return finding(pack, {
      id: 'dob-missing',
      state: 'missing_information',
      title: 'Date of birth comparison cannot run',
      observed: 'One or both dates are missing',
      expected: 'Two valid calendar dates in YYYY-MM-DD format',
      explanation: 'Blank dates are kept separate from an actual mismatch so the next action is clear.',
      nextAction: 'Enter both dates in YYYY-MM-DD format, then run the checks again.',
      inputId: 'applicantDob',
    })
  }

  const applicantDate = parseIsoDate(left)
  const documentDate = parseIsoDate(right)
  if (!applicantDate || !documentDate) {
    return finding(pack, {
      id: 'dob-invalid',
      state: 'warning',
      title: 'Date format needs review',
      observed: `${left} / ${right}`,
      expected: 'Two real calendar dates in YYYY-MM-DD format',
      explanation: 'The checker validates month lengths and leap days instead of relying on permissive browser date parsing.',
      nextAction: 'Use a real date in YYYY-MM-DD format.',
      inputId: 'applicantDob',
    })
  }

  if (applicantDate.timestamp > Date.now() || documentDate.timestamp > Date.now()) {
    return finding(pack, {
      id: 'dob-future', state: 'failed', title: 'Date of birth is in the future',
      observed: `${left} / ${right}`, expected: 'Birth dates on or before today',
      explanation: 'Matching future dates are not a valid date-of-birth consistency pass.',
      nextAction: 'Check the year and the original documents.', inputId: 'applicantDob',
    })
  }

  if (applicantDate.timestamp === documentDate.timestamp) {
    return finding(pack, {
      id: 'dob-match',
      state: 'passed',
      title: 'Dates of birth match',
      observed: `${formatDate(left)} / ${formatDate(right)}`,
      expected: 'Same calendar date',
      explanation: 'Both entered dates resolve to the same calendar day.',
      nextAction: 'No action for this implemented check.',
      inputId: 'applicantDob',
    })
  }

  return finding(pack, {
    id: 'dob-difference',
    state: 'failed',
    title: 'Dates of birth do not match',
    observed: `${formatDate(left)} / ${formatDate(right)}`,
    expected: 'Same calendar date',
    explanation: 'The two entered calendar dates are different. This should be checked against the original documents.',
    nextAction: 'Correct the entry that is wrong, or leave the item unresolved until the originals are reviewed.',
    inputId: 'applicantDob',
  })
}

function certificateFinding(details: ApplicantDetails, pack: RulePack): Finding {
  const sourceId = 'epass-prerequisites'
  const date = parseIsoDate(details.certificateDate)
  const applicable = pack.id === 'telangana-epass-fresh-2026-27' && pack.availability === 'verified-limited' && details.category !== 'unknown'
  if (details.certificateDate && !date) {
    return finding(pack, {
      id: 'certificate-invalid', state: 'failed', title: 'Certificate date is not a real calendar date',
      observed: details.certificateDate, expected: 'A real issue date in YYYY-MM-DD format',
      explanation: 'An invalid date cannot satisfy the configured issue-date condition.',
      nextAction: 'Read the issue date from the original certificate.', inputId: 'certificateDate', sourceId,
    })
  }
  if (!date) {
    return finding(pack, {
      id: 'certificate-missing',
      state: 'missing_information',
      title: 'Income certificate date is missing',
      observed: 'Not entered',
      expected: 'A date after 01 Apr 2025 for the selected fresh-registration path',
      explanation: 'The selected pack has a source-backed date condition. The condition cannot be evaluated without the date printed on the certificate.',
      nextAction: 'Enter the date shown on the income certificate.',
      inputId: 'certificateDate',
      sourceId,
    })
  }
  if (!applicable) {
    return finding(pack, {
      id: 'certificate-needs-context',
      state: 'needs_verification',
      title: 'Certificate date needs applicability confirmation',
      observed: formatDate(details.certificateDate),
      expected: 'A source-reviewed date rule for the selected category and cycle',
      explanation: 'The checker does not apply a cutoff when the category or selected pack is outside the verified rule context.',
      nextAction: 'Confirm the category-specific official instructions before treating this date as compliant.',
      inputId: 'certificateDate',
      sourceId,
    })
  }

  if (date.timestamp > Date.now()) {
    return finding(pack, {
      id: 'certificate-future', state: 'failed', title: 'Certificate issue date is in the future',
      observed: formatDate(details.certificateDate), expected: 'An issued certificate dated on or before today',
      explanation: 'A future date does not prove that a certificate has been issued.',
      nextAction: 'Check the entered year and the original issue date.', inputId: 'certificateDate', sourceId,
    })
  }

  const cutoff = Date.UTC(2025, 3, 1)
  if (date.timestamp > cutoff) {
    return finding(pack, {
      id: 'certificate-pass',
      state: 'passed',
      title: 'Income certificate date is after the published cutoff',
      observed: formatDate(details.certificateDate),
      expected: 'After 01 Apr 2025',
      explanation: 'The entered date is strictly after the cutoff stored in this source-reviewed fresh-registration rule.',
      nextAction: 'Keep the original certificate available for any official review.',
      inputId: 'certificateDate',
      sourceId,
    })
  }
  return finding(pack, {
    id: 'certificate-fail',
    state: 'failed',
    title: 'Income certificate date is on or before the published cutoff',
    observed: formatDate(details.certificateDate),
    expected: 'After 01 Apr 2025',
    explanation: 'The official wording is treated as a strict after-date condition: 01 Apr 2025 itself does not pass.',
    nextAction: 'Check the certificate date and the current official application instructions before proceeding.',
    inputId: 'certificateDate',
    sourceId,
  })
}

function documentFinding(details: ApplicantDetails, pack: RulePack, field: 'incomeCertificate' | 'bankAccount'): Finding {
  const value = details[field]
  const label = field === 'incomeCertificate' ? 'Income certificate' : 'Bank-account document'
  if (value === 'available') {
    return finding(pack, {
      id: field === 'incomeCertificate' ? 'income-document' : 'bank-document',
      state: 'passed',
      title: `${label} marked available`,
      observed: 'Student declaration: available',
      expected: 'Document status recorded for the selected path',
      explanation: 'This records the student’s declaration only. It does not authenticate the document or establish that the portal will accept it.',
      nextAction: 'Keep the original document available for official submission or review.',
      inputId: field,
      sourceId: 'epass-prerequisites',
    })
  }
  if (value === 'not_available') {
    return finding(pack, {
      id: field === 'incomeCertificate' ? 'income-document-missing' : 'bank-document-missing',
      state: field === 'bankAccount' && details.category === 'Other' ? 'failed' : 'missing_information',
      title: `${label} is not marked available`,
      observed: 'Student declaration: not available',
      expected: field === 'bankAccount' && details.category === 'Other' ? 'Document available for this selected category' : 'Document status confirmed',
      explanation: field === 'bankAccount' && details.category === 'Other'
        ? 'The selected non-EBC path treats the bank document as a required declared input in this limited rule pack.'
        : 'The checker cannot establish the next requirement until the student confirms the document status.',
      nextAction: field === 'bankAccount' ? 'Confirm the category-specific exception or document requirement from the official instructions.' : 'Confirm whether the document is available and follow the official guidance if it is not.',
      inputId: field,
      sourceId: 'epass-prerequisites',
    })
  }
  return finding(pack, {
    id: field === 'incomeCertificate' ? 'income-document-unknown' : 'bank-document-unknown',
    state: 'needs_verification',
    title: `${label} status is unknown`,
    observed: 'Student declaration: unknown',
    expected: 'Available or explicitly resolved from the official instructions',
    explanation: 'Unknown is kept separate from both available and unavailable so the report does not imply a false pass.',
    nextAction: 'Check the original documents and the official checklist before continuing.',
    inputId: field,
    sourceId: 'epass-prerequisites',
  })
}

function bankExceptionFinding(details: ApplicantDetails, pack: RulePack): Finding {
  if (details.category === 'EBC') {
    return finding(pack, {
      id: 'bank-ebc-exception',
      state: 'needs_verification',
      title: 'EBC bank-account exception needs confirmation',
      observed: `Category selected: ${details.category}`,
      expected: 'Category-specific exception confirmed from the current official instructions',
      explanation: 'The official page shows an EBC bank-account exception, but this browser-local checker does not make the exception decision for the student.',
      nextAction: 'Confirm the EBC exception on the current portal page and keep any supporting document or explanation available.',
      inputId: 'category',
      sourceId: 'epass-prerequisites',
    })
  }
  if (details.category === 'unknown') {
    return finding(pack, {
      id: 'category-missing',
      state: 'missing_information',
      title: 'Category is needed for the bank-account condition',
      observed: 'Category not selected',
      expected: 'A category-specific official condition',
      explanation: 'The checker does not apply the EBC exception or a universal bank requirement without a selected category.',
      nextAction: 'Select the applicable category from the official instructions, or leave this item for human review.',
      inputId: 'category',
      sourceId: 'epass-prerequisites',
    })
  }
  return documentFinding(details, pack, 'bankAccount')
}

export function runChecks(details: ApplicantDetails, pack: RulePack): Finding[] {
  if (pack.availability !== 'verified-limited') {
    return [finding(pack, {
      id: 'pack-unavailable',
      state: 'needs_verification',
      title: 'This rule pack is not available for real-use checking',
      observed: pack.name,
      expected: 'A source-reviewed, enabled rule pack',
      explanation: 'Unverified requirements remain disabled instead of being presented as official guidance.',
      nextAction: 'Choose the source-reviewed ePASS pack or verify this pack before enabling it.',
      inputId: null,
    })]
  }

  if (pack.id === 'tg-eapcet-images-2026') {
    return [compareNameFinding(details, pack), compareDobFinding(details, pack)]
  }

  return [
    compareNameFinding(details, pack),
    compareDobFinding(details, pack),
    certificateFinding(details, pack),
    documentFinding(details, pack, 'incomeCertificate'),
    bankExceptionFinding(details, pack),
  ]
}

export function demoDetails(): ApplicantDetails {
  return {
    applicantName: 'Aarav Reddy',
    documentName: 'Aarav Reddy',
    applicantDob: '2002-02-14',
    documentDob: '2002-02-14',
    certificateDate: '2025-05-18',
    category: 'Other',
    incomeCertificate: 'available',
    bankAccount: 'available',
  }
}

export function initialDetails(): ApplicantDetails {
  return {
    applicantName: '', documentName: '', applicantDob: '', documentDob: '',
    certificateDate: '', category: 'unknown', incomeCertificate: 'unknown', bankAccount: 'unknown',
  }
}
