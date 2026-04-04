import fs from "node:fs";
import path from "node:path";

import { cronJobs } from "./cron-jobs";

const DEFAULT_OUTPUT_PATH = process.env.CRON_OUTPUT_PATH || "./cron/cronjob";

export class RenderCrontabError extends Error {}

export interface CronJob {
  name: string;
  schedule: string;
  enabled: boolean;
  permmissioned?: boolean;
  command: string;
}

export interface CronConfig {
  jobs: CronJob[];
}

export function renderCrontab({
  jobs = cronJobs,
  outputPath = DEFAULT_OUTPUT_PATH,
}: { jobs?: CronJob[]; outputPath?: string } = {}) {
  const enabledJobs = jobs.filter((job) => job.enabled);
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

  return { jobs, enabledJobs, outputPath };
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
