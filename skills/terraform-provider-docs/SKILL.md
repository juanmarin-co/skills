---
name: terraform-provider-docs
description: Retrieve and compare version-specific documentation for public Terraform Registry providers. Use for provider resources, data sources, functions, configuration, imports, arguments, attributes, examples, or checking whether locked and latest provider versions support a capability. Do not use for Terraform language, CLI, modules, or provider development.
---

# Terraform Provider Docs

Retrieve authoritative provider documentation from the public Terraform Registry.

## Workflow

1. Determine the provider address and requested capability.
2. Use an explicit version when supplied. Otherwise, read the selected version from `.terraform.lock.hcl`. A configuration constraint is not a selected version.
3. If a current version exists, discover both it and `latest`. Skip duplicate work when they resolve to the same version. Without a current version, discover only `latest`.
4. Filter the returned document indexes with available shell tools. Select documents by their metadata; do not assume provider type names map directly to documentation slugs.
5. Fetch the selected current document and answer from that version.
6. If the task is unsupported by the current version, inspect the latest document. Recommend upgrading when latest supports the task, even if the upgrade has breaking changes. Disclose breaking-change risk without blocking the recommendation.
7. Identify the provider address and exact version used. Include the corresponding Registry documentation URL when practical.

## Script

Resolve paths relative to this `SKILL.md`, then run:

```text
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

`fetch` writes the document's raw Markdown. Errors go to stderr and return a nonzero exit code.

## Limitations

- Supports public providers on `registry.terraform.io` only.
- Uses the Registry's undocumented internal v2 provider-doc endpoints. They may change without notice.
- Has no cache or alternate source fallback.
