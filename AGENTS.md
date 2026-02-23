# Compass KPI Agent Governance

## Required Reads Before Any Proposal or Change
Always read these files first:
- `/architecture/ARCHITECTURE.md`
- `/architecture/NON_NEGOTIABLES.md`
- `/architecture/CURRENT_SPRINT.md`

## Hard Rules
1. If a request conflicts with `/architecture/NON_NEGOTIABLES.md`, stop and propose compliant alternatives.
2. If any structural change is made (folder structure, schema, API boundaries), update `/architecture/DECISIONS_LOG.md` in the same change set.
3. If requested work is not in `/architecture/CURRENT_SPRINT.md`, stop and ask for explicit approval.
4. Prefer simple, readable documentation.
5. Avoid framework wars and overengineering.

## Operating Principles
- Keep decisions traceable in repo docs.
- Keep architecture and specs as the source of truth.
- Ship clarity first, then implementation.
- For design assets, use source exports (Figma/API/manual SVG/PNG) rather than cropping/extracting from composite screenshots or sheets for production UI work. Composite extraction may be used only for temporary review mocks when explicitly approved.
