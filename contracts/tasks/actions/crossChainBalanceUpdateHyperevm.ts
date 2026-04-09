/// <reference types="hardhat/types/runtime" />

import addresses from "../../utils/addresses";
import { logTxDetails } from "../../utils/txLogger";
import { action } from "../lib/action";

const EXPECTED_CROSS_CHAIN_CONTROLLER =
  "0xE0228DB13F8C4Eb00fD1e08e076b09eF5cD0EA1e";

action({
  name: "crossChainBalanceUpdateHyperevm",
  description: "Send cross-chain balance update from HyperEVM",
  chains: [999],
  run: async ({ signer, log, networkName }) => {
    const strategyAddress = (addresses as any)[networkName]
      .CrossChainRemoteStrategy;
    if (!strategyAddress) {
      throw new Error(
        `CrossChainRemoteStrategy address missing for network ${networkName}`
      );
    }
    if (
      strategyAddress.toLowerCase() !==
      EXPECTED_CROSS_CHAIN_CONTROLLER.toLowerCase()
    ) {
      throw new Error(
        `CrossChainRemoteStrategy address mismatch: expected ${EXPECTED_CROSS_CHAIN_CONTROLLER}, got ${strategyAddress}`
      );
    }

    const strategy = await hre.ethers.getContractAt(
      "CrossChainRemoteStrategy",
      strategyAddress
    );
    log.info(`Calling sendBalanceUpdate on ${strategy.address}`);

    const tx = await strategy.connect(signer).sendBalanceUpdate({
      gasLimit: 1000000,
    });
    await logTxDetails(tx, "sendBalanceUpdate on CrossChainRemoteStrategy");
  },
});
