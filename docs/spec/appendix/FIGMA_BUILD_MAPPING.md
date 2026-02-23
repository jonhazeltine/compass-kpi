# Figma Build Mapping

## Purpose
Map canonical Figma flows/screens to concrete Expo implementation targets and acceptance checks.

## Status Legend
- `reference_only`: imported for design reference only, not in active implementation.
- `mapped`: implementation target decided, not started.
- `in_build`: active implementation.
- `implemented_v1`: first implementation complete.

**Export status:** Exports use versioned filenames under `design/figma/exports/`. `export_pending` = target filename defined, asset not yet exported from Figma.

## Current App Baseline
- Auth gate and session flow: `app/App.tsx`
- Login screen: `app/screens/LoginScreen.tsx`
- Home wrapper: `app/screens/HomeScreen.tsx`
- KPI dashboard (first-pass): `app/screens/KPIDashboardScreen.tsx`

## Mapping Table

| Area | Figma flow/screen slug | Export reference target | Export status | Expo target (file/route) | Acceptance linkage | Status | Notes |
|---|---|---|---|---|---|---|---|
| Auth | `auth_welcome` | `design/figma/exports/screens/auth_welcome_v1.png` | exported_v1 | new auth intro screen in app flow | `05_acceptance_tests.md` scenario 1 | mapped | Node-id: `173-31036`. |
| Auth | `auth_onboarding_projection` | `design/figma/exports/screens/auth_onboarding_projection_v1.png` | exported_v1 | new onboarding step screen | `05_acceptance_tests.md` scenario 1 | mapped | Node-id: `173-19124`. |
| Auth | `auth_onboarding_measure` | `design/figma/exports/screens/auth_onboarding_measure_v1.png` | exported_v1 | new onboarding step screen | `05_acceptance_tests.md` scenario 1 | mapped | Node-id: `173-31170`. |
| Auth | `auth_login` | `design/figma/exports/screens/auth_login_v1.png` | exported_v1 | `app/screens/LoginScreen.tsx` | `05_acceptance_tests.md` scenario 1 | in_build | Node-id: `173-31074`. |
| Auth | `auth_forgot_password` | `design/figma/exports/screens/auth_forgot_password_v1.png` | exported_v1 | new forgot password screen | `05_acceptance_tests.md` scenario 1, edge E2 | mapped | Node-id: `173-31119`. |
| Agent Core | `agent_dashboard_my_qualifiers` | `design/figma/exports/screens/agent_dashboard_my_qualifiers_v1.png` | exported_v1 | `app/screens/KPIDashboardScreen.tsx` | `05_acceptance_tests.md` scenarios 2-7 | implemented_v1 | Node-id: `173-19541`. |
| Agent Core | `agent_add_kpi` | `design/figma/exports/screens/agent_add_kpi_v1.png` (or flow) | pending | new add KPI flow screens | `05_acceptance_tests.md` scenarios 2-6 | mapped | |
| Agent Core | `agent_notifications` | `design/figma/exports/screens/agent_notifications_v1.png` | pending | new notifications screen | future communication acceptance cases | mapped | |
| Team | `team_dashboard` | `design/figma/exports/screens/team_dashboard_v1.png` | pending | new team dashboard screen | `05_acceptance_tests.md` scenarios 8-9 | mapped | |
| Team | `team_membership_invites` | `design/figma/exports/screens/team_membership_invites_v1.png` | pending | new team member management screens | `05_acceptance_tests.md` scenario 8 | mapped | |
| Challenge | `challenge_create_wizard` | `design/figma/exports/screens/challenge_create_wizard_v1.png` | pending | new challenge creation stack/screens | `05_acceptance_tests.md` scenarios 7-9, edge E6 | mapped | |
| Challenge | `challenge_progress_results` | `design/figma/exports/screens/challenge_progress_results_v1.png` | pending | new challenge progress/results screens | `05_acceptance_tests.md` scenarios 7, 10 | mapped | |
| Communication | `messages_inbox` | `design/figma/exports/screens/messages_inbox_v1.png` | pending | new messages tab screen | future communication acceptance cases | mapped | |
| Communication | `chat_thread` | `design/figma/exports/screens/chat_thread_v1.png` | pending | new chat thread screen | future communication acceptance cases | mapped | |
| Community | `community_feed` | `design/figma/exports/screens/community_feed_v1.png` | pending | new community feed screen | future communication acceptance cases | mapped | |
| Coaching | `coaching_overview` | `design/figma/exports/screens/coaching_overview_v1.png` | pending | new coaching tab screens | future coaching acceptance cases | mapped | |
| Billing | `upgrade_to_pro` | `design/figma/exports/screens/upgrade_to_pro_v1.png` | pending | reference-only until billing decision | N/A | reference_only | Do not implement RevenueCat-specific behavior pre-decision. |
| Support | `support_legal` | `design/figma/exports/screens/support_legal_v1.png` | pending | new static screens (later) | future support acceptance cases | mapped | |

## Component sheet export references

| Component set | Export reference target | Export status |
|---|---|---|
| Buttons | `design/figma/exports/components/core_buttons_v1.png` | exported_v1 |
| Inputs | `design/figma/exports/components/core_inputs_v1.png` | exported_v1 |
| Tabs / chips | `design/figma/exports/components/core_tabs_chips_v1.png` | exported_v1 |
| Cards | `design/figma/exports/components/core_cards_v1.png` | exported_v1 |
| Icons | `design/figma/exports/components/core_icons_v1.png` | exported_v1 |
| Nav bars | `design/figma/exports/components/core_nav_bars_v1.png` | pending |
| Chart widgets | `design/figma/exports/components/core_chart_widgets_v1.png` | pending |
| Badges | `design/figma/exports/components/core_badges_v1.png` | pending |

## Node-id links (Figma)

| Screen / component | Node-id link |
|---|---|
| `auth_welcome` | [173-31036](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-31036) |
| `auth_onboarding_projection` | [173-19124](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-19124) |
| `auth_onboarding_measure` | [173-31170](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-31170) |
| `auth_login` | [173-31074](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-31074) |
| `auth_forgot_password` | [173-31119](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-31119) |
| `agent_dashboard_my_qualifiers` | [173-19541](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-19541) |

All other screens: add node-id after selecting frame in Figma and copying link to selection (or map from `design/figma/FRAME_INVENTORY.md`).

## Missing / blocked assets

- **No programmatic export in this run:** Figma MCP does not expose file structure (frame list) or downloadable image URLs in the current environment. All target filenames and mapping are in place; assets must be exported manually from Figma or via Figma REST API.
- **Isolated single-screen exports still required:** messages_inbox, chat_thread, community_feed, plus remaining mapped screens not yet exported. Runbook: `design/figma/exports/EXPORT_BATCH_V1.md`.

## Immediate Next Build Slice

1. Visual parity refresh for `app/screens/LoginScreen.tsx` against `auth_login`.
2. Introduce minimal onboarding stack (`auth_welcome`, `auth_onboarding_projection`, `auth_onboarding_measure`) before login.
3. Keep `KPIDashboardScreen` as v1 baseline while challenge/team surfaces are scaffolded.

## Export backfill (batch V1)

Versioned targets are defined. To complete the batch:

1. Export isolated single-screen PNGs for remaining pending screens (at minimum: messages_inbox, chat_thread, community_feed).
2. Export component sheets: buttons, inputs, tabs/chips, cards, icons, nav bars, chart widgets, badges.
3. Optional: flow PDFs or step PNGs in `design/figma/exports/flows/`.
4. Update FIGMA_INDEX and this file with node-id URLs and dimensions after each export.
