const { expect } = require("chai");

const { fetchMorphoApys } = require("../../utils/morpho-apy");
const addresses = require("../../utils/addresses");

describe("ForkTest: Rebalancer APY — Ethereum", function () {
  it("should return non-zero APY for Ethereum MetaMorpho V1 vault", async () => {
    const { apys } = await fetchMorphoApys([
      {
        metaMorphoVaultAddress: addresses.mainnet.MorphoOUSDv1Vault,
        morphoChainId: 1,
      },
    ]);
    const apy = apys[addresses.mainnet.MorphoOUSDv1Vault];
    expect(apy).to.be.gt(0, `Expected APY > 0, got ${(apy * 100).toFixed(4)}%`);
  });
});
