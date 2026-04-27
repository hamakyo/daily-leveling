#!/usr/bin/env node
import { spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: {
      ...process.env,
      NO_COLOR: "1",
    },
    ...options,
  });

  return {
    command: [command, ...args].join(" "),
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

function firstLine(value) {
  return value.split(/\r?\n/).find(Boolean) || "";
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function hasJsonFlag(argv = process.argv.slice(2)) {
  return argv.includes("--json");
}

function checkGcloud() {
  const version = run("gcloud", ["--version"]);
  if (!version.ok) {
    return {
      installed: false,
      ok: false,
      error: version.stderr || version.stdout || "gcloud が見つかりません。",
    };
  }

  const auth = run("gcloud", ["auth", "list", "--format=json"]);
  const config = run("gcloud", ["config", "list", "--format=json"]);
  const accounts = auth.ok ? parseJson(auth.stdout, []) : [];
  const activeAccount = Array.isArray(accounts)
    ? accounts.find((account) => account.status === "ACTIVE") || null
    : null;
  const configuration = config.ok ? parseJson(config.stdout, {}) : {};

  return {
    installed: true,
    ok: Boolean(activeAccount),
    version: firstLine(version.stdout),
    activeAccount: activeAccount?.account ?? null,
    project: configuration?.core?.project ?? null,
    warnings: [
      ...(!auth.ok ? [auth.stderr || auth.stdout] : []),
      ...(!config.ok ? [config.stderr || config.stdout] : []),
      ...(!activeAccount ? ["gcloud auth login が必要です。"] : []),
      ...(activeAccount && !configuration?.core?.project ? ["gcloud config set project <PROJECT_ID> が未設定です。"] : []),
    ].filter(Boolean),
  };
}

function checkSupabase() {
  const version = run("supabase", ["--version"]);
  if (!version.ok) {
    return {
      installed: false,
      ok: false,
      error: version.stderr || version.stdout || "supabase CLI が見つかりません。",
    };
  }

  const projects = run("supabase", ["projects", "list"]);
  return {
    installed: true,
    ok: projects.ok,
    version: version.stdout,
    projectListAvailable: projects.ok,
    warnings: projects.ok ? [] : [projects.stderr || projects.stdout || "supabase login が必要です。"],
  };
}

function checkWrangler() {
  const version = run("pnpm", ["exec", "wrangler", "--version"]);
  if (!version.ok) {
    return {
      installed: false,
      ok: false,
      error: version.stderr || version.stdout || "wrangler が見つかりません。",
    };
  }

  const whoami = run("pnpm", ["exec", "wrangler", "whoami"]);
  return {
    installed: true,
    ok: whoami.ok,
    version: firstLine(version.stdout),
    authenticated: whoami.ok,
    warnings: whoami.ok ? [] : [whoami.stderr || whoami.stdout || "wrangler login が必要です。"],
  };
}

function printHuman(summary) {
  console.log("Cloud CLI status");

  console.log(`- gcloud: ${summary.gcloud.ok ? "OK" : "NG"}`);
  if (summary.gcloud.installed) {
    console.log(`  version: ${summary.gcloud.version}`);
    console.log(`  account: ${summary.gcloud.activeAccount ?? "none"}`);
    console.log(`  project: ${summary.gcloud.project ?? "none"}`);
  }
  for (const warning of summary.gcloud.warnings || []) {
    console.log(`  warning: ${warning}`);
  }

  console.log(`- supabase: ${summary.supabase.ok ? "OK" : "NG"}`);
  if (summary.supabase.installed) {
    console.log(`  version: ${summary.supabase.version}`);
  }
  for (const warning of summary.supabase.warnings || []) {
    console.log(`  warning: ${warning}`);
  }

  console.log(`- wrangler: ${summary.wrangler.ok ? "OK" : "NG"}`);
  if (summary.wrangler.installed) {
    console.log(`  version: ${summary.wrangler.version}`);
    console.log(`  authenticated: ${summary.wrangler.authenticated ? "yes" : "no"}`);
  }
  for (const warning of summary.wrangler.warnings || []) {
    console.log(`  warning: ${warning}`);
  }
}

const summary = {
  gcloud: checkGcloud(),
  supabase: checkSupabase(),
  wrangler: checkWrangler(),
};

if (hasJsonFlag()) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  printHuman(summary);
}

if (!summary.gcloud.ok || !summary.supabase.ok || !summary.wrangler.ok) {
  process.exitCode = 1;
}
