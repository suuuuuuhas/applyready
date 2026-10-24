export type PackAvailability = 'verified-limited' | 'unverified' | 'unavailable'

export type SourceRecord = {
  id: string
  publisher: string
  title: string
  url: string
  section: string
  reviewedOn: string
  verification: 'verified' | 'partial' | 'unverified'
  note: string
}

export type ImageConstraint = {
  id: string
  label: string
  outputMime: 'image/jpeg'
  maxBytes?: number
  minBytes?: number
  maxWidth?: number
  maxHeight?: number
  sourceId: string
  limitation: string
}

export type RulePack = {
  id: string
  name: string
  portal: string
  cycle: string
  applicationPath: string
  freshRenewal: 'fresh' | 'renewal' | 'both' | 'unknown'
  availability: PackAvailability
  reviewedOn: string
  coverage: string
  limitations: string[]
  sources: SourceRecord[]
  imageConstraints: ImageConstraint[]
}

const OFFICIAL_EPASS_FRESH = 'https://telanganaepass.cgg.gov.in/FreshRegistration202627.do'
const OFFICIAL_EPASS_FORM = 'https://telanganaepass.cgg.gov.in/FreshRegistration202627.do?studentAction=GetForm'
const OFFICIAL_EPASS_ELIGIBILITY = 'https://telanganaepass.cgg.gov.in/'
const OFFICIAL_EPASS_LINKS = 'https://telanganaepass.cgg.gov.in/epassonlinelinks.jsp'
const OFFICIAL_EAPCET = 'https://eapcet.tgche.ac.in/'
const REVIEW_DATE = '24 October 2026'

export const ePassFreshPack: RulePack = {
  id: 'telangana-epass-fresh-2026-27',
  name: 'Telangana ePASS · fresh registration',
  portal: 'Telangana ePASS',
  cycle: '2026–27',
  applicationPath: 'Post-matric scholarship · fresh registration · general case',
  freshRenewal: 'fresh',
  availability: 'verified-limited',
  reviewedOn: REVIEW_DATE,
  coverage: 'Name and DOB comparison, income-certificate date, declared document status, and the published ePASS photo-size constraint.',
  limitations: [
    'This is not complete portal coverage. Renewal, course, caste, disability, domicile, and institution-specific conditions are not enabled.',
    'The bank-account exception is surfaced as a conditional review, not inferred as a universal pass.',
    'The source page does not establish document authenticity, identity, eligibility, sanction, or approval.',
  ],
  sources: [
    {
      id: 'epass-prerequisites',
      publisher: 'Telangana ePASS',
      title: 'Official scholarship portal and fresh-registration prerequisites',
      url: OFFICIAL_EPASS_FRESH,
      section: 'Post Matric Scholarship Fresh Registration / eligibility and required documents',
      reviewedOn: REVIEW_DATE,
      verification: 'verified',
      note: 'The current official portal page lists a 2026–27 fresh-registration path, an income certificate obtained after 01-04-2025, and an EBC bank-account exception. The selected pack intentionally stores only those supported conditions.',
    },
    {
      id: 'epass-upload-limits',
      publisher: 'Telangana ePASS',
      title: 'Required-document upload fields',
      url: OFFICIAL_EPASS_FORM,
      section: 'Fresh registration document upload fields',
      reviewedOn: REVIEW_DATE,
      verification: 'partial',
      note: 'The current form labels the passport photograph as JPG only with a maximum size of 30 KB, and the bank-passbook first page as JPG only with a maximum of 100 KB. It does not define a universal pixel dimension or a full image-authenticity rule.',
    },
    {
      id: 'epass-renewal-attendance',
      publisher: 'Telangana ePASS',
      title: 'Renewal guidance requires a current source check',
      url: OFFICIAL_EPASS_ELIGIBILITY,
      section: 'Eligibility navigation; linked legacy page unavailable at review',
      reviewedOn: REVIEW_DATE,
      verification: 'unverified',
      note: 'The portal links a legacy eligibility page that returned HTTP 404 during release review. No current attendance threshold is asserted here. Confirm department- and cycle-specific renewal conditions through the official portal.',
    },
    {
      id: 'epass-status-service',
      publisher: 'Telangana ePASS',
      title: 'Application Status service',
      url: OFFICIAL_EPASS_LINKS,
      section: 'Application Status navigation',
      reviewedOn: REVIEW_DATE,
      verification: 'partial',
      note: 'The portal exposes an Application Status service, but its exact internal status vocabulary is not asserted here. FeeSafe status labels are student-entered editorial categories that require confirmation against the portal.',
    },
  ],
  imageConstraints: [
    {
      id: 'epass-photo-max-30kb',
      label: 'ePASS photo · maximum 30 KB',
      outputMime: 'image/jpeg',
      maxBytes: 30 * 1024,
      sourceId: 'epass-upload-limits',
      limitation: 'Only the byte limit is source-backed here. No universal pixel dimensions or authenticity check is claimed.',
    },
  ],
}

