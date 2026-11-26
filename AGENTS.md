# AGENTS.md — cangjit-knowledge-base

This repository is the shared knowledge base for the cangjit project. It holds
everything agents discover or decide while working on cangjit, so that
knowledge survives across sessions and agents. The cangjit code lives in the
cangjit repository; this repository also hosts its knowledge dashboard.

The knowledge base is a sibling checkout of the code repository:

```text
<path>/cangjit                 — the code
<path>/cangjit-knowledge-base  — the knowledge
```

## Starting work on cangjit

1. Read the cangjit `AGENTS.md`.
2. In the knowledge base, run `git pull --rebase` to obtain knowledge from
   the user's other machines.
3. Skim `arch/` and `ai-insights/` for current decisions and known quirks
   before touching code.
4. Check `ai-issues/` for open P0/P1 items affecting the area of work.

## Layout

| Folder    | Contents                                                                 | Format              |
|-----------|--------------------------------------------------------------------------|---------------------|
| `ai-docs/`   | Information the user explicitly asked an agent to scout for (research results, investigations, answers). | Markdown (`.md`) |
| `ai-insights/`| Information agents acquired that is needed for project understanding (how things work, gotchas, environment quirks). | Any format        |
| `ai-issues/` | Proposals and issues — each with a name, priority, and brief description. | Markdown (`.md`) |
| `arch/`      | Architecture designs and decisions that were taken.                      | Markdown (`.md`) |
| `tasks.json` | Dashboard tasks, statuses, sources and dependencies. | JSON |
| `dashboard/` | Static dashboard for this knowledge base, built to `dist/` and published to GitHub Pages. | JavaScript, HTML, CSS |

## Rules per folder

### `ai-docs/` — scouted information (user-requested)

* One topic per file, named `kebab-case.md` (e.g. `lazy-compilation-research.md`).
* Every file starts with a one-line summary of the question it answers.
* Record facts with their sources: file paths, symbol names, URLs, commands.
* Written when the user asks an agent to scout/research something — before or
  after the answer is given in chat, but always before the session ends.

### `ai-insights/` — project-understanding notes

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

### `tasks.json` — task board

Maintain this file when work is identified, started, tested, completed or put
on hold. Each task has a stable `id`, `title`, `status`, `description`,
`source` (repository-relative Markdown path), and `dependsOn` (task IDs).
Statuses are `in-progress`, `icebox`, `testing`, and `done`. Record only
evidenced dependencies; do not infer them from task order. Keep completed tasks
and update their status instead of deleting them. Keep issue descriptions in
`ai-issues/` and link to them as the task source when applicable.

## Development cadence

Take development in small, coherent steps so the user can understand and stay
involved in the project. Explain the intent and outcome of each substantive
step, including decisions, tradeoffs, verification and blockers, and let the
user steer before expanding the scope.

Log tasks frequently as work is identified, started, tested, blocked, completed
or put on hold. Keep `tasks.json` and its linked notes current during the work,
not only at the end; record unfinished work and concrete evidence promptly.

## When to write

While working on cangjit, write to the knowledge base at these points, not
in a batch at session end:

* User-requested scouting or research → `ai-docs/<topic>.md`, including when
  the answer was already given in chat.
* Non-obvious project behavior, build quirks, invariants, or debugging
  recipes → append to `ai-insights/`.
* A bug or proposal → create or update an `ai-issues/` file. Gate rejections
  usually deserve an issue or an update to an existing one.
* An architecture decision, including Gate 1/2 acceptance or an explicit
  design choice → record the decision, alternatives, and rationale in `arch/`.

## Sync rules

* Do not commit or push changes unless the user explicitly asks. By default,
  leave completed changes staged for the user to review.
* Before a user-authorized push, run `git pull --rebase` (or `git fetch` +
  rebase) and resolve conflicts by keeping both sides' knowledge.
* Do not force-push. If the history diverged unexpectedly, merge instead.

## General rules

* Write into this repository as work happens, not at the end of a session —
  a crashed session must not lose acquired knowledge.
* Do not put secrets, tokens, or large binary artifacts here.


### Verification scope

* Run only the narrowest check that exercises the change. Do not repeat broad or unrelated checks when prior state is documented as passing; verify only when this change could invalidate that state.

* Commit messages follow the cangjit convention: concise subject line.

## Cangjit code style

* Any assembly sequence longer than two lines must live in a helper method with a one-line comment describing its purpose, or be expressed as equivalent C++ code.
* Avoid magic values. Give used registers and other non-obvious constants adequately named global constants.
* Keep functions at or below 120 lines; exceptions require justification.
* Search for existing logic before implementing it. Reuse or generalize existing code rather than duplicating behavior.
* Apply single responsibility throughout: each method should do one job. If its body needs several distinct steps to explain, consider splitting it.
* When a coherent object representation is needed to express part of the logic, define a dedicated type for it rather than encoding it as an untyped collection or tuple.

* **Strong single responsibility — exclusive ownership, not helper extraction.**
  For every refactor, identify each complete responsibility and its owner before
  coding. Reuse an existing owner or create a cohesive one; move the full policy
  there, including decisions, invariants, validation, state changes, emission,
  and failure handling. Callers may pass inputs, sequence calls, and handle
  results, but must not partially implement or work around another component's
  rules.
  - Do not stop at extracting isolated helpers while the responsibility remains
    split across callers. Migrate every caller and remove the old path.
  - Keep utility components limited to one coherent domain; never collect
    unrelated helpers in a generic utility.
  - Infer and propose the necessary ownership boundaries and types yourself;
    do not wait for the user to name them. Follow the gates below before coding.
  - Example: `FunctionMetadata` owns metadata representation and format
    encoding; `BinaryUtils` owns primitive byte encoding; `CompileFunction`
    only orchestrates. Likewise, hidden-TypeInfo ordering, ABI location
    handling, and frame-slot copying should belong to one cohesive owner, not
    be implemented in `CompileFunction`.
* Avoid checks for impossible or corrupted states, such as unrealistic overflow or null checks. Use `CJC_ASSERT` only when an invariant genuinely needs asserting.
* Avoid documentation unless it explains non-trivial behavior or a high-level algorithm. Keep necessary comments brief; use examples and lists where they clarify.


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

* The user's code ownership is limited to `src/JIT/`. Inspect and modify code
  only within that directory; do not expand work into other compiler subsystems.
  Explicitly requested instruction-file updates, including this `AGENTS.md`,
  are permitted outside that directory.

* Trivial changes (typo fixes, comment edits, mechanical renames confined to
  one file) may skip the gates — state that you are treating the change as
  trivial and why.
* A change that touches a public/exported symbol, adds a class, or alters
  the JIT pipeline can never be treated as trivial.
* If mid-implementation the shape turns out wrong, stop, go back to the gate
  where the decision belongs, and re-present.
