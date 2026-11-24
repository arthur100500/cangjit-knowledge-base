# cangjit-knowledge-base

Knowledge base for the cangjit JIT project. `cangjit` (code) and this repo are
sibling checkouts; root rules live in cangjit's `AGENTS.md` (change pipeline
gates, build via `./build.sh`, examples verification).

## Layout

- `ai-docs/` — scouting notes and reference docs (function frames, metadata
  layout, lazy stub, native stack/exceptions, GC, state assertions). Kept intact.
- `ai-insights/` — durable ABI insights: stack frames, lazy compilation,
  stack-frame diagram, object allocation.
- `ai-issues/` — open issues and proposals; `NNN-name.md`, one file per issue.
- `arch/` — accepted architecture decisions.
- `tasks.json` — task board (dashboard input; dashboard source in `dashboard/`).

## Knowledge compaction (2026-11-24)

Removed `unfinished/` (session dumps and patches — all patches are already in
cangjit git history: `bcf2836c`…`676c60dea3`), per-file review issues 002–049
(duplicates of the 050 checklist) and 15 abi-insights notes superseded by the
kept ones. Task board compacted from 137 to 19 tasks (done history + open
backlog only). Issues 050–063 and `ai-docs/` are unchanged.
