# Non-Negotiables

These are hard constraints. Do not violate without explicit owner approval and a logged decision.

## Core Modeling Rules
1. **PC vs Actual GCI must stay separate.**
   - Keep projected values and realized values in distinct fields and flows.
2. **GP/VP must not generate PC.**
   - GP/VP are inputs/indicators and cannot be treated as closed production.
3. **Forecast Confidence modifies display, not base values.**
   - Confidence adjusts presentation/interpretation, not underlying raw calculations.
4. **Pipeline Anchors are required inputs.**
   - Forecast logic must consume defined Pipeline Anchor inputs.

## Data and Audit Rules
5. Every structural change must be reflected in `DECISIONS_LOG.md`.
6. Keep calculation logic deterministic and traceable.
7. Preserve historical records; avoid destructive overwrites.

## Product and Delivery Rules
8. Prefer readable, maintainable solutions over clever abstractions.
9. Keep scope aligned to current sprint unless explicitly approved.
10. Resolve ambiguity in writing before implementation.
