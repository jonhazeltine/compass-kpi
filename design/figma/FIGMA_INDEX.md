# Figma Index

Figma file link: [Compass KPI (Copy)](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-)

## Canonical Flow Groups

| Flow group | Figma source | Current export status | Build status | Notes |
|---|---|---|---|---|
| Onboarding + Auth | `Compass KPI (Copy)` onboarding/login/password reset frames | `exported_composite_png` | `partially_implemented` | Isolated single-screen targets: `auth_welcome_v1.png`, `auth_onboarding_projection_v1.png`, `auth_onboarding_measure_v1.png`, `auth_login_v1.png`, `auth_forgot_password_v1.png`. |
| Agent KPI Core | `Compass KPI (Copy)` dashboard, KPI add/log, notifications, reminders | `exported_composite_png` | `partially_implemented` | Single-screen target: `agent_dashboard_my_qualifiers_v1.png`; `app/screens/KPIDashboardScreen.tsx` exists. |
| Team + Leader | `Compass KPI (Copy)` team dashboard, invites, leaderboards, member profile | `exported_isolated_png_v1 + exported_composite_png` | `in_build` | Canonical isolated exports added for Team dashboard + management screens (`team_*_v1.png`). |
| Challenge Creation + Lifecycle | `Compass KPI (Copy)` create challenge wizard, join, progress, results | `exported_composite_png` | `not_started` | Create Challenge, Create Team Challenge, Manage Challenge & LeaderBoard. |
| Community + Messaging | `Compass KPI (Copy)` messages, 1:1 chat, community feed | `exported_composite_png` | `not_started` | Isolated targets: `messages_inbox_v1.png`, `chat_thread_v1.png`, `community_feed_v1.png`. |
| Coaching + Subscription + Legal/Support | `Compass KPI (Copy)` coaching tab, payment/upgrade, legal, support | `exported_composite_png` | `not_started` | Other Settings and Payment, Subscription. RevenueCat reference-only until billing decision. |

## Canonical Screen Inventory (Versioned exports)

Isolated single-screen exports use `{domain}_{screen}_v{n}.png`. Node-id links: add from Figma (Copy link to selection) when exporting.

| Screen slug | Frame URL (node-id) | Export filename | Dimensions | Status |
|---|---|---|---|---|
| `auth_welcome` | [173-31036](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-31036) | `screens/auth_welcome_v1.png` | `402x896` | `exported_v1` |
| `auth_onboarding_projection` | [173-19124](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-19124) | `screens/auth_onboarding_projection_v1.png` | `402x874` | `exported_v1` |
| `auth_onboarding_measure` | [173-31170](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-31170) | `screens/auth_onboarding_measure_v1.png` | `402x896` | `exported_v1` |
| `auth_login` | [173-31074](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-31074) | `screens/auth_login_v1.png` | `402x896` | `exported_v1` |
| `agent_dashboard_my_qualifiers` | [173-19541](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-19541) | `screens/agent_dashboard_my_qualifiers_v1.png` | `375x1033` | `exported_v1` |
| `auth_forgot_password` | [173-31119](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-31119) | `screens/auth_forgot_password_v1.png` | `402x896` | `exported_v1` |
| `messages_inbox` | TODO | `screens/messages_inbox_v1.png` | — | `pending` |
| `chat_thread` | TODO | `screens/chat_thread_v1.png` | — | `pending` |
| `community_feed` | TODO | `screens/community_feed_v1.png` | — | `pending` |
| `challenge_create_wizard` | TODO | `screens/challenge_create_wizard_v1.png` | — | `mapped` |
| `team_dashboard` | [173-29934](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-29934) | `screens/team_dashboard_v1.png` | `402x952` | `exported_v1` |
| `team_invite_member` | [173-4448](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-4448) | `screens/team_invite_member_v1.png` | `402x952` | `exported_v1` |
| `team_pending_invitations` | [173-4612](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-4612) | `screens/team_pending_invitations_v1.png` | `402x952` | `exported_v1` |
| `team_kpi_settings` | [173-4531](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-4531) | `screens/team_kpi_settings_v1.png` | `402x952` | `exported_v1` |
| `team_pipeline` | [168-16300](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=168-16300) | `screens/team_pipeline_v1.png` | `402x952` | `exported_v1` |
| `team_single_person_challenges` | [173-4905](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-4905) | `screens/team_single_person_challenges_v1.png` | `402x977` | `exported_v1` |
| `team_member_dashboard` | [389-19791](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=389-19791) | `screens/team_member_dashboard_v1.png` | `402x952` | `exported_v1` |
| `team_member_team_challenges` | [389-21273](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=389-21273) | `screens/team_member_team_challenges_v1.png` | `402x977` | `exported_v1` |
| `challenge_list_member` | [168-16436](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=168-16436) | `screens/challenge_list_member_v1.png` | `402x952` | `exported_v1` |
| `challenge_details_progress` | [173-13190](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-13190) | `screens/challenge_details_progress_v1.png` | `402x952` | `exported_v1` |
| `challenge_leaderboard_results` | [388-11502](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=388-11502) | `screens/challenge_leaderboard_results_v1.png` | `402x952` | `exported_v1` |
| `coaching_overview` | TODO | `screens/coaching_overview_v1.png` | — | `mapped` |

## Component Sheets (Versioned exports)

Reusable primitives for auth + dashboard. Target: `components/{domain}_{component_set}_v{n}.png`.

