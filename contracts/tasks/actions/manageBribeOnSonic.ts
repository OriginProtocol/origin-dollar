import { ethers } from "ethers";
import { subtask, task } from "hardhat/config";
import { getSigner } from "../../utils/signers";
import { logTxDetails } from "../../utils/txLogger";

const poolBoosterSwapXAbi = require("../../abi/poolBoosterSwapX.json");
const poolBoosterCentralRegistryAbi = require("../../abi/poolBoosterCentralRegistry.json");
const log = require("../../utils/logger")("action:manageBribeOnSonic");

subtask(
  "manageBribeOnSonic",
  "Manage bribes on all Sonic pool booster factories"
).setAction(async () => {
  const signer = await getSigner();

  const poolBoosterCentralRegistryProxyAddress =
    "0x4F3B656Aa5Fb5E708bF7B63D6ff71623eb4a218A";
  const poolBoosterCentralRegistryProxy = new ethers.Contract(
    poolBoosterCentralRegistryProxyAddress,
    poolBoosterCentralRegistryAbi,
    signer
  );

  const factories = await poolBoosterCentralRegistryProxy.getAllFactories();
  log(`Factories: ${factories}`);

  for (const f of factories) {
    const factory = new ethers.Contract(f, poolBoosterSwapXAbi, signer);
    const tx = await factory.connect(signer).bribeAll([]);
    await logTxDetails(tx, `Bribed all pools in factory ${f}`);
  }
});

task("manageBribeOnSonic").setAction(async (_, __, runSuper) => {
  return runSuper();
});
