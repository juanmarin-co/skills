#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const repository = "https://github.com/aip-dev/google.aip.dev";
const branch = "master";
const scope = "aip/general";

const skillDirectory = fileURLToPath(new URL("../", import.meta.url));
const repositoryDirectory = fileURLToPath(new URL("../../../", import.meta.url));
const referencesDirectory = join(skillDirectory, "references");
const aipsDirectory = join(referencesDirectory, "aips");
const catalogPath = join(referencesDirectory, "catalog.md");
const provenancePath = join(referencesDirectory, "provenance.json");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "google-aip-sync-"));
const checkoutDirectory = join(temporaryDirectory, "upstream");
const upstreamDirectory = join(checkoutDirectory, scope);
const stagedReferencesDirectory = join(temporaryDirectory, "references");
const stagedAipsDirectory = join(stagedReferencesDirectory, "aips");
const stagedCatalogPath = join(stagedReferencesDirectory, "catalog.md");

try {
  synchronize();
} catch (error) {
  console.error(`Google AIP sync failed: ${error.message}`);
  process.exitCode = 1;
}

function synchronize() {
  try {
    cloneUpstream();
    const aips = loadGeneralAips();
    const revision = readSourceRevision();
    const previousProvenance = readPreviousProvenance();

    stageGeneralAips();
    writeCatalog(aips);
    formatReferences();
    publishReferences();
    writeProvenance(aips.length, revision, previousProvenance);

    console.log(`Synced ${aips.length} general AIPs at ${revision.commit.slice(0, 12)}.`);
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}

function cloneUpstream() {
  execFileSync(
    "git",
    ["clone", "--quiet", "--depth=1", "--branch", branch, repository, checkoutDirectory],
    { stdio: "inherit" },
  );
}

function loadGeneralAips() {
  const filenames = readdirSync(upstreamDirectory)
    .filter((filename) => /^\d{4}\.md$/.test(filename))
    .sort();
  if (!filenames.length) throw new Error(`No general AIPs found in ${repository}`);
  return filenames.map(parseAip);
}

function readSourceRevision() {
  return {
    commit: runGit("rev-parse", "HEAD"),
    commitDate: runGit("show", "-s", "--format=%cI", "HEAD"),
    tree: runGit("rev-parse", `HEAD:${scope}`),
  };
}

function readPreviousProvenance() {
  try {
    return JSON.parse(readFileSync(provenancePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function stageGeneralAips() {
  mkdirSync(stagedReferencesDirectory, { recursive: true });
  cpSync(upstreamDirectory, stagedAipsDirectory, {
    recursive: true,
    filter: isGeneralAipPath,
  });
}

function writeCatalog(aips) {
  writeFileSync(stagedCatalogPath, renderCatalog(aips));
}

function formatReferences() {
  execFileSync("pnpm", ["exec", "oxfmt", stagedAipsDirectory, stagedCatalogPath, "--write"], {
    cwd: repositoryDirectory,
    stdio: "inherit",
  });
}

function publishReferences() {
  mkdirSync(referencesDirectory, { recursive: true });
  rmSync(aipsDirectory, { force: true, recursive: true });
  cpSync(stagedAipsDirectory, aipsDirectory, { recursive: true });
  copyFileSync(stagedCatalogPath, catalogPath);
}

function writeProvenance(count, revision, previousProvenance) {
  const scopeIsUnchanged =
    previousProvenance?.tree === revision.tree ||
    (!previousProvenance?.tree && previousProvenance?.commit === revision.commit);
  let recordedRevision = revision;
  let syncedAt = new Date().toISOString();

  if (scopeIsUnchanged) {
    recordedRevision = previousProvenance;
    syncedAt = previousProvenance.syncedAt;
  }

  const provenance = {
    source: repository,
    branch,
    commit: recordedRevision.commit,
    commitDate: recordedRevision.commitDate,
    tree: revision.tree,
    syncedAt,
    scope,
    count,
    transformation: "Formatted with Oxfmt",
    licenses: {
      content: {
        name: "Creative Commons Attribution 4.0 International",
        url: "https://creativecommons.org/licenses/by/4.0/",
      },
      codeSamples: {
        name: "Apache License 2.0",
        url: "https://www.apache.org/licenses/LICENSE-2.0",
      },
    },
  };
  writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
}

function parseAip(filename) {
  const content = readFileSync(join(upstreamDirectory, filename), "utf8");
  const number = filename.slice(0, 4);
  const id = extractField(content, /^id:\s*(\d+)$/m, "id", filename).padStart(4, "0");
  if (id !== number) throw new Error(`AIP id ${id} does not match ${filename}`);

  return {
    category: extractField(content, /^\s{2}category:\s*(.+)$/m, "category", filename),
    number,
    preview: extractPreview(content, filename),
    state: extractField(content, /^state:\s*(.+)$/m, "state", filename),
    title: extractField(content, /^#\s+(.+)$/m, "title", filename),
  };
}

function renderCatalog(aips) {
  const groups = groupByCategory(aips);
  const sections = [...groups].map(([category, entries]) => renderSection(category, entries));

  return `${[
    "# General AIP Catalog",
    "This file is generated by `../scripts/sync.mjs`. Do not edit it by hand.",
    ...sections,
  ].join("\n\n")}\n`;
}

function groupByCategory(aips) {
  const groups = new Map();

  for (const aip of aips) {
    const group = groups.get(aip.category) ?? [];
    group.push(aip);
    groups.set(aip.category, group);
  }

  return groups;
}

function renderSection(category, aips) {
  return [`## ${formatCategory(category)}`, "", renderTable(aips)].join("\n");
}

function renderTable(aips) {
  const rows = aips.map(
    (aip) =>
      `| [${aip.number}](aips/${aip.number}.md) | ${escapeTableCell(aip.title)} | ${aip.state} | ${escapeTableCell(aip.preview)} |`,
  );

  return ["| AIP | Title | State | Preview |", "| --- | --- | --- | --- |", ...rows].join("\n");
}

function extractPreview(content, filename) {
  const headingIndex = content.search(/^#\s+/m);
  const paragraph = content
    .slice(headingIndex)
    .split(/\n\s*\n/)
    .slice(1)
    .map((candidate) => candidate.trim())
    .find(isProseParagraph);
  if (!paragraph) throw new Error(`Missing preview paragraph in ${filename}`);

  return stripMarkdown(paragraph);
}

function stripMarkdown(markdown) {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractField(content, pattern, field, filename) {
  const result = content.match(pattern);
  if (!result) throw new Error(`Missing ${field} in ${filename}`);
  return result[1].trim();
}

function formatCategory(category) {
  return category
    .split("-")
    .map((word) => {
      if (word === "api") return "API";
      return word[0].toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function escapeTableCell(value) {
  return value.replaceAll("|", "\\|");
}

function isProseParagraph(candidate) {
  return candidate && !/^(#|```|[-*] |\d+\. |>)/.test(candidate);
}

function isGeneralAipPath(source) {
  return source === upstreamDirectory || /^\d{4}\.md$/.test(basename(source));
}

function runGit(...arguments_) {
  return execFileSync("git", ["-C", checkoutDirectory, ...arguments_], {
    encoding: "utf8",
  }).trim();
}
