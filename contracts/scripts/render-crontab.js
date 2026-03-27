#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_CONFIG_PATH =
  process.env.CRON_CONFIG_PATH || "/app/cron/cron-jobs.json";
const DEFAULT_OUTPUT_PATH = process.env.CRON_OUTPUT_PATH || "/etc/cronjob";

class RenderCrontabError extends Error {}

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const hasFiveCronFields = (value) =>
  isNonEmptyString(value) && value.trim().split(/\s+/).length === 5;

const validateJob = (job, index, names) => {
  if (!job || typeof job !== "object" || Array.isArray(job)) {
    throw new RenderCrontabError(`jobs[${index}] must be an object`);
  }
  if (!isNonEmptyString(job.name)) {
    throw new RenderCrontabError(
      `jobs[${index}].name must be a non-empty string`
    );
  }
  if (names.has(job.name)) {
    throw new RenderCrontabError(`duplicate job name "${job.name}"`);
  }
  names.add(job.name);
  if (!hasFiveCronFields(job.schedule)) {
    throw new RenderCrontabError(
      `jobs[${index}].schedule must be a valid 5-field cron expression`
    );
  }
  if (typeof job.enabled !== "boolean") {
    throw new RenderCrontabError(`jobs[${index}].enabled must be a boolean`);
  }
  if (!isNonEmptyString(job.command)) {
    throw new RenderCrontabError(
      `jobs[${index}].command must be a non-empty string`
    );
  }
};

const loadCronConfig = (configPath = DEFAULT_CONFIG_PATH) => {
  let parsed;
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new RenderCrontabError(
      `failed to read or parse config "${configPath}": ${error.message}`
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new RenderCrontabError("config root must be an object");
  }
  if (!Array.isArray(parsed.jobs)) {
    throw new RenderCrontabError('config must include a "jobs" array');
  }

  const names = new Set();
  parsed.jobs.forEach((job, index) => validateJob(job, index, names));
  return parsed;
};

const renderCrontab = ({
  configPath = DEFAULT_CONFIG_PATH,
  outputPath = DEFAULT_OUTPUT_PATH,
} = {}) => {
  const config = loadCronConfig(configPath);
  const enabledJobs = config.jobs.filter((job) => job.enabled);
  if (enabledJobs.length === 0) {
    throw new RenderCrontabError("config has zero enabled jobs");
  }

  const lines = [];
  for (const job of enabledJobs) {
    lines.push(`# ${job.name}`);
    lines.push(`${job.schedule} ${job.command}`);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");

  return {
    config,
    enabledJobs,
    outputPath,
  };
};

const main = () => {
  try {
    const result = renderCrontab();
    console.log(
      `[render-crontab] wrote ${result.enabledJobs.length} enabled jobs to ${result.outputPath}`
    );
  } catch (error) {
    console.error(`[render-crontab] ${error.message}`);
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}

module.exports = {
  RenderCrontabError,
  loadCronConfig,
  renderCrontab,
};
