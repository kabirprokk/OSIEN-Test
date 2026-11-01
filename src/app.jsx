import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HugeiconsIcon } from '@hugeicons/react'
import { FolderOpenIcon, PlayIcon, SparklesIcon, Shield01Icon, ArrowRight01Icon, Tick02Icon, Alert01Icon, Search01Icon } from '@hugeicons/core-free-icons'
import CallChip from './components/CallChip.jsx'
import LatticeLoader from './components/LatticeLoader.jsx'
import ThoughtLine from './components/ThoughtLine.jsx'
import DecryptedText from './components/DecryptedText.jsx'
import LineSidebar from './components/LineSidebar.jsx'
import SquishSwitch from './components/SquishSwitch.jsx'
import Scanner from './components/Scanner.jsx'
import './app.css'
import './sketch.css'

const byId = (id) => document.getElementById(id)
const safeRead = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback)) } catch { return fallback } }
const getPlan = (text) => {
  const json = text.match(/```json\s*([\s\S]*?)```/)?.[1] ?? text.match(/\{[\s\S]*\}/)?.[0]
  if (!json) return null
  try { return JSON.parse(json) } catch { return null }
}
const codexBlocked = (text) => /(?:blocked|rejected|denied).{0,80}(?:execution policy|project files|workspace)|(?:execution policy|workspace policy).{0,80}(?:blocked|rejected|denied)|session (?:also )?prohibits? writes|could not inspect code|files changed:\s*none[\s\S]{0,240}tests run:\s*none/i.test(text)
const escapeText = (value) => String(value ?? '')
function ConfirmDialog({ value, onAnswer }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    if (value && dialog && !dialog.open) dialog.showModal()
    if (!value && dialog?.open) dialog.close()
  }, [value])
  return <dialog ref={ref} className="confirm-dialog" onCancel={(event) => { event.preventDefault(); onAnswer(false) }}>
    {value && <div className="confirm-surface"><span className="eyebrow">PLEASE CONFIRM</span><h2>{value.title}</h2><p>{value.message}</p><div className="confirm-actions"><button className="button secondary" autoFocus onClick={() => onAnswer(false)}>Cancel</button><button className="button primary" onClick={() => onAnswer(true)}>{value.confirmLabel || 'Continue'}</button></div></div>}
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
    const supportedExtensions = new Set(inspected.extensions ?? [])
    const initialChecks = inspected.library.filter((item) => supportedExtensions.has(item.extension)).filter((item, index, all) => all.findIndex((candidate) => candidate.bundle === item.bundle && candidate.rule === item.rule) === index).slice(0, 10)
    setSelected(new Set(initialChecks.map((item) => item.id)))
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
  return <div className="app-shell sketch-shell">
    <header className="app-header sketch-header">
      <a className="brand sketch-brand" href="#top">OSIEN TEST</a>
      <nav className="sketch-tabs" aria-label="Main navigation">
        {[['run', 'Run Tests'], ['history', 'History'], ['settings', 'Settings']].map(([id, label]) => <button key={id} type="button" className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>{label}</button>)}
      </nav>
      <div className="window-controls sketch-window-controls">
        <button type="button" onClick={() => window.osien.windowControl('minimize')} aria-label="Minimize">&minus;</button>
        <button type="button" onClick={() => window.osien.windowControl('toggle-maximize')} aria-label="Maximize">&#9633;</button>
        <button type="button" className="close" onClick={() => window.osien.windowControl('close')} aria-label="Close">&times;</button>
      </div>
    </header>

    {tab === 'run' && <main id="top" className="run-page sketch-layout">
      <h1 className="sketch-visually-hidden">Run Tests</h1>
      <section className="sketch-left" aria-label="Test runner">
        <div className="sketch-run-controls">
          <button type="button" className="sketch-folder-button" onClick={chooseProject}>
            <HugeiconsIcon icon={FolderOpenIcon} size={19} />
            <span>{project?.name ?? 'Choose a Folder'}</span>
          </button>
          {project?.directory && <p className="sketch-project-path" title={project.directory}>{project.directory}</p>}
          <div className="sketch-run-row">
            <button type="button" className="sketch-run-button" disabled={!project || !selected.size || Boolean(busy)} onClick={runSelected}>
              {busy === 'tests' ? <><LatticeLoader status="working" label="Running" showTimer={false} /> Running...</> : 'Run Test'}
            </button>
            <span className="sketch-check-count">{selected.size ? `${selected.size} checks ready` : 'Choose a folder to begin'}</span>
          </div>
        </div>

        <section className="sketch-panel sketch-live" aria-live="polite">
          <div className="sketch-panel-heading">
            <div><span className="sketch-kicker">LIVE ACTIVITY</span><h2>Live things Codex is doing</h2></div>
            <span className={`sketch-status status-${status}`}>{busy ? 'IN PROGRESS' : status === 'ready' ? 'READY' : status.toUpperCase()}</span>
          </div>
          <div className="sketch-live-body">
            {activeCall && <CallChip name={activeCall.name} argument={activeCall.argument} status="running" />}
            {runItems.length > 0 && <div className="call-list">{runItems.map((item) => <CallChip key={item.id} icon="terminal" name={item.name} argument={item.argument} status={item.status} expectedMs={2500} size={34} radius={10} showTimer />)}</div>}
            {(busy === 'analyze' || busy === 'fix') && <ThoughtLine working label={busy === 'analyze' ? 'Building a focused test plan' : 'Reviewing the reported issues'} steps={busy === 'analyze' ? ['Reading project snapshot', 'Selecting relevant checks'] : ['Inspecting failure context', 'Preparing a minimal change']} />}
            {!busy && !runItems.length && !output && <p className="sketch-placeholder">Live test activity will appear here.</p>}
            {(output || aiStream) && <pre className="sketch-output">{aiStream || output}</pre>}
          </div>
        </section>
      </section>

      <aside className="sketch-panel sketch-summary">
        <div className="sketch-summary-content">
          <span className="sketch-kicker">RUN SUMMARY</span>
          <h2>{results.length ? status === 'error' ? 'Needs attention' : findings.length || failed.length ? 'Review recommended' : 'All clear' : 'Summary'}</h2>
          {results.length > 0 && <div className="sketch-metrics"><span>{passed} passed</span><span>{findings.length} findings</span><span>{failed.length} failed</span></div>}
          <section className="sketch-summary-section"><h3>What was wrong</h3>{findings.length || failed.length ? <ul>{[...findings, ...failed].slice(0, 6).map((item) => <li key={item.id}>{item.name}</li>)}</ul> : <p>{results.length ? 'No selected checks reported an issue.' : 'Findings will appear here after a run.'}</p>}</section>
          <section className="sketch-summary-section"><h3>What was fixed</h3><p>{fixOutput ? fixOutput.slice(0, 500) : 'Verified fixes will appear here.'}</p>{fixOutput && <details className="fix-details"><summary>Read full Codex report</summary><pre>{fixOutput}</pre></details>}</section>
          <section className="sketch-summary-section"><h3>What remains</h3><p>{findings.length || failed.length ? `${findings.length + failed.length} item${findings.length + failed.length === 1 ? '' : 's'} need review. Rerun checks after changes.` : status === 'review' ? 'Review the Codex report and rerun checks to verify changes.' : results.length ? 'Review the output and your own test coverage.' : 'Choose a folder, then run the selected checks.'}</p></section>
        </div>
      </aside>
    </main>}

    {tab === 'history' && <main className="simple-page sketch-secondary-page"><span className="sketch-kicker">LOCAL RUNS</span><h1>History</h1><p className="page-lede">Your recent runs, saved on this device.</p><div className="history-list">{history.length ? history.map((item, index) => <article className="history-row" key={`${item.at}-${index}`}><span className="history-status"><HugeiconsIcon icon={item.failed ? Alert01Icon : Tick02Icon} size={17} /></span><div><strong>{item.project?.split(/[\\/]/).at(-1) || 'Project'}</strong><small>{new Date(item.at).toLocaleString()} | {item.count} checks | {item.passed} passed | {item.failed} to review</small></div><span className="history-result">{item.failed ? 'Review' : 'Complete'}</span></article>) : <div className="empty-state">No test runs yet.</div>}</div><button type="button" className="sketch-run-button" onClick={() => setTab('run')}>Back to Run Tests</button></main>}

    {tab === 'settings' && <main className="simple-page sketch-secondary-page"><span className="sketch-kicker">PREFERENCES</span><h1>Settings</h1><p className="page-lede">Keep runs safe and decide what leaves your device.</p><section className="settings-list"><div className="setting-row"><div><strong>Run tests in a safe copy</strong><p>Copy the project to a temporary folder before running selected checks.</p></div><SquishSwitch checked={isolate} onChange={(value) => { setIsolate(value); localStorage.setItem('osien-isolate', JSON.stringify(value)) }} ariaLabel="Run tests in a safe copy" trackColor="#26232e" trackOnColor="#b7a5ff" width={52} height={28} radius={14} stretch={30} /></div><div className="setting-row"><div><strong>Codex connection</strong><p>{codex.text}</p></div><span className="codex-pill"><HugeiconsIcon icon={SparklesIcon} size={12} />{codex.signedIn ? 'Connected' : codex.available ? 'Sign-in required' : 'Unavailable'}</span></div><div className="setting-row"><div><strong>Project snapshot</strong><p>AI planning shares a bounded, redacted project snapshot only after you approve.</p></div><HugeiconsIcon icon={Shield01Icon} size={18} /></div></section></main>}

    <ConfirmDialog value={confirmation} onAnswer={answer} />
  </div>
}

createRoot(byId('root')).render(<App />)
