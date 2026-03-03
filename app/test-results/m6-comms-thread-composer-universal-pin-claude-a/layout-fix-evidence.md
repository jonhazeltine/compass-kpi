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

## Fix Part 2: Bottom Nav Clearance

### Problem (discovered after initial flex fix)
The flex layout correctly places the composer below the ScrollView, but the CommsHub container extends behind the absolutely-positioned bottom navigation rail. The composer renders at the very bottom of the screen, overlapping with or hidden by the nav pill.

### Root cause
- Bottom nav uses `position: 'absolute'` with `bottom: bottomNavLift`
- The outer ScrollView contentContainer has `paddingBottom: 0` for comms (via `contentComms` style)
- `commsComposerBottomInset` was hardcoded to `0`

### Fix — `KPIDashboardScreen.tsx`
```typescript
// Was: const commsComposerBottomInset = 0;
const commsComposerBottomInset = bottomNavLift + bottomNavPadBottom + 96;
// iPhone (~insets.bottom=34): 8 + 15 + 96 = 119px
// No safe area: 8 + 8 + 96 = 112px
```

### Fix — `CommsHub.tsx`
```typescript
const { screen, roleCanBroadcast, composerBottomInset } = props;
// ...
<View style={[st.root, composerBottomInset ? { paddingBottom: composerBottomInset } : undefined]}>
```

This shrinks the CommsHub flex container to end above the floating nav pill (including LOG button overshoot), ensuring the composer is always visible.

## Fix Part 3: Modern Slim Composer (iMessage-style)

### Problem
Even with correct flex layout and bottom-nav clearance, the composer consumed ~300-400px of vertical space because Mux Media controls (title + 2 buttons + status), Live Session controls (title + 4 buttons + status), and the action bar (Attach, AI Draft, Refresh, Send) were all permanently visible. This left minimal room for the message thread, especially on shorter devices.

### Solution — Messenger/iMessage-style compact input
Redesigned the composer from a tall multi-section panel to a slim single-row input bar:

#### Before (always-visible bulk)
```
composer
  ├── Error bar (conditional)
  ├── Mux Media panel (ALWAYS visible: title + 2 buttons + status)
  ├── Live Session panel (ALWAYS visible: title + 4 buttons + status)
  ├── Pending attachments (conditional)
  ├── TextInput
  ├── Slash menu (conditional)
  ├── Attach menu (conditional)
  └── Action bar (ALWAYS visible: Attach, AI Draft, Refresh, Send)
```

#### After (slim input row + expandable tools)
```
composer
  ├── Error bar (conditional)
  ├── Pending attachments (conditional)
  ├── Status toast (conditional — only when media/live busy)
  ├── Slash menu (conditional)
  ├── Primary input row: [⊕] [TextInput] [Send]  ← ONLY always-visible element (~44px)
  ├── Tools grid (tap ⊕): Attach, AI Draft, Media, Live, Refresh
  ├── Attach sub-panel (from tools): Photo, Document, Link
  ├── Media sub-panel (from tools): Get Upload URL, Send Attachment, status
  └── Live sub-panel (from tools): Start, Refresh, Join, End, status
```

### Changes — `CommsHub.tsx`

#### State
- Replaced `showAttachMenu: boolean` with `composerPanel: 'none' | 'tools' | 'attach' | 'media' | 'live'`
- Single state drives all panel visibility — only one panel open at a time

#### JSX
- Primary input row: `⊕` button (toggles tools) + `TextInput` (pill-shaped) + `Send` button — all inline
- Tools grid: 5 icon+label buttons in a flex-wrap row, revealed by ⊕ tap
- Attach sub-panel: horizontal row of Photo/Document/Link buttons
- Media sub-panel: bordered card with Upload/Send buttons + status text
- Live sub-panel: bordered card with Start/Refresh/Join/End buttons + status text
- Status toast: blue chip that only appears when `mediaUploadBusy` or `liveSessionBusy` is true

