import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HugeiconsIcon } from '@hugeicons/react'
import { FolderOpenIcon, PlayIcon, SparklesIcon, Shield01Icon, ArrowRight01Icon, Tick02Icon, Alert01Icon, Search01Icon } from '@hugeicons/core-free-icons'
import CallChip from './components/CallChip.jsx'
import LatticeLoader from './components/LatticeLoader.jsx'
import ThoughtLine from './components/ThoughtLine.jsx'
import BeamCard from './components/BeamCard.jsx'
import { BorderBeam } from './components/BorderBeam.jsx'
import SpecularButton from './components/SpecularButton.jsx'
import DecryptedText from './components/DecryptedText.jsx'
import CardNav from './components/CardNav.jsx'
import LineSidebar from './components/LineSidebar.jsx'
import SquishSwitch from './components/SquishSwitch.jsx'
import Scanner from './components/Scanner.jsx'
import './app.css'

const byId = (id) => document.getElementById(id)
const safeRead = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback)) } catch { return fallback } }
const getPlan = (text) => {
  const json = text.match(/```json\s*([\s\S]*?)```/)?.[1] ?? text.match(/\{[\s\S]*\}/)?.[0]
  if (!json) return null
  try { return JSON.parse(json) } catch { return null }
}
const codexBlocked = (text) => /(?:blocked|rejected|denied).{0,80}(?:execution policy|project files|workspace)|(?:execution policy|workspace policy).{0,80}(?:blocked|rejected|denied)|session (?:also )?prohibits? writes|could not inspect code|files changed:\s*none[\s\S]{0,240}tests run:\s*none/i.test(text)
const escapeText = (value) => String(value ?? '')
const specularButtonProps = {
  size: 'sm',
  radius: 8,
  tint: '#ffffff',
  tintOpacity: 0.04,
  textColor: '#f5f5f5',
  lineColor: '#ffffff',
  baseColor: '#525252',
  intensity: 1,
  idleIntensity: 0.35,
  shineSize: 10,
  shineFade: 34,
  thickness: 1.2,
  glow: 1,
  followMouse: true,
  proximity: 250,
}

function ConfirmDialog({ value, onAnswer }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    if (value && dialog && !dialog.open) dialog.showModal()
    if (!value && dialog?.open) dialog.close()
  }, [value])
  return <dialog ref={ref} className="confirm-dialog" onCancel={(event) => { event.preventDefault(); onAnswer(false) }}>
    {value && <div className="confirm-surface"><span className="eyebrow">PLEASE CONFIRM</span><h2>{value.title}</h2><p>{value.message}</p><div className="confirm-actions"><SpecularButton {...specularButtonProps} className="button secondary" autoFocus onClick={() => onAnswer(false)}>Cancel</SpecularButton><SpecularButton {...specularButtonProps} className="button primary" onClick={() => onAnswer(true)}>{value.confirmLabel || 'Continue'}</SpecularButton></div><BorderBeam size={60} transition={{ duration: 8 }} /></div>}
  </dialog>
}

