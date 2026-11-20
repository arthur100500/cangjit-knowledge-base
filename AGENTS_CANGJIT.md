# AGENTS_CANGJIT.md — Using the knowledge base while working on cangjit

This file is the bridge between the cangjit repository and
`cangjit-knowledge-base`. It describes when and how an agent working on
cangjit must read from and write into the knowledge base, and merges the
knowledge-base conventions with the cangjit change pipeline.

## The knowledge base

The knowledge base lives in a sibling checkout:

```text
<path>/cangjit            — the code (this repository)
<path>/cangjit-knowledge-base — the knowledge (see AGENTS.md there)
```

Its four folders and what belongs in each:

* `ai-docs/` — results of scouting the user explicitly asked for
  (`.md`, one topic per file, sources recorded).
* `ai-insides/` — anything an agent learned that is needed for project
  understanding (any format; append to existing notes when possible).
* `ai-issues/` — issues and proposals, one file each, with a name, priority
  (P0–P3), and brief description.
* `arch/` — architecture designs that were taken; always reflect the current
  decision.

When starting a session on cangjit:

1. Read the cangjit `AGENTS.md` (change pipeline below).
2. In the knowledge base, run `git pull --rebase` — the user works from
   multiple PCs and other machines may have pushed newer knowledge.
3. Skim `arch/` and `ai-insides/` in the knowledge base for current decisions
   and known quirks before touching code.
4. Check `ai-issues/` for open P0/P1 items affecting the area you work on.

## When to write into the knowledge base

While working on cangjit, an agent writes to the knowledge base at these
points — not in a batch at session end:

* **The user asks to scout/research something** → write the findings to
  `ai-docs/<topic>.md` (also when the answer was already given in chat).
* **The agent figures out non-obvious project behavior** (pipeline
  internals, build quirks, invariants, debugging recipes) → append to
  `ai-insides/`.
* **A bug is found or a proposal made** → create `ai-issues/NNN-<name>.md`
  with priority and description. Gate rejections (see pipeline) usually
  deserve an issue or an update to an existing one.
* **An architecture decision is taken (Gate 1/2 acceptance, or any
  explicit design choice)** → record it in `arch/<design>.md`: decision,
  alternatives considered, why it won.

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

## Scope rules

* Trivial changes (typo fixes, comment edits, mechanical renames confined to
  one file) may skip the gates — state that you are treating the change as
  trivial and why.
* A change that touches a public/exported symbol, adds a class, or alters
  the JIT pipeline can never be treated as trivial.
* If mid-implementation the shape turns out wrong, stop, go back to the gate
  where the decision belongs, and re-present.
