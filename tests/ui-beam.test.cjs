const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')

test('beam uses the OSIEN violet accent and respects reduced motion', () => {
  const styles = read('src/components/BorderBeam.css')
  assert.match(styles, /rgb\(183 165 255/)
  assert.match(styles, /prefers-reduced-motion:\s*reduce/)
  assert.doesNotMatch(styles, /rgb\(250 204 21/)
})

test('buttons render a decorative beam without intercepting input', () => {
  const component = read('src/components/SpecularButton.jsx')
  const styles = read('src/components/SpecularButton.css')
  assert.match(component, /import\s*\{\s*BorderBeam\s*\}/)
  assert.match(component, /<BorderBeam\b/)
  assert.match(styles, /pointer-events:\s*none/)
})

test('history entries use the shared card beam', () => {
  const app = read('src/app.jsx')
  assert.match(app, /import\s*\{\s*BorderBeam\s*\}/)
  assert.match(app, /className="history-row"[\s\S]*?<BorderBeam\b/)
})

test('all app card panels use the beam card instead of pixel cards', () => {
  const app = read('src/app.jsx')
  assert.match(app, /import BeamCard from '\.\/components\/BeamCard\.jsx'/)
  assert.doesNotMatch(app, /import PixelCard/)
  assert.equal((app.match(/<BeamCard\b/g) || []).length, 5)
  assert.match(app, /className="project-files-browser"[\s\S]*?<BorderBeam\b/)
  assert.match(app, /className="confirm-surface"[\s\S]*?<BorderBeam\b/)
  assert.match(read('src/components/CardNav.jsx'), /className=\{CARD\}[\s\S]*?<BorderBeam\b/)
})
