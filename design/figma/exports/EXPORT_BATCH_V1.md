# Export Batch V1 — Compass KPI

Target batch for isolated single-screen assets and component sheets. Naming follows `design/figma/exports/README.md`.

## Why manual export

Figma MCP in this environment does not return:
- File structure / list of frame node-ids.
- Downloadable asset URLs from `get_screenshot` or `get_design_context` (images are display-only; design context returns debug IDs for section children).

To get pixel-perfect assets into the repo, export from Figma manually (or use Figma REST API with a file token and node-ids).

## How to get node-ids

1. Open [Compass KPI (Copy)](https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-).
2. Select the **frame** for the screen (single screen, not the whole section).
3. Right-click → **Copy link to selection**, or copy from the URL: `...?node-id=XXX-YYY` → node-id is `XXX:YYY` for API.
4. Paste the node-id into `design/figma/FIGMA_INDEX.md` for that screen slug.

## Screens to export (isolated single-screen PNG)

| Screen slug | Target filename | Folder | Status |
|---|---|---|---|
| `auth_welcome` | `auth_welcome_v1.png` | `screens/` | pending |
| `auth_onboarding_projection` | `auth_onboarding_projection_v1.png` | `screens/` | pending |
| `auth_onboarding_measure` | `auth_onboarding_measure_v1.png` | `screens/` | pending |
| `auth_login` | `auth_login_v1.png` | `screens/` | pending |
| `agent_dashboard_my_qualifiers` | `agent_dashboard_my_qualifiers_v1.png` | `screens/` | pending (node-id 173-4988 is section; use child frame for single screen) |
| `auth_forgot_password` | `auth_forgot_password_v1.png` | `screens/` | pending |
| `messages_inbox` | `messages_inbox_v1.png` | `screens/` | pending |
| `chat_thread` | `chat_thread_v1.png` | `screens/` | pending |
| `community_feed` | `community_feed_v1.png` | `screens/` | pending |

Export at 1x or 2x; record dimensions in FIGMA_INDEX after export.

## Component sheets to export (reusable primitives)

Used by auth + dashboard. One PNG (or PDF) per sheet; place in `components/`.

| Component set | Target filename | Status |
|---|---|---|
| Buttons | `core_buttons_v1.png` | pending |
| Inputs | `core_inputs_v1.png` | pending |
| Tabs / chips | `core_tabs_chips_v1.png` | pending |
| Cards | `core_cards_v1.png` | pending |
| Icons | `core_icons_v1.png` | pending |
| Nav bars | `core_nav_bars_v1.png` | pending |
| Chart widgets | `core_chart_widgets_v1.png` | pending |
| Badges | `core_badges_v1.png` | pending |

## Flows (if any)

Multi-step flows → `flows/` as PDF or `{flow}_step_{nn}_v1.png`.

- Onboarding + Auth flow: optional `auth_onboarding_v1.pdf` or step PNGs.
- Add KPI flow: optional `agent_add_kpi_v1.pdf` or step PNGs.

## After exporting

1. Put files in `design/figma/exports/screens/`, `components/`, or `flows/`.
2. Update `design/figma/FIGMA_INDEX.md`: set export filename, node-id URL, status, dimensions.
3. Update `docs/spec/appendix/FIGMA_BUILD_MAPPING.md`: set export reference and status.
