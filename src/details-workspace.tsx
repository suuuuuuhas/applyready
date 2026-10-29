import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  ApplicantDetails,
  Finding,
  ResultState,
  initialDetails,
  demoDetails,
  runChecks,
} from './engine'
import {
  FitMode,
  ImageInspection,
  ImageRevalidation,
  ProcessedImage,
  createSyntheticDemoImage,
  downloadBlob,
  inspectImageFile,
  processImageFile,
  revalidateImageBlob,
} from './image-tools'
import {
  feeSafeSourceNote,
  feeSafeStatuses,
  FeeSafeStatusId,
  generateFeeSafeLetter,
  getFeeSafeStatus,
  proofKitItems,
} from './feesafe'
import { ImageConstraint, RulePack, getRulePack, rulePacks } from './rules'
import { checkImageConstraints } from './upload-engine'
import './styles.css'

const stateMeta: Record<ResultState, { label: string; className: string }> = {
  passed: { label: 'Passed', className: 'state-passed' },
  failed: { label: 'Failed', className: 'state-failed' },
  warning: { label: 'Warning', className: 'state-warning' },
  missing_information: { label: 'Missing information', className: 'state-missing' },
  needs_verification: { label: 'Needs verification', className: 'state-verify' },
}

type ImageState = {
  sourceFile: File | null
  sourceInspection: ImageInspection | null
  processed: ProcessedImage | null
  revalidation: ImageRevalidation | null
  previewUrl: string | null
  error: string
  busy: boolean
  applied: boolean
}

const emptyImageState: ImageState = {
  sourceFile: null,
  sourceInspection: null,
  processed: null,
  revalidation: null,
  previewUrl: null,
  error: '',
  busy: false,
  applied: false,
}

const todayLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date())