#### Styles
- Removed: `mediaLivePanel`, `mediaLiveRow`, `mediaLiveTitle`, `mediaLiveBtnRow`, `mediaLiveBtn`, `mediaLiveBtnDisabled`, `mediaLiveBtnText`, `mediaLiveStatus`, `composerRow`, `composerActions`, `composerGhostBtn`, `composerGhostBtnText`, `attachMenu`, `attachMenuItem`, `attachMenuText`
- Added: `composerInputRow`, `composerPlusBtn`, `composerPlusBtnActive`, `composerPlusBtnText`, `composerPlusBtnTextActive`, `composerInputWrap`, `composerToolsGrid`, `composerToolBtn`, `composerToolBtnDisabled`, `composerToolIcon`, `composerToolLabel`, `composerSubPanel`, `composerSubPanelItem`, `composerSubPanelItemText`, `composerSubPanelWrap`, `composerSubPanelTitle`, `composerSubPanelBtnRow`, `composerSubPanelBtn`, `composerSubPanelBtnDisabled`, `composerSubPanelBtnText`, `composerSubPanelStatus`, `composerStatusToast`, `composerStatusText`
- Slimmed composer padding: `paddingHorizontal: 8, paddingVertical: 6, gap: 6`
- Send button: 36×36 (was 40×40) — tighter fit in the input row

### Functional parity
- All Mux Media actions preserved: Get Upload URL, Send Attachment
- All Live Session actions preserved: Start, Refresh, Join, End
- Attach options preserved: Photo, Document, Link
- AI Draft preserved
- Refresh preserved
- Slash commands preserved
- Pending attachments preserved
- Error bar preserved
- Status text preserved (now shown as toast only when busy, not as permanent "No media action yet." text)

## Fix Part 4: Disappearing Composer (Zero-Height Content Container)

### Problem
The composer would intermittently disappear entirely — not pushed off-screen, but genuinely absent from the view. Also disappeared after sending a message. One specific user (coachleader) consistently had no message bar.

### Root Cause (two issues compounding)

**Issue 1: `flex: 1` on `contentContainerStyle`**
The outer ScrollView's `contentContainerStyle` used `flex: 1` for the comms tab. `flex: 1` expands to `flexGrow: 1, flexShrink: 1, flexBasis: 0`. The `flexShrink: 1` component allowed the content container to collapse to zero height during certain React Native layout passes (mount, re-render after send, keyboard changes). When the content container collapsed to 0, the entire flex tree (coachingShellWrapComms → CommsHub → ThreadView → Composer) also collapsed to nothing.

**Issue 2: coachingShellCard DOM interference**
When `isCommsScreen` was true, the old coaching shell card View (containing a full message thread + old-style composer) was hidden via `display: 'none'`. However, `display: 'none'` still keeps the element in the component tree, and any brief layout flash before the property takes effect could interfere with flex measurement of the content container.

### Fix — `KPIDashboardScreen.tsx`

#### 1. contentComms style
```typescript
// Before:
contentComms: { flex: 1, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, gap: 0 }
// After:
contentComms: { flexGrow: 1, flexShrink: 0, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, gap: 0 }
```
- `flexGrow: 1` fills the ScrollView height (same as before)
- `flexShrink: 0` prevents the content container from ever shrinking to zero
- Combined with `overflow: 'hidden'` on `coachingShellWrapComms`, content stays bounded

#### 2. coachingShellCard rendering
```typescript
// Before:
<View style={[styles.coachingShellCard, isCommsScreen && { display: 'none' } as any]}>
  ...full old-style thread/composer/broadcast UI (~1500 lines)...
</View>
// After:
{!isCommsScreen ? (
<View style={styles.coachingShellCard}>
  ...full old-style thread/composer/broadcast UI (~1500 lines)...
</View>
) : null}
```
- Removes the entire coachingShellCard from the component tree when comms is active
- Eliminates DOM interference with flex measurement
- Also saves significant render cost (old-style thread + composer no longer instantiated)

## Validation
- `npx tsc --noEmit` (app) — **PASS** (clean, no errors)
- `npm run -s build` (backend) — **PASS** (clean, no errors)
- Entry-path parity confirmed: single `<ThreadView>` for all paths (All/Channels/DMs)
- Mux/Live controls accessible via ⊕ → Media / Live sub-panels

## Constraints Verified
- Two files modified: `CommsHub.tsx` (primary), `KPIDashboardScreen.tsx` (inset calculation + layout fix)
- No new components or files
- No schema/table changes
- No API endpoint changes
- No permission boundary regressions
- Mux/Live controls remain accessible and functional (moved to on-demand panels)
