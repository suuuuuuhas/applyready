import { useEffect, useRef, useState } from 'react'
import { downloadBlob } from './image-tools'
import { reviewOverdue, uploadPacks } from './rules'
import type { RulePack, ImageConstraint } from './rules'
import { batchCsv, correctUpload, feedbackUrl, inspectUpload, validateBatch } from './upload-engine'
import type { UploadRow } from './upload-engine'

const statusText: Record<UploadRow['status'], string> = { queued: 'Queued', checking: 'Working…', 'needs-fix': 'Correction needed', ready: 'File checks passed', review: 'Manual help needed', error: 'Cannot read file' }
const reasons = ['Portal rejected a file that passed checks', 'Official requirements changed', 'Source link is broken', 'Other rule question']
const bytes = (value: number) => `${(value / 1024).toFixed(1)} KB (${value.toLocaleString()} bytes)`

function usePreview(blob?: Blob) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!blob) { setUrl(''); return }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}

async function syntheticFixture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1000; canvas.height = 700
  const context = canvas.getContext('2d')!
  const image = context.createImageData(canvas.width, canvas.height)
  let seed = 42
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    image.data[i] = seed & 255; image.data[i + 1] = (seed >>> 8) & 255; image.data[i + 2] = (seed >>> 16) & 255; image.data[i + 3] = 255
  }
  context.putImageData(image, 0, 0)
  context.fillStyle = '#263118'; context.fillRect(80, 250, 840, 180)
  context.fillStyle = '#ffffff'; context.font = 'bold 40px sans-serif'; context.fillText('SYNTHETIC DEMO', 135, 325)
  context.font = '24px sans-serif'; context.fillText('Not a student photo. Do not submit.', 135, 375)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Demo generation failed.')), 'image/png'))
  canvas.width = canvas.height = 0
  return new File([blob], 'synthetic-demo-not-for-submission.png', { type: 'image/png' })
}

