export function loadEnvFiles(options?: {
  cwd?: string;
  files?: string[];
}): string[];

export function getRuntimeEnvIssues(
  env?: Record<string, string | undefined>,
): string[];

export function formatIssues(issues: string[]): string;
