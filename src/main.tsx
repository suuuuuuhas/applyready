import { lazy, StrictMode, Suspense, useState } from 'react'
import { createRoot } from 'react-dom/client'
import UploadWorkspace from './upload-workspace'
import './styles.css'
import './upload-workspace.css'

const DetailsWorkspace = lazy(() => import('./details-workspace'))
function App() {
  const [view, setView] = useState<'upload' | 'details'>('upload')
  const [session, setSession] = useState(0)
  return <>
    <header className="topbar product-topbar"><a className="brand-lockup" href="#" onClick={event => { event.preventDefault(); setView('upload') }} aria-label="ApplyReady home"><span className="brand-mark" aria-hidden="true">A</span><span><span className="brand-name">ApplyReady</span><span className="brand-caption">Prepare the file. Keep the original.</span></span></a><div className="header-actions"><span className="privacy-pill"><span className="privacy-dot" /> Images stay on your device</span><button className="button button-quiet" onClick={() => setSession(value => value + 1)}>Clear session</button></div></header>
    <nav className="product-nav page-wrap" aria-label="Workspace"><button aria-current={view === 'upload' ? 'page' : undefined} onClick={() => setView('upload')}>Photo & signature tools</button><button aria-current={view === 'details' ? 'page' : undefined} onClick={() => setView('details')}>Details checklist & FeeSafe</button><a href="https://github.com/suuuuuuhas/applyready" target="_blank" rel="noreferrer">Source & rule contributions ↗</a></nav>
    <div key={session}><div hidden={view !== 'upload'}><UploadWorkspace /></div>{view === 'details' && <div className="details-view"><Suspense fallback={<p className="page-wrap">Loading checklist…</p>}><DetailsWorkspace key={session} /></Suspense></div>}</div>
  </>
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