export default function UploadWorkspace() {
  const [packId, setPackId] = useState(uploadPacks[0].id)
  const pack = uploadPacks.find(value => value.id === packId)!
  const [targetId, setTargetId] = useState(pack.imageConstraints[0].id)
  const target = pack.imageConstraints.find(value => value.id === targetId) ?? pack.imageConstraints[0]
  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [rows, setRows] = useState<UploadRow[]>([])
  const [selected, setSelected] = useState(0)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [demo, setDemo] = useState(false)
  const [zipBusy, setZipBusy] = useState(false)
  const [elapsed, setElapsed] = useState<number | null>(null)
  const generation = useRef(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const current = rows[selected]
  const beforeUrl = usePreview(current?.before ? current.file : undefined)
  const afterUrl = usePreview(current?.output)
  const ready = rows.filter(row => row.status === 'ready').length
  const canFix = rows.some(row => row.status === 'needs-fix')
  const source = pack.sources.find(value => value.id === target.sourceId)!
  useEffect(() => () => { generation.current++ }, [])

  function clearWork() {
    generation.current++
    setRows([]); setSelected(0); setBusy(false); setProgress(''); setError(''); setDemo(false); setElapsed(null); setZipBusy(false)
  }

  async function load(files: File[], isDemo = false) {
    try { validateBatch(files); if (mode === 'single' && files.length > 1) throw new Error('Choose one image, or switch to Batch mode.') }
    catch (problem) { setError((problem as Error).message); return }
    const operation = ++generation.current
    setError(''); setDemo(isDemo); setBusy(true); setElapsed(null); setSelected(0)
    const started = performance.now()
    const work: UploadRow[] = files.map((file, id) => ({ file, id, status: 'queued', issues: [], changed: false, resized: false }))
    setRows([...work])
    try {
      for (let i = 0; i < work.length; i++) {
        if (operation !== generation.current) return
        setProgress(`Checking ${i + 1} of ${work.length}`)
        work[i] = { ...work[i], status: 'checking' }; setRows([...work])
        const checked = await inspectUpload(work[i], target)
        if (operation !== generation.current) return
        work[i] = checked; setRows([...work])
        await new Promise(resolve => setTimeout(resolve, 0))
      }
      setElapsed(performance.now() - started); setProgress(`Checked ${work.length} ${work.length === 1 ? 'image' : 'images'}`)
    } finally { if (operation === generation.current) setBusy(false) }
  }

  async function fix() {
    const operation = ++generation.current
    const started = performance.now()
    const work = [...rows]
    setBusy(true); setError('')
    try {
      for (let i = 0; i < work.length; i++) {
        if (operation !== generation.current) return
        if (work[i].status !== 'needs-fix') continue
        setProgress(`Correcting ${i + 1} of ${work.length}`)
        const corrected = await correctUpload(work[i], target)
        if (operation !== generation.current) return
        work[i] = corrected; setRows([...work])
        await new Promise(resolve => setTimeout(resolve, 0))
      }
      setElapsed(performance.now() - started); setProgress('Correction complete. Review every output before uploading.')
    } finally { if (operation === generation.current) setBusy(false) }
  }

  async function downloadKit() {
    const operation = generation.current
    setZipBusy(true)
    try {
      const { createDownloadKit } = await import('./download-kit')
      const blob = await createDownloadKit(rows, pack, target)
      if (operation === generation.current) downloadBlob(blob, `applyready-${target.id}-kit.zip`)
    } catch (problem) { if (operation === generation.current) setError((problem as Error).message) }
    finally { if (operation === generation.current) setZipBusy(false) }
  }

  async function demoImage() {
    const operation = ++generation.current
    setBusy(true); setError('')
    try {
      const file = await syntheticFixture()
      if (operation === generation.current) await load([file], true)
    } catch (problem) { if (operation === generation.current) { setError((problem as Error).message); setBusy(false) } }
  }

  return <main className="page-wrap upload-page">
    <section className="upload-intro"><p className="kicker">ONE IMAGE OR A HUNDRED · PROCESSED ON YOUR DEVICE</p><h1>Fix the file.<br /><em>Get back to applying.</em></h1><p>Check a photo or signature against a sourced application spec. See what fails, create a corrected JPEG, and take the result with you.</p><div className="promise-line"><span>No account</span><span>No image uploads</span><span>Originals preserved</span></div></section>
    <section className="upload-workbench" aria-label="Upload preparation">
      <div className="workbench-heading"><div><span className="mini-label">01 / CHOOSE YOUR TARGET</span><h2>Which application is this for?</h2></div><div className="mode-switch" role="group" aria-label="Processing mode"><button aria-pressed={mode === 'single'} disabled={busy || zipBusy} onClick={() => { clearWork(); setMode('single') }}>Single image</button><button aria-pressed={mode === 'batch'} disabled={busy || zipBusy} onClick={() => { clearWork(); setMode('batch') }}>Batch · up to 100</button></div></div>
      <div className="target-grid"><label className="field"><span>Application & cycle</span><select value={pack.id} disabled={busy || zipBusy} onChange={event => { clearWork(); setPackId(event.target.value); setTargetId('') }}>{uploadPacks.map(value => <option value={value.id} key={value.id}>{value.portal} · {value.cycle}{value.cycleStatus === 'archived' ? ' (2026 reference)' : ''}</option>)}</select></label><label className="field"><span>Upload field</span><select value={target.id} disabled={busy || zipBusy} onChange={event => { clearWork(); setTargetId(event.target.value) }}>{pack.imageConstraints.map(value => <option value={value.id} key={value.id}>{value.label}</option>)}</select></label></div>
      <div className="rule-strip"><strong>JPG / JPEG</strong><span>{target.minBytes ? `${(target.minBytes / 1024).toFixed(0)} KB minimum · ` : ''}{target.maxBytes ? `${target.maxBytes.toLocaleString()} bytes maximum` : 'No byte maximum'}</span><span>Source reviewed {pack.reviewedOn}</span><a href={source.url} target="_blank" rel="noreferrer">Read the official spec ↗</a></div>
      {(pack.cycleStatus === 'archived' || reviewOverdue(pack)) && <p className="cycle-note" role="note">{reviewOverdue(pack) ? 'This pack is due for a source review. ' : ''}{pack.cycleStatus === 'archived' ? '2026 reference pack. These rules have not been verified for 2027. ' : ''}Confirm the cycle and current upload field before use.</p>}
      <div className={`drop-area ${busy ? 'is-busy' : ''}`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!busy && !zipBusy) void load(Array.from(event.dataTransfer.files)) }}>
        <span className="drop-count" aria-hidden="true">{mode === 'single' ? '01' : '01–100'}</span><h3>{mode === 'single' ? 'Bring the image that needs fixing.' : 'Prepare one batch for one upload field.'}</h3><p>{mode === 'single' ? 'Choose or drop a JPEG, PNG or WebP.' : 'Select photos OR signatures for the target above. Each file gets its own result.'}<br />20 MB per file · 100 MB per batch · PDF and HEIC are not supported.</p><div className="drop-actions"><button className="button button-primary" disabled={busy || zipBusy} onClick={() => fileInput.current?.click()}>{mode === 'single' ? 'Choose image' : 'Choose batch'}</button><button className="button button-secondary" disabled={busy || zipBusy} onClick={() => void demoImage()}>Try the synthetic demo</button></div><input ref={fileInput} aria-label={mode === 'single' ? 'Choose image file' : 'Choose batch files'} type="file" accept="image/jpeg,image/png,image/webp" multiple={mode === 'batch'} hidden onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; if (files.length) void load(files) }} />
      </div>
      {error && <p className="image-error" role="alert">{error}</p>}
      {demo && <p className="demo-label">Synthetic test image — demonstrates format/size correction. It is not a student photo or proof of portal acceptance.</p>}
      {rows.length > 0 && <section className="batch-results" aria-label="File results"><div className="results-toolbar"><div aria-live="polite"><h3>{ready} of {rows.length} pass file checks</h3><p>{progress}{elapsed !== null ? ` · ${(elapsed / 1000).toFixed(1)}s` : ''}</p></div><div className="result-actions">{canFix && <button className="button button-primary" disabled={busy || zipBusy} onClick={() => void fix()}>{busy ? 'Working…' : mode === 'single' ? 'Fix this image' : 'Fix correctable files'}</button>}{busy && <button className="button button-secondary" onClick={() => { generation.current++; setBusy(false); setRows(current => current.map(row => row.status === 'queued' || row.status === 'checking' ? { ...row, status: 'review', issues: ['Not processed: operation stopped. Choose these files again to retry.'] } : row)); setProgress('Stopped. Completed results are retained.') }}>Stop processing</button>}{!busy && <button className="button button-quiet" onClick={clearWork}>Clear files</button>}</div></div>
        {mode === 'batch' && <div className="batch-table-wrap"><table className="batch-table"><caption>Every input is listed. Only passing files are included in the ZIP.</caption><thead><tr><th>File</th><th>Before</th><th>After</th><th>Result</th><th>Preview</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id}><td>{row.file.name}</td><td>{row.before ? bytes(row.before.bytes) : '—'}</td><td>{row.after ? bytes(row.after.bytes) : '—'}</td><td><span className={`upload-status ${row.status}`}>{statusText[row.status]}</span></td><td><button className="inline-link" onClick={() => setSelected(index)} aria-label={`Preview file ${index + 1}`} aria-pressed={selected === index}>View</button></td></tr>)}</tbody></table></div>}
        {current && <div className="image-review"><div className="review-title"><h3>{current.file.name}</h3><span className={`upload-status ${current.status}`}>{statusText[current.status]}</span></div><div className="preview-pair"><figure><div className="preview-canvas">{beforeUrl ? <img src={beforeUrl} alt="Original image" /> : <span>Preview unavailable</span>}</div><figcaption><strong>Original</strong>{current.before ? <span>{bytes(current.before.bytes)} · {current.before.width} × {current.before.height}px</span> : <span>Waiting for a decoded image</span>}</figcaption></figure><figure><div className="preview-canvas">{afterUrl ? <img src={afterUrl} alt="Prepared JPEG" /> : <span>{current.status === 'needs-fix' ? 'Correct the image to compare' : 'No passing output yet'}</span>}</div><figcaption><strong>{current.changed ? 'Corrected JPEG' : current.output ? 'Original already passes — kept unchanged' : 'Prepared file'}</strong>{current.after && <span>{bytes(current.after.bytes)} · {current.after.width} × {current.after.height}px</span>}</figcaption></figure></div>
          {current.issues.length > 0 && <ul className="file-issues">{current.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}{current.resized && <p className="cycle-note">Dimensions were reduced to meet the byte limit. Check the face or signature carefully for lost detail.</p>}{current.output && <><p className="review-reminder">File checks passed. Review clarity, framing and orientation; the official portal makes the final decision.</p><button className="button button-primary" disabled={busy || zipBusy} onClick={() => current.output && downloadBlob(current.output, current.outputName!)}>Download JPEG</button></>}
        </div>}
        {!busy && <div className="kit-actions"><button className="button button-secondary" disabled={!ready || zipBusy} onClick={() => void downloadKit()}>{zipBusy ? 'Preparing ZIP…' : `Download ZIP · ${ready} passing ${ready === 1 ? 'file' : 'files'}`}</button><button className="button button-quiet" onClick={() => downloadBlob(new Blob([batchCsv(rows, pack, target)], { type: 'text/csv;charset=utf-8' }), 'applyready-report.csv')}>Download full CSV report</button><p>Downloads may contain private images and filenames. Share them only when you intend to.</p></div>}
      </section>}
    </section>
    <section className="upload-notes"><div><p className="mini-label">WHAT WE CHECK</p><h3>A specific target, a measurable result.</h3><p>We decode the actual file, check its format and byte range, and recheck any corrected JPEG. Already-passing originals are kept unchanged. Batch mode uses the same target for every file.</p><p>Compression keeps the composition. If needed, automatic resizing reduces dimensions proportionally. Files below a minimum need a better original; we do not add padding to fake detail.</p></div><div><p className="mini-label">WHAT YOU STILL REVIEW</p><ul>{pack.manualChecks.map(check => <li key={check}>{check}</li>)}</ul><p className="unit-note">For file checks, 1 KB = 1,024 bytes. Exact byte counts are shown. Portal unit interpretation and content checks may differ.</p></div></section>
    <details className="pack-evidence"><summary>Rule sources, review dates & coverage</summary><p>{pack.name} · version {pack.version} · next review {pack.reviewAfter}</p>{pack.sources.map(record => <article key={record.id}><strong>{record.title}</strong><p>{record.section} · reviewed {record.reviewedOn}</p><p>{record.note}</p><a href={record.url} target="_blank" rel="noreferrer">Official source ↗</a></article>)}<ul>{pack.limitations.map(value => <li key={value}>{value}</li>)}</ul><p>These packs were checked against published documents, not tested by submitting applications to a live government portal.</p></details>
    <RuleFeedback key={`${pack.id}-${target.id}`} pack={pack} target={target} />
    <footer className="site-footer"><span>APPLYREADY / FILE PREPARATION</span><span>Local processing · No database · No automatic submissions</span></footer>
  </main>
}

function RuleFeedback({ pack, target }: { pack: RulePack; target: ImageConstraint }) {
  const [reason, setReason] = useState(reasons[0])
  const [reviewed, setReviewed] = useState(false)
  return <details className="rule-feedback"><summary>Rejected anyway? Report a rule problem.</summary><p>No report is sent automatically. The link below opens a public GitHub issue draft. Review it there before submitting; a GitHub account is required.</p><label className="field"><span>What happened?</span><select value={reason} onChange={event => { setReason(event.target.value); setReviewed(false) }}>{reasons.map(value => <option key={value}>{value}</option>)}</select></label><div className="feedback-preview"><strong>Draft contains only:</strong><p>Pack: {pack.id} · v{pack.version}<br />Cycle: {pack.cycle}<br />Rule: {target.id}<br />Category: {reason}<br />Review date and official source URL.</p></div><label className="feedback-consent"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} /><span>I reviewed this metadata and want to open a public GitHub draft. Images, filenames and student details are excluded.</span></label>{reviewed ? <a className="button button-secondary" href={feedbackUrl(pack, target, reason)} target="_blank" rel="noreferrer">Open issue draft on GitHub ↗</a> : <button className="button button-secondary" disabled>Review metadata to open draft</button>}</details>
}
