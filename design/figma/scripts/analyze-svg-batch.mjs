#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const BATCH_DIR = process.argv[2] || 'design/figma/exports/raw_svg_batch_v1';
const OUT_DIR = process.argv[3] || path.join(BATCH_DIR, '_analysis');
const LIB_DIR = process.argv[4] || 'design/figma/exports/components/svg_library_v1';

if (!fs.existsSync(BATCH_DIR)) {
  console.error(`Batch dir not found: ${BATCH_DIR}`);
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(LIB_DIR, { recursive: true });

const files = fs.readdirSync(BATCH_DIR)
  .filter((f) => f.toLowerCase().endsWith('.svg'))
  .sort((a, b) => a.localeCompare(b));

function classify(name) {
  const n = name.toLowerCase();
  if (n.includes('status_bar') || n.includes('dynamic_island') || n.includes('battery_icon') || n.includes('cellular_icon') || n.includes('wi-fi_icon')) {
    return 'device_chrome';
  }
  if (n.includes('solid_') || n.includes('outline_') || n.includes('icon')) {
    return 'icon';
  }
  if (n.includes('button')) {
    return 'button';
  }
  if (n.includes('input')) {
    return 'input';
  }
  if (n.includes('tab') || n.includes('chip')) {
    return 'tabs_chips';
  }
  if (n.includes('card')) {
    return 'card';
  }
  if (n.includes('chart') || n.includes('line') || n.includes('highlighted_column') || n.includes('lights')) {
    return 'chart_widget';
  }
  if (n.includes('home') || n.includes('user') || n.includes('navigation')) {
    return 'nav';
  }
  if (n.includes('badge') || n.includes('award')) {
    return 'badge';
  }
  if (n.includes('frame') || n.includes('group') || n.includes('vector') || n.includes('div')) {
    return 'raw_fragment';
  }
  return 'uncategorized';
}

function canonicalBase(name) {
  return name
    .replace(/\.svg$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

const rows = [];
const byHash = new Map();

for (const f of files) {
  const full = path.join(BATCH_DIR, f);
  const data = fs.readFileSync(full);
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  const bytes = data.length;
  const category = classify(f);
  const base = canonicalBase(f);

  let dupIndex = 0;
  if (byHash.has(hash)) {
    dupIndex = byHash.get(hash).count + 1;
    byHash.get(hash).count = dupIndex;
  } else {
    byHash.set(hash, { first: f, count: 0 });
  }

  rows.push({
    original_file: f,
    category,
    bytes,
    sha256: hash,
    duplicate_of: byHash.get(hash).first,
    is_duplicate: byHash.get(hash).first !== f,
    canonical_name: `${category}__${base}.svg`,
  });
}

// Write summary
const totals = {
  total_files: rows.length,
  unique_files: rows.filter((r) => !r.is_duplicate).length,
  duplicate_files: rows.filter((r) => r.is_duplicate).length,
  categories: {},
};

for (const r of rows) {
  if (!totals.categories[r.category]) {
    totals.categories[r.category] = { total: 0, unique: 0, duplicate: 0 };
  }
  totals.categories[r.category].total += 1;
  if (r.is_duplicate) totals.categories[r.category].duplicate += 1;
  else totals.categories[r.category].unique += 1;
}

// Export unique canonical library grouped by category
for (const r of rows) {
  if (r.is_duplicate) continue;
  const src = path.join(BATCH_DIR, r.original_file);
  const catDir = path.join(LIB_DIR, r.category);
  fs.mkdirSync(catDir, { recursive: true });
  const dest = path.join(catDir, r.canonical_name);
  fs.copyFileSync(src, dest);
}

const csvHeader = [
  'original_file',
  'category',
  'bytes',
  'sha256',
  'is_duplicate',
  'duplicate_of',
  'canonical_name',
];

const csv = [csvHeader.join(',')]
  .concat(
    rows.map((r) => [
      r.original_file,
      r.category,
      r.bytes,
      r.sha256,
      r.is_duplicate,
      r.duplicate_of,
      r.canonical_name,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
  )
  .join('\n');

fs.writeFileSync(path.join(OUT_DIR, 'svg_manifest.csv'), csv);
fs.writeFileSync(path.join(OUT_DIR, 'svg_summary.json'), JSON.stringify(totals, null, 2));

let md = '# SVG Batch Analysis\n\n';
md += `- Source: \`${BATCH_DIR}\`\n`;
md += `- Total files: **${totals.total_files}**\n`;
md += `- Unique (content hash): **${totals.unique_files}**\n`;
md += `- Duplicates: **${totals.duplicate_files}**\n\n`;
md += '## Category Breakdown\n\n';
md += '| Category | Total | Unique | Duplicate |\n';
md += '|---|---:|---:|---:|\n';
for (const [cat, c] of Object.entries(totals.categories).sort((a, b) => a[0].localeCompare(b[0]))) {
  md += `| ${cat} | ${c.total} | ${c.unique} | ${c.duplicate} |\n`;
}
md += '\n## Outputs\n\n';
md += '- `svg_manifest.csv`\n';
md += '- `svg_summary.json`\n';
md += `- Canonical unique SVG library: \`${LIB_DIR}\`\n`;

fs.writeFileSync(path.join(OUT_DIR, 'README.md'), md);

console.log(`Analyzed ${totals.total_files} SVGs (${totals.unique_files} unique).`);
console.log(`Manifest: ${path.join(OUT_DIR, 'svg_manifest.csv')}`);
console.log(`Library: ${LIB_DIR}`);
