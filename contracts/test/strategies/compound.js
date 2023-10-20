const { expect } = require("chai");
const { utils } = require("ethers");

const { impersonateAndFund } = require("../../utils/signers");
const { createFixtureLoader, compoundFixture } = require("../fixture/_fixture");
const { usdcUnits, isFork } = require("../helpers");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const { shouldBehaveLikeStrategy } = require("../behaviour/strategy");

describe("Compound strategy", function () {
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

  it("Should collect rewards", async () => {
    const {
      cStandalone,
      strategySigner,
      vault,
      vaultSigner,
      governor,
      harvester,
      usdc,
      comp,
    } = fixture;

    await expect(await cStandalone.checkBalance(usdc.address)).to.be.equal("0");

    // Fund the strategy
    usdc.connect(strategySigner).mint(usdcUnits("1000"));
    expect(await usdc.balanceOf(cStandalone.address)).to.be.equal(
      usdcUnits("1000")
    );

    // Approve compound on vault
    await vault.connect(governor).approveStrategy(cStandalone.address);

    await harvester
      .connect(governor)
      .setSupportedStrategy(cStandalone.address, true);

    // Run deposit()
    await cStandalone
      .connect(vaultSigner)
      .deposit(usdc.address, usdcUnits("1000"));

    const compAmount = utils.parseUnits("100", 18);
    await comp.connect(strategySigner).mint(compAmount);

    // Make sure the Strategy has COMP balance
    await expect(await comp.balanceOf(vault.address)).to.be.equal("0");
    await expect(await comp.balanceOf(cStandalone.address)).to.be.equal(
      compAmount
    );

    await harvester.connect(governor)["harvest(address)"](cStandalone.address);

    // Vault address on Compound Strategy is set to governor so they Should
    // receive the reward
    await expect(await comp.balanceOf(harvester.address)).to.be.equal(
      compAmount
    );
    await expect(await comp.balanceOf(cStandalone.address)).to.be.equal("0");
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
