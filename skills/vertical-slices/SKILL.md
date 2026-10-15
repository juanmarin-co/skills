---
name: vertical-slices
description: Break implementation work into small, verifiable vertical slices.
disable-model-invocation: true
---

Draft a sequence of vertical slices. Each slice should take one behavior through all relevant layers and tests. Unlike a horizontal slice, which stays within one layer, a vertical slice produces a complete result.

Keep each slice small enough for one fresh context window and independently verifiable. Describe its result and verification method. If prefactoring is needed, place it before the slices.
