import { ethers } from "ethers";
import { logTxDetails } from "../../utils/txLogger";
import { action } from "../lib/action";

const poolBoosterSwapXAbi = require("../../abi/poolBoosterSwapX.json");
const poolBoosterCentralRegistryAbi = require("../../abi/poolBoosterCentralRegistry.json");

action({
  name: "manageBribeOnSonic",
  description: "Manage bribes on all Sonic pool booster factories",
  chains: [146],
  run: async ({ signer, log }) => {
    const poolBoosterCentralRegistryProxyAddress =
      "0x4F3B656Aa5Fb5E708bF7B63D6ff71623eb4a218A";
    const poolBoosterCentralRegistryProxy = new ethers.Contract(
      poolBoosterCentralRegistryProxyAddress,
      poolBoosterCentralRegistryAbi,
      signer
    );

    const factories = await poolBoosterCentralRegistryProxy.getAllFactories();
    log.info(`Factories: ${factories}`);

    for (const f of factories) {
      const factory = new ethers.Contract(f, poolBoosterSwapXAbi, signer);
      const tx = await factory.connect(signer).bribeAll([]);
      await logTxDetails(tx, `Bribed all pools in factory ${f}`);
    }
  },
});
