import { ethers } from "ethers";
import { subtask, task, types } from "hardhat/config";
import { address as hoodiConsolidationControllerAddress } from "../../deployments/hoodi/ConsolidationController.json";
import {
  abi as consolidationControllerAbi,
  address as mainnetConsolidationControllerAddress,
} from "../../deployments/mainnet/ConsolidationController.json";
import addresses from "../../utils/addresses";
import { getSigner } from "../../utils/signers";
import { logTxDetails } from "../../utils/txLogger";

const log = require("../../utils/logger")("action:doAccounting");

async function doAccountingForProxy(
  proxyName: string,
  networkName: string,
  signer: ethers.Signer,
  consolidationController: ethers.Contract
) {
  const nativeStakingProxyAddress = (addresses as any)[networkName][proxyName];
  if (!nativeStakingProxyAddress) {
    throw new Error(`Failed to resolve ${proxyName} on ${networkName}`);
  }
  log(`Resolved ${proxyName} address to ${nativeStakingProxyAddress}`);

  const tx = await consolidationController
    .connect(signer)
    .doAccounting(nativeStakingProxyAddress);
  await logTxDetails(tx, `doAccounting for ${proxyName} via controller`);
}

subtask(
  "doAccounting",
  "Account for consensus rewards and validator exits in the Native Staking Strategy"
)
  .addOptionalParam(
    "index",
    "The number of the Native Staking Contract deployed.",
    undefined,
    types.int
  )
  .addOptionalParam(
    "consol",
    "Call the consolidation controller instead of the strategy",
    false,
    types.boolean
  )
  .setAction(async () => {
    const signer = await getSigner();
    const { chainId } = await signer.provider?.getNetwork();

    const networkName =
      chainId === 1 ? "mainnet" : chainId === 560048 ? "hoodi" : undefined;
    if (!networkName) {
      throw new Error(
        `Action only supports mainnet and hoodi, not chainId ${chainId}`
      );
    }
    log(`Network: ${networkName} (${chainId})`);

    const controllerAddress =
      networkName === "mainnet"
        ? mainnetConsolidationControllerAddress
        : hoodiConsolidationControllerAddress;
    log(`ConsolidationController: ${controllerAddress}`);

    const consolidationController = new ethers.Contract(
      controllerAddress,
      consolidationControllerAbi,
      signer
    );

    await doAccountingForProxy(
      "NativeStakingSSVStrategy2Proxy",
      networkName,
      signer,
      consolidationController
    );
    await doAccountingForProxy(
      "NativeStakingSSVStrategy3Proxy",
      networkName,
      signer,
      consolidationController
    );
  });

task("doAccounting").setAction(async (_, __, runSuper) => {
  return runSuper();
});
