---
name: google-aip
description: >
  Google API Improvement Proposals (AIP) guidelines for designing gRPC/protobuf APIs.
  Consult this skill before adding, modifying, or reviewing RPC methods in .proto files.
  Trigger for resource-oriented API design, standard or custom methods, pagination,
  filtering, soft delete, long-running operations, AIP compliance reviews, or questions
  about a specific AIP.
---

# Google AIP Skill

Use Google AIPs when designing or reviewing protobuf APIs.

## Workflow

1. Identify relevant AIPs using `references/catalog.md`.
2. Read only those documents from `references/aips/{NUMBER}.md`, where `{NUMBER}` is
   zero-padded (for example, `0132.md`).
3. Apply their guidance and cite AIP numbers in findings or recommendations.

Catalog previews contain each AIP's complete first prose paragraph, with Markdown
removed and whitespace normalized.

## Source

The local AIPs are sourced from
[`aip-dev/google.aip.dev`](https://github.com/aip-dev/google.aip.dev) and formatted with
Oxfmt; the source revision and transformation are recorded in `provenance.json`. AIP
content is licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), and code samples are licensed
under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).

Run `node <skill-directory>/scripts/sync.mjs` to mirror upstream general AIPs,
regenerate the catalog, and update provenance.
