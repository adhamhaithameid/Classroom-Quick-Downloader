## 2024-05-19 — Added missing accessible attributes to toggle switches
**Finding:** The toggle switches in the popup lacked standard accessible attributes (like `role="switch"` and `aria-checked`), making it harder for screen reader users to identify them and their state, even though they functioned.
**Action:** Added `role="switch"` and `aria-checked` to the native checkbox input inside `ToggleRow`, and updated tests.
**Learning:** For React toggle switches built on native checkboxes, the native input must receive the switch role, not its wrapper, so screen reader semantics match the element actually receiving keyboard focus.
## 2025-02-19 — Added missing accessible attributes to toggle switches
**Finding:** The toggle switches in the popup lacked standard accessible attributes (`role="switch"` and `aria-checked`), making it harder for screen reader users to identify their state, even though they functioned visually.
**Action:** Added `role="switch"` and `aria-checked` to the native checkbox input inside `ToggleRow`, and updated tests.
**Learning:** For React toggle switches built on native checkboxes, the native input must receive the switch role, not its wrapper, so screen reader semantics match the element actually receiving keyboard focus.
