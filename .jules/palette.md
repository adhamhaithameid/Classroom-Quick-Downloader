## 2026-06-11 - Add `aria-hidden="true"` to decorative internal icons in toggle switches
**Learning:** Screen readers may read decorative internal SVG icons (such as cross or checkmark inside a toggle switch) as confusing phantom elements if they do not have `aria-hidden="true"`.
**Action:** Always add `aria-hidden="true"` to decorative internal icons in UI toggle switches to improve screen reader accessibility.
