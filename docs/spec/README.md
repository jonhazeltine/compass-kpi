# Engineering Spec Index

Use this directory to break the master engineering spec into maintainable markdown chunks.

Guidance for future agents: Prefer markdown chunks; full master spec lives in `appendix`.

## Master Source
- Primary source file: `docs/spec/appendix/Master Spec.md`
- Keep this index synced whenever sections are updated.
- Figma implementation mapping: `docs/spec/appendix/FIGMA_BUILD_MAPPING.md`

## Chunked Sections
- `00_vision.md`: product goals, users, outcomes
- `01_system_overview.md`: system boundaries, modules, data flow
- `02_data_model.md`: entities, relationships, core constraints
- `03_engines.md`: KPI + forecast + challenge behavior rules
- `04_api_contracts.md`: endpoint surface, request/response patterns
- `05_acceptance_tests.md`: scenario-driven acceptance criteria

## Appendix Runbooks
- `appendix/M6_REALISM_DATA_PACK_UI_EVALUATION.md`: deterministic coaching seed/run/smoke runbook for `/coach/*` + mobile UI realism evaluation
- `appendix/COACHING_W12_FOURTHREASON_CHAT_PARITY_MAP.md`: Fourth Reason chat/journey UX pattern parity map to Compass mobile + `/coach/*` routes/contracts (no new endpoint families)
- `appendix/COACHING_W12_DRAGDROP_LIBRARY_TO_JOURNEY_SPEC.md`: implementation-ready drag/drop authoring UX spec + build map for `/coach/library` -> `/coach/journeys` using existing contract families with explicit in-family gaps

## Working Rules
- Keep sections concise and plain English.
- Capture non-negotiables explicitly where relevant.
- Record structural architecture changes in `architecture/DECISIONS_LOG.md`.