export default function DetailsWorkspace() {
  const [step, setStep] = useState(1)
  const [selectedPackId, setSelectedPackId] = useState(rulePacks[0].id)
  const [details, setDetails] = useState<ApplicantDetails>(initialDetails)
  const [hasChecked, setHasChecked] = useState(false)
  const [imageStates, setImageStates] = useState<Record<string, ImageState>>({})
  const [imageTargetId, setImageTargetId] = useState('')
  const [imageOptions, setImageOptions] = useState({ width: '', height: '', mode: 'contain' as FitMode })
  const [feeSafeOpen, setFeeSafeOpen] = useState(false)
  const [feeSafeStatusId, setFeeSafeStatusId] = useState<FeeSafeStatusId>('unknown')
  const [feeSafeStudent, setFeeSafeStudent] = useState('')
  const [feeSafeCollege, setFeeSafeCollege] = useState('')
  const [feeSafeUnresolved, setFeeSafeUnresolved] = useState('')
  const [feeSafeProof, setFeeSafeProof] = useState<string[]>([])
  const [feeSafeLetter, setFeeSafeLetter] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const imageOperation = useRef(0)
  const previewUrls = useRef(new Set<string>())

  const selectedPack = useMemo(() => getRulePack(selectedPackId), [selectedPackId])
  const imageConstraint = selectedPack.imageConstraints.find((constraint) => constraint.id === imageTargetId) ?? selectedPack.imageConstraints[0]
  const imageKey = imageConstraint?.id ?? 'mechanics'
  const imageState = imageStates[imageKey] ?? emptyImageState
  const findings = useMemo(() => {
    if (!hasChecked) return []
    const current = runChecks(details, selectedPack)
    for (const constraint of selectedPack.imageConstraints) {
      const state = imageStates[constraint.id] ?? emptyImageState
      const measured = state.applied ? state.revalidation?.inspection : state.sourceInspection
      const valid = measured && checkImageConstraints(measured, constraint).length === 0
      current.push({
        id: `image-${constraint.id}`,
        state: !measured ? 'missing_information' : valid ? 'passed' : 'failed',
        title: `${constraint.label}: ${!measured ? 'file not checked' : valid ? 'file checks passed' : 'correction needed'}`,
        observed: measured ? `${measured.name}: ${measured.bytes} bytes, ${measured.width} × ${measured.height}px, ${measured.mime}` : 'No decoded image in this session',
        expected: constraint.label,
        explanation: 'Only the actual decoded file format and measured byte limit are checked. Content, appearance, identity and portal acceptance are not verified.',
        nextAction: !measured ? 'Open correction tools and choose an image.' : valid ? 'Review the image visually and retain the original.' : 'Resize/compress the image, then apply and revalidate the generated JPEG.',
        sourceIds: [constraint.sourceId],
        inputId: null,
      })
    }
    return current
  }, [hasChecked, details, selectedPack, imageStates])
  const unresolved = findings.filter((finding) => finding.state !== 'passed')
  const passed = findings.filter((finding) => finding.state === 'passed')
  const readinessLabel = findings.length === 0
    ? 'Not checked yet'
    : unresolved.length === 0
      ? 'All implemented checks passed'
      : 'Action needed before this is ready'

  const releasePreviews = () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrls.current.clear()
  }
  useEffect(() => () => { imageOperation.current += 1; releasePreviews() }, [])

  const createPreview = (blob: Blob) => {
    const url = URL.createObjectURL(blob)
    previewUrls.current.add(url)
    return url
  }

  const updateDetail = <K extends keyof ApplicantDetails>(key: K, value: ApplicantDetails[K]) => {
    setDetails((current) => ({ ...current, [key]: value }))
  }

  const updateImageState = (next: Partial<ImageState>) => {
    if ('previewUrl' in next && imageState.previewUrl && imageState.previewUrl !== next.previewUrl) {
      URL.revokeObjectURL(imageState.previewUrl)
      previewUrls.current.delete(imageState.previewUrl)
    }
    setImageStates((current) => ({ ...current, [imageKey]: { ...(current[imageKey] ?? emptyImageState), ...next } }))
  }

  const handleImageTargetChange = (id: string) => {
    imageOperation.current += 1
    if (imageState.busy) updateImageState({ busy: false })
    setImageTargetId(id)
    setImageOptions({ width: '', height: '', mode: 'contain' })
  }

  const handleRunChecks = () => {
    setHasChecked(true)
    setStep(3)
  }

  const handlePackChange = (id: string) => {
    imageOperation.current += 1
    setSelectedPackId(id)
    setHasChecked(false)
    releasePreviews()
    setImageStates({})
    setImageTargetId('')
    setImageOptions({ width: '', height: '', mode: 'contain' })
    setFeeSafeOpen(false)
    setFeeSafeLetter('')
  }

  const handleReset = () => {
    setStep(1)
    setSelectedPackId(rulePacks[0].id)
    setDetails(initialDetails())
    setHasChecked(false)
    imageOperation.current += 1
    releasePreviews()
    setImageStates({})
    setImageTargetId('')
    setImageOptions({ width: '', height: '', mode: 'contain' })
    setFeeSafeOpen(false)
    setFeeSafeStatusId('unknown')
    setFeeSafeStudent('')
    setFeeSafeCollege('')
    setFeeSafeUnresolved('')
    setFeeSafeLetter('')
    setFeeSafeProof([])
    setCopyMessage('')
  }

  const printSection = (target: 'report' | 'proof' | 'letter') => {
    const source = document.querySelector(`.print-${target}`)
    if (!source) return
    const surface = document.createElement('section')
    surface.id = 'print-surface'
    surface.append(source.cloneNode(true))
    document.body.append(surface)
    const cleanup = () => {
      document.body.removeAttribute('data-print-target')
      surface.remove()
      window.removeEventListener('afterprint', cleanup)
    }
    document.body.dataset.printTarget = target
    window.addEventListener('afterprint', cleanup)
    try { window.print() } catch { cleanup() }
  }

  const handleFile = async (candidate: File | undefined) => {
    if (!candidate) return
    const operation = ++imageOperation.current
    updateImageState({ busy: true, error: '', sourceFile: null, sourceInspection: null, processed: null, revalidation: null, previewUrl: null, applied: false })
    try {
      const inspection = await inspectImageFile(candidate)
      if (operation !== imageOperation.current) return
      const previewUrl = createPreview(candidate)
      updateImageState({ busy: false, sourceFile: candidate, sourceInspection: inspection, previewUrl })
    } catch (error) {
      if (operation !== imageOperation.current) return
      updateImageState({ busy: false, error: error instanceof Error ? error.message : 'The image could not be inspected.' })
    }
  }

  const handleSyntheticImage = async () => {
    const operation = ++imageOperation.current
    try {
      const file = await createSyntheticDemoImage()
      if (operation !== imageOperation.current) return
      await handleFile(file)
    } catch (error) {
      updateImageState({ error: error instanceof Error ? error.message : 'The synthetic image could not be created.' })
    }
  }

  const handleProcessImage = async () => {
    if (!imageState.sourceFile) return
    const operation = ++imageOperation.current
    updateImageState({ busy: true, error: '', processed: null, revalidation: null, applied: false })
    try {
      const processed = await processImageFile(imageState.sourceFile, {
        width: imageOptions.width ? Number(imageOptions.width) : undefined,
        height: imageOptions.height ? Number(imageOptions.height) : undefined,
        mode: imageOptions.mode,
        maxBytes: imageConstraint?.maxBytes,
        minBytes: imageConstraint?.minBytes,
      })
      if (operation !== imageOperation.current) return
      const previewUrl = createPreview(processed.blob)
      updateImageState({ busy: false, processed, previewUrl })
    } catch (error) {
      if (operation !== imageOperation.current) return
      updateImageState({ busy: false, error: error instanceof Error ? error.message : 'The image could not be corrected.' })
    }
  }

  const handleApplyImage = async () => {
    if (!imageState.processed) return
    const operation = ++imageOperation.current
    try {
      const revalidation = await revalidateImageBlob(imageState.processed.blob, {
        maxBytes: imageConstraint?.maxBytes,
        minBytes: imageConstraint?.minBytes,
      })
      if (operation !== imageOperation.current) return
      updateImageState({ revalidation, applied: true })
    } catch (error) {
      if (operation !== imageOperation.current) return
      updateImageState({ error: error instanceof Error ? error.message : 'The output could not be revalidated.' })
    }
  }

  const generateLetter = () => {
    setCopyMessage('')
    setFeeSafeLetter(generateFeeSafeLetter({
      studentName: feeSafeStudent || details.applicantName,
      collegeName: feeSafeCollege,
      applicationPath: selectedPack.applicationPath,
      status: getFeeSafeStatus(feeSafeStatusId),
      unresolved: feeSafeUnresolved,
      date: todayLabel,
    }))
  }

  const copyLetter = async () => {
    try {
      await navigator.clipboard.writeText(feeSafeLetter)
      setCopyMessage('Letter copied.')
    } catch {
      setCopyMessage('Copy unavailable. Select the editable letter and copy it manually.')
    }
  }

  return (
    <div className="app-shell">
      <main className="page-wrap">
        <section className="intro-grid">
          <div>
            <p className="kicker">READINESS WORKSPACE <span>/</span> 01</p>
            <h1>Know what differs.<br /><em>Know what to do next.</em></h1>
            <p className="intro-copy">Compare entered details, correct a supported image locally, and leave with a source-linked checklist. Nothing is submitted from this browser.</p>
          </div>
          <div className="intro-note">
            <span className="note-label">SCOPE NOTE</span>
            <p>This checker finds declared differences and missing inputs. It does not certify documents, eligibility, approval, or official acceptance.</p>
          </div>
        </section>

        <section className="workspace-layout">
          <aside className="side-rail">
            <div className="rail-heading">YOUR FLOW</div>
            <nav aria-label="Application checker steps">
              {['Select', 'Enter', 'Check', 'Correct', 'Report'].map((item, index) => {
                const number = index + 1
                return <button className={`step-item ${step === number ? 'active' : ''} ${step > number ? 'complete' : ''}`} key={item} onClick={() => number <= step && setStep(number)}><span className="step-number">0{number}</span><span>{item}</span>{step > number && <span className="step-check">✓</span>}</button>
              })}
            </nav>
            <div className="rail-footer"><div className="rail-heading">CURRENT PACK</div><strong>{selectedPack.name}</strong><span>{selectedPack.cycle} · {selectedPack.availability === 'verified-limited' ? 'Verified limited coverage' : 'Unavailable for real-use checking'}</span></div>
          </aside>

          <div className="workspace-main">
            <div className="workspace-header">
              <div><div className="section-count">0{step} / 05</div><h2>{['Choose the application path', 'Enter details from your documents', 'Review the checks', 'Correct and recheck', 'Save the readiness report'][step - 1]}</h2></div>
              <div className="workspace-status"><span className={`status-dot ${findings.length ? (unresolved.length ? 'dot-warning' : 'dot-good') : ''}`} /> {readinessLabel}</div>
            </div>

            {step === 1 && <SelectionStep selectedPack={selectedPack} selectedPackId={selectedPackId} onSelect={handlePackChange} />}
            {step === 2 && <><button className="button button-secondary demo-button" onClick={() => setDetails(demoDetails())}>Load synthetic sample details</button><EntryStep details={details} updateDetail={updateDetail} pack={selectedPack} /></>}
            {step === 3 && <FindingsStep findings={findings} pack={selectedPack} onGoToEntry={() => setStep(2)} />}
            {step === 4 && <><label className="field target-selector"><span>Image to check</span><select aria-label="Image to check" value={imageKey} onChange={(event) => handleImageTargetChange(event.target.value)}>{selectedPack.imageConstraints.length ? selectedPack.imageConstraints.map((constraint) => <option key={constraint.id} value={constraint.id}>{constraint.label}</option>) : <option value="mechanics">Local image mechanics only</option>}</select></label><CorrectionStep findings={findings} details={details} updateDetail={updateDetail} imageConstraint={imageConstraint} imageOptions={imageOptions} setImageOptions={(next) => { imageOperation.current += 1; updateImageState({ processed: null, revalidation: null, applied: false, busy: false }); setImageOptions(next) }} imageState={imageState} onFile={handleFile} onSynthetic={handleSyntheticImage} onProcess={handleProcessImage} onApply={handleApplyImage} onDownload={() => imageState.processed && downloadBlob(imageState.processed.blob, imageState.processed.name)} /></>}
            {step === 5 && <ReportStep findings={findings} pack={selectedPack} details={details} imageState={imageState} onPrint={() => printSection('report')} />}

            <div className="workspace-actions">
              {step > 1 && <button className="button button-quiet" onClick={() => setStep(step - 1)}>Back</button>}
              <div className="action-spacer" />
              {step === 1 && <button className="button button-primary" onClick={() => setStep(2)}>Continue to details <span>→</span></button>}
              {step === 2 && <button className="button button-primary" onClick={handleRunChecks}>Run checks <span>→</span></button>}
              {step === 3 && <><button className="button button-secondary" onClick={() => setStep(4)}>Open correction tools</button><button className="button button-primary" onClick={() => setStep(5)}>Go to report <span>→</span></button></>}
              {step === 4 && <><button className="button button-secondary" onClick={handleRunChecks}>Re-run affected checks</button><button className="button button-primary" onClick={() => setStep(5)}>Review report <span>→</span></button></>}
              {step === 5 && <button className="button button-primary" onClick={() => printSection('report')}>Print / save PDF <span>↗</span></button>}
            </div>
          </div>
        </section>

        {findings.length > 0 && selectedPack.id === 'telangana-epass-fresh-2026-27' && <FeeSafePanel open={feeSafeOpen} onToggle={() => setFeeSafeOpen((current) => !current)} statusId={feeSafeStatusId} onStatusChange={setFeeSafeStatusId} student={feeSafeStudent} onStudent={setFeeSafeStudent} college={feeSafeCollege} onCollege={setFeeSafeCollege} unresolved={feeSafeUnresolved} onUnresolved={setFeeSafeUnresolved} proof={feeSafeProof} onProof={setFeeSafeProof} letter={feeSafeLetter} onLetter={setFeeSafeLetter} onGenerate={generateLetter} onCopy={copyLetter} copyMessage={copyMessage} onPrintProof={() => printSection('proof')} onPrintLetter={() => printSection('letter')} />}

        <footer className="site-footer"><span>APPLYREADY + FEESAFE / MVP PREVIEW</span><span>Local-first · No account required · {todayLabel}</span></footer>
      </main>
    </div>
  )
}

