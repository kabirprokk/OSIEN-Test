const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')

test('run screen follows the folder, live activity, and summary sketch', () => {
  const app = read('src/app.jsx')
  assert.match(app, /className="dashboard-grid sketch-layout"/)
  assert.match(app, /className="left-stack sketch-left"[\s\S]*?className="page-heading"[\s\S]*?className="project-strip"[\s\S]*?className="checks-panel"[\s\S]*?className="activity-panel"/)
  assert.match(app, /className="summary-column"[\s\S]*?RUN SUMMARY[\s\S]*?WHAT WAS WRONG[\s\S]*?WHAT CODEX CHANGED[\s\S]*?WHAT REMAINS/)
  assert.match(app, /Run selected tests/)
  assert.match(app, /className="main-tabs sketch-tabs"/)
})

test('sketch layout retains project, test-selection, safe-copy, and Codex workflows', () => {
  const app = read('src/app.jsx')
  assert.match(app, /Browse check library/)
  assert.match(app, /className="check-list"/)
  assert.match(app, /Run in safe copy/)
  assert.match(app, /onClick=\{askCodexToFix\}/)
  assert.match(app, /onClick=\{analyze\}/)
  assert.match(app, /className="project-files-browser"/)
  assert.match(app, /onClick=\{stopRun\}/)
  assert.match(app, /tab === 'history'/)
  assert.match(app, /tab === 'settings'/)
})

test('BorderBeam animation is removed while existing components remain', () => {
  const app = read('src/app.jsx')
  assert.doesNotMatch(app, /BorderBeam/)
  assert.doesNotMatch(read('src/components/PixelCard.jsx'), /BorderBeam/)
  assert.doesNotMatch(read('src/components/CardNav.jsx'), /BorderBeam/)
  assert.doesNotMatch(read('src/components/SpecularButton.jsx'), /BorderBeam/)
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'src/components/BorderBeam.css')), false)
})
