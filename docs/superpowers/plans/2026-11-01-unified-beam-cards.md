# Unified beam cards implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every existing card a consistent animated BorderBeam-inspired edge in OSIEN Test's existing style without removing content or behavior.

**Architecture:** Add one reusable React beam wrapper/component and CSS animation using the existing React/CSS stack. Apply it to the existing card-like panels and make matching changes to existing buttons without adding shadcn or new packages.

**Tech Stack:** React, CSS, Vite, Electron.

**Spec:** `docs/superpowers/specs/2026-11-01-unified-beam-cards-design.md`

## Global Constraints

- Preserve all existing content, actions, and layout.
- Use existing project dependencies; add no UI dependency.
- Keep the effect subtle, using the dark palette and violet accent.
- Respect reduced-motion preferences.

## Review Focus

- Cards with different sizes and nested content retain usable layout and clipping.
- Interactive controls within cards remain clickable and keyboard accessible.
- Reduced-motion preference disables or minimizes the animation.
- History and settings surfaces receive the same visual treatment as the main screen.
- Disabled buttons retain their disabled behavior and legible styling.

---

### Task 1: Build the reusable beam treatment

**Files:**
- Create: `src/components/BorderBeam.jsx`
- Create: `src/components/BorderBeam.css`
- Test: `npm run build`

**Interfaces:**
- Produces: `BorderBeam({ className })` decorative beam element; `BeamCard({ className, children })` wrapper for card surfaces.

- [ ] Add the beam component and styles with a violet-to-transparent gradient, no pointer interception, and a reduced-motion fallback.
- [ ] Run `npm run build`; expected result is a successful Vite production build.

### Task 2: Apply beam cards and matching button accents

**Files:**
- Modify: `src/app.jsx`
- Modify: `src/app.css`
- Test: `npm run build`

**Interfaces:**
- Consumes: `BeamCard` from `src/components/BorderBeam.jsx`.

- [ ] Replace existing `PixelCard` card wrappers and card-like surfaces with `BeamCard`, preserving all children and handlers; include history rows where they are card-like.
- [ ] Add a restrained matching beam accent to existing button treatments in CSS without changing their behavior.
- [ ] Run `npm run build`; expected result is a successful Vite production build.

### Task 3: Verify and push

**Files:**
- Verify: all changed files and repository status.

- [ ] Run the available test suite and production build; record any pre-existing warnings separately.
- [ ] Review the diff for preserved controls, reduced-motion behavior, and unintended changes.
- [ ] Commit with a conventional message and push the current branch to `origin`.
