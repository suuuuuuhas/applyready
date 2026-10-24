import { ePassFreshPack } from './rules'

export type FeeSafeStatusId = 'unknown' | 'pending' | 'approved' | 'returned' | 'rejected'

export type FeeSafeStatus = {
  id: FeeSafeStatusId
  label: string
  statusWord: string
  meaning: string
  nextAction: string
  evidence: string[]
  sourceIds: string[]
  uncertainty: string
}

export const feeSafeStatuses: FeeSafeStatus[] = [
  {
    id: 'unknown',
    label: 'Unknown / exact portal wording not confirmed',
    statusWord: 'Unknown',
    meaning: 'The current portal status has not been confirmed in this local session.',
    nextAction: 'Open the official Application Status service or official help channel and record the exact wording shown there.',
    evidence: ['A dated note of the exact status wording', 'The official help or status page used', 'A copy of any response received'],
    sourceIds: ['epass-status-service'],
    uncertainty: 'The public portal exposes an Application Status service, but this MVP does not retrieve or interpret account status automatically.',
  },
  {
    id: 'pending',
    label: 'Pending / under review (editorial label)',
    statusWord: 'Pending',
    meaning: 'A student-entered label for a case that appears not to have reached a final decision.',
    nextAction: 'Confirm the exact portal wording and any stated review timeline through the official channel.',
    evidence: ['A dated status capture or printout', 'Application or reference identifier with sensitive digits redacted', 'Any official acknowledgement'],
    sourceIds: ['epass-status-service'],
    uncertainty: '“Pending” is an editorial convenience label, not a claim that this exact word is used by the portal.',
  },
  {
    id: 'approved',
    label: 'Approved / sanctioned (editorial label)',
    statusWord: 'Approved',
    meaning: 'A student-entered label for a portal message that appears to indicate a positive outcome.',
    nextAction: 'Save the official wording and follow any remaining college or portal instructions. Do not treat this letter as proof of payment.',
    evidence: ['A dated official status capture or printout', 'Sanction or acknowledgement details if the portal provides them', 'College communication if relevant'],
    sourceIds: ['epass-status-service'],
    uncertainty: '“Approved” and “sanctioned” are not asserted as the portal’s exact status vocabulary here.',
  },
  {
    id: 'returned',
    label: 'Returned / needs correction (editorial label)',
    statusWord: 'Returned',
    meaning: 'A student-entered label for a message that appears to request correction or another action.',
    nextAction: 'Copy the exact reason, correct only what the official instructions request, and keep the original message.',
    evidence: ['A dated status capture or printout', 'The exact reason shown by the portal', 'A note of the correction made'],
    sourceIds: ['epass-status-service'],
    uncertainty: '“Returned” is an editorial convenience label, not a confirmed portal status string.',
  },
  {
    id: 'rejected',
    label: 'Rejected / not approved (editorial label)',
    statusWord: 'Rejected',
    meaning: 'A student-entered label for a message that appears to indicate a negative outcome.',
    nextAction: 'Preserve the exact reason and seek official clarification or the published review route. This tool does not assess an appeal or entitlement.',
    evidence: ['A dated status capture or printout', 'The exact reason shown by the portal', 'Any official review or help reference'],
    sourceIds: ['epass-status-service'],
    uncertainty: '“Rejected” is an editorial convenience label, not a confirmed portal status string.',
  },
]

export const proofKitItems = [
  { id: 'status', label: 'Exact portal status wording and date recorded', detail: 'Keep the official wording; do not paraphrase it as a legal conclusion.' },
  { id: 'application', label: 'Application path and cycle recorded', detail: 'Record the selected fresh/renewal path and cycle without copying full sensitive identifiers.' },
  { id: 'receipt', label: 'Fee or transaction evidence available', detail: 'Keep receipts or bank/portal references privately; never paste a full account number here.' },
  { id: 'documents', label: 'Relevant document checklist reviewed', detail: 'Mark which requested documents were available, unknown, or unavailable.' },
  { id: 'communication', label: 'Official response or help reference saved', detail: 'Record the channel, date, and response; keep the original message.' },
]

export function getFeeSafeStatus(id: FeeSafeStatusId) {
  return feeSafeStatuses.find((status) => status.id === id) ?? feeSafeStatuses[0]
}

export function generateFeeSafeLetter(input: {
  studentName: string
  collegeName: string
  applicationPath: string
  status: FeeSafeStatus
  unresolved: string
  date: string
}) {
  const name = input.studentName.trim() || '[Student name]'
  const college = input.collegeName.trim() || '[College / institution]'
  const unresolved = input.unresolved.trim() || 'I have attached the available supporting information and request guidance on the next step.'
  return `Subject: Request for guidance on my ${input.applicationPath} application\n\nDear ${college} support team,\n\nI am writing about my ${input.applicationPath} application. In my own record, the current status is noted as “${input.status.statusWord}”. This is a student-entered description; please rely on the official portal record and your published guidance for the authoritative status.\n\nI would be grateful if you could confirm the next action and any specific document or correction required. My unresolved note is:\n\n${unresolved}\n\nI can provide the relevant official status wording and supporting records through the appropriate channel. I have not included full bank or identity numbers in this draft.\n\nThank you for your guidance.\n\nYours faithfully,\n${name}\nPrepared locally on ${input.date}`
}

export const feeSafeSourceNote = `FeeSafe uses the official Telangana ePASS Application Status service as a source reference. It does not retrieve status, interpret undisclosed portal rules, assert entitlement, calculate reimbursement, or promise an outcome. Renewal and attendance conditions need a current department- and cycle-specific source check; they are not assessed by this fresh-registration checker.`

export const feeSafePackName = ePassFreshPack.name
