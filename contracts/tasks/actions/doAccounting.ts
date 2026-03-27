import { ethers } from "ethers";
import { types } from "hardhat/config";
import type { Logger } from "winston";
import { address as hoodiConsolidationControllerAddress } from "../../deployments/hoodi/ConsolidationController.json";
import {
  abi as consolidationControllerAbi,
  address as mainnetConsolidationControllerAddress,
} from "../../deployments/mainnet/ConsolidationController.json";
import addresses from "../../utils/addresses";
import { logTxDetails } from "../../utils/txLogger";
import { action } from "../lib/action";

async function doAccountingForProxy(
  proxyName: string,
  networkName: string,
  signer: ethers.Signer,
  consolidationController: ethers.Contract,
  log: Logger
) {
  const nativeStakingProxyAddress = (addresses as any)[networkName][proxyName];
  if (!nativeStakingProxyAddress) {
    throw new Error(`Failed to resolve ${proxyName} on ${networkName}`);
  }
  log.info(`Resolved ${proxyName} address to ${nativeStakingProxyAddress}`);

  const tx = await consolidationController
    .connect(signer)
    .doAccounting(nativeStakingProxyAddress);
  await logTxDetails(tx, `doAccounting for ${proxyName} via controller`);
}

action({
  name: "doAccounting",
  description:
    "Account for consensus rewards and validator exits in the Native Staking Strategy",
  chains: [1, 560048],
  params: (t) => {
    t.addOptionalParam(
      "index",
      "The number of the Native Staking Contract deployed.",
      undefined,
      types.int
    );
    t.addOptionalParam(
      "consol",
      "Call the consolidation controller instead of the strategy",
      false,
      types.boolean
    );
  },
  run: async ({ signer, networkName, log }) => {
    const controllerAddress =
      networkName === "mainnet"
        ? mainnetConsolidationControllerAddress
        : hoodiConsolidationControllerAddress;
    log.info(`ConsolidationController: ${controllerAddress}`);

    const consolidationController = new ethers.Contract(
      controllerAddress,
      consolidationControllerAbi,
      signer
    );

    await doAccountingForProxy(
      "NativeStakingSSVStrategy2Proxy",
      networkName,
      signer,
      consolidationController,
      log
    );
    await doAccountingForProxy(
      "NativeStakingSSVStrategy3Proxy",
      networkName,
      signer,
      consolidationController,
      log
    );
  },
});