function SelectionStep({ selectedPack, selectedPackId, onSelect }: { selectedPack: RulePack; selectedPackId: string; onSelect: (id: string) => void }) {
  return <div className="step-content selection-content">
    <div className="step-lead"><span className="lead-number">01</span><p>Pick one isolated rule pack. A pack stays unavailable when its official requirements have not been reviewed well enough to support real-use checking.</p></div>
    <div className="pack-list">{rulePacks.map((pack) => <label className={`pack-option ${selectedPackId === pack.id ? 'selected' : ''}`} key={pack.id}><input type="radio" name="pack" checked={selectedPackId === pack.id} onChange={() => onSelect(pack.id)} /><span className="radio-mark" /><span className="pack-details"><strong>{pack.name}</strong><span>{pack.applicationPath}</span><small>{pack.coverage}</small></span><span className={`pack-status ${pack.availability}`}>{pack.availability === 'verified-limited' ? 'Verified limited' : 'Unavailable'}</span></label>)}</div>
    <div className="coverage-grid"><div><span className="mini-label">PORTAL</span><strong>{selectedPack.portal}</strong></div><div><span className="mini-label">REVIEWED</span><strong>{selectedPack.reviewedOn}</strong></div><div><span className="mini-label">SOURCES</span><strong>{selectedPack.sources.length ? `${selectedPack.sources.length} source records · ${selectedPack.sources.filter((source) => source.verification === 'verified').length} verified` : 'No source record selected'}</strong></div></div>
    <div className="source-ledger compact-ledger"><div className="mini-label">PACK LIMITATIONS</div><ul>{selectedPack.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></div>
  </div>
}

function EntryStep({ details, updateDetail, pack }: { details: ApplicantDetails; pack: RulePack; updateDetail: <K extends keyof ApplicantDetails>(key: K, value: ApplicantDetails[K]) => void }) {
  return <div className="step-content entry-content">
    <div className="step-lead"><span className="lead-number">02</span><p>Enter what you can read from the original documents. Unknown is a valid state; it is not the same as passed. Do not enter full Aadhaar or bank numbers.</p></div>
    <div className="form-section"><div className="form-section-heading"><span>01</span><div><h3>Identity document</h3><p>Compare the student-entered value with the value on the document.</p></div></div><div className="form-grid"><TextField label="Applicant name" value={details.applicantName} onChange={(value) => updateDetail('applicantName', value)} /><TextField label="Name on document" value={details.documentName} onChange={(value) => updateDetail('documentName', value)} /><TextField label="Applicant date of birth" type="date" value={details.applicantDob} onChange={(value) => updateDetail('applicantDob', value)} /><TextField label="Date on document" type="date" value={details.documentDob} onChange={(value) => updateDetail('documentDob', value)} /></div></div>
    {pack.id === 'telangana-epass-fresh-2026-27' && <div className="form-section"><div className="form-section-heading"><span>02</span><div><h3>Selected path context</h3><p>The selected ePASS source makes the certificate condition and bank exception category-dependent.</p></div></div><div className="form-grid"><TextField label="Income certificate date" type="date" value={details.certificateDate} onChange={(value) => updateDetail('certificateDate', value)} /><SelectField label="Category" value={details.category} onChange={(value) => updateDetail('category', value as ApplicantDetails['category'])} options={['Other', 'EBC', 'unknown']} /><SelectField label="Income certificate" value={details.incomeCertificate} onChange={(value) => updateDetail('incomeCertificate', value as ApplicantDetails['incomeCertificate'])} options={['available', 'unknown', 'not_available']} /><SelectField label="Bank-account document" value={details.bankAccount} onChange={(value) => updateDetail('bankAccount', value as ApplicantDetails['bankAccount'])} options={['available', 'unknown', 'not_available']} /></div></div>}
  </div>
}

function TextField({ label, type = 'text', value, onChange, helper }: { label: string; type?: string; value: string; onChange: (value: string) => void; helper?: string }) { return <label className="field"><span>{label}</span><input aria-label={label} type={type} value={value} onChange={(event) => onChange(event.target.value)} />{helper && <small>{helper}</small>}</label> }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) { return <label className="field"><span>{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option === 'not_available' ? 'Not available' : option[0].toUpperCase() + option.slice(1)}</option>)}</select></label> }

