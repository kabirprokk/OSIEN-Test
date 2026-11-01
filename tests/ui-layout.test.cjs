const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')

test('run screen follows the folder, live activity, and summary sketch', () => {
  const app = read('src/app.jsx')
  assert.match(app, /className="run-page sketch-layout"/)
  assert.match(app, /className="sketch-panel sketch-live"[\s\S]*?LIVE ACTIVITY[\s\S]*?Live things Codex is doing/)
  assert.match(app, /className="sketch-panel sketch-summary"[\s\S]*?What was wrong[\s\S]*?What was fixed[\s\S]*?What remains/)
  assert.match(app, /Run Test/)
  assert.match(app, /className="sketch-tabs"/)
})

test('beam effects are removed from the rendered app and buttons', () => {
  const app = read('src/app.jsx')
  const button = read('src/components/SpecularButton.jsx')
  assert.doesNotMatch(app, /BeamCard|BorderBeam|SpecularButton/)
  assert.doesNotMatch(button, /BorderBeam/)
  assert.doesNotMatch(read('src/components/CardNav.jsx'), /BorderBeam/)
  assert.doesNotMatch(read('src/sketch.css'), /border-beam|@keyframes/i)
})

test('project selection supplies a small default test set for the sketch run button', () => {
  const app = read('src/app.jsx')
  assert.match(app, /const initialChecks = inspected\.library[\s\S]*?\.slice\(0, 10\)/)
  assert.match(app, /setSelected\(new Set\(initialChecks\.map\(\(item\) => item\.id\)\)\)/)
  assert.match(app, /onClick=\{runSelected\}/)
})
