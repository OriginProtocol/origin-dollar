const { expect } = require("chai");

const { impersonateAndFund } = require("../../utils/signers");
const { createFixtureLoader, compoundFixture } = require("../_fixture");
const { usdcUnits, isFork } = require("../helpers");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const { shouldBehaveLikeHarvestable } = require("../behaviour/harvestable");
const { shouldBehaveLikeStrategy } = require("../behaviour/strategy");

describe.skip("Compound strategy", function () {
  if (isFork) {
    this.timeout(0);
  }

  let fixture;
  const loadFixture = createFixtureLoader(compoundFixture);
  beforeEach(async function () {
    fixture = await loadFixture();
  });

  shouldBehaveLikeGovernable(() => ({
    ...fixture,
    strategy: fixture.cStandalone,
  }));

  shouldBehaveLikeHarvestable(() => ({
    ...fixture,
    harvester: fixture.harvester,
    strategy: fixture.cStandalone,
  }));

  shouldBehaveLikeStrategy(() => ({
    ...fixture,
    strategy: fixture.cStandalone,
    assets: [fixture.dai, fixture.usdc],
    vault: fixture.vault,
  }));

  it("Should allow a withdraw", async () => {
    const { cStandalone, usdc, cusdc, vault, vaultSigner } = fixture;
    const stratCUSDBalance = await cusdc.balanceOf(cStandalone.address);
    // Fund the strategy
    const strategySigner = await impersonateAndFund(
      fixture.cStandalone.address
    );
    usdc.connect(strategySigner).mint(usdcUnits("1000"));
    // Run deposit()
    await cStandalone
      .connect(vaultSigner)
      .deposit(usdc.address, usdcUnits("1000"));
    const exchangeRate = await cusdc.exchangeRateStored();
    // 0xde0b6b3a7640000 == 1e18
    const expectedCusd = usdcUnits("1000")
      .mul("0xde0b6b3a7640000")
      .div(exchangeRate);
    // Make sure we have cUSD now
    await expect(await cusdc.balanceOf(cStandalone.address)).to.be.above(
      stratCUSDBalance
    );
    await expect(await cusdc.balanceOf(cStandalone.address)).to.be.equal(
      expectedCusd
    );
    await expect(await usdc.balanceOf(cStandalone.address)).to.be.equal(
      usdcUnits("0")
    );
    // event Withdrawal(address indexed _asset, address _pToken, uint256 _amount);
    await expect(
      cStandalone
        .connect(vaultSigner)
        .withdraw(vault.address, usdc.address, usdcUnits("1000"))
    )
      .to.emit(cStandalone, "Withdrawal")
      .withArgs(usdc.address, cusdc.address, usdcUnits("1000"));
    await expect(await cusdc.balanceOf(cStandalone.address)).to.be.equal(
      stratCUSDBalance
    );
  });

  it("Should allow Governor to set reward token address", async () => {
    const { cStandalone, governor, comp } = fixture;

    await expect(
      cStandalone
        .connect(governor)
        .setRewardTokenAddresses([cStandalone.address])
    )
      .to.emit(cStandalone, "RewardTokenAddressesUpdated")
      .withArgs([comp.address], [cStandalone.address]);
    expect(await cStandalone.rewardTokenAddresses(0)).to.equal(
      cStandalone.address
    );
  });

  it("Should block Governor from adding more reward token address with zero address", async () => {
    const { cStandalone, governor } = fixture;

    await expect(
      cStandalone
        .connect(governor)
        .setRewardTokenAddresses([
          cStandalone.address,
          "0x0000000000000000000000000000000000000000",
        ])
    ).to.be.revertedWith("Can not set an empty address as a reward token");
  });

  it("Should allow Governor to remove reward token addresses", async () => {
    const { cStandalone, governor, comp } = fixture;

    // Add so we can remove
    await cStandalone
      .connect(governor)
      .setRewardTokenAddresses([cStandalone.address, comp.address]);
    // Remove all
    await cStandalone.connect(governor).setRewardTokenAddresses([]);
  });

  it("Should not allow non-Governor to set reward token address", async () => {
    const { cStandalone, anna } = fixture;
    await expect(
      cStandalone.connect(anna).setRewardTokenAddresses([cStandalone.address])
    ).to.be.revertedWith("Caller is not the Governor");
  });
});
