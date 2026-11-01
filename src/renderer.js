const state = { project: null, catalog: [], detected: [], bundles: [], selected: new Set(), results: [], output: '', repairReport: '', jobId: null, workingDirectory: null, isolated: false }
const byId = (id) => document.getElementById(id)
byId('changeProject').addEventListener('click', () => byId('choose').click())

byId('windowMinimize').addEventListener('click', () => window.osien.windowControl('minimize'))
byId('windowMaximize').addEventListener('click', async () => {
  const maximized = await window.osien.windowControl('toggle-maximize')
  byId('windowMaximize').textContent = maximized ? '❐' : '□'
  byId('windowMaximize').title = maximized ? 'Restore' : 'Maximize'
  byId('windowMaximize').setAttribute('aria-label', maximized ? 'Restore' : 'Maximize')
})
byId('windowClose').addEventListener('click', () => window.osien.windowControl('close'))

window.osien.aiStatus().then((status) => {
  byId('codexStatus').textContent = status.signedIn ? '✦ CODEX CONNECTED' : status.available ? '✦ SIGN-IN REQUIRED' : 'CODEX NOT FOUND'
  byId('codexStatus').title = status.message
}).catch((error) => {
  byId('codexStatus').textContent = 'CODEX ERROR'
  byId('codexStatus').title = error.message
})

byId('choose').addEventListener('click', async () => {
  try {
    const directory = await window.osien.chooseProject()
    if (!directory) return
    await loadProject(directory)
  } catch (error) { appendConsole(`Project scan failed: ${error.message}`) }
})

const savedProject = localStorage.getItem('osien-project')
if (savedProject) loadProject(savedProject).catch((error) => {
  localStorage.removeItem('osien-project')
  appendConsole(`Could not restore the last project: ${error.message}`)
})

byId('bundleFilter').addEventListener('change', renderTests)
byId('testSearch').addEventListener('input', renderTests)
byId('selectAll').addEventListener('click', () => {
  for (const test of visibleTests()) state.selected.add(test.id)
  renderTests()
})
byId('clearSelection').addEventListener('click', () => { state.selected.clear(); renderTests() })

byId('analyze').addEventListener('click', async () => {
  if (!state.project) return appendConsole('Choose a project folder first.')
  if (!await showConfirm({ title: 'Share a project snapshot?', message: 'Codex analysis sends the project file list and up to 24 redacted source excerpts (up to 30,000 characters) to your signed-in Codex account. Secret-named files are excluded.', confirmLabel: 'Continue to Codex' })) return
  byId('analyze').disabled = true
  byId('insight').innerHTML = '<div class="insight-graphic"><div class="orbit orbit-a"></div><div class="orbit orbit-b"></div><div class="core">✳</div></div><strong>Codex is mapping your project…</strong><p>Inspecting structure and choosing focused bundles and project scripts.</p>'
  setStatus('ANALYZING', 'running')
  byId('console').textContent = 'Starting Codex project analysis…\n'
  let response
  try {
    response = await window.osien.analyze({ directory: state.project.directory, results: state.results })
  } catch (error) {
    byId('analyze').disabled = false
    setStatus('AI UNAVAILABLE', 'failure')
    byId('insight').innerHTML = `<strong>Analysis could not start</strong><p>${escapeHtml(error.message)}</p>`
    appendConsole(`Codex analysis failed: ${error.message}`)
    return
  }
  byId('analyze').disabled = false
  setStatus(response.code === 0 ? 'PLAN READY' : 'AI UNAVAILABLE', response.code === 0 ? 'success' : 'failure')
  const parsed = parsePlan(response.text)
  if (parsed?.bundles?.length) {
    const valid = [...new Set(parsed.bundles)].filter((id) => state.bundles.some((bundle) => bundle.id === id)).slice(0, 2)
    byId('bundleFilter').value = valid[0] ?? 'all'
    const checksByRule = new Map()
    for (const item of state.catalog) {
      if (!valid.includes(item.bundle) || !state.project.extensions.includes(item.extension) || checksByRule.has(`${item.bundle}:${item.rule}`)) continue
      checksByRule.set(`${item.bundle}:${item.rule}`, item)
    }
    for (const item of [...checksByRule.values()].slice(0, 10)) state.selected.add(item.id)
    for (const item of state.detected.filter((test) => parsed.scripts?.includes(test.id)).slice(0, 2)) state.selected.add(item.id)
    const summary = parsed.summary ?? 'Focused test plan ready.'
    byId('insight').textContent = summary.length > 220 ? `${summary.slice(0, 217)}…` : summary
    byId('planBundles').innerHTML = valid.map((id) => `<span>${escapeHtml(state.bundles.find((item) => item.id === id)?.name ?? id)}</span>`).join('')
    byId('planBundles').classList.toggle('hidden', !valid.length)
    const gaps = Array.isArray(parsed.gaps) ? parsed.gaps.filter((gap) => typeof gap === 'string').slice(0, 3) : []
    byId('gapList').innerHTML = gaps.map((gap) => `<li>${escapeHtml(gap.length > 180 ? `${gap.slice(0, 177)}…` : gap)}</li>`).join('')
    byId('planGaps').open = false
    byId('planGaps').classList.toggle('hidden', !gaps.length)
    byId('console').textContent = `Focused plan ready · ${state.selected.size} checks selected.`
    renderTests()
  } else {
    byId('insight').textContent = response.code === 0 ? 'Codex did not return a usable plan. Choose checks from the library instead.' : 'Codex is unavailable. You can still choose checks from the library.'
    byId('console').textContent = response.code === 0 ? 'No usable test plan was returned.' : response.text.slice(-1200)
    if (response.code !== 0) byId('activityDetails').open = true
  }
})

