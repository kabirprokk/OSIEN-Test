const profiles = [
  ['js', 'JavaScript'], ['jsx', 'React JSX'], ['mjs', 'ES modules'], ['cjs', 'CommonJS'], ['ts', 'TypeScript'], ['tsx', 'React TSX'],
  ['py', 'Python'], ['pyi', 'Python stubs'], ['go', 'Go'], ['rs', 'Rust'], ['java', 'Java'], ['kt', 'Kotlin'], ['kts', 'Kotlin scripts'],
  ['cs', 'C#'], ['fs', 'F#'], ['rb', 'Ruby'], ['php', 'PHP'], ['swift', 'Swift'], ['c', 'C'], ['h', 'C headers'], ['cc', 'C++'],
  ['cpp', 'C++'], ['hpp', 'C++ headers'], ['vue', 'Vue'], ['svelte', 'Svelte'], ['html', 'HTML'], ['sql', 'SQL'], ['sh', 'Shell'],
  ['bash', 'Bash'], ['dart', 'Dart'], ['scala', 'Scala'], ['ex', 'Elixir'], ['exs', 'Elixir scripts'], ['lua', 'Lua'], ['pl', 'Perl'],
]

const bundles = [
  { id: 'security', name: 'Security heuristics', description: 'Flags common risky code patterns; findings need human review.', risk: 'Review', rules: [
    ['dynamic-code', 'Dynamic code execution', /\beval\s*\(|new\s+Function\s*\(/g, 'Dynamic code can execute untrusted input.'],
    ['weak-random', 'Weak randomness', /\bMath\.random\s*\(/g, 'Math.random is not cryptographically secure.'],
    ['disabled-tls', 'TLS verification disabled', /rejectUnauthorized\s*:\s*false|verify\s*[:=]\s*false|InsecureSkipVerify\s*:\s*true/gi, 'Disabling certificate verification weakens transport security.'],
    ['shell-concat', 'Shell command built from input', /exec(?:Sync)?\s*\([^\n]*(?:\+\s*\w|\$\{)/g, 'String-built shell commands can create injection risks.'],
    ['unsafe-html', 'User input concatenated into HTML', /\.innerHTML\s*=\s*[^;\n]*\+\s*(?:req|request|input|userInput|query|params)\b/g, 'Directly concatenating request or user input into HTML can create cross-site scripting risks.'],
  ] },
  { id: 'secrets', name: 'Secret hygiene', description: 'Looks for hard-coded credentials and private-key material.', risk: 'Review', rules: [
    ['private-key', 'Private key marker', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, 'A private key marker appears in source.'],
    ['credential-literal', 'Credential-like assignment', /(?:password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*["'][^"']{8,}["']/gi, 'A credential-like literal was found; test fixtures may be false positives.'],
    ['cloud-key', 'Cloud access key pattern', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, 'A cloud-provider access-key shape appears in source.'],
    ['url-credential', 'Credential embedded in URL', /https?:\/\/[^\s/:]+:[^\s/@]+@/gi, 'A URL contains user-info that may be a credential.'],
    ['secret-env-fallback', 'Secret fallback literal', /process\.env\.[A-Z0-9_]+\s*\|\|\s*["'][^"']+["']/g, 'A secret environment variable has a literal fallback.'],
  ] },
  { id: 'reliability', name: 'Reliability', description: 'Highlights error handling, assertions, and suspicious unfinished paths.', risk: 'Review', rules: [
    ['empty-catch', 'Empty catch block', /catch\s*(?:\([^)]*\))?\s*\{\s*\}/g, 'An exception is caught and ignored.'],
    ['todo', 'Unresolved TODO marker', /\b(?:TODO|FIXME|XXX)\b/g, 'A TODO marker may indicate unfinished work.'],
    ['debugger', 'Debugger statement', /\bdebugger\s*;?/g, 'A debugger statement may have been left in production code.'],
    ['assert-disabled', 'Assertions disabled', /\b(?:assert|assertions?)\s*[:=]\s*(?:false|off|disabled)\b/gi, 'An assertion appears to be disabled.'],
    ['unhandled-promise', 'Potential unawaited async call', /\.then\s*\([^\n]*\)\s*;?\s*$/gm, 'Review promise chains for missing rejection handling.'],
  ] },
  { id: 'maintainability', name: 'Maintainability', description: 'Identifies debug residue, broad suppressions, and high-churn markers.', risk: 'Low', rules: [
    ['console-output', 'Console output call', /\bconsole\.(?:log|debug|info)\s*\(/g, 'Consider whether this output should remain in shipped code.'],
    ['broad-ignore', 'Broad lint/type suppression', /(?:eslint-disable(?!-next-line)|@ts-nocheck|noinspection)/g, 'Broad suppressions can hide unrelated defects.'],
    ['magic-delay', 'Hard-coded long delay', /(?:setTimeout|sleep)\s*\([^,]+,\s*(?:[1-9]\d{4,})/g, 'A long hard-coded delay may make behavior brittle.'],
    ['large-comment', 'Disabled code marker', /\/\*\s*(?:disabled|old code|unused)\b/gi, 'Commented-out code tends to become stale.'],
    ['duplicate-marker', 'Duplicate implementation marker', /\bcopy\s+of\s+|\bduplicate\s+of\s+/gi, 'Review possible copied implementations for drift.'],
  ] },
  { id: 'performance', name: 'Performance heuristics', description: 'Surfaces common hot-path and resource-use patterns.', risk: 'Review', rules: [
    ['sync-io', 'Synchronous file or process I/O', /\b(?:readFileSync|writeFileSync|execSync|spawnSync)\s*\(/g, 'Synchronous I/O may block an event loop or UI thread.'],
    ['nested-loop', 'Nested loop marker', /for\s*\([^\n]*\)\s*\{[\s\S]{0,180}?for\s*\(/g, 'Nested loops can have high cost; verify input bounds.'],
    ['unbounded-select', 'Potential unbounded query', /SELECT\s+\*\s+FROM\s+\w+(?![\s\S]{0,60}\bLIMIT\b)/gi, 'Review query pagination and result limits.'],
    ['large-payload', 'Potential large inline payload', /(?:base64|data:[^,]+),[A-Za-z0-9+/]{1500,}={0,2}/g, 'Large inline payloads may increase memory and bundle size.'],
    ['polling-loop', 'Tight polling loop', /while\s*\([^)]*\)\s*\{\s*(?:await\s+)?(?:poll|check|status)/gi, 'Polling loops need a delay, timeout, and cancellation path.'],
  ] },
  { id: 'privacy', name: 'Privacy and data handling', description: 'Flags potentially sensitive logging, storage, and telemetry paths.', risk: 'Review', rules: [
    ['sensitive-log', 'Potential sensitive data logging', /console\.(?:log|info|debug)\s*\([^\n]*(?:token|password|email|authorization|cookie)/gi, 'Sensitive values should not be logged.'],
    ['local-storage-secret', 'Credential-like local storage', /localStorage\.(?:setItem|getItem)\s*\([^\n]*(?:token|secret|password)/gi, 'Long-lived browser storage may be inappropriate for credentials.'],
    ['tracking-pixel', 'Tracking pixel reference', /(?:pixel\.gif|track(?:ing)?[-_]?pixel|beacon)/gi, 'Review whether this tracking behavior is disclosed and consented.'],
    ['request-body-log', 'Request body logged', /(?:console\.(?:log|debug)|logger\.(?:info|debug))\s*\([^\n]*(?:request\.body|req\.body)/gi, 'Request bodies can contain personal or secret data.'],
    ['cookie-insecure', 'Cookie security flag disabled', /(?:httpOnly|secure)\s*:\s*false/gi, 'Review cookie flags against the deployment threat model.'],
  ] },
  { id: 'testing', name: 'Test readiness', description: 'Checks for test markers and disabled or skipped assertions.', risk: 'Low', rules: [
    ['skipped-test', 'Skipped test case', /\b(?:skip|xit|xdescribe|pending)\s*\(/g, 'Skipped tests reduce coverage until restored.'],
    ['only-test', 'Focused test left enabled', /\b(?:fit|fdescribe|it\.only|test\.only|describe\.only)\s*\(/g, 'A focused test can cause the rest of the suite to be omitted.'],
    ['weak-assertion', 'Test without visible assertion', /\b(?:test|it)\s*\([^\n]{0,160}\{(?:(?!\b(?:expect|assert|should)\b)[\s\S]){0,260}\}/g, 'Review whether this test actually asserts an outcome.'],
    ['random-test', 'Randomized test input', /\b(?:Math\.random|random\.rand|rand::random)\s*\(/g, 'Randomized tests should use a reproducible seed.'],
    ['sleep-test', 'Fixed sleep in test', /\b(?:sleep|setTimeout)\s*\([^\n]{0,80}\b(?:test|spec|wait)/gi, 'Fixed sleeps often make tests slow or flaky.'],
  ] },
  { id: 'configuration', name: 'Configuration', description: 'Finds permissive defaults and common configuration hazards.', risk: 'Review', rules: [
    ['wildcard-origin', 'Wildcard origin', /Access-Control-Allow-Origin\s*[:=]\s*["']?\*/gi, 'Wildcard origins may expose authenticated resources.'],
    ['debug-mode', 'Debug mode enabled', /\b(?:DEBUG|debug|development)\s*[:=]\s*(?:true|1|["']true["'])/g, 'Confirm debug settings are not enabled in production.'],
    ['bind-all', 'Service binds to all interfaces', /(?:0\.0\.0\.0|::)\s*[,)]/g, 'Binding all network interfaces may expose a service.'],
    ['unsafe-permission', 'Overly broad permission marker', /\b(?:chmod\s+777|\*:\*|"\*"\s*:\s*"\*")/gi, 'Review wildcard permissions or world-writable access.'],
    ['http-endpoint', 'Plain HTTP endpoint', /http:\/\/(?!localhost|127\.0\.0\.1)[^\s"'`]+/gi, 'Review whether non-local endpoints should require HTTPS.'],
  ] },
  { id: 'dependencies', name: 'Dependency hygiene', description: 'Checks source-level dependency and package-manager warning markers.', risk: 'Review', rules: [
    ['deprecated-api', 'Deprecated API marker', /\b(?:deprecated|DeprecationWarning)\b/gi, 'Review the deprecation and plan a supported replacement.'],
    ['floating-version', 'Floating dependency version', /(?:"|')\*\s*(?:"|')/g, 'Wildcard dependency versions reduce reproducibility.'],
    ['git-dependency', 'Git-based dependency reference', /(?:git\+https?:\/\/|github:[\w-]+\/)/gi, 'Git dependencies may not be pinned to an immutable revision.'],
    ['insecure-registry', 'HTTP package registry', /https?:\/\/[^\s"']*(?:registry|npm|pypi)[^\s"']*/gi, 'Review package registry transport security.'],
    ['install-hook', 'Install-time hook marker', /\b(?:preinstall|postinstall|prepare)\b/g, 'Install hooks execute code during dependency installation.'],
  ] },
  { id: 'accessibility', name: 'Accessibility heuristics', description: 'Basic source checks for common accessible UI semantics.', risk: 'Review', rules: [
    ['image-alt', '<img> without apparent alt attribute', /<img\b(?![^>]*\balt\s*=)[^>]*>/gi, 'Images should have an appropriate text alternative.'],
    ['button-name', 'Button with no apparent accessible label', /<button\b[^>]*>\s*<\/button>/gi, 'Interactive controls need an accessible name.'],
    ['positive-tabindex', 'Positive tabindex', /tabindex\s*=\s*["']?[1-9]/gi, 'Positive tabindex can create confusing keyboard order.'],
    ['autoplay-media', 'Autoplay media', /<(?:video|audio)\b[^>]*\bautoplay\b/gi, 'Automatically playing media can disrupt users.'],
    ['click-div', 'Clickable non-interactive element', /<div\b[^>]*\bonclick\s*=/gi, 'Use a semantic button or provide keyboard interaction and role.'],
  ] },
]

const library = bundles.flatMap((bundle) => bundle.rules.flatMap((rule) => profiles.map(([extension, language]) => ({
  id: `${bundle.id}.${rule[0]}.${extension}`,
  bundle: bundle.id,
  bundleName: bundle.name,
  description: bundle.description,
  rule: rule[0],
  name: `${rule[1]} — ${language}`,
  extension,
  language,
  explanation: rule[3],
  pattern: rule[2],
  risk: bundle.risk,
  testFilesOnly: bundle.id === 'testing',
}))))

function evaluate(test, sources) {
  return sources.flatMap((source) => {
    if (source.extension !== test.extension) return []
    if (test.bundle === 'testing' && !/(?:^|[\\/])(?:test|tests|spec|specs)(?:[\\/.]|$)|(?:^|[\\/.])(?:test|spec)(?:[.-]|$)/i.test(source.path)) return []
    if (test.testFilesOnly && !/(?:^|[\\/])(?:[^\\/]*(?:test|spec)[^\\/]*|test_[^\\/]*)\.[^.\\/]+$/i.test(source.path)) return []
    const pattern = new RegExp(test.pattern.source, test.pattern.flags.includes('g') ? test.pattern.flags : `${test.pattern.flags}g`)
    const findings = []
    for (const match of source.content.matchAll(pattern)) {
      findings.push({ path: source.path, line: source.content.slice(0, match.index).split('\n').length })
      if (findings.length >= 1000) break
    }
    return findings
  })
}

module.exports = { bundles: bundles.map(({ id, name, description, risk }) => ({ id, name, description, risk })), library, evaluate }
