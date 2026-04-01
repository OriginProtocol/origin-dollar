import { action } from "../lib/action";

action({
  name: "healthcheck",
  description: "Verify the action execution pipeline (signer, network, logging)",
  run: async ({ log, signer, chainId, networkName }) => {
    log.info(`Node version: ${process.version}`);
    log.info(`Network: ${networkName} (${chainId})`);

    const address = await signer.getAddress();
    log.info(`Signer address: ${address}`);

    const balance = await signer.provider!.getBalance(address);
    log.info(`Signer balance: ${balance.toString()} wei`);

    log.info(
      `AWS KMS available: ${!!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)}`
    );
    log.info("Healthcheck passed");
  },
});
