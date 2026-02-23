# M3b Dashboard Gamification + Interaction Polish Checklist

## Purpose
This checklist defines the approved, time-boxed `M3b` scope exception for dashboard gamification and interaction polish. It translates animation/audio requirements from `docs/spec/appendix/Master Spec.md` into an implementation-ready backlog.

## Scope Boundary
- Focus surface: mobile Home dashboard gameplay loop (`chart/visual + logging controls`)
- Time-box: 1 week (or equivalent effort slice)
- Goal: improve game feel and interaction polish without expanding into Challenge/Team feature work

## Status Key
- `todo`: not started
- `in_progress`: active implementation
- `blocked`: waiting on external assets/tooling/decision
- `done`: implemented and validated

## Runtime Stack (Approved for M3b)
- UI motion: `react-native-reanimated`, React Native `Animated`
- Gestures: `react-native-gesture-handler`
- Haptics: `expo-haptics`
- Animation slots / authored motion: `lottie-react-native`
- Audio/SFX (planned): `expo-audio` (preferred Expo SDK path; install when audio implementation starts)

## M3b Checklist (Dashboard + Logging Core)
| ID | Item | Spec Reference(s) | Surface | Delivery Type | Asset Dependency | Status | Notes |
|---|---|---|---|---|---|---|---|
| M3B-ANIM-001 | Finalize mode rail wrap animation (no directional wrap flicker) | `Master Spec.md:131`, `Master Spec.md:283` | Dashboard header rail | Code-only | none | in_progress | Must match KPI/chart wrap direction behavior. |
| M3B-ANIM-002 | Tune panel transitions (`Quick/Projections/Growth/Vitality`) with snappy slide + parallax-lite | `Master Spec.md:131`, `Master Spec.md:283` | Dashboard visual + KPI grid | Code-only | none | done | Tightened transition timing and added subtle parallax-lite differential movement between visual and KPI grid tracks. |
| M3B-ANIM-003 | KPI tile tap feedback (press-in, release, visual confirmation) | `Master Spec.md:138`, `Master Spec.md:967` | Dashboard KPI grid | Code-only | none | done | Home + Log dashboard KPI tiles now animate press-in/release scale and brief confirmation ring/label highlight on tap. |
| M3B-ANIM-004 | KPI log success micro-feedback (pulse/float/count cue) | `Master Spec.md:138`, `Master Spec.md:967` | Dashboard KPI grid / chart context | Code-only (first pass) | optional Lottie | done | Added per-tile success `+1` float/pulse cue after successful KPI log response; repeat-safe and scoped to tapped tile. |
| M3B-ANIM-005 | Press-and-hold rapid log feedback loop (accelerating visual response) | `Master Spec.md:967` | Dashboard KPI grid | Code + UX logic | none | todo | Sound/haptic “flurry” can be staged behind feature flag until audio pass. |
| M3B-ANIM-006 | Chart reaction cues on KPI log (marker pulse / subtle forecast reaction) | `Master Spec.md:138`, `Master Spec.md:283` | Dashboard chart | Code-only | none | done | Added subtle chart current-marker pulse reaction after successful KPI log response; confidence/base values remain unchanged. |
| M3B-ANIM-007 | Boost chip state animation in chart context (locked -> attention pulse / active glow) | `Master Spec.md:138`, `Master Spec.md:283` | Dashboard chart overlay | Code-only (first pass) | optional art | done | Locked GP/VP boost chips now run a subtle attention pulse (first-pass, no custom art assets required). |
| M3B-ANIM-008 | Growth visual module upgrade (city visual socket with ambient motion) | `Master Spec.md:138`, `Master Spec.md:285` | Dashboard Growth mode | Hybrid | preferred Lottie/assets | blocked | `Growth = city`. Placeholder acceptable only if motion-ready. |
| M3B-ANIM-009 | Vitality visual module upgrade (tree visual socket with ambient motion) | `Master Spec.md:138`, `Master Spec.md:285` | Dashboard Vitality mode | Hybrid | preferred Lottie/assets | blocked | `Vitality = tree`. |
| M3B-ANIM-010 | Projections visual polish (chart entry/idle micro-motion) | `Master Spec.md:138`, `Master Spec.md:283` | Dashboard Projections mode | Code-only | none | todo | Keep subtle to avoid obscuring data readability. |
| M3B-ANIM-011 | Bottom tab bar motion polish (active-state feedback and transitions) | `Master Spec.md:131`, `Master Spec.md:296` | Global nav (mobile) | Code-only | none | done | Added active-tab emphasis pill and subtle active-state pulse animation (M3b-limited polish pass). |
| M3B-ANIM-012 | Header/garage visual polish (active mode emphasis, icon state transitions) | `Master Spec.md:131`, `Master Spec.md:296` | Dashboard mode header | Code-only | optional icon art | done | Added active mode lane pulse emphasis in dashboard header rail; player-facing labels preserved. |

