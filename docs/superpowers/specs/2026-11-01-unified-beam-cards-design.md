# Unified beam card design

## Intent

Give every existing card the visual treatment of the supplied BorderBeam card,
adapted to OSIEN Test's dark, violet-accented style, while preserving the app's
current content and behavior.

## Scope

- Apply a consistent animated perimeter beam to all existing card panels.
- Adapt the supplied outlined button treatment to the app's existing buttons.
- Keep existing card content, actions, and layout; do not turn panels into
  repeated login forms.
- Use the project's current React and CSS components; do not add shadcn or
  another UI dependency.

## Approaches

- Replace all card contents with the supplied Login card: rejected because it
  would remove the test-planning workflow.
- Preserve content and apply the supplied beam/button treatment: selected
  because it matches the visual request without breaking the product.
- Add the effect only to selected panels: rejected because the request covers
  all cards.

## Implementation calls

Use CSS/React animation consistent with the existing dark palette and violet
accent. Keep motion subtle and respect reduced-motion preferences. Apply the
card treatment to the project, checks, activity, summary, history, and settings
surfaces where they currently use card-like containers.

## Acceptance

- All existing card surfaces use the unified beam treatment.
- Existing text, controls, and interactions remain functional.
- Buttons use a matching beam accent where the treatment fits.
- The app builds successfully.