export const eapcetImagePack: RulePack = {
  id: 'tg-eapcet-images-2026',
  name: 'TG EAPCET · photograph and signature',
  portal: 'TG EAPCET', cycle: '2026 intake',
  applicationPath: '2026 online application · manual photo/signature upload when prompted',
  freshRenewal: 'unknown', availability: 'verified-limited', reviewedOn: REVIEW_DATE,
  coverage: 'Entered-name/DOB consistency and separate JPEG photograph/signature byte checks.',
  limitations: [
    'This pack covers the 2026 application guide, not the 2027 cycle or admission eligibility.',
    'Some qualifying-examination records supply images automatically. Upload only when the official form prompts you.',
    'The guide does not specify universal pixel dimensions. Photo content, signature authenticity, and portal acceptance are not checked.',
  ],
  sources: [{
    id: 'tg-eapcet-guide-2026', publisher: 'JNTUH / TGCHE',
    title: 'TG EAPCET 2026 online application user guide',
    url: 'https://eapcet.tgche.ac.in/TGEAPCET/Doc2026/USER%20GUIDE%20FOR%20TG%20EAPCET%20-%202026.pdf',
    section: 'Photograph and Signature, pages 34–35', reviewedOn: REVIEW_DATE,
    verification: 'verified',
    note: 'The guide specifies JPG photograph below 50 KB and JPG signature below 30 KB for applicants asked to upload them. No minimum byte size is stated.',
  }],
  imageConstraints: [
    { id: 'eapcet-photo', label: 'TG EAPCET photograph · below 50 KB', outputMime: 'image/jpeg', maxBytes: 50 * 1024 - 1, sourceId: 'tg-eapcet-guide-2026', limitation: 'Strictly below 50 KB. Pixel dimensions are a user-selected setting, not an official requirement.' },
    { id: 'eapcet-signature', label: 'TG EAPCET signature · below 30 KB', outputMime: 'image/jpeg', maxBytes: 30 * 1024 - 1, sourceId: 'tg-eapcet-guide-2026', limitation: 'Strictly below 30 KB. Check signature legibility yourself.' },
  ],
}

export const recruitmentImagePack: RulePack = {
  id: 'recruitment-image-unavailable',
  name: 'Recruitment photo/signature · source not selected',
  portal: 'Named recruitment portal not selected',
  cycle: 'Not set',
  applicationPath: 'Photo/signature requirements',
  freshRenewal: 'unknown',
  availability: 'unavailable',
  reviewedOn: REVIEW_DATE,
  coverage: 'Unavailable until one named recruitment portal and current specification are reviewed.',
  limitations: ['No recruitment image rule is enabled. The local image tool can still demonstrate mechanics without representing portal compliance.'],
  sources: [],
  imageConstraints: [],
}

export const rulePacks: RulePack[] = [ePassFreshPack, eapcetImagePack, recruitmentImagePack]

export const getRulePack = (id: string) => rulePacks.find((pack) => pack.id === id) ?? ePassFreshPack
