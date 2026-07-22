#!/usr/bin/env node

const REGISTRY_URL = "https://registry.terraform.io";
const PAGE_SIZE = 100;

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (command === "discover") {
    await discover(args);

    return;
  }

  if (command === "fetch") {
    await fetchDocument(args);

    return;
  }

  throw usageError();
}

async function discover(args) {
  if (args.length !== 2) {
    throw usageError();
  }

  const provider = parseProviderAddress(args[0]);
  let version = args[1];

  if (version === "latest") {
    version = await resolveLatestVersion(provider);
  }

  const versionId = await resolveVersionId(provider, version);
  const documents = await listDocuments(versionId);
  const result = {
    provider: `${provider.namespace}/${provider.name}`,
    version,
    documents,
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function fetchDocument(args) {
  if (args.length !== 1 || args[0].length === 0) {
    throw usageError();
  }

  const documentId = encodeURIComponent(args[0]);
  const response = await requestJson(`${REGISTRY_URL}/v2/provider-docs/${documentId}`);
  const content = response?.data?.attributes?.content;

  if (typeof content !== "string") {
    throw new Error(`Provider document ${args[0]} did not include Markdown content`);
  }

  process.stdout.write(content);
}

async function resolveLatestVersion(provider) {
  const namespace = encodeURIComponent(provider.namespace);
  const name = encodeURIComponent(provider.name);
  const response = await requestJson(`${REGISTRY_URL}/v1/providers/${namespace}/${name}`);

  if (typeof response.version !== "string" || response.version.length === 0) {
    throw new Error(`Could not resolve the latest version of ${provider.namespace}/${provider.name}`);
  }

  return response.version;
}

async function resolveVersionId(provider, version) {
  const namespace = encodeURIComponent(provider.namespace);
  const name = encodeURIComponent(provider.name);
  const url = new URL(`${REGISTRY_URL}/v2/providers/${namespace}/${name}`);
  url.searchParams.set("include", "provider-versions");

  const response = await requestJson(url);
  const versions = response.included;

  if (!Array.isArray(versions)) {
    throw new Error(`Registry did not return versions for ${provider.namespace}/${provider.name}`);
  }

  const match = versions.find((item) => {
    return item?.type === "provider-versions" && item?.attributes?.version === version;
  });

  if (!match) {
    throw new Error(`Provider version not found: ${provider.namespace}/${provider.name} ${version}`);
  }

  return match.id;
}

async function listDocuments(versionId) {
  const documents = [];
  const seenIds = new Set();
  let pageNumber = 1;

  while (true) {
    const url = new URL(`${REGISTRY_URL}/v2/provider-docs`);
    url.searchParams.set("filter[provider-version]", versionId);
    url.searchParams.set("page[size]", String(PAGE_SIZE));
    url.searchParams.set("page[number]", String(pageNumber));

    const response = await requestJson(url);

    if (!Array.isArray(response.data)) {
      throw new Error("Registry did not return a provider document list");
    }

    if (response.data.length === 0) {
      break;
    }

    let added = 0;

    for (const item of response.data) {
      if (seenIds.has(item.id)) {
        continue;
      }

      seenIds.add(item.id);
      documents.push(normalizeDocument(item));
      added += 1;
    }

    if (added === 0) {
      break;
    }

    pageNumber += 1;
  }

  return documents;
}

function normalizeDocument(item) {
  const attributes = item.attributes ?? {};

  return {
    id: String(item.id),
    category: attributes.category ?? null,
    slug: attributes.slug ?? null,
    title: attributes.title ?? null,
    subcategory: attributes.subcategory ?? null,
  };
}

function parseProviderAddress(address) {
  const parts = address.split("/");

  if (parts.length !== 2 || parts.some((part) => part.length === 0)) {
    throw new Error(`Expected provider address <namespace/provider>, received: ${address}`);
  }

  return {
    namespace: parts[0],
    name: parts[1],
  };
}

async function requestJson(input) {
  const response = await fetch(input, {
    headers: {
      accept: "application/json",
      "user-agent": "terraform-provider-docs-skill",
    },
  });
  const text = await response.text();
  let body;

  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Registry returned invalid JSON (${response.status})`);
  }

  if (!response.ok) {
    let detail = text;

    if (Array.isArray(body.errors)) {
      detail = body.errors.join(", ");
    }

    throw new Error(`Registry request failed (${response.status}): ${detail}`);
  }

  return body;
}

function usageError() {
  return new Error(
    "Usage: provider-docs.mjs discover <namespace/provider> <version|latest>\n" +
      "       provider-docs.mjs fetch <document-id>",
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
