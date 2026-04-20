#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const ENVIRONMENTS = {
  test: {
    workerName: "daily-leveling-test",
    baseUrl: "https://daily-leveling-test.hamakyoh.workers.dev",
  },
  staging: {
    workerName: "daily-leveling-staging",
    baseUrl: "https://daily-leveling-staging.hamakyoh.workers.dev",
  },
  production: {
    workerName: "daily-leveling",
    baseUrl: "https://daily-leveling.hamakyoh.workers.dev",
  },
};

const REQUIRED_SECRETS = ["DATABASE_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"];

function printHelp() {
  console.log(`Cloudflare environment status checker

Usage:
  node scripts/check-cloudflare-env.mjs --env test
  node scripts/check-cloudflare-env.mjs --env staging --json
  pnpm run cf:status:test

Behavior:
  - wrangler deployments list で配備状態を確認します
  - wrangler secret list で secret の投入状況を確認します
  - workers.dev の /healthz に疎通確認します
`);
}

function resolveEnvironment(argv = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const envArgument = argv.find((item) => item.startsWith("--env"));
  if (!envArgument) {
    throw new Error(`--env には ${Object.keys(ENVIRONMENTS).join(" / ")} のいずれかを指定してください。`);
  }

  const inlineValue = envArgument.startsWith("--env=") ? envArgument.slice("--env=".length) : null;
  const value =
    inlineValue ||
    (() => {
      const index = argv.indexOf("--env");
      return index >= 0 ? argv[index + 1] : null;
    })();

  if (!value || !(value in ENVIRONMENTS)) {
    throw new Error(`--env には ${Object.keys(ENVIRONMENTS).join(" / ")} のいずれかを指定してください。`);
  }

  return value;
}

function hasJsonFlag(argv = process.argv.slice(2)) {
  return argv.includes("--json");
}

function runWranglerJson(args) {
  const result = spawnSync("pnpm", ["exec", "wrangler", ...args], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return {
      ok: false,
      command: `pnpm exec wrangler ${args.join(" ")}`,
      message: (result.stderr || result.stdout || "wrangler command failed").trim(),
    };
  }

  try {
    return {
      ok: true,
      value: JSON.parse(result.stdout || "null"),
    };
  } catch (error) {
    return {
      ok: false,
      command: `pnpm exec wrangler ${args.join(" ")}`,
      message: error instanceof Error ? error.message : "JSON の解析に失敗しました。",
    };
  }
}

function normalizeSecretNames(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object") {
        if (typeof item.name === "string") {
          return item.name;
        }

        if (typeof item.secret_name === "string") {
          return item.secret_name;
        }
      }

      return null;
    })
    .filter((item) => typeof item === "string");
}

async function checkHealth(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/healthz`, {
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      body: body.trim(),
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : "healthz の確認に失敗しました。",
    };
  }
}

function summarizeDeployments(value) {
  if (!Array.isArray(value)) {
    return {
      count: 0,
      latest: null,
    };
  }

  const latest =
    value
      .slice()
      .sort((left, right) => {
        const leftTime = Date.parse(left?.created_on || "");
        const rightTime = Date.parse(right?.created_on || "");
        return rightTime - leftTime;
      })[0] || null;
  return {
    count: value.length,
    latest: latest
      ? {
          id: latest.id,
          source: latest.source,
          createdOn: latest.created_on,
          versionId: latest.versions?.[0]?.version_id ?? null,
        }
      : null,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const environment = resolveEnvironment(argv);
  const { workerName, baseUrl } = ENVIRONMENTS[environment];

  const deploymentsResult = runWranglerJson(["deployments", "list", "--env", environment, "--json"]);
  const secretsResult = runWranglerJson(["secret", "list", "--env", environment, "--format", "json"]);
  const health = await checkHealth(baseUrl);

  const secretNames = secretsResult.ok ? normalizeSecretNames(secretsResult.value) : [];
  const missingSecrets = REQUIRED_SECRETS.filter((name) => !secretNames.includes(name));

  const summary = {
    environment,
    workerName,
    baseUrl,
    health,
    deployments: deploymentsResult.ok
      ? summarizeDeployments(deploymentsResult.value)
      : { error: deploymentsResult.message },
    secrets: secretsResult.ok
      ? {
          configured: secretNames,
          missingRequired: missingSecrets,
        }
      : {
          error: secretsResult.message,
        },
  };

  if (hasJsonFlag(argv)) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`Cloudflare status: ${environment}`);
  console.log(`- worker: ${workerName}`);
  console.log(`- url: ${baseUrl}`);
  console.log(
    `- health: ${health.ok ? `OK (${health.status})` : `NG${health.status ? ` (${health.status})` : ""}`}`,
  );
  if (health.body) {
    console.log(`  body: ${health.body}`);
  }
  if (health.error) {
    console.log(`  error: ${health.error}`);
  }

  if ("error" in summary.deployments) {
    console.log(`- deployments: NG`);
    console.log(`  error: ${summary.deployments.error}`);
  } else {
    console.log(`- deployments: ${summary.deployments.count}`);
    if (summary.deployments.latest) {
      console.log(`  latest: ${summary.deployments.latest.versionId} (${summary.deployments.latest.createdOn})`);
    }
  }

  if ("error" in summary.secrets) {
    console.log(`- secrets: NG`);
    console.log(`  error: ${summary.secrets.error}`);
    return;
  }

  console.log(`- secrets configured: ${summary.secrets.configured.length}`);
  console.log(
    `  required missing: ${
      summary.secrets.missingRequired.length > 0 ? summary.secrets.missingRequired.join(", ") : "none"
    }`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Cloudflare status の確認に失敗しました。");
  process.exit(1);
});