byId('run').addEventListener('click', async () => {
  if (!state.project || !state.selected.size) return
  const commands = state.detected.filter((test) => state.selected.has(test.id))
  if (commands.length && !await showConfirm({ title: 'Run project commands?', message: `${commands.map((test) => test.command).join('\n')}\n\nThese commands are defined by the selected project and may have side effects. Run them only if you trust this project.`, confirmLabel: 'Run commands' })) return
  byId('run').disabled = true
  byId('activityDetails').open = true
  byId('cancelRun').classList.remove('hidden')
  state.results = []
  state.output = ''
  byId('runSummary').replaceChildren()
  byId('console').textContent = `Preparing ${state.selected.size.toLocaleString()} selected checks${byId('isolate').checked ? ' in an isolated project copy' : ' in the source directory'}…\n`
  setStatus('RUNNING', 'running')
  try {
    const response = await window.osien.runTests({ directory: state.project.directory, tests: [...state.selected], isolate: byId('isolate').checked })
    state.jobId = response.id
    state.workingDirectory = response.workingDirectory
    state.isolated = response.isolated
  } catch (error) { appendConsole(`Could not start test run: ${error.message}`); finishRun([], { error: error.message }) }
})
byId('cancelRun').addEventListener('click', async () => { if (state.jobId) await window.osien.cancelRun(state.jobId) })

window.osien.onOutput((message) => {
  if (state.jobId && message.id !== state.jobId) return
  state.output += message.data
  byId('console').textContent += `\n[${message.test}] ${message.data}`
  byId('console').scrollTop = byId('console').scrollHeight
})
window.osien.onComplete((event) => {
  if (state.jobId && event.id !== state.jobId) return
  state.jobId = event.id
  state.workingDirectory = event.workingDirectory
  state.isolated = event.isolated
  finishRun(event.results, event)
})

byId('fix').addEventListener('click', async () => {
  if (!state.project) return
  const target = state.isolated && state.workingDirectory ? state.workingDirectory : state.project.directory
  if (!await showConfirm({ title: 'Let Codex review and edit?', message: `Codex can inspect and may edit files in:\n${target}\n\nYou can review changes afterward.`, confirmLabel: 'Continue to Codex' })) return
  byId('fix').disabled = true
  byId('fix').textContent = 'Codex is reviewing…'
  try {
    const report = state.repairReport || 'No specific test failure has been provided. Review the project for a clearly identifiable issue related to its tests or quality. Make only a confirmed, minimal fix; explain findings and ask for clarification instead of guessing.'
    const response = await window.osien.fix({ directory: target, report })
    const verifyNext = state.selected.size ? 'Re-run the selected checks and review the file changes before trusting a fix.' : 'Choose and run relevant checks, then review the file changes before trusting a fix.'
    byId('fixOutput').textContent += `\n\n--- Codex session (exit ${response.code}) · NOT VERIFIED ---\n${response.output}\n\n${verifyNext}`
    byId('fixHint').textContent = response.code === 0
      ? `Codex finished, but the app has not verified its changes. ${verifyNext}`
      : 'Codex did not complete successfully. No fix has been confirmed; inspect the output before trying again.'
  } catch (error) {
    byId('fixOutput').textContent += `\n\nCodex repair failed: ${error.message}`
  } finally {
    byId('fix').disabled = false
    byId('fix').textContent = 'Ask Codex to fix failures'
  }
})
byId('clear').addEventListener('click', () => { state.output = ''; byId('console').textContent = 'Output cleared.' })

