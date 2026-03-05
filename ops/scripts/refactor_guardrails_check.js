#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const configPath = path.join(repoRoot, 'ops', 'refactor_guardrails.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function countLines(absPath) {
  if (!fs.existsSync(absPath)) return null;
  const text = fs.readFileSync(absPath, 'utf8');
  if (!text.length) return 0;
  return text.split('\n').length;
}

function gitChangedFiles() {
  const baseRef = process.env.GUARDRAIL_BASE_REF;
  const commands = [];
  if (baseRef) {
    commands.push(`git diff --name-only ${baseRef}...HEAD`);
  }
  commands.push('git diff --name-only --cached');
  commands.push('git diff --name-only');
  commands.push('git diff --name-only HEAD~1..HEAD');

  for (const cmd of commands) {
    try {
      const out = cp.execSync(cmd, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (!out) continue;
      return Array.from(new Set(out.split('\n').map((s) => s.trim()).filter(Boolean)));
    } catch {
      // continue
    }
  }
  return [];
}

function pathMatches(filePath, pattern) {
  if (pattern.endsWith('/')) return filePath.startsWith(pattern);
  return filePath === pattern;
}

function fileIsText(filePath) {
  return !/\.(png|jpg|jpeg|gif|webp|svg|ico|pdf|mov|mp4|ttf|woff|woff2|zip|tar|gz|db)$/i.test(filePath);
}

const config = readJson(configPath);
const failures = [];
const warnings = [];

for (const legacy of config.legacy_files) {
  const abs = path.join(repoRoot, legacy.path);
  const lines = countLines(abs);
  if (lines == null) {
    failures.push(`Missing legacy file: ${legacy.path}`);
    continue;
  }
  if (lines > legacy.baseline_lines) {
    failures.push(`Legacy file grew beyond baseline: ${legacy.path} (${lines} > ${legacy.baseline_lines})`);
  }
  if (legacy.warning_lines && lines > legacy.warning_lines) {
    warnings.push(`Legacy file exceeds warning threshold: ${legacy.path} (${lines} > ${legacy.warning_lines})`);
  }
}

for (const rule of config.module_rules) {
  const files = cp
    .execSync(`git ls-files "${rule.prefix}*"`, { cwd: repoRoot, encoding: 'utf8' })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter(fileIsText);

  for (const file of files) {
    const lines = countLines(path.join(repoRoot, file));
    if (lines == null) continue;
    if (lines > rule.hard_max_lines) {
      failures.push(`Module exceeds hard max: ${file} (${lines} > ${rule.hard_max_lines})`);
    } else if (rule.warning_lines && lines > rule.warning_lines) {
      warnings.push(`Module exceeds warning threshold: ${file} (${lines} > ${rule.warning_lines})`);
    }
  }
}

const changedFiles = gitChangedFiles();
if (changedFiles.length > 0) {
  for (const file of changedFiles) {
    const laneMatches = config.lane_manifest.filter((lane) => lane.paths.some((p) => pathMatches(file, p)));
    if (laneMatches.length > 1) {
      failures.push(`Lane collision: ${file} matches multiple lanes (${laneMatches.map((l) => l.lane).join(', ')})`);
    }
  }
}

console.log('Refactor Guardrails Check');
console.log(`- Legacy files checked: ${config.legacy_files.length}`);
console.log(`- Module rules checked: ${config.module_rules.length}`);
console.log(`- Changed files analyzed for lane collisions: ${changedFiles.length}`);

if (warnings.length > 0) {
  console.log('\nWarnings:');
  for (const warning of warnings) console.log(`- ${warning}`);
}

if (failures.length > 0) {
  console.error('\nFailures:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('\nGuardrails passed.');
