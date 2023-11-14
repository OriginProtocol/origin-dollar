const { expect } = require("chai");
const { utils } = require("ethers");

const { createFixtureLoader, convexVaultFixture } = require("../_fixture");
const {
  daiUnits,
  ousdUnits,
  units,
  expectApproxSupply,
  isFork,
} = require("../helpers");
const { parseUnits } = require("ethers/lib/utils");

describe("Convex Strategy", function () {
  if (isFork) {
    this.timeout(0);
  }

  let anna,
    ousd,
    vault,
    harvester,
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
    await asset.connect(anna).mint(await units(amount, asset));
    await asset
      .connect(anna)
      .approve(vault.address, await units(amount, asset));
    return await vault
      .connect(anna)
      .mint(asset.address, await units(amount, asset), 0);
  };

  const loadFixture = createFixtureLoader(convexVaultFixture);
  beforeEach(async function () {
    const fixture = await loadFixture();
    anna = fixture.anna;
    vault = fixture.vault;
    harvester = fixture.harvester;
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

    it("Should allow the strategist to call harvest for a specific strategy", async () => {
      // Mint of MockCRVMinter mints a fixed 2e18
      // prettier-ignore
      await harvester
        .connect(governor)["harvest(address)"](convexStrategy.address);
    });

    it("Should collect reward tokens using collect rewards on all strategies", async () => {
      // Mint of MockCRVMinter mints a fixed 2e18
      await harvester.connect(governor)["harvest()"]();
      await expect(await crv.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("2", 18)
      );
      await expect(await cvx.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("3", 18)
      );
    });

    it("Should collect all reward tokens even though the swap limits are set", async () => {
      const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");

      await harvester.connect(governor).setRewardTokenConfig(
        crv.address, // reward token
        {
          allowedSlippageBps: 300,
          harvestRewardBps: 100,
          swapRouterAddr: mockUniswapRouter.address,
          doSwapRewardToken: true,
          platform: 0,
          liquidationLimit: parseUnits("1"),
        },
        utils.defaultAbiCoder.encode(
          ["address[]"],
          [[crv.address, usdt.address]]
        )
      );

      await harvester.connect(governor).setRewardTokenConfig(
        cvx.address, // reward token
        {
          allowedSlippageBps: 300,
          harvestRewardBps: 100,
          swapRouterAddr: mockUniswapRouter.address,
          doSwapRewardToken: true,
          platform: 0,
          liquidationLimit: parseUnits("1"),
        },
        utils.defaultAbiCoder.encode(
          ["address[]"],
          [[cvx.address, usdt.address]]
        )
      );

      // Mint of MockCRVMinter mints a fixed 2e18
      await harvester.connect(governor)["harvest()"]();
      expect(await crv.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("2", 18)
      );
      expect(await cvx.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("3", 18)
      );
    });

    it("Should collect reward tokens using collect rewards on a specific strategy", async () => {
      await harvester.connect(governor)[
        // eslint-disable-next-line
        "harvest(address)"
      ](convexStrategy.address);

      await expect(await crv.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("2", 18)
      );
      await expect(await cvx.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("3", 18)
      );
    });

    it("Should collect reward tokens and swap via Uniswap", async () => {
      const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");

      await harvester.connect(governor).setRewardTokenConfig(
        crv.address, // reward token
        {
          allowedSlippageBps: 0,
          harvestRewardBps: 0,
          swapRouterAddr: mockUniswapRouter.address,
          doSwapRewardToken: true,
          platform: 0,
          liquidationLimit: 0,
        },
        utils.defaultAbiCoder.encode(
          ["address[]"],
          [[crv.address, usdt.address]]
        )
      );

      await harvester.connect(governor).setRewardTokenConfig(
        cvx.address, // reward token
        {
          allowedSlippageBps: 0,
          harvestRewardBps: 0,
          swapRouterAddr: mockUniswapRouter.address,
          doSwapRewardToken: true,
          platform: 0,
          liquidationLimit: 0,
        },
        utils.defaultAbiCoder.encode(
          ["address[]"],
          [[cvx.address, usdt.address]]
        )
      );

      // Make sure Vault has 0 USDT balance
      await expect(vault).has.a.balanceOf("0", usdt);
      await expect(vault).has.a.balanceOf("0", crv);
      await expect(vault).has.a.balanceOf("0", cvx);

      // prettier-ignore
      await harvester
        .connect(governor)["harvestAndSwap()"]();

      // Make sure Vault has 5 USDT balance
      await expect(vault).has.a.balanceOf("5", usdt);

      // No CRV in Vault or Compound strategy
      await expect(harvester).has.a.balanceOf("0", crv);
      await expect(harvester).has.a.balanceOf("0", cvx);
      await expect(await crv.balanceOf(convexStrategy.address)).to.be.equal(
        "0"
      );
      await expect(await cvx.balanceOf(convexStrategy.address)).to.be.equal(
        "0"
      );
    });

    it("Should collect reward tokens and swap via Uniswap considering liquidation limits using harvestAndSwap()", async () => {
      await harvestAndSwapTokens(false);
    });

    it("Should collect reward tokens and swap via Uniswap considering liquidation limits using harvestAndSwap(strategy_address)", async () => {
      await harvestAndSwapTokens(true);
    });

    const harvestAndSwapTokens = async (callAsGovernor) => {
      const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");

      // Make sure Vault has 0 USDT balance
      await expect(vault).has.a.balanceOf("0", usdt);
      await expect(vault).has.a.balanceOf("0", crv);
      await expect(vault).has.a.balanceOf("0", cvx);

      // Configure harvester
      await harvester.connect(governor).setRewardTokenConfig(
        crv.address, // reward token
        {
          allowedSlippageBps: 0,
          harvestRewardBps: 100,
          swapRouterAddr: mockUniswapRouter.address,
          doSwapRewardToken: true,
          platform: 0,
          liquidationLimit: parseUnits("0.8"),
        },
        utils.defaultAbiCoder.encode(
          ["address[]"],
          [[crv.address, usdt.address]]
        )
      );
      await harvester.connect(governor).setRewardTokenConfig(
        cvx.address, // reward token
        {
          allowedSlippageBps: 0,
          harvestRewardBps: 100,
          swapRouterAddr: mockUniswapRouter.address,
          doSwapRewardToken: true,
          platform: 0,
          liquidationLimit: parseUnits("1.5"),
        },
        utils.defaultAbiCoder.encode(
          ["address[]"],
          [[cvx.address, usdt.address]]
        )
      );

      const crvConfig = await harvester.rewardTokenConfigs(crv.address);
      const cvxConfig = await harvester.rewardTokenConfigs(cvx.address);

      expect(crvConfig.liquidationLimit).to.equal(utils.parseUnits("0.8", 18));
      expect(cvxConfig.liquidationLimit).to.equal(utils.parseUnits("1.5", 18));

      const balanceBeforeAnna = await usdt.balanceOf(anna.address);

      if (callAsGovernor) {
        // prettier-ignore
        await harvester
          .connect(anna)["harvestAndSwap(address)"](convexStrategy.address);

        await expect(vault).has.a.balanceOf("2.277", usdt); // (0.8 + 1.5) - 1%
        const balanceAfterAnna = await usdt.balanceOf(anna.address);
        await expect(balanceAfterAnna - balanceBeforeAnna).to.be.equal(
          utils.parseUnits("0.023", 6)
        );
      } else {
        // prettier-ignore
        await harvester
          .connect(governor)["harvestAndSwap()"]();
        await expect(vault).has.a.balanceOf("2.3", usdt); // (0.8 + 1.5)
      }

      await expect(harvester).has.a.balanceOf("1.2", crv);
      await expect(harvester).has.a.balanceOf("1.5", cvx);
      await expect(await crv.balanceOf(convexStrategy.address)).to.be.equal(
        "0"
      );
      await expect(await cvx.balanceOf(convexStrategy.address)).to.be.equal(
        "0"
      );
    };

    it("Should revert when zero address attempts to be set as reward token address", async () => {
      await expect(
        convexStrategy
          .connect(governor)
          .setRewardTokenAddresses([
            crv.address,
            "0x0000000000000000000000000000000000000000",
          ])
      ).to.be.revertedWith("Can not set an empty address as a reward token");
    });
  });
});
