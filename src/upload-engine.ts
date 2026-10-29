import type { ImageConstraint, RulePack } from './rules'
import { inspectImageFile, processImageFile, revalidateImageBlob } from './image-tools'
import type { ImageInspection } from './image-tools'

export const MAX_BATCH_FILES = 100
export const MAX_BATCH_BYTES = 100 * 1024 * 1024
export type UploadRow = {
  id: number
  file: File
  before?: ImageInspection
  after?: ImageInspection
  output?: Blob
  outputName?: string
  status: 'queued' | 'checking' | 'needs-fix' | 'ready' | 'review' | 'error'
  issues: string[]
  changed: boolean
  resized: boolean
}

export function checkImageConstraints(image: ImageInspection, target: ImageConstraint) {
  const issues: string[] = []
  if (image.mime !== target.outputMime) issues.push('Convert to JPEG: this target accepts JPG/JPEG.')
  if (target.maxBytes !== undefined && image.bytes > target.maxBytes) issues.push(`${image.bytes.toLocaleString()} bytes exceeds the ${target.maxBytes.toLocaleString()} byte limit.`)
  if (target.minBytes !== undefined && image.bytes < target.minBytes) issues.push(`${image.bytes.toLocaleString()} bytes is below the ${target.minBytes.toLocaleString()} byte minimum. Use a higher-detail original; we do not pad files.`)
  if (target.maxWidth !== undefined && image.width > target.maxWidth) issues.push(`Width exceeds ${target.maxWidth}px.`)
  if (target.maxHeight !== undefined && image.height > target.maxHeight) issues.push(`Height exceeds ${target.maxHeight}px.`)
  return issues
}

export function validateBatch(files: File[]) {
  if (!files.length) throw new Error('Choose at least one image.')
  if (files.length > MAX_BATCH_FILES) throw new Error(`Choose up to ${MAX_BATCH_FILES} images per batch. No files were added.`)
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_BATCH_BYTES) throw new Error('Keep each batch under 100 MB in total. No files were added.')
}

export function safeOutputName(name: string, index: number) {
  const stem = name.replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 70) || 'image'
  return `${String(index + 1).padStart(3, '0')}-${stem}-ready.jpg`
}

export async function inspectUpload(row: UploadRow, target: ImageConstraint): Promise<UploadRow> {
  try {
    const before = await inspectImageFile(row.file)
    const issues = checkImageConstraints(before, target)
    return { ...row, before, status: issues.length ? 'needs-fix' : 'ready', issues, output: issues.length ? undefined : row.file, after: issues.length ? undefined : before, outputName: safeOutputName(row.file.name, row.id), changed: false, resized: false }
  } catch (error) {
    return { ...row, status: 'error', issues: [error instanceof Error ? error.message : 'Image could not be decoded.'] }
  }
}

export async function correctUpload(row: UploadRow, target: ImageConstraint): Promise<UploadRow> {
  if (!row.before || row.status === 'error') return row
  if (!checkImageConstraints(row.before, target).length) return row
  // Keep the full composition. Only reduce dimensions when quality compression
  // cannot reach the upper byte limit. Never crop, stretch, or pad to a minimum.
  let width = Math.min(row.before.width, target.maxWidth ?? row.before.width)
  let height = Math.min(row.before.height, target.maxHeight ?? row.before.height)
  const scale = Math.min(width / row.before.width, height / row.before.height, Math.sqrt(16_000_000 / (row.before.width * row.before.height)))
  width = Math.max(1, Math.round(row.before.width * scale))
  height = Math.max(1, Math.round(row.before.height * scale))
  try {
    for (let attempt = 0; attempt < 10; attempt++) {
      const processed = await processImageFile(row.file, { width, height, mode: 'contain', maxBytes: target.maxBytes, minBytes: target.minBytes, qualityCeiling: 1 })
      const checked = await revalidateImageBlob(processed.blob, target)
      const issues = checkImageConstraints(checked.inspection, target)
      if (!issues.length) return { ...row, status: 'ready', after: checked.inspection, output: processed.blob, outputName: safeOutputName(row.file.name, row.id), changed: true, resized: width !== row.before.width || height !== row.before.height, issues: [] }
      if (!target.maxBytes || processed.bytes <= target.maxBytes || Math.min(width, height) <= 80) break
      width = Math.max(1, Math.round(width * 0.78))
      height = Math.max(1, Math.round(height * 0.78))
    }
    return { ...row, status: 'review', output: undefined, after: undefined, issues: ['Could not produce a JPEG within this byte range without further compromises. Use a clearer or higher-detail original, or ask for manual help.'] }
  } catch (error) {
    return { ...row, status: 'error', output: undefined, issues: [error instanceof Error ? error.message : 'Correction failed.'] }
  }
}

function csvCell(value: unknown) {
  let text = String(value ?? '')
  // Student filenames must not become spreadsheet formulas.
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text
  return '"' + text.replace(/"/g, '""') + '"'
}

export function batchCsv(rows: UploadRow[], pack: RulePack, target: ImageConstraint) {
  const lines: unknown[][] = [
    ['input_file', 'output_file', 'status', 'input_bytes', 'output_bytes', 'input_pixels', 'output_pixels', 'changed', 'resized', 'rule_pack', 'pack_version', 'cycle', 'target', 'source', 'source_reviewed', 'review_due', 'notes'],
    ...rows.map(row => [row.file.name, row.outputName && row.output ? row.outputName : '', row.status, row.before?.bytes, row.after?.bytes, row.before ? `${row.before.width}x${row.before.height}` : '', row.after ? `${row.after.width}x${row.after.height}` : '', row.changed, row.resized, pack.id, pack.version, pack.cycle, target.id, pack.sources.find(source => source.id === target.sourceId)?.url, pack.reviewedAt, pack.reviewAfter, [...row.issues, 'Format/byte checks only; visually review and confirm the live portal.'].join(' ')]),
  ]
  return '\uFEFF' + lines.map(line => line.map(csvCell).join(',')).join('\r\n')
}

export function feedbackUrl(pack: RulePack, target: ImageConstraint, reason: string) {
  // Deliberately excludes filenames, images, document details and free text.
  const categories = ['Portal rejected a file that passed checks', 'Official requirements changed', 'Source link is broken', 'Other rule question']
  if (!categories.includes(reason)) throw new Error('Choose a report category.')
  const body = `Rule pack: ${pack.id}\nVersion: ${pack.version}\nCycle: ${pack.cycle}\nTarget: ${target.id}\nReviewed: ${pack.reviewedAt}\nCategory: ${reason}\n\nPlease describe the public rule discrepancy. Do not include student names, application numbers, images, documents or unredacted portal errors.\n\nSource: ${pack.sources.find(source => source.id === target.sourceId)?.url ?? ''}`
  return `https://github.com/suuuuuuhas/applyready/issues/new?title=${encodeURIComponent(`[Rule report] ${target.id}`)}&body=${encodeURIComponent(body)}`
}
