# AGENTS.md — cangjit-knowledge-base

This repository is the shared knowledge base for the cangjit project. It holds
everything agents discover or decide while working on cangjit, so that
knowledge survives across sessions and agents. Code lives in the cangjit
repository; this repository holds only knowledge artifacts.

The knowledge base is a sibling checkout of the code repository:

```text
<path>/cangjit                 — the code
<path>/cangjit-knowledge-base  — the knowledge
```

## Starting work on cangjit

1. Read the cangjit `AGENTS.md`.
2. In the knowledge base, run `git pull --rebase` to obtain knowledge from
   the user's other machines.
3. Skim `arch/` and `ai-insides/` for current decisions and known quirks
   before touching code.
4. Check `ai-issues/` for open P0/P1 items affecting the area of work.

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

## When to write

While working on cangjit, write to the knowledge base at these points, not
in a batch at session end:

* User-requested scouting or research → `ai-docs/<topic>.md`, including when
  the answer was already given in chat.
* Non-obvious project behavior, build quirks, invariants, or debugging
  recipes → append to `ai-insides/`.
* A bug or proposal → create or update an `ai-issues/` file. Gate rejections
  usually deserve an issue or an update to an existing one.
* An architecture decision, including Gate 1/2 acceptance or an explicit
  design choice → record the decision, alternatives, and rationale in `arch/`.

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

## Change pipeline for cangjit

Every non-trivial change goes through the gates below, in order. Do not skip
ahead to a later gate while an earlier one is unaccepted. A gate is
"accepted" when the user explicitly approves in the conversation; absence of
an objection is not acceptance.

### Gate 1 — Class contract (only when new classes are proposed)

Before any code is written for a new class, present a brief contract in this
exact form:

```text
ClassName
  Purpose: one sentence on what it is for.
  Fields:
    - TypeName fieldName — what it holds
  Methods:
    - RetType methodName(Args) — what it does
```

* One block per new class. List every field and method, one line each.
* Keep descriptions to a single clause; this is a contract, not a design doc.
* Present the blocks in the chat response (or an `out://` note for long
  lists) and STOP — wait for acceptance before Gate 2.

### Gate 2 — Code shape

After the class contracts (or immediately, when no new classes are involved)
and before writing the final code, present the rough logic and shape of the
change:

* Which files are touched / created, and what goes into each.
* The skeleton of each new or modified function: signature plus a few lines
  of pseudocode or bullet-point logic for its body. No full implementations
  yet.
* Invariants and edge cases the code will rely on or handle.
* Risks (e.g. existing callers, ownership, ABI) — named explicitly.

STOP again and wait for acceptance.

Once Gate 2 is accepted, record the agreed shape as an architecture decision
in `arch/` before writing code.

### Gate 3 — Write code, build it, and run the generated code

Only after Gate 2 is accepted:

1. Write the code (use the `edit` tool; follow `.clang-format`).
2. Build the project to verify it compiles:

   ```bash
   ./build.sh
   ```

   (`build.sh` = `python3 build.py build -t debug --no-tests` — incremental
   debug build, no unittests. Pass extra flags through, e.g.
   `./build.sh --product cjc` when only the compiler front end is needed.)
3. Fix compile errors and repeat until the build passes.
4. Run generated code that exercises the changed area and check its result.
   Select self-checking examples where supported; record each command and exit
   code. A successful compiler exit alone is not proof the generated code ran.
   For changes to shared JIT machinery, run all numbered `examples/` programs
   and report each failure. Skip `examples/hello.cj` until external calls are
   supported.

   The current JIT does not yet support all constructs in the examples.
   Unsupported lazy compilation can abort; report these failures rather than
   treating them as successful executions.
5. Report which gates' artifacts (contracts, shape) the final code deviated
   from, if any, plus the exit code of every example run.

### Scope rules

* Trivial changes (typo fixes, comment edits, mechanical renames confined to
  one file) may skip the gates — state that you are treating the change as
  trivial and why.
* A change that touches a public/exported symbol, adds a class, or alters
  the JIT pipeline can never be treated as trivial.
* If mid-implementation the shape turns out wrong, stop, go back to the gate
  where the decision belongs, and re-present.
