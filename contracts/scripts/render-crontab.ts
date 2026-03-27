import fs from "node:fs";
import path from "node:path";

const DEFAULT_CONFIG_PATH =
  process.env.CRON_CONFIG_PATH || "/app/cron/cron-jobs.json";
const DEFAULT_OUTPUT_PATH = process.env.CRON_OUTPUT_PATH || "/etc/cronjob";

export class RenderCrontabError extends Error {}

export interface CronJob {
  name: string;
  schedule: string;
  enabled: boolean;
  command: string;
}

export interface CronConfig {
  jobs: CronJob[];
}

function assertCronConfig(data: any): asserts data is CronConfig {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new RenderCrontabError("config root must be an object");
  }
  if (!Array.isArray(data.jobs)) {
    throw new RenderCrontabError('config must include a "jobs" array');
  }
  const names = new Set<string>();
  for (let i = 0; i < data.jobs.length; i++) {
    const job = data.jobs[i];
    if (!job || typeof job !== "object" || Array.isArray(job)) {
      throw new RenderCrontabError(`jobs[${i}] must be an object`);
    }
    if (typeof job.name !== "string" || !job.name.trim()) {
      throw new RenderCrontabError(
        `jobs[${i}].name must be a non-empty string`
      );
    }
    if (names.has(job.name)) {
      throw new RenderCrontabError(`duplicate job name "${job.name}"`);
    }
    names.add(job.name);
    if (
      typeof job.schedule !== "string" ||
      job.schedule.trim().split(/\s+/).length !== 5
    ) {
      throw new RenderCrontabError(
        `jobs[${i}].schedule must be a valid 5-field cron expression`
      );
    }
    if (typeof job.enabled !== "boolean") {
      throw new RenderCrontabError(`jobs[${i}].enabled must be a boolean`);
    }
    if (typeof job.command !== "string" || !job.command.trim()) {
      throw new RenderCrontabError(
        `jobs[${i}].command must be a non-empty string`
      );
    }
  }
}

export function loadCronConfig(configPath = DEFAULT_CONFIG_PATH): CronConfig {
  let parsed: any;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (e: any) {
    throw new RenderCrontabError(
      `failed to read or parse config "${configPath}": ${e.message}`
    );
  }
  assertCronConfig(parsed);
  return parsed;
}

export function renderCrontab({
  configPath = DEFAULT_CONFIG_PATH,
  outputPath = DEFAULT_OUTPUT_PATH,
} = {}) {
  const config = loadCronConfig(configPath);
  const enabledJobs = config.jobs.filter((job) => job.enabled);
  if (enabledJobs.length === 0) {
    throw new RenderCrontabError("config has zero enabled jobs");
  }

  const lines: string[] = [];
  for (const job of enabledJobs) {
    lines.push(`# ${job.name}`);
    lines.push(`${job.schedule} ${job.command}`);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");

  return { config, enabledJobs, outputPath };
}

if (require.main === module) {
  try {
    const result = renderCrontab();
    console.log(
      `[render-crontab] wrote ${result.enabledJobs.length} enabled jobs to ${result.outputPath}`
    );
  } catch (e: any) {
    console.error(`[render-crontab] ${e.message}`);
    process.exit(1);
  }
}
