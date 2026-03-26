const { ethers } = require("hardhat");
const { expect } = require("chai");

const { estimateVaultApy } = require("../../utils/morpho-apy");
const addresses = require("../../utils/addresses");

describe("ForkTest: Rebalancer APY — HyperEVM", function () {
  it("should return non-zero on-chain APY for HyperEVM MetaMorpho V1 vault", async () => {
    const apy = await estimateVaultApy(
      ethers.provider,
      999,
      addresses.hyperevm.MorphoOusdV1Vault
    );
    expect(apy).to.be.gt(0, `Expected APY > 0, got ${(apy * 100).toFixed(4)}%`);
  });
});
