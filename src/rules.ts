import epass from './packs/telangana-epass-fresh-2026-27.json'
import eapcet from './packs/tg-eapcet-images-2026.json'
import neet from './packs/neet-ug-images-2026.json'
import cuet from './packs/cuet-ug-images-2026.json'
import recruitment from './packs/recruitment-image-unavailable.json'

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
  schemaVersion: number
  version: string
  reviewedAt: string
  reviewAfter: string
  cycleStatus: 'published' | 'archived'
  manualChecks: string[]
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


export const ePassFreshPack = epass as RulePack
export const eapcetImagePack = eapcet as RulePack
export const recruitmentImagePack = recruitment as RulePack
export const rulePacks: RulePack[] = [ePassFreshPack, eapcetImagePack, neet as RulePack, cuet as RulePack, recruitmentImagePack]
export const uploadPacks = rulePacks.filter(pack => pack.availability === 'verified-limited' && pack.imageConstraints.length > 0)
export const getRulePack = (id: string) => rulePacks.find(pack => pack.id === id) ?? ePassFreshPack
export function reviewOverdue(pack: RulePack, now = new Date()) {
  return now.toISOString().slice(0, 10) > pack.reviewAfter
}