| Component set | Export filename | Status |
|---|---|---|
| Buttons | `components/core_buttons_v1.png` | `exported_v1` |
| Inputs | `components/core_inputs_v1.png` | `exported_v1` |
| Tabs / chips | `components/core_tabs_chips_v1.png` | `exported_v1` |
| Cards | `components/core_cards_v1.png` | `exported_v1` |
| Icons | `components/core_icons_v1.png` | `exported_v1` |
| Nav bars | `components/core_nav_bars_v1.png` | `pending` |
| Chart widgets | `components/core_chart_widgets_v1.png` | `pending` |
| Badges | `components/core_badges_v1.png` | `pending` |

## Export Instructions

1. Export single screens to `design/figma/exports/screens/` as PNG (versioned names).
2. Export multi-step flows to `design/figma/exports/flows/` as PDF or ordered PNG set.
3. Export component sheets to `design/figma/exports/components/`.
4. Naming: `{domain}_{screen_or_flow}_v{n}.{ext}` (see `exports/README.md`).
5. When replacing a canonical frame, keep prior export and increment `v{n}`.
6. After each export batch, update this file and `docs/spec/appendix/FIGMA_BUILD_MAPPING.md`. Record dimensions in this index when available.

## Node-id links added (this batch)

| Screen / component | Node-id link |
|---|---|
| `auth_welcome` | [173-31036](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-31036) |
| `auth_onboarding_projection` | [173-19124](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-19124) |
| `auth_onboarding_measure` | [173-31170](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-31170) |
| `auth_login` | [173-31074](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-31074) |
| `auth_forgot_password` | [173-31119](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-31119) |
| `agent_dashboard_my_qualifiers` | [173-19541](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-19541) |
| `team_dashboard` | [173-29934](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-29934) |
| `team_invite_member` | [173-4448](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-4448) |
| `team_pending_invitations` | [173-4612](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-4612) |
| `team_kpi_settings` | [173-4531](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-4531) |
| `team_pipeline` | [168-16300](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=168-16300) |
| `team_single_person_challenges` | [173-4905](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-4905) |
| `team_member_dashboard` | [389-19791](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=389-19791) |
| `team_member_team_challenges` | [389-21273](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=389-21273) |
| `challenge_list_member` | [168-16436](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=168-16436) |
| `challenge_details_progress` | [173-13190](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=173-13190) |
| `challenge_leaderboard_results` | [388-11502](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-?node-id=388-11502) |

All other screens/components: node-id TODO until frame is selected in Figma and link copied (or mapped via API inventory).

## Figma API (frame inventory)

To list all frames with node ids from the file, use the Figma REST API script (requires a [personal access token](https://www.figma.com/settings)):

```bash
FIGMA_TOKEN=xxx node design/figma/scripts/list-frames.mjs
```

See `design/figma/scripts/README.md` for setup. Export of PNGs is still manual or via Figma API image endpoints.

## Missing / blocked assets

- **Programmatic export:** Figma MCP still does not provide file structure listing or downloadable image URLs in this environment, but Figma REST API export is working and was used for Team isolated screen exports (`team_*_v1.png`).
- **Isolated frames:** `agent_dashboard_my_qualifiers_v1.png` is now mapped to frame node `173-19541` and exported.
- **Runbook:** See `design/figma/exports/EXPORT_BATCH_V1.md` for step-by-step export and how to capture node-ids.
- **Programmatic frame inventory:** `design/figma/FRAME_INVENTORY.md` and `design/figma/FRAME_INVENTORY.csv` are generated from Figma REST API to accelerate mapping.

## Raw SVG Batch (v1)

- Source folder: `design/figma/exports/raw_svg_batch_v1`
- Analysis outputs:
  - `design/figma/exports/raw_svg_batch_v1/_analysis/README.md`
  - `design/figma/exports/raw_svg_batch_v1/_analysis/svg_manifest.csv`
  - `design/figma/exports/raw_svg_batch_v1/_analysis/svg_summary.json`
- Canonical deduped library:
  - `design/figma/exports/components/svg_library_v1/`
- Current status:
  - Raw SVGs analyzed and deduped for mapping/rename support.
  - FE-00 required component-sheet PNG exports generated:
    - `components/core_buttons_v1.png` (`1088x652`)
    - `components/core_inputs_v1.png` (`1088x652`)
    - `components/core_tabs_chips_v1.png` (`1088x652`)
    - `components/core_cards_v1.png` (`1088x472`)
    - `components/core_icons_v1.png` (`1088x1012`)
  - Source node manifest: `design/figma/exports/components/core_component_sheets_manifest_v1.json`

## Legacy / previous export filenames (reference)

Previously used or composite exports (not versioned in current convention):

- `What if the work you do today,  V1.png`, `Onboarding.png`, `Onboarding-1.png`, `Measure What Matters.png`, `Measure What Matters-1.png`
- `Login.png`, `Other Settings and Payment.png`, `Other Settings and Payment-1.png`
- `Dashboard and KPI.png`, `Dashboard and KPI-1.png`, `Create Challenge.png`, `Create Challenge-1.png`
- `Manage Team.png`, `Manage Challenge & LeaderBoard.png`, `Create Team Challenge.png`
- `Compass Kpi, Mobile app design, mobile ui, ui design, mobile design. ui ux design, app design.png`
- `Step 67.png`, `Step 68.png`, `Profile.png`, `Sponsered Challenges.png`, `Subscription.png`, `Frame 238249.png`
