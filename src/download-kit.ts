import type { UploadRow } from './upload-engine'
import { batchCsv } from './upload-engine'
import type { ImageConstraint, RulePack } from './rules'

export async function createDownloadKit(rows: UploadRow[], pack: RulePack, target: ImageConstraint) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (const row of rows) {
    if (row.status === 'ready' && row.output && row.outputName) zip.file(`images/${row.outputName}`, await row.output.arrayBuffer())
  }
  zip.file('report.csv', batchCsv(rows, pack, target))
  zip.file('REVIEW-BEFORE-UPLOADING.txt', [
    `ApplyReady — ${pack.name} / ${pack.cycle} / ${target.label}`,
    `Rule pack ${pack.id} v${pack.version}; reviewed ${pack.reviewedAt}; review due ${pack.reviewAfter}.`,
    'Only files passing the implemented checks are included. Check report.csv for every input, including failures.',
    'Images were processed locally. The ZIP/report may contain private filenames and images; share it carefully.',
    'A pass means file-format and configured byte/dimension checks only. It is not proof of identity or portal acceptance.',
    'KB is interpreted as 1024 bytes. Confirm actual live portal limits, including any different unit interpretation.',
    ...pack.manualChecks, ...pack.limitations,
  ].join('\r\n'))
  return zip.generateAsync({ type: 'blob', compression: 'STORE' })
}
