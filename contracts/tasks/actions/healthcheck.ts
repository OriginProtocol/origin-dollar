import { action } from "../lib/action";

action({
  name: "healthcheck",
  description: "Simple test task to verify the action execution pipeline",
  run: async ({ log, chainId, networkName }) => {
    log.info(`Network: ${networkName} (${chainId})`);
    log.info(`Node version: ${process.version}`);
    log.info(
      `AWS KMS available: ${!!(
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      )}`
    );
  },
});
