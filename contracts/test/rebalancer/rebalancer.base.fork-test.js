const { expect } = require("chai");

const { fetchMorphoApys } = require("../../utils/morpho-apy");
const addresses = require("../../utils/addresses");

describe("ForkTest: Rebalancer APY — Base", function () {
  it("should return non-zero APY for Base MetaMorpho V1 vault", async () => {
    const { apys } = await fetchMorphoApys([
      {
        metaMorphoVaultAddress: addresses.base.MorphoOusdV1Vault,
        morphoChainId: 8453,
      },
    ]);
    const apy = apys[addresses.base.MorphoOusdV1Vault];
    expect(apy).to.be.gt(
      0,
      `Expected APY > 0, got ${(apy * 100).toFixed(4)}%`
    );
  });
});
