#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { fromMarkdown } from "mdast-util-from-markdown";

const repository = "https://github.com/aip-dev/google.aip.dev";
const branch = "master";
const websiteBranch = "gh-pages";
const scope = "aip/general";

const repositoryDirectory = fileURLToPath(new URL("../", import.meta.url));
const skillDirectory = fileURLToPath(new URL("../skills/google-aip/", import.meta.url));
const referencesDirectory = join(skillDirectory, "references");
const aipsDirectory = join(referencesDirectory, "aips");
const catalogPath = join(referencesDirectory, "catalog.md");
const provenancePath = join(referencesDirectory, "provenance.json");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "google-aip-sync-"));
const checkoutDirectory = join(temporaryDirectory, "upstream");
const websiteCheckoutDirectory = join(temporaryDirectory, "website");
const upstreamDirectory = join(checkoutDirectory, scope);
const stagedReferencesDirectory = join(temporaryDirectory, "references");
const stagedAipsDirectory = join(stagedReferencesDirectory, "aips");
const stagedUpstreamDirectory = join(stagedReferencesDirectory, "upstream");
const stagedCatalogPath = join(stagedReferencesDirectory, "catalog.md");
const publishedUpstreamDirectory = join(referencesDirectory, "upstream");
const website = "https://google.aip.dev";

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

    const dependencyManifest = stageGeneralAips(aips);
    writeCatalog(aips);
    formatReferences();
    validateLocalLinks();
    publishReferences();
    writeProvenance(aips.length, revision, previousProvenance, dependencyManifest);

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
  execFileSync(
    "git",
    [
      "clone",
      "--quiet",
      "--depth=1",
      "--branch",
      websiteBranch,
      repository,
      websiteCheckoutDirectory,
    ],
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
    commit: runGit(checkoutDirectory, "rev-parse", "HEAD"),
    commitDate: runGit(checkoutDirectory, "show", "-s", "--format=%cI", "HEAD"),
    tree: runGit(checkoutDirectory, "rev-parse", `HEAD:${scope}`),
    website: {
      branch: websiteBranch,
      commit: runGit(websiteCheckoutDirectory, "rev-parse", "HEAD"),
      commitDate: runGit(websiteCheckoutDirectory, "show", "-s", "--format=%cI", "HEAD"),
    },
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

function stageGeneralAips(aips) {
  mkdirSync(stagedAipsDirectory, { recursive: true });

  const records = new Map();
  const websiteAliases = new Map();
  const queue = [];
  const seeds = new Set();

  for (const aip of aips) {
    const sourcePath = posix.join(scope, `${aip.number}.md`);
    const record = registerRepositoryDocument(sourcePath, posix.join("aips", `${aip.number}.md`));
    seeds.add(record.sourceId);
    websiteAliases.set(`/${aip.number}`, record);
    websiteAliases.set(`/${aip.number}.md`, record);
  }

  while (queue.length) stageDocument(queue.shift());

  const entries = [...records.values()].sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId),
  );
  const contentHash = createHash("sha256");
  for (const record of entries) {
    contentHash.update(`${record.sourceId}\0`);
    contentHash.update(readFileSync(record.checkoutPath));
    contentHash.update("\0");
  }

  const dependencies = entries.filter((record) => !seeds.has(record.sourceId));
  return {
    contentHash: contentHash.digest("hex"),
    count: dependencies.length,
    files: dependencies.map((record) => record.sourceId),
  };

  function registerRepositoryDocument(sourcePath, outputPath) {
    return registerDocument({
      checkoutPath: join(checkoutDirectory, sourcePath),
      outputPath,
      sourceId: sourcePath,
      sourcePath,
      websitePath: outputPath.startsWith("aips/")
        ? `/${basename(outputPath, ".md")}`
        : `/${sourcePath}`,
    });
  }

  function registerWebsiteDocument(websitePath) {
    const sourcePath = websitePath.replace(/^\//, "");
    return registerDocument({
      checkoutPath: join(websiteCheckoutDirectory, sourcePath),
      outputPath: posix.join("upstream", "website", sourcePath),
      sourceId: `${websiteBranch}:${sourcePath}`,
      sourcePath: null,
      websitePath,
    });
  }

  function registerDocument(record) {
    const existing = records.get(record.sourceId);
    if (existing) return existing;

    records.set(record.sourceId, record);
    if (isMarkdown(record.checkoutPath)) queue.push(record);
    else copyDependency(record);
    return record;
  }

  function stageDocument(record) {
    const source = readFileSync(record.checkoutPath, "utf8");
    const links = findMarkdownLinks(source);
    const replacements = [];

    for (const link of links) {
      const replacement = resolveLink(link.url, record);
      if (replacement === link.url) continue;
      const range = findLinkDestination(source, link);
      replacements.push({ ...range, value: replacement });
    }

    const output = applyReplacements(source, replacements);
    const outputPath = join(stagedReferencesDirectory, record.outputPath);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, output);
  }

  function resolveLink(url, sourceRecord) {
    if (isExternalLink(url) || url.startsWith("#")) return url;

    const { pathname, suffix } = splitLink(url);
    if (!pathname) return url;

    const repositoryTarget = sourceRecord.sourcePath
      ? resolveRepositoryTarget(pathname, sourceRecord.sourcePath)
      : null;
    let target = repositoryTarget && records.get(repositoryTarget);

    if (!target && repositoryTarget && isFile(join(checkoutDirectory, repositoryTarget))) {
      target = registerRepositoryDocument(
        repositoryTarget,
        posix.join("upstream", repositoryTarget),
      );
    }

    const websitePath = resolveWebsitePath(pathname, sourceRecord);
    if (!target) {
      target = websiteAliases.get(websitePath) ?? websiteAliases.get(`${websitePath}.md`);
    }

    if (!target && websitePath !== "/") {
      const websiteFile = join(websiteCheckoutDirectory, websitePath.replace(/^\//, ""));
      if (isFile(websiteFile)) target = registerWebsiteDocument(websitePath);
    }

    if (!target) return new URL(`${pathname}${suffix}`, sourceWebsiteUrl(sourceRecord)).href;

    let rewritten = posix.relative(posix.dirname(sourceRecord.outputPath), target.outputPath);
    if (!rewritten.startsWith(".")) rewritten = `./${rewritten}`;
    return `${encodeLinkPath(rewritten)}${suffix}`;
  }

  function resolveRepositoryTarget(pathname, sourcePath) {
    let candidate;
    try {
      const decoded = decodeURIComponent(pathname);
      candidate = decoded.startsWith("/")
        ? posix.normalize(decoded.slice(1))
        : posix.normalize(posix.join(posix.dirname(sourcePath), decoded));
    } catch {
      return null;
    }

    if (!candidate || candidate === "." || candidate.startsWith("../")) return null;
    if (isFile(join(checkoutDirectory, candidate))) return candidate;
    if (!extname(candidate) && isFile(join(checkoutDirectory, `${candidate}.md`))) {
      return `${candidate}.md`;
    }
    return candidate;
  }

  function resolveWebsitePath(pathname, sourceRecord) {
    return new URL(pathname, sourceWebsiteUrl(sourceRecord)).pathname;
  }

  function sourceWebsiteUrl(sourceRecord) {
    return new URL(sourceRecord.websitePath, website);
  }

  function copyDependency(record) {
    const outputPath = join(stagedReferencesDirectory, record.outputPath);
    mkdirSync(dirname(outputPath), { recursive: true });
    copyFileSync(record.checkoutPath, outputPath);
  }
}

function findMarkdownLinks(markdown) {
  const links = [];
  visit(fromMarkdown(markdown));
  return links;

  function visit(node) {
    if (node.type === "link" || node.type === "image" || node.type === "definition") {
      links.push({
        end: node.position.end.offset,
        start: node.position.start.offset,
        type: node.type,
        url: node.url,
      });
    }
    for (const child of node.children ?? []) visit(child);
  }
}

function findLinkDestination(markdown, link) {
  let cursor;
  let definition = false;

  if (link.type === "definition") {
    const marker = markdown.indexOf("]: ", link.start);
    const compactMarker = markdown.indexOf("]:", link.start);
    const colon = marker >= 0 && marker < link.end ? marker + 1 : compactMarker + 1;
    if (colon <= 0 || colon >= link.end) throw new Error("Unable to locate link definition");
    cursor = colon + 1;
    definition = true;
  } else {
    cursor = findInlineLinkOpening(markdown, link);
  }

  while (cursor < link.end && /\s/.test(markdown[cursor])) cursor++;
  if (markdown[cursor] === "<") {
    const start = cursor + 1;
    cursor = start;
    while (cursor < link.end && markdown[cursor] !== ">") {
      cursor += markdown[cursor] === "\\" ? 2 : 1;
    }
    if (cursor >= link.end) throw new Error("Unterminated angle-bracket link destination");
    return { end: cursor, start };
  }

  const start = cursor;
  let parenthesisDepth = 0;
  while (cursor < link.end) {
    const character = markdown[cursor];
    if (character === "\\") {
      cursor += 2;
      continue;
    }
    if (character === "(" && !definition) parenthesisDepth++;
    else if (character === ")" && !definition) {
      if (!parenthesisDepth) break;
      parenthesisDepth--;
    } else if (/\s/.test(character) && !parenthesisDepth) break;
    cursor++;
  }
  return { end: cursor, start };
}

function findInlineLinkOpening(markdown, link) {
  const labelStart = link.start + (link.type === "image" ? 2 : 1);
  let bracketDepth = 1;

  for (let cursor = labelStart; cursor < link.end; cursor++) {
    if (markdown[cursor] === "\\") {
      cursor++;
      continue;
    }
    if (markdown[cursor] === "[") bracketDepth++;
    else if (markdown[cursor] === "]" && --bracketDepth === 0) {
      cursor++;
      while (cursor < link.end && /\s/.test(markdown[cursor])) cursor++;
      if (markdown[cursor] !== "(") throw new Error("Unable to locate inline link destination");
      return cursor + 1;
    }
  }
  throw new Error("Unterminated inline link label");
}

function applyReplacements(content, replacements) {
  replacements.sort((left, right) => right.start - left.start);
  let previousStart = content.length;
  for (const replacement of replacements) {
    if (replacement.end > previousStart) throw new Error("Overlapping link replacements");
    content =
      content.slice(0, replacement.start) + replacement.value + content.slice(replacement.end);
    previousStart = replacement.start;
  }
  return content;
}

function splitLink(link) {
  const suffixStart = link.search(/[?#]/);
  if (suffixStart < 0) return { pathname: link, suffix: "" };
  return { pathname: link.slice(0, suffixStart), suffix: link.slice(suffixStart) };
}

function encodeLinkPath(pathname) {
  return pathname
    .split("/")
    .map((segment) => (segment === "." || segment === ".." ? segment : encodeURIComponent(segment)))
    .join("/");
}

function isExternalLink(link) {
  return /^[a-z][a-z\d+.-]*:/i.test(link) || link.startsWith("//");
}

function isMarkdown(path) {
  return [".md", ".markdown"].includes(extname(path).toLowerCase());
}

function isFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

function writeCatalog(aips) {
  writeFileSync(stagedCatalogPath, renderCatalog(aips));
}

function formatReferences() {
  execFileSync("pnpm", ["exec", "oxfmt", stagedReferencesDirectory, "--write"], {
    cwd: repositoryDirectory,
    stdio: "inherit",
  });
}

function validateLocalLinks() {
  for (const markdownPath of findFiles(stagedReferencesDirectory).filter(isMarkdown)) {
    const content = readFileSync(markdownPath, "utf8");
    for (const link of findMarkdownLinks(content)) {
      if (isExternalLink(link.url) || link.url.startsWith("#")) continue;
      const { pathname } = splitLink(link.url);
      if (!pathname) continue;

      let decoded;
      try {
        decoded = decodeURIComponent(pathname);
      } catch {
        throw new Error(
          `Invalid URL encoding in ${relative(stagedReferencesDirectory, markdownPath)}`,
        );
      }
      const target = resolve(dirname(markdownPath), decoded);
      const stagedRoot = `${resolve(stagedReferencesDirectory)}${sep}`;
      if (!target.startsWith(stagedRoot) || !isFile(target)) {
        throw new Error(
          `Broken local link ${JSON.stringify(link.url)} in ${relative(stagedReferencesDirectory, markdownPath)}`,
        );
      }
    }
  }
}

function findFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? findFiles(path) : [path];
  });
}

function publishReferences() {
  mkdirSync(referencesDirectory, { recursive: true });
  rmSync(aipsDirectory, { force: true, recursive: true });
  rmSync(publishedUpstreamDirectory, { force: true, recursive: true });
  cpSync(stagedAipsDirectory, aipsDirectory, { recursive: true });
  if (existsSync(stagedUpstreamDirectory)) {
    cpSync(stagedUpstreamDirectory, publishedUpstreamDirectory, { recursive: true });
  }
  copyFileSync(stagedCatalogPath, catalogPath);
}

function writeProvenance(count, revision, previousProvenance, dependencies) {
  const scopeIsUnchanged =
    previousProvenance?.dependencies?.contentHash === dependencies.contentHash;
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
    tree: recordedRevision.tree,
    website: recordedRevision.website,
    syncedAt,
    scope,
    count,
    transformation: "Formatted with Oxfmt; repository-local links resolved and bundled",
    dependencies,
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
    "This file is generated. Do not edit it by hand.",
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

function runGit(directory, ...arguments_) {
  return execFileSync("git", ["-C", directory, ...arguments_], {
    encoding: "utf8",
  }).trim();
}
