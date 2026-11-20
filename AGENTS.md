# AGENTS.md — cangjit-knowledge-base

This repository is the shared knowledge base for the cangjit project. It holds
everything agents discover or decide while working on cangjit, so that
knowledge survives across sessions and agents. Code lives in the cangjit
repository; this repository holds only knowledge artifacts.

## Layout

| Folder    | Contents                                                                 | Format              |
|-----------|--------------------------------------------------------------------------|---------------------|
| `ai-docs/`   | Information the user explicitly asked an agent to scout for (research results, investigations, answers). | Markdown (`.md`) |
| `ai-insides/`| Information agents acquired that is needed for project understanding (how things work, gotchas, environment quirks). | Any format        |
| `ai-issues/` | Proposals and issues — each with a name, priority, and brief description. | Markdown (`.md`) |
| `arch/`      | Architecture designs and decisions that were taken.                      | Markdown (`.md`) |

## Rules per folder

### `ai-docs/` — scouted information (user-requested)

* One topic per file, named `kebab-case.md` (e.g. `lazy-compilation-research.md`).
* Every file starts with a one-line summary of the question it answers.
* Record facts with their sources: file paths, symbol names, URLs, commands.
* Written when the user asks an agent to scout/research something — before or
  after the answer is given in chat, but always before the session ends.

### `ai-insides/` — project-understanding notes

* Anything an agent had to figure out to do its job that is not already
  obvious from the cangjit source: build quirks, invariants, pipeline
  behavior, debugging recipes.
* Any format is acceptable (`.md`, `.txt`, logs, scripts, notes dumps).
* Prefer appending to an existing note over creating near-duplicates;
  date-stamp appended sections.

### `ai-issues/` — issues and proposals

One file per issue or proposal, named `NNN-short-name.md` (sequential number,
e.g. `001-jit-abi-mismatch.md`). Each file begins with:

```markdown
# <Issue name>

Priority: <P0 | P1 | P2 | P3>

<One-paragraph brief description: what is wrong / what is proposed.>

```

Priority meanings: **P0** blocks current work, **P1** must be fixed soon,
**P2** should be fixed, **P3** nice to have. The rest of the file carries
evidence: reproduction, affected files, proposed approach. Update priority in
place when it changes; add a `Closed:` line rather than deleting the file.

### `arch/` — architecture designs

* One file per design or decision that was taken (e.g. `jit-tiering.md`).
* State the decision, the alternatives considered, and why this one won.
* When a design changes, update the file — it must always reflect what is
  currently decided, not history. Superseded designs are deleted, not kept.

## Sync rules

* This repository is agent-maintained: agents are permitted to commit to and
  push it directly (no human approval needed per commit). Push after each
  meaningful batch of knowledge, not once at session end.
* The user works from multiple PCs: at session start and before every push,
  run `git pull --rebase` (or `git fetch` + rebase) and resolve any conflicts
  by keeping both sides' knowledge — never drop another machine's notes.
* Do not force-push. If the history diverged unexpectedly, merge instead.

## General rules

* Write into this repository as work happens, not at the end of a session —
  a crashed session must not lose acquired knowledge.
* Do not put secrets, tokens, or large binary artifacts here.
* Commit messages follow the cangjit convention: concise subject line.
* See `AGENTS_CANGJIT.md` for how this knowledge base is used from within the
  cangjit repository, including the change pipeline that applies there.
