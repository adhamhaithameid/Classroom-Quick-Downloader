# Oracle Dashboard Dark Design Language

## 1. Scope
Visual system guidance for Oracle dashboard dark UI refresh.

## 2. Design Intent
- High-contrast dark surfaces for long operator sessions.
- Clear hierarchy across cockpit/analysis/website/danger pages.
- Consistent control sizing and spacing.

## 3. Core Tokens
Recommended baseline token families:
- Backgrounds: `--bg`, `--surface`, `--surface-elevated`
- Text: `--text-main`, `--text-muted`, `--text-soft`
- Borders: `--border-subtle`, `--border-strong`
- Feedback: `--success`, `--warn`, `--error`, `--info`

## 4. Component Rules
### Cards
- Uniform radius, border, and padding.
- Header area includes title + concise subtitle + action group.

### Buttons
- Secondary and danger variants are visually distinct.
- Icon-only actions keep hit area >= 32px.

### Pills/Badges
- Use for status context only (source, endpoint, freshness, mode).
- Keep a single visual grammar across pages.

### Data Tables
- Sticky headers where practical.
- Monospace for IDs/checksums.
- Row hover contrast without excessive glow.

## 5. Motion and Interaction
- Keep transitions short and functional.
- No decorative motion on critical operations.
- Loading states use consistent spinner + text.

## 6. Accessibility
- Ensure readable contrast for all states.
- Visible focus outline for keyboard users.
- Avoid conveying meaning by color alone.

## 7. Implementation Notes
- Keep style changes in `oracle-dashboard.css`.
- Keep structure updates in `index.html` with semantic grouping.
- Keep behavior updates in `oracle-dashboard.js` with page-local handlers.
