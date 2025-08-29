# Pitch One — Fruitful Search (2025-08-29)

Copied pitch methodology from sibling project (conch) for consistency. We’ll track each pitch as a small, end‑to‑end slice with clear phases.

## Pitch Methodology
Each pitch is a small, end‑to‑end slice of work tracked in the devlog and executed in clearly separated phases. Do not implement before agreement.

- Phase 0 — Proposal (open)
  - Create a new devlog entry `devlog/YYYY-MM-DD-<topic>.md` from the template.
  - Fill: Summary, Goals (measurable), Acceptance Criteria, Out‑of‑Scope, Open Questions.
  - Status: Proposed. No code changes in this phase.

- Phase 1 — Alignment (agree)
  - Discuss and refine objectives in the devlog or PR comments.
  - Edit the devlog until both parties agree on scope and acceptance criteria.
  - Mark Status: Agreed (include date/initials). Only after this, proceed.

- Phase 2 — Development
  - Implement the agreed scope with focused patches; avoid scope creep.
  - Update/add tests alongside code; keep tests network‑free.
  - Integrate CI changes if needed and update docs/help where relevant.
  - Record notable decisions in the devlog’s Actions section.

- Phase 3 — Wrap‑Up
  - Format code: `uv run black .` (or `uvx black .`).
  - Run tests: `uv run pytest -q`; ensure CI passes.
  - Update devlog: Outcomes vs. Goals, links to files/PR, follow‑ups.
  - Final commit message suggestion: `pitch: <topic> — <short summary>`.
    - Note: In Codex CLI runs, agents usually don’t commit; maintainers handle commit/merge.

### Pitch Template
- Template file: `devlog/pitch-template.md`
- Create a new entry from the template:
  - `cp devlog/pitch-template.md "devlog/$(date +%F)-<topic>.md"`
  - Fill in placeholders for date/topic and sections.

