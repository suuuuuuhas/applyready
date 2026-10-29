import fs from 'node:fs'
import Ajv from 'ajv'

const directory = new URL('../src/packs/', import.meta.url)
const schema = JSON.parse(fs.readFileSync(new URL('pack.schema.json', directory), 'utf8'))
const validate = new Ajv({ allErrors: true, strict: true }).compile(schema)
const packIds = new Set()
const constraintIds = new Set()
const knownHosts = ['telanganaepass.cgg.gov.in', 'eapcet.tgche.ac.in', 'cdnbbsr.s3waas.gov.in']
let count = 0
for (const filename of fs.readdirSync(directory).filter(name => name.endsWith('.json') && name !== 'pack.schema.json')) {
  const pack = JSON.parse(fs.readFileSync(new URL(filename, directory), 'utf8'))
  if (!validate(pack)) throw new Error(`${filename}: ${JSON.stringify(validate.errors)}`)
  if (filename !== `${pack.id}.json` || packIds.has(pack.id)) throw new Error(`Duplicate/mismatched pack ID: ${pack.id}`)
  packIds.add(pack.id)
  for (const field of ['reviewedAt', 'reviewAfter']) {
    if (new Date(`${pack[field]}T00:00:00Z`).toISOString().slice(0, 10) !== pack[field]) throw new Error(`Invalid ${field}: ${filename}`)
  }
  if (pack.reviewAfter <= pack.reviewedAt) throw new Error(`Review due date must follow review: ${filename}`)
  const sourceIds = new Set()
  for (const source of pack.sources) {
    if (sourceIds.has(source.id)) throw new Error(`Duplicate source: ${source.id}`)
    sourceIds.add(source.id)
    if (!knownHosts.includes(new URL(source.url).hostname)) throw new Error(`Review and allowlist this official publisher: ${source.url}`)
  }
  if (pack.availability !== 'verified-limited' && pack.imageConstraints.length) throw new Error(`Unverified pack cannot enable targets: ${filename}`)
  for (const rule of pack.imageConstraints) {
    if (constraintIds.has(rule.id)) throw new Error(`Duplicate target across packs: ${rule.id}`)
    constraintIds.add(rule.id)
    if (!sourceIds.has(rule.sourceId)) throw new Error(`Missing source: ${rule.id}`)
    if (pack.sources.find(source => source.id === rule.sourceId).verification === 'unverified') throw new Error(`Unverified source cannot enable a target: ${rule.id}`)
    if (rule.minBytes && rule.maxBytes && rule.minBytes > rule.maxBytes) throw new Error(`Impossible byte range: ${rule.id}`)
  }
  count++
}
console.log(`Validated ${count} JSON packs and ${constraintIds.size} isolated upload targets.`)
