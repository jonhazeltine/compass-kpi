#!/usr/bin/env node
/**
 * List all frames (and optional component nodes) from the Compass KPI Figma file
 * via the Figma REST API. Requires FIGMA_TOKEN in the environment.
 *
 * Usage:
 *   FIGMA_TOKEN=<your-token> node design/figma/scripts/list-frames.mjs
 *   FIGMA_TOKEN=<your-token> node design/figma/scripts/list-frames.mjs --components
 *
 * Get a token: Figma → Settings → Account → Personal access tokens
 * File: https://www.figma.com/design/ebEWgwdjIZywvK2b4zf0ek/Compass-KPI--Copy-
 */

const FIGMA_API = 'https://api.figma.com/v1';
const COMPASS_KPI_FILE_KEY = 'ebEWgwdjIZywvK2b4zf0ek';
const includeComponents = process.argv.includes('--components');

const token = process.env.FIGMA_TOKEN;
if (!token) {
  console.error('Missing FIGMA_TOKEN. Set it in the environment or use a .env file.');
  console.error('Get a token: Figma → Settings → Account → Personal access tokens');
  process.exit(1);
}

function walk(node, path = '', acc = []) {
  const name = node.name ?? '(unnamed)';
  const id = node.id;
  const type = node.type ?? 'UNKNOWN';
  const fullPath = path ? `${path} / ${name}` : name;

  if (type === 'FRAME') {
    acc.push({ name, id, path: fullPath, type });
  }
  if (includeComponents && (type === 'COMPONENT' || type === 'COMPONENT_SET')) {
    acc.push({ name, id, path: fullPath, type });
  }

  const children = node.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      walk(child, fullPath, acc);
    }
  }

  return acc;
}

async function main() {
  const url = `${FIGMA_API}/files/${COMPASS_KPI_FILE_KEY}`;
  const res = await fetch(url, {
    headers: { 'X-Figma-Token': token },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Figma API error ${res.status}: ${text}`);
    process.exit(1);
  }

  const data = await res.json();
  const document = data.document;
  if (!document || !document.children) {
    console.error('Unexpected response: no document.children');
    process.exit(1);
  }

  const frames = [];
  for (const page of document.children ?? []) {
    const pageName = page.name ?? '(unnamed page)';
    walk(page, pageName, frames);
  }

  // Sort by path then name for stable output
  frames.sort((a, b) => (a.path + a.name).localeCompare(b.path + b.name));

  console.log('# Frame inventory – Compass KPI (Copy)\n');
  console.log('| Frame name | Node id | Type | Page/path |');
  console.log('|------------|---------|------|-----------|');
  for (const f of frames) {
    const pathShort = f.path.length > 40 ? f.path.slice(0, 37) + '…' : f.path;
    console.log(`| ${f.name} | ${f.id.replace(':', '-')} | ${f.type} | ${pathShort} |`);
  }
  console.log(`\nTotal: ${frames.length} ${includeComponents ? 'frames + components' : 'frames'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
