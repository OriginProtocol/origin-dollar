const { expect } = require("chai");
const { utils } = require("ethers");

const { convexVaultFixture } = require("../_fixture");
const {
  daiUnits,
  usdtUnits,
  ousdUnits,
  units,
  loadFixture,
  expectApproxSupply,
  isFork,
} = require("../helpers");

describe.only("Convex Strategy", function () {
  if (isFork) {
    this.timeout(0);
  }

  let anna,
    ousd,
    vault,
    governor,
    crv,
    cvx,
    threePoolToken,
    convexStrategy,
    cvxBooster,
    usdt,
    usdc,
    dai;

  const mint = async (amount, asset) => {
    await asset.connect(anna).mint(units(amount, asset));
    await asset.connect(anna).approve(vault.address, units(amount, asset));
    return await vault
      .connect(anna)
      .mint(asset.address, units(amount, asset), 0);
  };

  beforeEach(async function () {
    const fixture = await loadFixture(convexVaultFixture);
    anna = fixture.anna;
    vault = fixture.vault;
    ousd = fixture.ousd;
    governor = fixture.governor;
    crv = fixture.crv;
    cvx = fixture.cvx;
    threePoolToken = fixture.threePoolToken;
    convexStrategy = fixture.convexStrategy;
    cvxBooster = fixture.cvxBooster;
    usdt = fixture.usdt;
    usdc = fixture.usdc;
    dai = fixture.dai;

    await vault
      .connect(governor)
      .setAssetDefaultStrategy(usdc.address, convexStrategy.address);
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(usdt.address, convexStrategy.address);
  });

  describe("Mint", function () {
    it("Should stake USDT in Curve gauge via 3pool", async function () {
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("30000.00", usdt);
      await expectApproxSupply(ousd, ousdUnits("30200"));
      await expect(anna).to.have.a.balanceOf("30000", ousd);
      await expect(cvxBooster).has.an.approxBalanceOf("30000", threePoolToken);
    });

    it("Should stake USDC in Curve gauge via 3pool", async function () {
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("50000.00", usdc);
      await expectApproxSupply(ousd, ousdUnits("50200"));
      await expect(anna).to.have.a.balanceOf("50000", ousd);
      await expect(cvxBooster).has.an.approxBalanceOf("50000", threePoolToken);
    });

    it("Should use a minimum LP token amount when depositing USDT into 3pool", async function () {
      await expect(mint("29000", usdt)).to.be.revertedWith(
        "Slippage ruined your day"
      );
    });

    it("Should use a minimum LP token amount when depositing USDC into 3pool", async function () {
      await expect(mint("29000", usdc)).to.be.revertedWith(
        "Slippage ruined your day"
      );
    });
  });

  describe("Redeem", function () {
    it("Should be able to unstake from gauge and return USDT", async function () {
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("10000.00", dai);
      await mint("10000.00", usdc);
      await mint("10000.00", usdt);
      await vault.connect(anna).redeem(ousdUnits("20000"), 0);
      await expectApproxSupply(ousd, ousdUnits("10200"));
    });
  });

  describe("Utilities", function () {
    it("Should allow transfer of arbitrary token by Governor", async () => {
      await dai.connect(anna).approve(vault.address, daiUnits("8.0"));
      await vault.connect(anna).mint(dai.address, daiUnits("8.0"), 0);
      // Anna sends her OUSD directly to Strategy
      await ousd
        .connect(anna)
        .transfer(convexStrategy.address, ousdUnits("8.0"));
      // Anna asks Governor for help
      await convexStrategy
        .connect(governor)
        .transferToken(ousd.address, ousdUnits("8.0"));
      await expect(governor).has.a.balanceOf("8.0", ousd);
    });

    it("Should not allow transfer of arbitrary token by non-Governor", async () => {
      // Naughty Anna
      await expect(
        convexStrategy
          .connect(anna)
          .transferToken(ousd.address, ousdUnits("8.0"))
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Should allow the strategist to call harvest", async () => {
      await vault.connect(governor).setStrategistAddr(anna.address);
      await vault.connect(anna)["harvest()"]();
    });

    it("Should allow the strategist to call harvest for a specific strategy", async () => {
      // Mint of MockCRVMinter mints a fixed 2e18
      await vault.connect(governor).setStrategistAddr(anna.address);
      await vault.connect(anna)["harvest(address)"](convexStrategy.address);
    });

    it("Should collect reward tokens using collect rewards on all strategies", async () => {
      // Mint of MockCRVMinter mints a fixed 2e18
      await vault.connect(governor)["harvest()"]();
      await expect(await crv.balanceOf(vault.address)).to.be.equal(
        utils.parseUnits("2", 18)
      );
      await expect(await cvx.balanceOf(vault.address)).to.be.equal(
        utils.parseUnits("3", 18)
      );
    });

    it("Should collect all reward tokens even though the swap limits are set", async () => {
      await expect(
        convexStrategy
          .connect(governor)
          .setRewardLiquidationLimits([
            utils.parseUnits("1", 18), // CRV
            utils.parseUnits("1.5", 18) // CVX
          ])
      )
        .to.emit(convexStrategy, "RewardLiquidationLimitsUpdated")
        .withArgs([0, 0], [utils.parseUnits("1", 18), utils.parseUnits("1.5", 18)]);
      
      expect(await convexStrategy.rewardLiquidationLimits(0)).to.equal(
        utils.parseUnits("1", 18)
      );
      expect(await convexStrategy.rewardLiquidationLimits(1)).to.equal(
        utils.parseUnits("1.5", 18)
      );

      // Mint of MockCRVMinter mints a fixed 2e18
      await vault.connect(governor)["harvest()"]();
      await expect(await crv.balanceOf(vault.address)).to.be.equal(
        utils.parseUnits("2", 18)
      );
      await expect(await cvx.balanceOf(vault.address)).to.be.equal(
        utils.parseUnits("3", 18)
      );
    });

    it("Should collect reward tokens using collect rewards on a specific strategy", async () => {
      await vault.connect(governor)[
        // eslint-disable-next-line
        "harvest(address)"
      ](convexStrategy.address);

      await expect(await crv.balanceOf(vault.address)).to.be.equal(
        utils.parseUnits("2", 18)
      );
      await expect(await cvx.balanceOf(vault.address)).to.be.equal(
        utils.parseUnits("3", 18)
      );
    });

    it("Should collect reward tokens and swap via Uniswap", async () => {
      const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");

      mockUniswapRouter.initialize(crv.address, usdt.address);
      await vault.connect(governor).setUniswapAddr(mockUniswapRouter.address);

      // Add CRV to the Vault as a token that should be swapped
      await vault.connect(governor).addSwapToken(crv.address);

      // Make sure Vault has 0 USDT balance
      await expect(vault).has.a.balanceOf("0", usdt);

      // Give Uniswap mock some USDT so it can give it back in CRV liquidation
      await usdt
        .connect(anna)
        .transfer(mockUniswapRouter.address, usdtUnits("100"));

      // prettier-ignore
      await vault
        .connect(governor)["harvestAndSwap()"]();

      // Make sure Vault has 100 USDT balance (the Uniswap mock converts at 1:1)
      await expect(vault).has.a.balanceOf("2", usdt);

      // No CRV in Vault or Compound strategy
      await expect(vault).has.a.balanceOf("0", crv);
      await expect(await crv.balanceOf(convexStrategy.address)).to.be.equal(
        "0"
      );
    });

    // This test only succeeds because the CVX token is not yet added as a swapToken on the vault. 
    // And that can be done once an oracle exists
    it("Should collect reward tokens and swap via Uniswap considering liquidation limits using harvestAndSwap()", async () => {
      await harvestAndSwapTokens(false)
    });

    // TODO: This test will fail as long as we don't have CVX oracle
    it("Should collect reward tokens and swap via Uniswap considering liquidation limits using harvestAndSwap(strategy_address)", async () => {
      await harvestAndSwapTokens(true)
    });

    const harvestAndSwapTokens = async (callWithStrategyAddress) => {
      const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");
      mockUniswapRouter.initialize(crv.address, usdt.address);
      await vault.connect(governor).setUniswapAddr(mockUniswapRouter.address);

      // Add CRV to the Vault as a token that should be swapped
      await vault.connect(governor).addSwapToken(crv.address);

      // Make sure Vault has 0 USDT balance
      await expect(vault).has.a.balanceOf("0", usdt);

      // Give Uniswap mock some USDT so it can give it back in CRV liquidation
      await usdt
        .connect(anna)
        .transfer(mockUniswapRouter.address, usdtUnits("100"));

      await convexStrategy
        .connect(governor)
        .setRewardLiquidationLimits([
          utils.parseUnits("0.8", 18), // CRV
          utils.parseUnits("1.5", 18) // CVX
        ]);

      const limits = await convexStrategy.getRewardLiquidationLimits();
      expect(limits[0]).to.equal(utils.parseUnits("0.8", 18));
      expect(limits[1]).to.equal(utils.parseUnits("1.5", 18));

      if (callWithStrategyAddress) {
        // prettier-ignore
        await vault
          .connect(governor)["harvestAndSwap(address)"](convexStrategy.address);
      } else {
        // prettier-ignore
        await vault
          .connect(governor)["harvestAndSwap()"]();
      }

      // No CRV in Vault or Compound strategy
      await expect(vault).has.a.balanceOf("1.2", crv);
      await expect(await crv.balanceOf(convexStrategy.address)).to.be.equal(
        "0"
      );
      // TODO once CVX swapping is possible adjust this to 1.5 
      await expect(vault).has.a.balanceOf("3", cvx);
      await expect(await cvx.balanceOf(convexStrategy.address)).to.be.equal(
        "0"
      );
      // TODO increase usdt to 2.3 when CVX selling is possible
      // Make sure Vault has 100 USDT balance (the Uniswap mock converts at 1:1)
      await expect(vault).has.a.balanceOf("0.8", usdt);
    }

    it("Should reset reward token liquidation limits when new reward tokens are set", async () => {
      await convexStrategy
        .connect(governor)
        .setRewardLiquidationLimits([
          utils.parseUnits("0.8", 18), // CRV
          utils.parseUnits("1.5", 18) // CVX
        ]);

      let limits = await convexStrategy.getRewardLiquidationLimits();
      expect(limits[0]).to.equal(utils.parseUnits("0.8", 18));
      expect(limits[1]).to.equal(utils.parseUnits("1.5", 18));

      await convexStrategy
        .connect(governor)
        .setRewardTokenAddresses([crv.address, cvx.address]);

      limits = await convexStrategy.getRewardLiquidationLimits();
      expect(limits[0]).to.equal(utils.parseUnits("0", 18));
      expect(limits[1]).to.equal(utils.parseUnits("0", 18));

    });
  });
});
