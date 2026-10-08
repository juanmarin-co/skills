---
name: vertical-slices
description: Break implementation work into small, verifiable vertical slices.
disable-model-invocation: true
---

Break the work into vertical slices, each delivering one complete behavior across all relevant layers, including tests. Organize around outcomes rather than separate tasks such as “build the API” and “build the UI.”

Each slice should be independently verifiable and fit within one fresh context window. State what it delivers and how to verify it. Place necessary preparatory refactoring first.
