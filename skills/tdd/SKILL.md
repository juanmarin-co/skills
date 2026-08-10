---
name: tdd
description: Use test-driven development and red-green-refactor for feature development, behavior changes, and regression fixes.
---

# Test-Driven Development

Work through **seams** and **tracer bullets**.

A **seam** is an interface through which callers or users observe behavior. Test through it rather than private methods or state.

**Test only at pre-agreed seams.**

A **tracer bullet** is one red-green cycle through a seam. It may contain any number of tests.

Each bullet costs model turns and tokens. Group tests when their expectations are clear and implementing some would not help write the others. Split them when feedback could change the remaining tests, seam, or implementation direction. Reduce cycles, not coverage; never target a test count. Edit grouped tests together, not one at a time.

Choose unit, integration, or end-to-end scope by behavior, without unnecessary implementation dependence.

## Start

1. Use **Checkpoint** unless the user requests **Guided** or **Autonomous**.
2. Read relevant tests, then code. Run a baseline once when practical and report existing failures.
3. Propose the affected seams, behavior, scope, first bullet, and why its tests belong together or separately. Confirm them before writing tests; pause to confirm any later seam.

Plan only the current bullet, not the entire suite.

## Loop

Before each bullet, briefly state its behavior, coverage decision, seam, and grouping reason. Then:

1. Choose the next useful behavior from what is known.
2. Keep tests compact, not append-only. Cover new, changed, or uncovered behavior by first updating existing tests when clear. Delete or consolidate obsolete tests and duplicates with no useful feedback. Never delete merely to get green or add tests for internal changes alone.
3. If coverage need not change, work while green and run affected tests without weakening coverage.
4. Otherwise, write the selected tests together before implementation. Give each a behavior name and independent expected values. Prefer exact results unless omitted values are irrelevant. Avoid implementation checks and excessive mocking.
5. Run focused tests together. Confirm changed coverage fails for the expected reason. If a test passes, investigate whether behavior exists or the test is redundant or invalid.
6. Write only enough implementation to pass.
7. Run focused and affected tests together when practical and get to green.
8. Choose the next bullet from what this one taught. Defer uncertain or unrelated tests.

After a seam, refactor code and tests while green, delete redundancies, then run the relevant suite.

## Modes

Modes control user review:

- **Guided:** pause after each bullet and after seam refactoring.
- **Checkpoint:** pause after each seam.
- **Autonomous:** pause at completion.

Report behavior, coverage, results, refactoring, and what comes next. Always pause for blockers or material seam changes.