function App() {
  const [tab, setTab] = useState('run')
  const [project, setProject] = useState(null)
  const [catalog, setCatalog] = useState([])
  const [bundles, setBundles] = useState([])
  const [scripts, setScripts] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [bundle, setBundle] = useState('all')
  const [search, setSearch] = useState('')
  const [isolate, setIsolate] = useState(() => safeRead('osien-isolate', true))
  const [status, setStatus] = useState('ready')
  const [results, setResults] = useState([])
  const [events, setEvents] = useState([])
  const [output, setOutput] = useState('')
  const [history, setHistory] = useState(() => { const value = safeRead('osien-history', []); return Array.isArray(value) ? value : [] })
  const [codex, setCodex] = useState({ available: false, signedIn: false, text: 'Checking Codex…' })
  const [codexConnected, setCodexConnected] = useState(false)
  const [busy, setBusy] = useState(null)
  const [aiStream, setAiStream] = useState('')
  const [activeCall, setActiveCall] = useState(null)
  const [runItems, setRunItems] = useState([])
  const [fileQuery, setFileQuery] = useState('')
  const [activeFile, setActiveFile] = useState(null)
  const [jobId, setJobId] = useState(null)
  const [workingDirectory, setWorkingDirectory] = useState(null)
  const [isolated, setIsolated] = useState(false)
  const [fixReport, setFixReport] = useState('')
  const [fixOutput, setFixOutput] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const confirmResolve = useRef(null)
  const aiId = useRef(null)

  const ask = useCallback((options) => new Promise((resolve) => { confirmResolve.current = resolve; setConfirmation(options) }), [])
  const answer = (yes) => { const resolve = confirmResolve.current; confirmResolve.current = null; setConfirmation(null); resolve?.(yes) }

  const loadProject = useCallback(async (directory) => {
    const inspected = await window.osien.inspectProject(directory)
    setProject(inspected)
    setCatalog(inspected.library)
    setBundles(inspected.bundles)
    setScripts(inspected.detected)
    setFileQuery('')
    setActiveFile(null)
    setSelected(new Set())
    setResults([])
    setFixReport('')
    setFixOutput('')
    setEvents([])
    setOutput('')
    localStorage.setItem('osien-project', directory)
  }, [])

  const chooseProject = async () => {
    try {
      const directory = await window.osien.chooseProject()
      if (directory) await loadProject(directory)
    } catch (error) { setOutput(`Project scan failed: ${error.message}`) }
  }

  useEffect(() => {
    const saved = localStorage.getItem('osien-project')
    if (saved) loadProject(saved).catch(() => localStorage.removeItem('osien-project'))
    window.osien.aiStatus().then((value) => setCodex({ available: value.available, signedIn: value.signedIn, text: value.message })).catch((error) => setCodex({ available: false, signedIn: false, text: error.message }))
    const offOutput = window.osien.onOutput((message) => {
      if (jobId && message.id !== jobId) return
      if (message.phase === 'start') {
        setActiveCall({ name: message.test, argument: message.data.trim().split(/\r?\n/).at(-1)?.slice(0, 90) || 'checking', status: 'running' })
        setRunItems((items) => items.map((item) => item.name === message.test ? { ...item, status: 'running' } : item))
      } else if (message.phase === 'complete') {
        setRunItems((items) => items.map((item) => item.name === message.test ? { ...item, status: message.status === 'passed' ? 'done' : ['finding', 'failed'].includes(message.status) ? 'error' : 'idle' } : item))
      }
      setOutput((current) => `${current}${message.data}`.slice(-30000))
    })
    const offComplete = window.osien.onComplete((event) => {
      if (jobId && event.id !== jobId) return
      setJobId(null)
      setStatus(event.cancelled ? 'cancelled' : event.error || event.results.some((item) => item.status === 'failed') ? 'error' : event.results.some((item) => item.status === 'finding') ? 'review' : 'done')
      setResults(event.results)
      setRunItems(event.results.map((item) => ({ id: item.id, name: item.name, argument: item.command || 'Built-in check', status: item.status === 'passed' ? 'done' : ['failed', 'finding'].includes(item.status) ? 'error' : 'idle' })))
      setWorkingDirectory(event.workingDirectory)
      setIsolated(event.isolated)
      setActiveCall(null)
      const report = event.results.filter((item) => ['failed', 'finding'].includes(item.status)).map((item) => `${item.name} (${item.status}): ${item.detail || `exit code ${item.code}`}`).join('\n')
      setFixReport(report)
      setEvents((items) => [...items, { kind: 'run', title: 'Checks finished', detail: `${event.results.length} checks · ${event.results.filter((x) => x.status === 'passed').length} passed`, at: new Date().toISOString() }])
      const entry = { at: new Date().toISOString(), project: project?.directory, count: event.results.length, passed: event.results.filter((x) => x.status === 'passed').length, failed: event.results.filter((x) => ['finding', 'failed'].includes(x.status)).length, cancelled: Boolean(event.cancelled) }
      setHistory((items) => { const next = [entry, ...items].slice(0, 30); localStorage.setItem('osien-history', JSON.stringify(next)); return next })
      if (event.error) setOutput((current) => `${current}\n${event.error}`.slice(-30000))
    })
    const offAI = window.osien.onAIOutput((message) => {
      if (!busy || (aiId.current && message.id !== aiId.current)) return
      setAiStream((current) => `${current}${message.data}`.slice(-12000))
    })
    return () => { offOutput?.(); offComplete?.(); offAI?.() }
  }, [loadProject, jobId, project?.directory, busy])

  const extensions = useMemo(() => new Set(project?.extensions ?? []), [project])
  const visibleProjectFiles = useMemo(() => {
    const query = fileQuery.trim().toLowerCase()
    return (project?.files ?? []).filter((file) => file.toLowerCase().includes(query)).slice(0, 120)
  }, [project, fileQuery])
  const visibleChecks = useMemo(() => {
    const query = search.trim().toLowerCase()
    return catalog.filter((item) => (bundle === 'all' || item.bundle === bundle) && extensions.has(item.extension) && `${item.name} ${item.explanation} ${item.language}`.toLowerCase().includes(query)).slice(0, 120)
  }, [catalog, bundle, extensions, search])
  const checksToShow = bundle === 'commands'
    ? scripts.filter((item) => `${item.name} ${item.command}`.toLowerCase().includes(search.trim().toLowerCase()))
    : visibleChecks

  const toggleCheck = (id) => setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })
  const chooseAllVisible = () => setSelected((current) => new Set([...current, ...checksToShow.map((item) => item.id)]))

  const runSelected = async () => {
    if (!project || !selected.size || busy) return
    const selectedItems = [...selected].map((id) => {
      const item = catalog.find((entry) => entry.id === id) ?? scripts.find((entry) => entry.id === id)
      return item ? { id, name: item.name, argument: item.command || 'Built-in check', status: 'idle' } : null
    }).filter(Boolean)
    const commands = scripts.filter((item) => selected.has(item.id))
    if (commands.length && !await ask({ title: 'Run project commands?', message: `${commands.map((item) => item.command).join('\n')}\n\nThese commands are defined by the project and may have side effects. Run them only if you trust this project.`, confirmLabel: 'Run commands' })) return
    setRunItems(selectedItems); setBusy('tests'); setStatus('running'); setResults([]); setOutput('Preparing selected checks…'); setActiveCall({ name: 'OSIEN', argument: 'preparing test run', status: 'running' })
    setEvents((items) => [...items, { kind: 'run', title: 'Test run started', detail: `${selected.size} selected checks`, at: new Date().toISOString() }])
    try {
      const response = await window.osien.runTests({ directory: project.directory, tests: [...selected], isolate })
      setJobId(response.id); setWorkingDirectory(response.workingDirectory); setIsolated(response.isolated)
    } catch (error) {
      setBusy(null); setStatus('error'); setActiveCall(null); setOutput(`Could not start test run: ${error.message}`)
    }
  }

  useEffect(() => { if (status !== 'running') setBusy((current) => current === 'tests' ? null : current) }, [status])

  const stopRun = async () => { if (jobId) await window.osien.cancelRun(jobId) }

  const analyze = async () => {
    if (!project || busy) return
    const ok = await ask({ title: 'Share a project snapshot?', message: 'Codex receives the project file list and up to 24 redacted source excerpts (up to 30,000 characters). Secret-named files are excluded.', confirmLabel: 'Continue to Codex' })
    if (!ok) return
    aiId.current = null; setCodexConnected(false); setBusy('analyze'); setAiStream(''); setStatus('planning'); setOutput('Codex is preparing a focused plan…')
    setEvents((items) => [...items, { kind: 'ai', title: 'Codex is planning checks', detail: project.name, at: new Date().toISOString() }])
    try {
      const response = await window.osien.analyze({ directory: project.directory, results })
      aiId.current = response.id; setCodexConnected(true)
      const plan = getPlan(response.text)
      if (response.code !== 0 || !plan) {
        setStatus('error'); setAiStream(response.text.slice(-3000)); setOutput(response.code ? 'Codex could not complete its plan.' : 'Codex did not return a usable plan.')
        return
      }
      const validBundles = [...new Set(plan.bundles ?? [])].filter((id) => bundles.some((item) => item.id === id)).slice(0, 2)
      const byRule = new Map()
      for (const item of catalog) if (validBundles.includes(item.bundle) && extensions.has(item.extension) && !byRule.has(`${item.bundle}:${item.rule}`)) byRule.set(`${item.bundle}:${item.rule}`, item)
      const planTests = [...byRule.values()].slice(0, 10).map((item) => item.id)
      const planScripts = scripts.filter((item) => (plan.scripts ?? []).includes(item.id)).slice(0, 2).map((item) => item.id)
      setSelected(new Set([...planTests, ...planScripts])); setBundle(validBundles[0] ?? 'all')
      setOutput(`Focused plan ready · ${planTests.length + planScripts.length} checks selected.`)
      setEvents((items) => [...items, { kind: 'ai', title: 'Focused plan ready', detail: validBundles.map((id) => bundles.find((x) => x.id === id)?.name).filter(Boolean).join(' · '), at: new Date().toISOString() }])
      setStatus('done')
      setAiStream(JSON.stringify({ summary: plan.summary, bundles: validBundles, gaps: (plan.gaps ?? []).slice(0, 3) }, null, 2))
    } catch (error) { setStatus('error'); setOutput(`Codex analysis failed: ${error.message}`) }
    finally { setBusy(null) }
  }

  const askCodexToFix = async () => {
    if (!project || busy) return
    const target = isolated && workingDirectory ? workingDirectory : project.directory
    if (!await ask({ title: 'Let Codex review and edit?', message: `Codex can inspect and may edit files in:\n${target}\n\nChanges are not verified automatically.`, confirmLabel: 'Continue to Codex' })) return
    aiId.current = null; setCodexConnected(false); setBusy('fix'); setAiStream(''); setFixOutput(''); setStatus('planning')
    setEvents((items) => [...items, { kind: 'ai', title: 'Codex is investigating', detail: 'Reviewing the latest findings', at: new Date().toISOString() }])
    try {
      const report = fixReport || 'No specific test failure was provided. Review the project for a clearly identifiable quality issue. Make a minimal confirmed fix and describe any uncertainty.'
      const response = await window.osien.fix({ directory: target, report })
      const resultText = response.output || 'Codex returned no explanation.'
      const blocked = codexBlocked(resultText)
      const completed = response.code === 0 && !blocked
      aiId.current = response.id; setCodexConnected(true); setFixOutput(resultText)
      setAiStream(resultText)
      setOutput(completed ? 'Codex review finished. Changes still need verification.' : blocked ? 'Codex could not inspect the project because its execution policy blocked file access.' : 'Codex could not complete the review.')
      setStatus(completed ? 'review' : 'error')
      setEvents((items) => [...items, { kind: 'ai', title: completed ? 'Codex report ready' : blocked ? 'Codex access blocked' : 'Codex could not complete', detail: completed ? 'Not verified · rerun checks and review the diff' : 'No project changes were verified', at: new Date().toISOString() }])
    } catch (error) { setStatus('error'); setOutput(`Codex repair failed: ${error.message}`) }
    finally { setBusy(null) }
  }

  const passed = results.filter((item) => item.status === 'passed').length
  const findings = results.filter((item) => item.status === 'finding')
  const failed = results.filter((item) => item.status === 'failed')
  return <div className="app-shell">
    <Scanner className="app-background" color1="#31205c" color2="#8b5cf6" color3="#e9ddff" speed={0.22} sweepSpeed={0.12} sweepWidth={1.8} trail={0.65} scale={1.8} ripple={0.12} bandDensity={14} glow={0.45} scanDirection="vertical" colorSpread={0.35} scanline scanlineIntensity={0.18} grain={false} opacity={0.28} mouseInteraction={false} clickEffect="none" intro />
    <header className="app-header">
      <a className="brand" href="#top"><span className="brand-mark">o</span><span>OSIEN <b>TEST</b></span></a>
      <CardNav className="app-card-nav" logo={<span className="brand-mark">o</span>} logoAlt="OSIEN Test home" logoHref="#top" items={[
        { label: 'Run Tests', description: 'Choose checks and inspect live results.', links: [{ label: 'Open test runner' }] },
        { label: 'History', description: 'Review recent local test runs.', links: [{ label: 'Open history' }] },
        { label: 'Settings', description: 'Manage safe-copy and privacy preferences.', links: [{ label: 'Open settings' }] },
      ]} cta={{ label: project ? 'Change project' : 'Choose project', onClick: chooseProject }} theme="dark" surface="glass" openOn="click" cardEffect="rise" cardHeight={112} maxWidth={610} accentColor="#b7a5ff" menuLabel intro onLinkClick={(link) => setTab(link.label.includes('history') ? 'history' : link.label.includes('settings') ? 'settings' : 'run')} ariaLabel="OSIEN main navigation" />
      <div className="header-right"><span className="private-state"><i />Private workspace</span><span className="codex-pill"><HugeiconsIcon icon={SparklesIcon} size={12} />{codex.signedIn ? 'Codex connected' : codex.available ? 'Sign-in required' : 'Codex unavailable'}</span><div className="window-controls"><SpecularButton {...specularButtonProps} onClick={() => window.osien.windowControl('minimize')} aria-label="Minimize">−</SpecularButton><SpecularButton {...specularButtonProps} onClick={() => window.osien.windowControl('toggle-maximize')} aria-label="Maximize">□</SpecularButton><SpecularButton {...specularButtonProps} className="close" onClick={() => window.osien.windowControl('close')} aria-label="Close">×</SpecularButton></div></div>
    </header>

    {tab === 'run' && <main id="top" className="run-page">
      <section className="page-heading"><div><div className="eyebrow">PROJECT QUALITY</div><h1><DecryptedText text="Run Tests" animateOn="inViewHover" effect="scramble" sequential revealDirection="start" speed={40} maxIterations={8} hoverRadius={80} scrambleColor="#b7a5ff" /></h1><p>Choose a project, run focused checks, review what needs attention.</p></div><SpecularButton {...specularButtonProps} className="button secondary choose-button" onClick={chooseProject}><HugeiconsIcon icon={FolderOpenIcon} size={16} />{project ? 'Change project' : 'Choose project'}</SpecularButton></section>

      <BeamCard className="project-strip">
        <span className="project-icon"><HugeiconsIcon icon={FolderOpenIcon} size={21} /></span>
        <div className="project-details"><span className="eyebrow">ACTIVE PROJECT</span><strong>{project?.name ?? 'No project selected'}</strong><small>{project?.directory ?? 'Choose a local folder to begin'}</small></div>
        {project && <div className="project-facts"><span>{project.fileCount.toLocaleString()} files</span><i />{project.extensions.slice(0, 5).map((ext) => <span key={ext}>{ext.toUpperCase()}</span>)}</div>}
        {!project && <SpecularButton {...specularButtonProps} className="button primary" onClick={chooseProject}>Choose folder <HugeiconsIcon icon={ArrowRight01Icon} size={15} /></SpecularButton>}
      </BeamCard>

      {project && <details className="project-files-browser"><summary><span>Browse project files</span><span>{project.fileCount.toLocaleString()} files</span></summary><div className="project-files-content"><input className="project-file-search" value={fileQuery} onChange={(event) => setFileQuery(event.target.value)} placeholder="Filter files in this folder" aria-label="Filter project files" /><LineSidebar items={visibleProjectFiles} accentColor="#b7a5ff" textColor="#b8bdc9" markerColor="#454052" showIndex showMarker proximityRadius={100} maxShift={12} markerLength={26} itemGap={12} fontSize={0.76} onItemClick={(_index, file) => setActiveFile(file)} className="project-file-sidebar" />{visibleProjectFiles.length === 0 && <p className="empty-message">No matching files.</p>}{(project.files?.length ?? 0) > 120 && <small className="list-limit">Showing up to 120 matches. Filter to find other files.</small>}{activeFile && <small className="active-file-path">Selected: {activeFile}</small>}</div><BorderBeam size={60} transition={{ duration: 8 }} /></details>}

      <div className="dashboard-grid">
        <section className="left-stack">
          <BeamCard className="checks-panel">
            <div className="panel-head"><div><div className="eyebrow">TEST PLAN</div><h2>Checks to run</h2><p>{project ? `${project.applicable} checks apply to this project` : 'Choose a project to find relevant checks'}</p></div><span className="selected-count">{selected.size} selected</span></div>
            <details className="library-browser"><summary><span>Browse check library</span><span className="summary-plus">＋</span></summary>
              <div className="filter-row"><label className="search-box"><HugeiconsIcon icon={Search01Icon} size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a check" /></label><select value={bundle} onChange={(event) => setBundle(event.target.value)} aria-label="Check category"><option value="all">All checks</option>{bundles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="commands">Project commands</option></select></div>
              <div className="select-actions"><SpecularButton {...specularButtonProps} onClick={chooseAllVisible}>Select visible</SpecularButton><SpecularButton {...specularButtonProps} onClick={() => setSelected(new Set())}>Clear selection</SpecularButton></div>
              <div className="check-list">{checksToShow.slice(0, 120).map((item) => <label className="check-item" key={item.id}><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleCheck(item.id)} /><span><strong>{item.name}</strong><small>{item.command ?? item.explanation}</small></span><em>{item.language ?? 'Project command'}</em></label>)}{checksToShow.length === 0 && <p className="empty-message">No matching checks.</p>}</div>
              {catalog.length > 120 && <small className="list-limit">Showing the first 120 matches. Search to narrow the list.</small>}
            </details>
            <div className="run-bar"><SquishSwitch checked={isolate} onChange={(value) => { setIsolate(value); localStorage.setItem('osien-isolate', JSON.stringify(value)) }} label="Run in safe copy" ariaLabel="Run tests in a safe copy" trackColor="#26232e" trackOnColor="#b7a5ff" width={48} height={26} radius={13} stretch={30} hoverScale={1.03} /><div className="action-buttons">{busy === 'tests' && <SpecularButton {...specularButtonProps} className="button subtle stop" onClick={stopRun}>Stop</SpecularButton>}{busy === 'tests' ? <SpecularButton {...specularButtonProps} className="button primary" disabled><LatticeLoader status="working" label="Running" showTimer={false} /></SpecularButton> : <SpecularButton {...specularButtonProps} className="button primary run-button" disabled={!project || !selected.size || Boolean(busy)} onClick={runSelected}><HugeiconsIcon icon={PlayIcon} size={16} />Run selected tests</SpecularButton>}</div></div>
          </BeamCard>

          <BeamCard className="activity-panel">
            <div className="activity-top"><div><div className="eyebrow">LIVE ACTIVITY</div><h2>{busy === 'analyze' ? 'Planning a focused run' : busy === 'fix' ? 'Investigating findings' : busy === 'tests' ? 'Running checks' : 'What OSIEN is doing'}</h2></div><LatticeLoader status={busy ? 'working' : status === 'error' ? 'error' : status === 'ready' ? 'idle' : 'done'} label={busy ? 'In progress' : status === 'ready' ? 'Ready' : status === 'review' ? 'Report ready · not verified' : status === 'error' ? 'Needs attention' : 'Complete'} pattern="orbit" /></div>
            {busy === 'analyze' || busy === 'fix' ? <ThoughtLine working label={busy === 'analyze' ? 'Building a focused test plan' : 'Reviewing the reported issues'} steps={busy === 'analyze' ? ['Reading project snapshot', 'Selecting relevant checks'] : ['Inspecting failure context', 'Preparing a minimal change']} /> : null}
            {activeCall && busy !== 'tests' && <CallChip name={activeCall.name} argument={activeCall.argument} status="running" />}
            {runItems.length > 0 && <div className="call-list">{runItems.map((item) => <CallChip key={item.id} icon="terminal" name={item.name} argument={item.argument} status={item.status} expectedMs={2500} size={34} radius={10} showTimer />)}</div>}
            {!busy && status === 'review' && <p className="review-next-step">Codex review finished. Open <strong>Review Codex report</strong> in the summary, then rerun checks to verify any changes.</p>}
            {!busy && !results.length && status !== 'review' && <p className="activity-empty">Select checks and run them to see real-time progress here.</p>}
            {(output || aiStream) && <details className="activity-output" open={!busy && ['review', 'error'].includes(status)}><summary>{busy?.startsWith('analy') || busy === 'fix' ? 'Codex stream' : 'Process output'} <span>{output.length + aiStream.length > 0 ? `${(output + aiStream).length.toLocaleString()} chars` : ''}</span></summary><pre>{aiStream || output}</pre></details>}
          </BeamCard>
        </section>

        <aside className="summary-column">
          <BeamCard className="summary-panel">
            <div className="eyebrow">RUN SUMMARY</div><h2>{status === 'review' && !results.length ? 'Codex report ready' : results.length ? status === 'error' ? 'Needs attention' : findings.length || failed.length ? 'Review recommended' : 'All clear' : 'Ready when you are'}</h2>
            <p className="summary-intro">{status === 'review' && !results.length ? `Codex finished for ${project?.name ?? 'your project'}; any changes are unverified.` : results.length ? `${results.length} checks completed for ${project?.name ?? 'your project'}.` : 'Your results will appear here after the run.'}</p>
            {results.length > 0 && <div className="summary-metrics"><div><strong>{passed}</strong><span>Passed</span></div><div><strong>{findings.length}</strong><span>Findings</span></div><div><strong>{failed.length}</strong><span>Failures</span></div></div>}
            <div className="summary-section"><span className="summary-label"><HugeiconsIcon icon={Alert01Icon} size={14} />WHAT WAS WRONG</span>{findings.length || failed.length ? <ul>{[...findings, ...failed].slice(0, 5).map((item) => <li key={item.id}>{item.name}</li>)}</ul> : <p>{results.length ? 'No selected checks reported an issue.' : 'No results yet.'}</p>}</div>
            <div className="summary-section"><span className="summary-label"><HugeiconsIcon icon={SparklesIcon} size={14} />{fixOutput ? 'CODEX REPORT' : 'WHAT CODEX CHANGED'}</span>{fixOutput ? <><p className="unverified-note">{status === 'error' ? 'Codex could not inspect the project' : 'Session complete · not verified'}</p><details className="fix-details"><summary>Review Codex report</summary><pre>{fixOutput}</pre></details></> : <p>{findings.length || failed.length ? 'Codex can review findings and propose a change.' : 'No Codex changes yet.'}</p>}</div>
            <div className="summary-section"><span className="summary-label"><HugeiconsIcon icon={ArrowRight01Icon} size={14} />WHAT REMAINS</span><p>{findings.length || failed.length ? `${findings.length + failed.length} item${findings.length + failed.length === 1 ? '' : 's'} need review. Rerun checks after changes.` : status === 'review' ? 'Review the Codex report and rerun checks to verify changes.' : results.length ? 'Review the output and your own test coverage.' : 'Choose a project and select checks.'}</p></div>
            <SpecularButton {...specularButtonProps} className="button ai-button" disabled={!project || Boolean(busy)} onClick={askCodexToFix}><HugeiconsIcon icon={SparklesIcon} size={16} />{busy === 'fix' ? 'Codex is investigating…' : codexConnected ? 'Ask Codex to review again' : 'Ask Codex to investigate'}</SpecularButton>
            <SpecularButton {...specularButtonProps} className="text-ai" disabled={!project || Boolean(busy)} onClick={analyze}>Suggest a focused test plan <HugeiconsIcon icon={ArrowRight01Icon} size={14} /></SpecularButton>
          </BeamCard>
          <p className="privacy-note"><HugeiconsIcon icon={Shield01Icon} size={13} /> Tests run locally. Codex only receives a snapshot after you confirm.</p>
        </aside>
      </div>
    </main>}

    {tab === 'history' && <main className="simple-page"><div className="eyebrow">LOCAL RUNS</div><h1>History</h1><p className="page-lede">Your recent runs, saved on this device.</p><div className="history-list">{history.length ? history.map((item, index) => <article className="history-row" key={`${item.at}-${index}`}><span className="history-status"><HugeiconsIcon icon={item.failed ? Alert01Icon : Tick02Icon} size={17} /></span><div><strong>{item.project?.split(/[\\/]/).at(-1) || 'Project'}</strong><small>{new Date(item.at).toLocaleString()} · {item.count} checks · {item.passed} passed · {item.failed} to review</small></div><span className="history-result">{item.failed ? 'Review' : 'Complete'}</span><BorderBeam size={60} transition={{ duration: 8 }} /></article>) : <div className="empty-state">No test runs yet.</div>}</div><SpecularButton {...specularButtonProps} className="button primary" onClick={() => setTab('run')}>Back to Run Tests</SpecularButton></main>}

    {tab === 'settings' && <main className="simple-page"><div className="eyebrow">PREFERENCES</div><h1><DecryptedText text="Settings" animateOn="inViewHover" effect="scramble" sequential revealDirection="start" speed={40} maxIterations={8} hoverRadius={80} scrambleColor="#b7a5ff" /></h1><p className="page-lede">Keep runs safe and decide what leaves your device.</p><BeamCard className="settings-card"><div className="setting-row"><div><strong>Run tests in a safe copy</strong><p>Copy the project to a temporary folder before running selected checks.</p></div><SquishSwitch checked={isolate} onChange={(value) => { setIsolate(value); localStorage.setItem('osien-isolate', JSON.stringify(value)) }} ariaLabel="Run tests in a safe copy" trackColor="#26232e" trackOnColor="#b7a5ff" width={52} height={28} radius={14} stretch={30} /></div><div className="setting-row"><div><strong>Codex connection</strong><p>{codex.text}</p></div><span className="codex-pill"><HugeiconsIcon icon={SparklesIcon} size={12} />{codex.signedIn ? 'Connected' : codex.available ? 'Sign-in required' : 'Unavailable'}</span></div><div className="setting-row"><div><strong>Project snapshot</strong><p>AI planning shares a bounded, redacted project snapshot only after you approve.</p></div><HugeiconsIcon icon={Shield01Icon} size={18} /></div></BeamCard></main>}

    <footer className="app-footer"><span>OSIEN TEST</span><span><i />LOCAL BY DEFAULT</span></footer>
    <ConfirmDialog value={confirmation} onAnswer={answer} />
  </div>
}

createRoot(byId('root')).render(<App />)
