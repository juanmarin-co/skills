---
name: tdd
description: Run TDD one observable behavior at a time. Use for test-first development and red-green-refactor.
---

# Test-Driven Development

Develop one observable behavior at a time. A **seam** is the public boundary where a test observes behavior without reaching inside. A **tracer bullet** is one small test-to-working-code cycle: test one behavior, make it pass, learn, then choose the next.

Tests may be unit, integration, or end-to-end. Choose by behavior, not preference.

## Start

1. If no mode was given, ask the user to choose **Guided**, **Checkpoint**, or **Autonomous**.
2. Read relevant tests first, then related code. Run them when practical to establish a baseline; report existing failures.
3. Propose test seams before editing. Name each public interface, intended behavior, recommended scope, and why. Name the first tracer bullet and ask the user to confirm. Do not design every test upfront.

Test only at confirmed seams. Ask before materially changing them.

## Loop

Before each increment, briefly state:

- the behavior or cleanup;
- the coverage decision and why;
- the public interface under test, if any;
- why this is the next smallest useful move.

This is a progress update, not a review gate unless the mode says so.

1. Pick the smallest behavior or cleanup that advances the change or reduces risk.
2. Decide whether to add, update, consolidate, delete, or leave coverage unchanged. Change it only for new, changed, or uncovered behavior. Improve existing tests instead of adding redundant ones. Never test merely to prove an internal change.
3. If no new behavior coverage is needed, make the code or test cleanup while green and run affected tests without weakening coverage.
4. If behavior coverage is needed, add or update one test for one behavior through the agreed seam. Use a behavior name and independent expected values. Prefer exact result matching over truthy, existence, partial, or loose matching unless omitted values are irrelevant. Avoid implementation checks and over-mocking.
5. Run the focused test and ensure it fails for the expected reason. If it passes, investigate instead of implementing.
6. Write only enough code to pass. Run the focused test, then affected tests, and get to green.
7. Refactor only while green without changing behavior or weakening coverage, then rerun. Defer broad restructuring to seam review.
8. Choose the next tracer bullet from what the last cycle taught. Add only meaningful edge cases.

Do not write all tests upfront. At seam completion, run the broader relevant suite.

## Modes

Modes only control review cadence:

- **Guided:** pause after each tracer bullet or no-test cleanup.
- **Checkpoint:** pause after each completed seam.
- **Autonomous:** pause at completion.

At a review gate, report behavior, coverage, test results, refactoring, and the next tracer bullet or seam. Always pause for blockers or material seam changes.
