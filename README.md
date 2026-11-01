# OSIEN Test

OSIEN Test is a Windows-first desktop app for project-aware test planning. It includes 1,750 heuristic checks in 10 bundles (175 per bundle), filters checks by the source languages present in a selected project, detects common project test scripts, streams test output, records recent run summaries locally, and can ask the Codex CLI to plan bundles or review/fix failures.

Built-in checks are static pattern heuristics, not a formal proof of security, correctness, or test coverage. Findings can be false positives and passing checks do not establish that code is safe. Project-defined test commands are separate from the built-in catalog and require confirmation before execution. AI planning asks before sending a bounded source snapshot (up to 24 redacted excerpts/30,000 characters plus a file list) to the signed-in Codex account; secret-named files are excluded. AI planning is prompt-only and does not need shell access to inspect the project.

Projects may add a `.osienignore` file with one relative path or `*` wildcard per line to exclude generated fixtures or other intentional scan targets. Lines beginning with `#` are comments.

## Run locally

Requires Node.js 18+, npm, and the Codex CLI (`codex`) installed and authenticated for AI features.

```powershell
npm install
npm start
```

## Safety

Test runs use a temporary project copy by default (excluding `.git`, dependency folders, build outputs, and virtual environments). Dependency binaries are resolved from the source project where available. Disable the copy toggle only when you understand the selected test commands. Tests are arbitrary project commands and may have side effects; inspect the selected bundle before running. AI fixes run in Codex workspace-write mode only after confirmation, in the active test directory. When testing a copy, fixes affect that copy, not the original source.

This is an early prototype, not a hardened security sandbox. The isolated copy protects the source tree from ordinary file edits, but tests should not be treated as safe against host access, external services, or malicious code. Use a disposable VM for hostile security tests. No attack or destructive test suite is generated or executed by default.
