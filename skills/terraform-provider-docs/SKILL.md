---
name: terraform-provider-docs
description: Use when configuration or reference documentation for a public Terraform Registry provider is needed.
---

# Terraform Provider Documentation

## Workflow

1. Find the provider address and the requested topic. Use the `source` in `required_providers`; do not guess from the provider's local name.
2. Resolve the documentation version from the user's request or `.terraform.lock.hcl`. A version constraint does not identify one exact version. If neither is available, use `latest` and say so.
3. Run `discover` for that provider and version. Search the result by category, slug, title, and subcategory. Fetch all likely matches when the result is unclear.
4. Answer from the resolved version. Do not replace it with `latest`.
5. Check `latest` only when the user asks for a comparison or the resolved version lacks the requested feature. Skip this when the versions are the same. If `latest` adds the feature, explain that an upgrade is required and check release or migration guidance before commenting on upgrade safety.
6. Include the provider address, documentation version, document title, and Registry URL when it can be determined.

## Commands

Resolve paths relative to this `SKILL.md`:

```bash
node <skill-directory>/scripts/provider-docs.mjs discover <namespace/provider> <version|latest>
node <skill-directory>/scripts/provider-docs.mjs fetch <document-id>
```

`discover` returns the provider version and a documentation index with each document's ID, category, slug, title, and subcategory. Use `fetch` with a document ID to read its Markdown.

## Rules

- Use this skill only for public providers on `registry.terraform.io`, not Terraform language, CLI, modules, private providers, or provider development.
- Do not change the user's project while resolving the provider or version.
- Do not use memory or unmatched documentation in place of documentation for the resolved version.
- If reliable documentation cannot be retrieved, stop and explain why.
- The script requires Node.js and network access. It uses Registry endpoints that may change without notice.
