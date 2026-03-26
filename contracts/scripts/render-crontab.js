#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const configPath = process.env.CRON_CONFIG_PATH || "/app/cron/cron-jobs.json";
const outputPath = process.env.CRON_OUTPUT_PATH || "/etc/cronjob";

const fail = (message) => {
  console.error(`[render-crontab] ${message}`);
  process.exit(1);
};

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const hasFiveCronFields = (value) =>
  isNonEmptyString(value) && value.trim().split(/\s+/).length === 5;

const validateJob = (job, index, names) => {
  if (!job || typeof job !== "object" || Array.isArray(job)) {
    fail(`jobs[${index}] must be an object`);
  }
  if (!isNonEmptyString(job.name)) {
    fail(`jobs[${index}].name must be a non-empty string`);
  }
  if (names.has(job.name)) {
    fail(`duplicate job name "${job.name}"`);
  }
  names.add(job.name);
  if (!hasFiveCronFields(job.schedule)) {
    fail(`jobs[${index}].schedule must be a valid 5-field cron expression`);
  }
  if (typeof job.enabled !== "boolean") {
    fail(`jobs[${index}].enabled must be a boolean`);
  }
  if (!isNonEmptyString(job.command)) {
    fail(`jobs[${index}].command must be a non-empty string`);
  }
};

const main = () => {
  let parsed;
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(`failed to read or parse config "${configPath}": ${error.message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail("config root must be an object");
  }
  if (!Array.isArray(parsed.jobs)) {
    fail('config must include a "jobs" array');
  }

  const names = new Set();
  parsed.jobs.forEach((job, index) => validateJob(job, index, names));

  const enabledJobs = parsed.jobs.filter((job) => job.enabled);
  if (enabledJobs.length === 0) {
    fail("config has zero enabled jobs");
  }

  const lines = [];
  for (const job of enabledJobs) {
    lines.push(`# ${job.name}`);
    lines.push(`${job.schedule} ${job.command}`);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");

  console.log(
    `[render-crontab] wrote ${enabledJobs.length} enabled jobs to ${outputPath}`
  );
};

main();
