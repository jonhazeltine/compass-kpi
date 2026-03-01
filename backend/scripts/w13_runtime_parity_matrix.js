#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const evidenceDir = path.join(repoRoot, "app", "test-results", "w13-runtime-parity-and-hardening-a");
const summaryPath = path.join(evidenceDir, "checkpoint-f-runtime-matrix-summary.json");

function run(command, args) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(command, args, {
    cwd: path.join(repoRoot, "backend"),
    env: process.env,
    encoding: "utf8",
  });
  const endedAt = new Date().toISOString();
  return {
    command: [command, ...args].join(" "),
    status: result.status,
    signal: result.signal,
    started_at: startedAt,
    ended_at: endedAt,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });

  const build = run("npm", ["run", "build"]);
  const stream = build.status === 0 ? run("node", ["scripts/w13_stream_wave_a_acceptance.js"]) : null;
  const mux = build.status === 0 ? run("node", ["scripts/w13_mux_wave_b_acceptance.js"]) : null;

  const matrix = {
    generated_at: new Date().toISOString(),
    build: {
      passed: build.status === 0,
      command: build.command,
      status: build.status,
    },
    stream_wave_a: stream
      ? {
          passed: stream.status === 0,
          command: stream.command,
          status: stream.status,
        }
      : {
          passed: false,
          skipped: true,
          reason: "build_failed",
        },
    mux_wave_b: mux
      ? {
          passed: mux.status === 0,
          command: mux.command,
          status: mux.status,
        }
      : {
          passed: false,
          skipped: true,
          reason: "build_failed",
        },
    kpi_no_side_effect_guardrails: {
      passed: Boolean(stream && mux && stream.status === 0 && mux.status === 0),
      source: "validated inside both acceptance scripts via kpi_logs pre/post count checks",
    },
    overall_passed: build.status === 0 && Boolean(stream && stream.status === 0) && Boolean(mux && mux.status === 0),
    raw_outputs: {
      build,
      stream,
      mux,
    },
  };

  fs.writeFileSync(summaryPath, JSON.stringify(matrix, null, 2));
  const logLines = [
    `W13 runtime parity matrix generated: ${matrix.generated_at}`,
    `build: ${matrix.build.passed ? "PASS" : "FAIL"}`,
    `stream_wave_a: ${matrix.stream_wave_a.passed ? "PASS" : "FAIL"}`,
    `mux_wave_b: ${matrix.mux_wave_b.passed ? "PASS" : "FAIL"}`,
    `kpi_no_side_effect_guardrails: ${matrix.kpi_no_side_effect_guardrails.passed ? "PASS" : "FAIL"}`,
    `overall: ${matrix.overall_passed ? "PASS" : "FAIL"}`,
    `summary: ${summaryPath}`,
  ];
  console.log(logLines.join("\n"));

  if (!matrix.overall_passed) {
    process.exit(1);
  }
}

main();
