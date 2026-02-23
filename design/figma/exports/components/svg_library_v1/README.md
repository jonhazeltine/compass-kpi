# SVG Library v1

Canonical unique SVG assets generated from `design/figma/exports/raw_svg_batch_v1`.

## Purpose
- Remove duplicate raw exports.
- Normalize names into category-prefixed canonical files.
- Provide a stable source library for component-sheet assembly.

## Source and Generation
- Source batch: `design/figma/exports/raw_svg_batch_v1`
- Analysis outputs:
  - `design/figma/exports/raw_svg_batch_v1/_analysis/svg_manifest.csv`
  - `design/figma/exports/raw_svg_batch_v1/_analysis/svg_summary.json`
  - `design/figma/exports/raw_svg_batch_v1/_analysis/README.md`
- Generator script:
  - `design/figma/scripts/analyze-svg-batch.mjs`

## Category Mapping (for FE-00 component sheets)
- `icon/` -> candidate source for `core_icons_v1.png`
- `chart_widget/` -> candidate source for chart widget subset in future `core_chart_widgets_v1.png`
- `device_chrome/` -> exclude from FE-00 component sheets unless explicitly needed
- `raw_fragment/` -> low-level fragments; usually not direct design-system assets

## Notes
- FE-00 gate still requires exported **PNG component sheets**:
  - `core_buttons_v1.png`
  - `core_inputs_v1.png`
  - `core_tabs_chips_v1.png`
  - `core_cards_v1.png`
  - `core_icons_v1.png`
- This library accelerates assembly and naming, but does not replace required sheet exports.
