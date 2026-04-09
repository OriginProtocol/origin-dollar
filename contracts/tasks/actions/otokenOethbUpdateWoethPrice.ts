/// <reference types="hardhat/types/runtime" />

import { action } from "../lib/action";
import { logTxDetails } from "../../utils/txLogger";

const STRATEGY_PROXY_DEPLOYMENT = "BridgedWOETHStrategyProxy";

action({
  name: "otokenOethbUpdateWoethPrice",
  description: "Update WOETH price on Base",
  chains: [8453],
  run: async ({ signer, log }) => {
    const ethers = hre.ethers;
    const strategyProxy = await ethers.getContract(STRATEGY_PROXY_DEPLOYMENT);
    const strategy = await ethers.getContractAt(
      "BridgedWOETHStrategy",
      strategyProxy.address
    );

    log.info(
      `Calling updateWOETHOraclePrice on ${STRATEGY_PROXY_DEPLOYMENT} at ${strategy.address}`
    );
    const tx = await strategy.connect(signer).updateWOETHOraclePrice({
      gasLimit: 200000,
    });
    await logTxDetails(tx, "updateWOETHOraclePrice");
  },
});
