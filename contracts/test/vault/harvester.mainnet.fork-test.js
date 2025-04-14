const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");

const { createFixtureLoader, harvesterFixture } = require("./../_fixture");
const { isCI, oethUnits } = require("./../helpers");
const { hotDeployOption } = require("../_hot-deploy");
const addresses = require("../../utils/addresses");
const { setERC20TokenBalance } = require("../_fund");
const { parseUnits } = require("ethers").utils;

const loadFixture = createFixtureLoader(harvesterFixture);

describe("ForkTest: Harvester", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
    await hotDeployOption(fixture, null, {
      isOethFixture: true,
    });
    await hotDeployOption(fixture, null, {
      isOethFixture: false,
    });
  });

  // Skipping this since we switched to simple harvester
  describe.skip("with Curve", () => {
    it("Should swap CRV for WETH", async () => {
      const {
        oethHarvester,
        strategist,
        convexEthMetaStrategy,
        oethDripper,
        crv,
        weth,
      } = fixture;
      const wethBefore = await weth.balanceOf(oethDripper.address);

      // Send some rewards to the strategy
      await setERC20TokenBalance(convexEthMetaStrategy.address, crv, "2000");

      // prettier-ignore
      const tx = await oethHarvester
        .connect(strategist)["harvestAndSwap(address)"](convexEthMetaStrategy.address);

      await expect(tx).to.emit(convexEthMetaStrategy, "RewardTokenCollected");
      await expect(tx).to.emit(oethHarvester, "RewardTokenSwapped");
      await expect(tx).to.emit(oethHarvester, "RewardProceedsTransferred");

      // Should've transferred swapped WETH to Dripper
      expect(await weth.balanceOf(oethDripper.address)).to.be.gt(
        wethBefore.add(oethUnits("0.1"))
      );
    });
  });

  // Commenting this out since none of the strategies have anything
  // that we want to harvest on Uniswap V2 or V3 right now.

  // describe("with Uniswap V3", () => {
  //   it("Should swap CRV for USDT", async () => {
  //     const { harvester, timelock, crv } = fixture;
  //     const crvBefore = await crv.balanceOf(harvester.address);

  //     await harvester.connect(timelock).swapRewardToken(crv.address);

  //     expect(await crv.balanceOf(harvester.address)).to.equal(
  //       crvBefore.sub(oethUnits("4000"))
  //     );
  //   });
  // });

  describe.skip("with Balancer", () => {
    it("Should swap BAL and AURA for WETH", async () => {
      const {
        oethHarvester,
        strategist,
        bal,
        aura,
        weth,
        oethDripper,
        balancerREthStrategy,
      } = fixture;

      const wethBefore = await weth.balanceOf(oethDripper.address);

      // Send some rewards to the strategy
      await setERC20TokenBalance(balancerREthStrategy.address, bal, "1000");
      await setERC20TokenBalance(balancerREthStrategy.address, aura, "1000");

      // prettier-ignore
      const tx = await oethHarvester
        .connect(strategist)["harvestAndSwap(address)"](balancerREthStrategy.address);

      await expect(tx).to.emit(balancerREthStrategy, "RewardTokenCollected");
      await expect(tx).to.emit(oethHarvester, "RewardTokenSwapped");
      await expect(tx).to.emit(oethHarvester, "RewardProceedsTransferred");

      // Should've transferred everything to Harvester
      expect(await bal.balanceOf(balancerREthStrategy.address)).to.equal("0");
      expect(await aura.balanceOf(balancerREthStrategy.address)).to.equal("0");

      // Should've transferred swapped WETH to Dripper
      expect(await weth.balanceOf(oethDripper.address)).to.be.gt(
        wethBefore.add(oethUnits("0.1"))
      );
    });
  });

  describe("OUSD Rewards Config", () => {
    it("Should have correct reward token config for CRV", async () => {
      const { harvester, crv } = fixture;

      const config = await harvester.rewardTokenConfigs(crv.address);

      expect(config.allowedSlippageBps).to.equal(300);
      expect(config.harvestRewardBps).to.equal(200);
      expect(config.swapPlatform).to.equal(
        1 // Uniswap V3
      );
      expect(config.swapPlatformAddr).to.equal(
        "0xE592427A0AEce92De3Edee1F18E0157C05861564"
      );
      expect(config.doSwapRewardToken).to.be.true;
      expect(config.liquidationLimit).to.equal(parseUnits("4000", 18));
      expect(await harvester.uniswapV3Path(crv.address)).to.eq(
        utils.solidityPack(
          ["address", "uint24", "address", "uint24", "address"],
          [
            addresses.mainnet.CRV,
            3000,
            addresses.mainnet.WETH,
            500,
            addresses.mainnet.USDT,
          ]
        )
      );
    });

    it("Should have correct reward token config for CVX", async () => {
      const { harvester, cvx } = fixture;

      const config = await harvester.rewardTokenConfigs(cvx.address);

      expect(config.allowedSlippageBps).to.equal(300);
      expect(config.harvestRewardBps).to.equal(100);
      expect(config.swapPlatform).to.equal(
        1 // Uniswap V3
      );
      expect(config.swapPlatformAddr).to.equal(
        "0xE592427A0AEce92De3Edee1F18E0157C05861564"
      );
      expect(config.doSwapRewardToken).to.be.true;
      expect(config.liquidationLimit).to.equal(utils.parseEther("2500"));
      expect(await harvester.uniswapV3Path(cvx.address)).to.eq(
        utils.solidityPack(
          ["address", "uint24", "address", "uint24", "address"],
          [
            addresses.mainnet.CVX,
            10000,
            addresses.mainnet.WETH,
            500,
            addresses.mainnet.USDT,
          ]
        )
      );
    });

    it("Should have correct reward token config for COMP", async () => {
      const { harvester, comp } = fixture;

      const config = await harvester.rewardTokenConfigs(comp.address);

      expect(config.allowedSlippageBps).to.equal(300);
      expect(config.harvestRewardBps).to.equal(100);
      expect(config.swapPlatform).to.equal(
        1 // Uniswap V3
      );
      expect(config.swapPlatformAddr).to.equal(
        "0xE592427A0AEce92De3Edee1F18E0157C05861564"
      );
      expect(config.doSwapRewardToken).to.be.true;
      expect(config.liquidationLimit).to.equal(0);
      expect((await harvester.uniswapV3Path(comp.address)).toLowerCase()).to.eq(
        utils.solidityPack(
          ["address", "uint24", "address", "uint24", "address"],
          [
            addresses.mainnet.COMP,
            3000,
            addresses.mainnet.WETH,
            500,
            addresses.mainnet.USDT,
          ]
        )
      );
    });

    it("Should have correct reward token config for AAVE", async () => {
      const { harvester, aave } = fixture;

      const config = await harvester.rewardTokenConfigs(aave.address);

      expect(config.allowedSlippageBps).to.equal(300);
      expect(config.harvestRewardBps).to.equal(100);
      expect(config.swapPlatform).to.equal(
        1 // Uniswap V3
      );
      expect(config.swapPlatformAddr).to.equal(
        "0xE592427A0AEce92De3Edee1F18E0157C05861564"
      );
      expect(config.doSwapRewardToken).to.be.true;
      expect(config.liquidationLimit).to.equal(0);

      expect((await harvester.uniswapV3Path(aave.address)).toLowerCase()).to.eq(
        utils.solidityPack(
          ["address", "uint24", "address", "uint24", "address"],
          [
            addresses.mainnet.Aave,
            10000,
            addresses.mainnet.WETH,
            500,
            addresses.mainnet.USDT,
          ]
        )
      );
    });
  });

  describe("OETH Rewards Config", () => {
    it("Should have correct reward token config for CRV", async () => {
      const { oethHarvester, crv } = fixture;

      const config = await oethHarvester.rewardTokenConfigs(crv.address);

      expect(config.allowedSlippageBps).to.equal(300);
      expect(config.harvestRewardBps).to.equal(200);
      expect(config.swapPlatform).to.equal(
        3 // Curve
      );
      expect(config.swapPlatformAddr).to.equal(
        "0x4eBdF703948ddCEA3B11f675B4D1Fba9d2414A14"
      );
      expect(config.doSwapRewardToken).to.be.true;
      expect(config.liquidationLimit).to.equal(parseUnits("4000", 18));
      const indices = await oethHarvester.curvePoolIndices(crv.address);
      expect(indices[0]).to.eq(BigNumber.from("2"));
      expect(indices[1]).to.eq(BigNumber.from("1"));
    });

    it("Should have correct reward token config for CVX", async () => {
      const { oethHarvester, cvx } = fixture;

      const config = await oethHarvester.rewardTokenConfigs(cvx.address);

      expect(config.allowedSlippageBps).to.equal(300);
      expect(config.harvestRewardBps).to.equal(200);
      expect(config.swapPlatform).to.equal(
        3 // Curve
      );
      expect(config.swapPlatformAddr).to.equal(
        "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4"
      );
      expect(config.doSwapRewardToken).to.be.true;
      expect(config.liquidationLimit).to.equal(parseUnits("2500", 18));
      const indices = await oethHarvester.curvePoolIndices(cvx.address);
      expect(indices[0]).to.eq(BigNumber.from("1"));
      expect(indices[1]).to.eq(BigNumber.from("0"));
    });

    it("Should have correct reward token config for BAL", async () => {
      const { oethHarvester, bal } = fixture;

      const config = await oethHarvester.rewardTokenConfigs(bal.address);

      expect(config.allowedSlippageBps).to.equal(300);
      expect(config.harvestRewardBps).to.equal(200);
      expect(config.swapPlatform).to.equal(
        2 // Balancer
      );
      expect(config.swapPlatformAddr).to.equal(
        "0xBA12222222228d8Ba445958a75a0704d566BF2C8"
      );
      expect(config.doSwapRewardToken).to.be.true;
      expect(config.liquidationLimit).to.equal(parseUnits("1000", 18));
      expect(await oethHarvester.balancerPoolId(bal.address)).to.equal(
        "0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014"
      );
    });

    it("Should have correct reward token config for AURA", async () => {
      const { oethHarvester, aura } = fixture;

      const config = await oethHarvester.rewardTokenConfigs(aura.address);

      expect(config.allowedSlippageBps).to.equal(300);
      expect(config.harvestRewardBps).to.equal(200);
      expect(config.swapPlatform).to.equal(
        2 // Balancer
      );
      expect(config.swapPlatformAddr).to.equal(
        "0xBA12222222228d8Ba445958a75a0704d566BF2C8"
      );
      expect(config.doSwapRewardToken).to.be.true;
      expect(config.liquidationLimit).to.equal(parseUnits("4000", 18));
      expect(await oethHarvester.balancerPoolId(aura.address)).to.equal(
        "0xcfca23ca9ca720b6e98e3eb9b6aa0ffc4a5c08b9000200000000000000000274"
      );
    });
  });
});
