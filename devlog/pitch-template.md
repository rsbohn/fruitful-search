## YYYY-MM-DD — Pitch: <topic>

### Status
- Proposed | Agreed (YYYY-MM-DD initials) | In Progress | Done

### Summary
- One paragraph describing the intent and outcome of the pitch.

### Goals
- [ ] Goal 1 (measurable)
- [ ] Goal 2 (verification: tests/CI/docs)
- [ ] Goal 3

### Acceptance Criteria
- Clear, testable statements for completion and verification.

### Out of Scope
- Items explicitly not included in this pitch.

### Open Questions
- Clarifications to resolve before implementation begins.

### Actions (Development Phase)
- Planned work items or steps to achieve the goals. Keep focused and incremental.

### Artifacts
- Code: paths to changed files (e.g., `src/...`, `.github/workflows/...`)
- Docs: updated guides or READMEs
- Tests: new/updated tests

### Repro
- Setup: `uv sync --group dev`
- Tests: `uv run pytest -q`
- App (smoke): `uv run python main.py --test`

### Notes
- Decisions, tradeoffs, and risks/assumptions.

### Wrap-up
- Formatting: `uv run black .` (or `uvx black .`)
- Update this entry with outcomes: which goals were met? links/paths.
- Commit message suggestion:
  - `pitch: <topic> — <short summary>`
