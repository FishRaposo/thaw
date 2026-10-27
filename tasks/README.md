# Task pack

Three self-contained tasks built on Thaw, in the format used for evaluating AI agents on game development: two bugs planted in working code and one feature request.

| Task | Kind | Brief voice | Systems involved |
|---|---|---|---|
| [bug-01 · Undo doesn't fix the ice](bug-01-undo-keeps-broken-ice/BRIEF.md) | bug | player report | undo history, state copying, tile changes |
| [bug-02 · Next level starts with a move already made](bug-02-moves-leak-into-next-level/BRIEF.md) | bug | QA ticket | input queue, animation timing, level flow |
| [feat-01 · Hints](feat-01-hint/BRIEF.md) | feature | producer request | solver, session, scoring, UI, input |

## What's in each task

| File | Purpose |
|---|---|
| `BRIEF.md` | The request as it would arrive. Describes symptoms or goals, never the cause or the code. |
| `CRITERIA.md` | Acceptance criteria: an input sequence, the expected visual outcome, the verifiable state, and what must not change. |
| `starting-state.patch` | Bugs only: applied to `main`, it produces the broken game the task starts from, including the test coverage it shipped with. |
| `reference-solution.patch` | The fix or the feature. |
| `REFERENCE.md` | Root cause or design of the change, how to find it by playtesting, and rejected alternatives. |
| `check.mjs` | The criteria as an automated check, driven through the same `Session` object the game screen uses. |

## Verifying the pack

```bash
npm run tasks
```

For every task, `tasks/verify.mjs` copies the game and its tests to a temp folder and applies the starting state. It then requires three things: the check **fails** there, the check **passes** once the reference solution is applied, and the **whole unit suite is green** on the solved copy.

```
ok    bug-01-undo-keeps-broken-ice   bug      starting state: fail  ·  solution: pass  ·  unit tests after: green
ok    bug-02-moves-leak-into-next-level bug   starting state: fail  ·  solution: pass  ·  unit tests after: green
ok    feat-01-hint                   feature  starting state: fail  ·  solution: pass  ·  unit tests after: green
```
