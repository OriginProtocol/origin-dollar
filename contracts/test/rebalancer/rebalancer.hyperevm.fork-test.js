const { expect } = require("chai");

const { fetchMorphoApys } = require("../../utils/morpho-apy");
const addresses = require("../../utils/addresses");

describe("ForkTest: Rebalancer APY — HyperEVM", function () {
  it("should return non-zero APY for HyperEVM MetaMorpho V1 vault", async () => {
    const { apys } = await fetchMorphoApys([
      {
        metaMorphoVaultAddress: addresses.hyperevm.MorphoOusdV1Vault,
        morphoChainId: 999,
      },
    ]);
    const apy = apys[addresses.hyperevm.MorphoOusdV1Vault];
    expect(apy).to.be.gt(
      0,
      `Expected APY > 0, got ${(apy * 100).toFixed(4)}%`
    );
  });
});
