/// <reference types="hardhat/types/runtime" />

import addresses from "../../utils/addresses";
import { logTxDetails } from "../../utils/txLogger";
import { action } from "../lib/action";

const EXPECTED_CROSS_CHAIN_CONTROLLER =
  "0xB1d624fc40824683e2bFBEfd19eB208DbBE00866";

action({
  name: "crossChainBalanceUpdateBase",
  description: "Send cross-chain balance update from Base",
  chains: [8453],
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