function FindingsStep({ findings, pack, onGoToEntry }: { findings: Finding[]; pack: RulePack; onGoToEntry: () => void }) {
  if (!findings.length) return <EmptyState title="No checks have run yet" text="Return to the details step and run the selected rule pack." />
  return <div className="step-content findings-content"><div className="result-summary"><div className="summary-number">{findings.filter((finding) => finding.state === 'passed').length}<span>/{findings.length}</span></div><div><strong>{findings.some((finding) => finding.state !== 'passed') ? 'Review the unresolved items below' : 'All implemented checks passed'}</strong><p>Every result shows the observed value, expected condition, source record, and next action.</p></div></div><div className="findings-list">{findings.map((finding) => <FindingCard key={finding.id} finding={finding} pack={pack} />)}</div><SourceLedger pack={pack} /><button className="inline-link" onClick={onGoToEntry}>← Edit entered details</button></div>
}

function FindingCard({ finding, pack }: { finding: Finding; pack: RulePack }) { const meta = stateMeta[finding.state]; return <article className={`finding-card ${meta.className}`}><div className="finding-top"><span className="result-label"><i />{meta.label}</span><span className="finding-id">CHECK / {finding.id}</span></div><h3>{finding.title}</h3><div className="finding-grid"><div><span className="mini-label">OBSERVED</span><p>{finding.observed}</p></div><div><span className="mini-label">EXPECTED</span><p>{finding.expected}</p></div></div><p className="finding-explanation">{finding.explanation}</p><div className="finding-action"><span className="mini-label">NEXT ACTION</span><strong>{finding.nextAction}</strong></div><div className="finding-source">Source: {finding.sourceIds.map((id) => pack.sources.find((source) => source.id === id)?.title ?? id).join(' · ') || 'No source-backed rule; review required'}</div></article> }

