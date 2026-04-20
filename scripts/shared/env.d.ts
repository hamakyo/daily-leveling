export const TARGET_ENVIRONMENTS: string[];

export function loadEnvFiles(options?: {
  cwd?: string;
  files?: string[];
  targetEnvironment?: string;
}): string[];

export function getEnvFilesForTarget(targetEnvironment?: string): string[];

export function resolveTargetEnvironment(argv?: string[]): string;

export function getRuntimeEnvIssues(
  env?: Record<string, string | undefined>,
): string[];

export function formatIssues(issues: string[]): string;