function visibleTests() {
  const bundle = byId('bundleFilter').value
  const query = byId('testSearch').value.trim().toLowerCase()
  if (bundle === 'commands') return state.detected.filter((test) => `${test.name} ${test.command}`.toLowerCase().includes(query))
  const supported = new Set(state.project?.extensions ?? [])
  return state.catalog.filter((test) => (bundle === 'all' || test.bundle === bundle) && supported.has(test.extension) && `${test.name} ${test.explanation} ${test.language}`.toLowerCase().includes(query))
}

async function loadProject(directory) {
  state.project = await window.osien.inspectProject(directory)
  state.catalog = state.project.library
  state.detected = state.project.detected
  state.bundles = state.project.bundles
  state.selected.clear()
  state.results = []
  state.repairReport = ''
  byId('fixOutput').textContent = ''
  byId('fixOutput').classList.add('hidden')
  byId('fixHint').textContent = 'Or review the project and propose a fix.'
  byId('planBundles').classList.add('hidden')
  byId('planGaps').classList.add('hidden')
  byId('choose').classList.add('hidden')
  byId('changeProject').classList.remove('hidden')
  byId('analyze').disabled = false
  byId('fix').disabled = false
  localStorage.setItem('osien-project', directory)
  byId('projectName').textContent = state.project.name
  byId('projectPath').textContent = state.project.directory
  byId('fileCount').textContent = `${state.project.fileCount.toLocaleString()} files scanned`
  byId('stack').textContent = state.project.extensions.slice(0, 5).map((extension) => extension.toUpperCase()).join(' · ') || 'No stack detected'
  byId('catalogSummary').textContent = `${state.project.applicable.toLocaleString()} checks match this project`
  byId('bundleFilter').innerHTML = '<option value="all">All bundles</option>' + state.bundles.map((bundle) => `<option value="${bundle.id}">${escapeHtml(bundle.name)}</option>`).join('') + '<option value="commands">Project test commands</option>'
  byId('insight').textContent = 'Get a focused plan or review issues from your latest run.'
  renderTests()
}

function renderTests() {
  if (!state.project) return
  const tests = visibleTests()
  byId('testCount').textContent = `${state.selected.size.toLocaleString()} selected`
  byId('tests').innerHTML = tests.length ? tests.map((test) => `<label class="test-row"><input class="test-check" type="checkbox" data-test-id="${escapeAttr(test.id)}" ${state.selected.has(test.id) ? 'checked' : ''}><span><strong>${escapeHtml(test.name)}</strong><small>${escapeHtml(test.command ?? test.explanation)}</small></span><span class="test-desc"><span class="risk">${escapeHtml(test.risk ?? 'Command')} · ${escapeHtml(test.language ?? 'project')}</span></span></label>`).join('') : '<div class="empty"><div class="empty-icon">✳</div><strong>No applicable checks</strong><span>Try another bundle or inspect the detected project commands.</span></div>'
  document.querySelectorAll('.test-check').forEach((input) => input.addEventListener('change', () => {
    if (input.checked) state.selected.add(input.dataset.testId)
    else state.selected.delete(input.dataset.testId)
    byId('testCount').textContent = `${state.selected.size.toLocaleString()} selected`
  }))
  byId('run').disabled = !state.selected.size
}