function SourceLedger({ pack }: { pack: RulePack }) { return <div className="source-ledger"><div className="ledger-header"><span className="mini-label">SOURCE LEDGER</span><strong>{pack.reviewedOn} · {pack.portal} · {pack.cycle}</strong></div>{pack.sources.map((source) => <div className="source-row" key={source.id}><span className={`verification-chip ${source.verification}`}>{source.verification}</span><div><strong>{source.title}</strong><p>{source.section}. {source.note}</p><a href={source.url} target="_blank" rel="noreferrer">Open official source ↗</a></div></div>)}</div> }

function CorrectionStep({ findings, details, updateDetail, imageConstraint, imageOptions, setImageOptions, imageState, onFile, onSynthetic, onProcess, onApply, onDownload }: { findings: Finding[]; details: ApplicantDetails; updateDetail: <K extends keyof ApplicantDetails>(key: K, value: ApplicantDetails[K]) => void; imageConstraint?: ImageConstraint; imageOptions: { width: string; height: string; mode: FitMode }; setImageOptions: (value: { width: string; height: string; mode: FitMode }) => void; imageState: ImageState; onFile: (file: File | undefined) => void; onSynthetic: () => void; onProcess: () => void; onApply: () => void; onDownload: () => void }) {
  const mismatch = findings.find((finding) => finding.id.includes('name') || finding.id.includes('dob'))
  return <div className="step-content correction-content"><div className="step-lead"><span className="lead-number">04</span><p>Correct a transcription error here, then re-run the checks. The local image tool produces a measurable JPEG output, downloads it, applies it back to this session, and revalidates it.</p></div><div className="correction-panel"><div className="correction-header"><span className="tool-icon">↻</span><div><h3>Transcription correction</h3><p>{mismatch ? mismatch.title : 'Use this panel to recheck entered values.'}</p></div></div><div className="form-grid"><TextField label="Applicant name" value={details.applicantName} onChange={(value) => updateDetail('applicantName', value)} /><TextField label="Name on document" value={details.documentName} onChange={(value) => updateDetail('documentName', value)} /><TextField label="Applicant date of birth" type="date" value={details.applicantDob} onChange={(value) => updateDetail('applicantDob', value)} /><TextField label="Date on document" type="date" value={details.documentDob} onChange={(value) => updateDetail('documentDob', value)} /></div><p className="panel-note">Findings update when you edit. Use “Re-run affected checks” to review them together.</p></div><ImageTool constraint={imageConstraint} options={imageOptions} setOptions={setImageOptions} state={imageState} onFile={onFile} onSynthetic={onSynthetic} onProcess={onProcess} onApply={onApply} onDownload={onDownload} /></div>
}

