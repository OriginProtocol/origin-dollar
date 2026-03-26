import type { ethers } from "ethers";
import type { Chain, Hash, TransactionReceipt } from "viem";
import type { Logger } from "winston";

import { getPublicClient, getRpcUrl, getWalletClient } from "./client";
import rootLogger from "./logger";
import { getEthersProvider, getEthersSigner, getKmsAccount } from "./signer";
import { logTxDetails as _logTxDetails } from "./txLogger";

export interface ActionContext {
  log: Logger;
  publicClient: ReturnType<typeof getPublicClient>;
  walletClient: Awaited<ReturnType<typeof getWalletClient>>;
  logTx: (hash: Hash, method: string) => Promise<TransactionReceipt>;
  ethersSigner: ethers.Signer;
  ethersProvider: ethers.providers.JsonRpcProvider;
}

export function action(params: {
  name: string;
  chain: Chain;
  run: (ctx: ActionContext) => Promise<void>;
}) {
  const { name, chain, run: fn } = params;

  const execute = async () => {
    const log = rootLogger.child({ action: name });
    log.info(`Starting`);

    const account = await getKmsAccount();
    const publicClient = getPublicClient(chain);
    const walletClient = getWalletClient(chain, account);

    const rpcUrl = getRpcUrl(chain);
    const ethersProvider = getEthersProvider(rpcUrl);
    const ethersSigner = getEthersSigner(ethersProvider);

    const logTx = (hash: Hash, method: string) => _logTxDetails(publicClient, hash, method, log);

    await fn({
      log,
      publicClient,
      walletClient,
      logTx,
      ethersSigner,
      ethersProvider,
    });

    log.info(`Completed`);
  };

  execute().catch((err) => {
    rootLogger.error(`${name} failed: ${err.message}`, { stack: err.stack });
    process.exit(1);
  });
}