function finishRun(results, event) {
  state.results = results
  state.jobId = null
  byId('run').disabled = !state.selected.size
  byId('cancelRun').classList.add('hidden')
  byId('activityDetails').open = true
  const failed = results.filter((result) => result.status === 'failed' || (result.status !== 'finding' && result.code !== 0))
  const findings = results.filter((result) => result.status === 'finding')
  const passed = results.filter((result) => result.status === 'passed' || (result.status !== 'finding' && result.code === 0))
  const cancelled = event.cancelled
  setStatus(cancelled ? 'STOPPED' : event.error ? 'RUN ERROR' : failed.length ? `${failed.length} COMMAND FAILURES` : findings.length ? `${findings.length} FINDINGS TO REVIEW` : 'ALL CLEAR', cancelled || event.error || failed.length ? 'failure' : findings.length ? 'review' : 'success')
  byId('runSummary').innerHTML = `<span class="summary-pill">${results.length.toLocaleString()} executed</span><span class="summary-pill pass">${passed.length.toLocaleString()} passed</span><span class="summary-pill ${findings.length ? 'review-pill' : ''}">${findings.length.toLocaleString()} review findings</span><span class="summary-pill ${failed.length ? 'fail' : ''}">${failed.length.toLocaleString()} command failures</span>${cancelled ? '<span class="summary-pill">cancelled</span>' : ''}`
  appendConsole(`\n\nFinished: ${results.length} checks · ${passed.length} passed · ${findings.length} heuristic findings to review · ${failed.length} command failures.${event.isolated ? `\nIsolated workspace: ${event.workingDirectory}` : ''}${event.error ? `\nError: ${event.error}` : ''}`)
  const actionable = [...failed, ...findings]
  state.repairReport = actionable.map((result) => `${result.name} (${result.status}): ${result.detail || `exit code ${result.code}`}`).join('\n')
  byId('fixOutput').classList.toggle('hidden', !actionable.length)
  byId('fixOutput').textContent = state.repairReport
  byId('fixHint').textContent = actionable.length
    ? `${actionable.length} item${actionable.length === 1 ? '' : 's'} from your latest run to review. Codex can investigate and propose a fix.`
    : 'Ask Codex to review the project or investigate your latest run. You’ll approve before it can edit.'
  saveHistory({ at: new Date().toISOString(), project: state.project?.directory, count: results.length, passed: passed.length, failed: failed.length, cancelled: Boolean(cancelled) })
}

function saveHistory(run) {
  let history = []
  try {
    const stored = JSON.parse(localStorage.getItem('osien-history') ?? '[]')
    if (Array.isArray(stored)) history = stored
  } catch {}
  history.unshift(run)
  localStorage.setItem('osien-history', JSON.stringify(history.slice(0, 30)))
}
function setStatus(label, style) { byId('runStatus').className = `run-status ${style}`; byId('runStatus').innerHTML = `<span></span> ${escapeHtml(label)}` }
function appendConsole(text) { byId('console').textContent += `\n${text}` }
function showConfirm({ title, message, confirmLabel = 'Continue' }) {
  const dialog = byId('confirmDialog')
  byId('confirmTitle').textContent = title
  byId('confirmMessage').textContent = message
  byId('confirmAccept').textContent = confirmLabel
  return new Promise((resolve) => {
    let settled = false
    const finish = (accepted) => {
      if (settled) return
      settled = true
      dialog.removeEventListener('cancel', cancelEvent)
      dialog.removeEventListener('close', closeEvent)
      byId('confirmCancel').removeEventListener('click', cancelAction)
      byId('confirmAccept').removeEventListener('click', acceptAction)
      dialog.close()
      resolve(accepted)
    }
    const cancelEvent = (event) => { event.preventDefault(); finish(false) }
    const closeEvent = () => finish(false)
    const cancelAction = () => finish(false)
    const acceptAction = () => finish(true)
    dialog.addEventListener('cancel', cancelEvent)
    dialog.addEventListener('close', closeEvent)
    byId('confirmCancel').addEventListener('click', cancelAction)
    byId('confirmAccept').addEventListener('click', acceptAction)
    dialog.showModal()
  })
}
function parsePlan(text) {
  const candidates = [text.match(/```json\s*([\s\S]*?)```/)?.[1], text.match(/\{[\s\S]*\}/)?.[0]]
  for (const candidate of candidates) { if (!candidate) continue; try { return JSON.parse(candidate) } catch {} }
  return null
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]) }
function escapeAttr(value) { return escapeHtml(value) }
