# Figma Exports

This directory stores exported design references used for implementation.

## Folders

- `screens/`: single-screen PNG exports.
- `flows/`: multi-screen journey exports (PDF or ordered PNG series).
- `components/`: component sheets and reusable UI references.

## Naming Convention

Use stable, versioned names:

- Screens: `{domain}_{screen}_v{n}.png`
- Flows: `{domain}_{flow}_v{n}.pdf` (or `{domain}_{flow}_step_{nn}_v{n}.png`)
- Components: `{domain}_{component_set}_v{n}.png`

Examples:

- `auth_login_v1.png`
- `challenge_create_wizard_v1.pdf`
- `core_inputs_v2.png`

## Update Rules

1. Never overwrite by filename without version bump.
2. Keep historical versions for implementation traceability.
3. After any export drop, update:
   - `design/figma/FIGMA_INDEX.md`
   - `docs/spec/appendix/FIGMA_BUILD_MAPPING.md`

## Current batch

See **`EXPORT_BATCH_V1.md`** in this folder for the current asset batch: screen list, component sheets, versioned filenames, and manual export runbook (Figma MCP does not provide downloadable asset URLs in this environment).