function ImageTool({ constraint, options, setOptions, state, onFile, onSynthetic, onProcess, onApply, onDownload }: { constraint?: ImageConstraint; options: { width: string; height: string; mode: FitMode }; setOptions: (value: { width: string; height: string; mode: FitMode }) => void; state: ImageState; onFile: (file: File | undefined) => void; onSynthetic: () => void; onProcess: () => void; onApply: () => void; onDownload: () => void }) {
  const onInput = (event: ChangeEvent<HTMLInputElement>) => { onFile(event.target.files?.[0]); event.currentTarget.value = '' }
  return <div className="image-tool-panel"><div className="image-tool-heading"><span className="tool-icon">IMG</span><div><div className="tool-title-row"><h3>Local image correction</h3><span className={`pack-status ${constraint ? 'verified-limited' : 'unavailable'}`}>{constraint ? 'Source-backed target' : 'Mechanics only'}</span></div><p>{constraint ? `${constraint.label}. ${constraint.limitation}` : 'No portal-specific limit is verified for this pack. You can still inspect and test a synthetic image.'}</p></div></div><div className="image-controls"><label className="file-picker"><span>{state.sourceFile ? 'Choose another image' : 'Choose image'}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={onInput} /></label><button className="button button-secondary" onClick={onSynthetic}>Use synthetic demo</button></div>{state.error && <div className="image-error" role="alert">{state.error}</div>}{state.sourceInspection && <div className="image-inspection"><div><span className="mini-label">INPUT</span><strong>{state.sourceInspection.name}</strong><span>{Math.round(state.sourceInspection.bytes / 1024)} KB · {state.sourceInspection.width} × {state.sourceInspection.height}px · {state.sourceInspection.mime}</span></div>{state.previewUrl && <img src={state.previewUrl} alt="Current local image preview" />}</div>}<div className="image-options"><TextField label="Output width (optional)" type="number" value={options.width} onChange={(value) => setOptions({ ...options, width: value })} helper="Leave blank to preserve source width." /><TextField label="Output height (optional)" type="number" value={options.height} onChange={(value) => setOptions({ ...options, height: value })} helper="With both set, contain or crop to that box." /><SelectField label="Fit mode" value={options.mode} onChange={(value) => setOptions({ ...options, mode: value as FitMode })} options={['contain', 'cover']} /><div className="target-box"><span className="mini-label">RECHECK TARGET</span><strong>{constraint?.maxBytes ? `Maximum ${Math.round(constraint.maxBytes / 1024)} KB` : 'No verified byte limit'}</strong><span>{constraint?.label ?? 'Synthetic mechanics only'}</span></div></div><div className="image-actions"><button className="button button-primary" onClick={onProcess} disabled={!state.sourceFile || state.busy}>{state.busy ? 'Working…' : 'Resize + compress'}</button>{state.processed && <><button className="button button-secondary" onClick={onApply}>Apply + revalidate</button><button className="button button-secondary" onClick={onDownload}>Download JPEG</button></>}</div>{state.processed && <div className={`image-result ${!constraint ? 'neutral' : state.revalidation?.valid || state.processed.meetsTarget ? 'valid' : 'invalid'}`}><strong>{state.processed.name}</strong><span>{Math.round(state.processed.bytes / 1024)} KB · {state.processed.width} × {state.processed.height}px · quality {Math.round(state.processed.quality * 100)}%</span><p>{state.revalidation ? !constraint ? 'Output decoded successfully. No portal compliance target is configured.' : state.revalidation.valid ? 'Applied output passes the selected revalidation target.' : state.revalidation.issues.join(' ') : state.processed.message}</p></div>}</div>
}