## Audio + Haptics Checklist (M3b)
| ID | Item | Spec Reference(s) | Surface | Delivery Type | Asset Dependency | Status | Notes |
|---|---|---|---|---|---|---|---|
| M3B-AUDIO-001 | Install and wire `expo-audio` baseline playback utility | `Master Spec.md:138`, `Master Spec.md:174`, `Master Spec.md:283` | Mobile app runtime | Code-only | none | done | `expo-audio` installed (Expo SDK 54-compatible) with Expo plugin config and baseline `app/lib/feedback.ts` audio session priming/utility hooks. |
| M3B-AUDIO-002 | Add haptic feedback map for KPI log actions (light/medium/success) | `Master Spec.md:138`, `Master Spec.md:967` | Dashboard KPI logging | Code-only | none | done | `expo-haptics` map wired for tap/success/error/warning in core KPI logging interactions; reduced-intensity toggle deferred. |
| M3B-AUDIO-003 | Add sound cue hooks by KPI currency type (PC/GP/VP/Custom/GCI) | `Master Spec.md:138`, `Master Spec.md:285` | Dashboard KPI logging | Code + asset wiring | audio files required | in_progress | Hook points landed via `playKpiTypeCueAsync`; final per-type SFX asset wiring still blocked pending audio files. |
| M3B-AUDIO-004 | Press-and-hold rapid log audio layering/flurry (throttled) | `Master Spec.md:967` | Dashboard KPI logging | Code + asset wiring | audio files required | blocked | Must avoid clipping/stack explosion. |
| M3B-AUDIO-005 | User-level audio mute/volume behavior placeholder (dev toggle acceptable for M3b) | `Master Spec.md:174`, `Master Spec.md:283` | Mobile UX settings / dev controls | Code-only | none | done | Added dev-facing SFX control in dashboard header (`tap` mute/unmute, `long press` cycle volume) for M3b testing. |

## External Asset / Tool Inputs (Not Codex-Generated)
These items are expected to come from Figma/AE/Blender/Lottie/SFX tooling and are not production-quality candidates for screenshot extraction:

- GP city visual animation assets (`.json` Lottie and/or layered PNGs)
- VP tree visual animation assets (`.json` Lottie and/or layered PNGs)
- KPI log success effect animation assets (optional Lottie)
- Audio SFX set by currency type:
  - PC
  - GP
  - VP
  - GCI / Deal Closed
  - Custom KPI
- Optional header and bottom-nav decorative motion assets

## Acceptance (M3b Animation/Audio)
1. Dashboard mode switching feels directionally consistent and responsive (no visible wrap flicker).
2. KPI logging provides immediate visual response on tap and success.
3. Haptics are active for core logging interactions and are not overly aggressive.
4. GP and VP modes have distinct visual identities (`Growth=city`, `Vitality=tree`) with motion-ready modules.
5. Bottom tab and dashboard header present a coherent gamified interaction layer.
6. No regressions to dashboard data integrity or non-negotiables:
   - PC vs Actual separation
   - GP/VP not treated as PC
   - confidence display-only
   - pipeline anchors remain forecast inputs

## Notes
- This checklist is intentionally execution-focused and narrower than the broader `M7` visual polish scope.
- If a checklist item exceeds the M3b time-box, ship the simpler version and defer the remainder to `M7` backlog.
