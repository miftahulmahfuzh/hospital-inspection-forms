# iOS Safari date input overflows its container

Card: [#1](https://github.com/miftahulmahfuzh/hospital-inspection-forms/issues/1) · round 1 · branch `task/1-date-input-overflows-its-container-on` off `642f0955`

## The problem, measured

Reported on iPhone XS Max / Safari. The **Waktu Pemeriksaan** field (`type="date"`) is wider
than the **Area** field (`type="text"`) directly below it — same left edge, right edge ~30
screenshot-px further right and almost touching the viewport.

The screenshot is 739px wide for a 414 CSS-px viewport, so the scale is ~1.785. The Area
field's ~34px right gutter is **20 CSS px**, which is exactly the `px-5` on the page container
at `InspectionForm.tsx:244`. The date field's ~4px is roughly **zero**. So the container is
correct and it is the date input alone that escapes it.

## Mechanism

`.field` (`src/app/globals.css:223`) is one class shared by four controls — `input[type=text]`,
`input[type=date]`, `select` and `textarea` — and `InspectionForm.tsx:445` renders the first two
from the same `<input>`, switching only `type`. It sets `width: 100%`, and Tailwind preflight
supplies `box-sizing: border-box`, which is why the text input sits correctly.

On iOS Safari `input[type="date"]` carries a UA `-webkit-appearance` whose shadow
`-webkit-date-and-time-value` child establishes an intrinsic **min-content width**. A used
`width` cannot resolve below an intrinsic minimum, so the control renders wider than its
containing block and overflows to the right. Desktop Blink/Gecko give the date input no such
floor, which is why the bug is iOS-only and invisible in DevTools device emulation.

The same floor applies to the two admin date pickers at `src/app/admin/page.tsx:125,137`, which
carry `field w-44` — an 11rem fixed width that iOS is equally free to ignore.

## Approaches

Scored on: does it look like what this repo already does · is it the smallest change that fully
satisfies the card · can the gate prove it · is it one commit to undo.

| | Approach | Verdict |
|---|---|---|
| **A** | **Scoped CSS on the existing primitive** — `min-width: 0; max-width: 100%` on `.field`, and `appearance: none` on date inputs only. | **Chosen.** Lives in the `Form primitives` block where the repo already keeps this layer; fixes the admin pickers by the same rule; one file, one commit to revert. |
| B | Wrap the input in a flex/grid parent carrying `min-width: 0`. | Rejected. Adds markup to a component that deliberately renders one `<input>` for both types, does nothing for `admin/page.tsx`'s fixed-width pickers, and leaves the UA inner padding — so the date text still would not line up with the neighbouring placeholder. |
| C | Replace the native date input with a text field plus a JS picker. | Rejected. Throws away the native iOS date wheel, which is the single best affordance on a phone form filled in by an inspector one-handed, in exchange for an alignment fix. Scope far past the card. |

### Why `appearance: none` is scoped rather than global

`.field` is also the `<select>` at `InspectionForm.tsx:420`. `-webkit-appearance: none` on a
`<select>` removes the native dropdown chevron, leaving a control that looks like a text input —
a regression on a different widget, traded for nothing. So the appearance reset is written as
`input[type="date"].field`, while `min-width: 0` / `max-width: 100%` are safe for all four
controls and go on `.field` itself (they also protect the `<select>`, whose longest `<option>`
sets a comparable intrinsic floor on iOS).

`min-width: 0` is the half that actually releases the floor; `appearance: none` also drops the
UA's own inner padding, which is what makes the rendered date text share a baseline and a left
inset with the "Tulis di sini" placeholder below it.

## Ambiguity call

The card says *"make sure these fields aligned uniformly. left and right has the same spacing to
phone border"*. Two readings:

- **narrow (built):** the date field is the outlier; bring it onto the gutter the other fields
  already hold.
- wider: the page's gutter itself is wrong and the spacing wants redesigning.

The narrow one is right on the evidence — Area's gutters are already symmetric at 20px, so
there is nothing to redesign, only one control to bring into line. If the intent was to change
the gutter itself, that is a comment on the card and a round 2.

## Steps

1. `src/app/globals.css` — add `min-width: 0` and `max-width: 100%` to `.field`.
2. `src/app/globals.css` — add an `input[type="date"].field` rule resetting the appearance, with
   a comment naming the iOS mechanism so the next reader does not "simplify" it away.
3. Confirm no other control is over-wide: audit every `className="field"` site.

## Verification

- Gate: this repo has no `.github/workflows` and no test script, so the derived gate is
  `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- **Not provable by the gate:** the visual result needs a real iOS device or the Xcode iOS
  Simulator. Chrome DevTools emulation renders Blink's date input and will not reproduce the
  bug, so a green emulator is not evidence. On-device check: compare
  `document.querySelectorAll('.field')[0].getBoundingClientRect().right` against `[1]`'s — they
  must be equal — and confirm the native date wheel still opens on tap after `appearance: none`.