function ReportStep({ findings, pack, details, imageState, onPrint }: { findings: Finding[]; pack: RulePack; details: ApplicantDetails; imageState: ImageState; onPrint: () => void }) {
  const unresolved = findings.filter((finding) => finding.state !== 'passed').length
  return <div className="step-content report-content"><div className="report-paper print-report"><div className="report-header"><div><span className="kicker">READINESS REPORT</span><h3>{pack.name}</h3><p>Generated {todayLabel} · Session-only data · {pack.availability === 'verified-limited' ? 'Verified limited coverage' : 'Unavailable pack'}</p></div><div className={`report-badge ${unresolved ? 'attention' : ''}`}>{unresolved ? 'ACTION NEEDED' : 'READY TO REVIEW'}</div></div><div className="report-context"><div><span className="mini-label">PORTAL</span><strong>{pack.portal}</strong></div><div><span className="mini-label">CYCLE</span><strong>{pack.cycle}</strong></div><div><span className="mini-label">PACK REVIEW</span><strong>{pack.reviewedOn}</strong></div></div><div className="report-person"><span className="mini-label">APPLICANT</span><strong>{details.applicantName || 'Not entered'}</strong></div><div className="report-findings">{findings.length ? findings.map((finding) => <div className="report-row" key={finding.id}><span className={`state-chip ${stateMeta[finding.state].className}`}>{stateMeta[finding.state].label}</span><div><strong>{finding.title}</strong><p>Observed: {finding.observed}</p><p>Expected: {finding.expected}</p><p>{finding.nextAction}</p></div></div>) : <p>No checks have been run.</p>}</div><div className="report-limitations"><span className="mini-label">LIMITATIONS</span><ul>{pack.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></div><ReportChecklist /><SourceLedger pack={pack} /></div><div className="report-actions"><p className="report-tip">Reports may contain entered personal details. Saving, printing, and sharing remain explicit student actions.</p><button className="inline-link" onClick={onPrint}>Print this report ↗</button></div></div>
}

function ReportChecklist() {
  const [checked, setChecked] = useState<string[]>([])
  const items = ['Compared entries with the original documents', 'Reviewed the official cycle and any category exceptions', 'Checked the image visually and saved the corrected file', 'Reviewed unresolved items before using the official portal']
  return <section className="report-checklist"><h4>Before you submit</h4><p>These are your own review notes; this app does not submit anything.</p>{items.map((item) => <label key={item}><input type="checkbox" checked={checked.includes(item)} onChange={() => setChecked((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])} /><span>{item}</span></label>)}</section>
}

function FeeSafePanel({ open, onToggle, statusId, onStatusChange, student, onStudent, college, onCollege, unresolved, onUnresolved, proof, onProof, letter, onLetter, onGenerate, onCopy, copyMessage, onPrintProof, onPrintLetter }: { open: boolean; onToggle: () => void; statusId: FeeSafeStatusId; onStatusChange: (value: FeeSafeStatusId) => void; student: string; onStudent: (value: string) => void; college: string; onCollege: (value: string) => void; unresolved: string; onUnresolved: (value: string) => void; proof: string[]; onProof: (value: string[]) => void; letter: string; onLetter: (value: string) => void; onGenerate: () => void; onCopy: () => void; copyMessage: string; onPrintProof: () => void; onPrintLetter: () => void }) {
  const status = getFeeSafeStatus(statusId)
  const toggleProof = (id: string) => onProof(proof.includes(id) ? proof.filter((item) => item !== id) : [...proof, id])
  return <section className={`feesafe-shell ${open ? 'open' : ''}`}><div className="feesafe-banner"><div className="feesafe-symbol">FS</div><div className="feesafe-copy"><span className="kicker">OPTIONAL FOLLOW-UP</span><h3>FeeSafe stays narrow and source-linked.</h3><p>Use a reviewed status explanation, select the evidence you already hold, and draft a respectful factual letter. It does not calculate entitlement or promise a result.</p></div><button className="button button-light" onClick={onToggle}>{open ? 'Hide FeeSafe' : 'Open FeeSafe'} <span>↗</span></button></div>{open && <div className="feesafe-grid"><div className="feesafe-card"><div className="card-heading"><span className="mini-label">01 / STATUS GUIDE</span><strong>What does the portal message say?</strong></div><label className="field"><span>Student-entered status</span><select aria-label="Student-entered status" value={statusId} onChange={(event) => onStatusChange(event.target.value as FeeSafeStatusId)}>{feeSafeStatuses.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label><div className="status-explanation"><span className="result-label"><i />{status.statusWord}</span><p>{status.meaning}</p><strong>Next action: {status.nextAction}</strong><small>{status.uncertainty}</small></div><div className="evidence-list"><span className="mini-label">EVIDENCE TO KEEP</span>{status.evidence.map((item) => <div key={item}>· {item}</div>)}</div></div><div className="feesafe-card print-proof"><div className="card-heading"><span className="mini-label">02 / PROOF KIT</span><strong>Make a small, private checklist.</strong></div><div className="proof-list">{proofKitItems.map((item) => <label key={item.id} className="proof-item"><input type="checkbox" checked={proof.includes(item.id)} onChange={() => toggleProof(item.id)} /><span className="check-box">{proof.includes(item.id) ? '✓' : ''}</span><span><strong>{item.label}</strong><small>{item.detail}</small></span></label>)}</div><p className="source-note">{feeSafeSourceNote}</p><button className="button button-secondary" onClick={onPrintProof}>Print proof-kit ↗</button></div><div className="feesafe-card letter-card"><div className="card-heading"><span className="mini-label">03 / REPRESENTATION LETTER</span><strong>Keep it factual and editable.</strong></div><div className="form-grid"><TextField label="Student name" value={student} onChange={onStudent} /><TextField label="College / institution" value={college} onChange={onCollege} /></div><label className="field letter-field"><span>Unresolved note</span><textarea value={unresolved} onChange={(event) => onUnresolved(event.target.value)} placeholder="What still needs official guidance?" rows={3} /></label><div className="letter-actions"><button className="button button-primary" onClick={onGenerate}>Generate editable letter</button>{letter && <button className="button button-secondary" onClick={onCopy}>Copy letter</button>}{letter && <button className="button button-secondary" onClick={onPrintLetter}>Print letter ↗</button>}</div>{copyMessage && <p role="status" className="panel-note">{copyMessage}</p>}{letter && <><textarea className="letter-output" value={letter} onChange={(event) => onLetter(event.target.value)} rows={13} aria-label="Editable FeeSafe letter" /><article className="print-letter letter-print-copy">{letter}</article></>}</div></div>}</section>
}

function EmptyState({ title, text }: { title: string; text: string }) { return <div className="empty-state"><span className="empty-mark">—</span><h3>{title}</h3><p>{text}</p></div> }

