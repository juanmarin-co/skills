---
name: terraform-provider-docs
description: Retrieve and compare version-specific documentation for public Terraform Registry providers. Use for provider configuration, resources, data sources, functions, imports, arguments, attributes, examples, or checking a locked provider version against latest. Do not use for Terraform language or CLI, modules, private providers, or provider development.
---

# Terraform Provider Docs

Retrieve authoritative, version-specific provider documentation from the public Terraform Registry.

## Workflow

1. Determine the provider source address and requested capability. Prefer the `source` in `required_providers`; do not infer an address from a local provider name when an explicit source exists.
2. Use an explicit version when supplied. Otherwise, read the selected version from `.terraform.lock.hcl`. Treat a configuration constraint as a constraint, not a selected version.
3. If a selected version exists, discover it and `latest`; skip duplicate work when both resolve to the same version. Without a selected version, discover only `latest` and disclose that no locked version was available.
4. Filter document indexes by `category`, `slug`, `title`, and `subcategory`. Do not assume a Terraform type name equals its documentation slug. Fetch plausible candidates when metadata is ambiguous.
5. Answer from the selected-version document first. Never silently substitute latest documentation for a locked or requested version.
6. If the selected version lacks the capability, inspect latest. State whether latest adds it and identify upgrade risk; do not claim an upgrade is safe without checking the provider's release or migration guidance.
7. Report the provider address, exact documentation version, document title, and Registry URL when an exact URL can be established.

## Script

Resolve paths relative to this `SKILL.md`, then run:

```bash
node <skill-directory>/scripts/provider-docs.mjs discover <namespace/provider> <version|latest>
node <skill-directory>/scripts/provider-docs.mjs fetch <document-id>
```

`discover` follows pagination and writes:

```json
{
  "provider": "namespace/provider",
  "version": "1.2.3",
  "documents": [
    {
      "id": "123",
      "category": "resources",
      "slug": "example",
      "title": "example",
      "subcategory": null
    }
  ]
}
```

Filter the `documents` array before calling `fetch`. The fetch command writes raw Markdown to stdout. Errors go to stderr and return a nonzero exit code.

## Limitations

- Supports public providers on `registry.terraform.io` only.
- Requires network access and a Node.js runtime with built-in `fetch`.
- Uses the Registry's undocumented internal v2 provider-doc endpoints. They may change without notice.
- Has no cache or alternate source fallback.
