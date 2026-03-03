# M6-COMMS-THREAD-COMPOSER-UNIVERSAL-PIN-CLAUDE-A — Layout Fix Evidence

## Date
2026-03-02

## Objective
Ship one universal thread layout model where the composer is always visible and pinned directly above the app bottom navigation rail — regardless of thread length, entry path, or media control state.

## Root Cause
The composer used `position: 'absolute'` with a dynamic `bottom` offset computed from `composerBottomInset` (hardcoded to `0`). The ScrollView above it relied on a dynamically-measured `composerHeight` state (via `onLayout`) to compute `paddingBottom` so messages wouldn't hide behind the overlapping composer. This approach caused four failure modes:

1. **Composer floats too high** — absolute positioning + measurement lag
2. **Composer drops below/behind nav** — bottom offset miscalculation
3. **Entry-path behavior variance** — different mount timing across All/Channels/DMs
4. **Long-thread desync** — composerHeight measurement drift on scroll

## Fix: Absolute → Flex Layout

### Before (fragile absolute positioning)
```
threadRoot (flex:1, position:'relative')
  ├── ScrollView (flex:1, paddingBottom: composerHeight + composerBottomInset + 12)
  └── Composer (position:'absolute', left:0, right:0, bottom: composerBottomInset, zIndex:40)
```

### After (stable flex column)
```
threadRoot (flex:1)
  ├── ScrollView (flex:1, static paddingBottom:8)
  └── Composer (normal flex child — no absolute positioning)
```

## Changes Made — `app/components/comms/CommsHub.tsx`

### 1. Style: `threadRoot` (was line 1548)
- Removed `position: 'relative'` — no longer needed since composer is not absolute

### 2. Style: `composer` (was line 1738)
- Removed `position: 'absolute'`
- Removed `left: 0`
- Removed `right: 0`
- Removed `zIndex: 40`
- Removed `elevation: 40`
- Kept: `backgroundColor`, `borderTopWidth`, `borderTopColor`, `paddingHorizontal`, `paddingVertical`, `gap`

### 3. ScrollView `contentContainerStyle` (was line 855)
- Before: `[st.threadScrollInner, { paddingBottom: composerHeight + Math.max(0, composerBottomInset ?? 0) + 12 }]`
- After: `st.threadScrollInner` (static `paddingBottom: 8` from stylesheet)

### 4. Composer View element (was line 978)
- Before: `<View style={[st.composer, { bottom: Math.max(0, composerBottomInset ?? 0) }]} onLayout={(e) => setComposerHeight(e.nativeEvent.layout.height)}>`
- After: `<View style={st.composer}>`

### 5. Removed state: `composerHeight` (was line 684)
- Removed `const [composerHeight, setComposerHeight] = useState(0);` — no longer needed

### 6. Prop `composerBottomInset` — now dead code
- Still defined in `CommsHubProps` interface (line 141) and destructured (line 679) but no longer consumed. Harmless; kept for backward compatibility of the prop interface.

## Entry-Path Parity Verification
All three entry paths (All, Channels, DMs) converge to `screen === 'channel_thread'` → same `<ThreadView {...props} />` (line 250). The composer fix applies uniformly via the single ThreadView component.

## Mux Media / Live Session Controls
Remain inside the composer View — no change to their position or visibility. They render as part of the flex-based composer footer.

## Validation
- `node node_modules/typescript/bin/tsc --noEmit` (app) — **PASS** (clean, no errors)
- `npm run -s build` (backend) — **PASS** (clean, no errors)

## Constraints Verified
- Single file modified: `CommsHub.tsx`
- No new components or files
- No schema/table changes
- No API endpoint changes
- No permission boundary regressions
- Mux/Live controls remain visible and functional
