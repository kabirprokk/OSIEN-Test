const assert = require('node:assert/strict')
const test = require('node:test')
const { bundles, library, evaluate } = require('../src/test-library.cjs')

test('catalog contains over one thousand unique executable checks', () => {
  assert.ok(library.length >= 1000)
  assert.equal(new Set(library.map((item) => item.id)).size, library.length)
  assert.ok(library.every((item) => item.pattern instanceof RegExp && item.extension && item.bundle))
})

test('each bundle exposes a substantial, labeled catalog', () => {
  assert.ok(bundles.length >= 10)
  for (const bundle of bundles) {
    const checks = library.filter((item) => item.bundle === bundle.id)
    assert.ok(checks.length >= 100, `${bundle.id} has ${checks.length} checks`)
    assert.ok(checks.every((item) => item.bundleName === bundle.name))
  }
})

test('heuristic patterns identify representative risky source examples', () => {
  const secretRule = library.find((item) => item.id === 'secrets.private-key.js')
  const dynamicCodeRule = library.find((item) => item.id === 'security.dynamic-code.ts')
  assert.ok(secretRule.pattern.test('-----BEGIN PRIVATE KEY-----'))
  assert.ok(dynamicCodeRule.pattern.test('eval(userInput)'))
})

test('catalog evaluator reports only matching files of the right language', () => {
  const rule = library.find((item) => item.id === 'security.dynamic-code.js')
  const findings = evaluate(rule, [
    { path: 'src/unsafe.js', extension: 'js', content: 'eval(input)' },
    { path: 'src/safe.js', extension: 'js', content: 'JSON.parse(input)' },
    { path: 'src/example.py', extension: 'py', content: 'eval(input)' },
  ])
  assert.deepEqual(findings, [{ path: 'src/unsafe.js', line: 1 }])
})

test('catalog evaluator reports every occurrence and leaves catalog regex state untouched', () => {
  const rule = library.find((item) => item.id === 'security.dynamic-code.js')
  const source = { path: 'src/unsafe.js', extension: 'js', content: 'eval(a)\nnew Function(b)\neval(c)' }
  assert.deepEqual(evaluate(rule, [source]), [
    { path: 'src/unsafe.js', line: 1 },
    { path: 'src/unsafe.js', line: 2 },
    { path: 'src/unsafe.js', line: 3 },
  ])
  assert.deepEqual(evaluate(rule, [source]), [
    { path: 'src/unsafe.js', line: 1 },
    { path: 'src/unsafe.js', line: 2 },
    { path: 'src/unsafe.js', line: 3 },
  ])
})

test('test-readiness checks only scan test and spec files', () => {
  const rule = library.find((item) => item.id === 'testing.skipped-test.js')
  const findings = evaluate(rule, [
    { path: 'src/main.js', extension: 'js', content: 'test.skip("fixture")' },
    { path: 'tests/main.test.js', extension: 'js', content: 'test.skip("fixture")' },
  ])
  assert.deepEqual(findings, [{ path: 'tests/main.test.js', line: 1 }])
})
