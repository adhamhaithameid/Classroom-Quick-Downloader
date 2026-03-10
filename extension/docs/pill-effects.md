# Version Pill Effects

The version pill in the extension popup header uses the notification rule system to display visual effects that draw the user's attention to new updates.

## How It Works

1. **On popup open** → the extension checks `isVersionSeen(currentVersion)` against `chrome.storage.local`
2. **If not seen** → the pill gets effect classes (color + animation)
3. **User taps the pill** → `markAsSeen(currentVersion)` is called → effects removed
4. **Extension updates** → the version changes → seen-state mismatches → effects return automatically

## Effect Types

Each notification rule in the changelog config defines a `priority` and an `effect`:

### Priority (Background Color)

| Priority | Appearance | CSS Class | Use Case |
|----------|-----------|-----------|----------|
| `normal` | Default blue pill | *(no extra class)* | Routine update, no action needed |
| `minor` | Solid blue, white text | `cqd-pill-minor` | Feature update worth noting |
| `major` | Solid red, white text | `cqd-pill-major` | Critical update, breaking change |

### Effect (Animation)

| Effect | Animation | CSS Class (minor) | CSS Class (major) |
|--------|-----------|-------------------|-------------------|
| `none` | No animation | *(no extra class)* | *(no extra class)* |
| `glow` | Glowing shadow | `cqd-effect-glow-blue` | `cqd-effect-glow-red` |
| `pulse` | Pulsing ring | `cqd-effect-pulse-blue` | `cqd-effect-pulse-red` |

### Examples

| Rule | Result |
|------|--------|
| `priority: 'minor', effect: 'glow'` | Blue pill with glowing blue shadow |
| `priority: 'major', effect: 'pulse'` | Red pill with pulsing red ring |
| `priority: 'normal', effect: 'none'` | Default blue pill, no animation |
| `priority: 'major', effect: 'glow'` | Red pill with glowing red shadow |

## Configuration

Effects are configured via `NotificationRule` objects in the changelog config:

```json
{
  "rules": [
    {
      "id": "v3.8.9",
      "target": "3.8.9",
      "priority": "minor",
      "effect": "glow"
    }
  ]
}
```

- `target: "all"` → applies to any version without an exact match
- `target: "3.8.9"` → applies only to version 3.8.9

## Seen State

Stored in `chrome.storage.local` under key `cqd_changelog_seen_v1`:

```json
{
  "3.8.9": "3.8.9::rev-abc123",
  "3.8.8": "3.8.8::rev-def456"
}
```

Each entry is `{version}: {version}::{revisionToken}`. When the extension updates:
- New version → no entry exists → `isVersionSeen()` returns `false` → effects show
- User taps pill → entry written → `isVersionSeen()` returns `true` → effects removed

## Files

- [App.tsx](../extension/entrypoints/popup/App.tsx) — pill rendering + `getRuleClasses()` usage
- [changelog.ts](../extension/entrypoints/utils/changelog.ts) — `getRuleClasses()`, `markAsSeen()`, `isVersionSeen()`
- [App.css](../extension/entrypoints/popup/App.css) — `cqd-pill-*` and `cqd-effect-*` CSS classes
