const { expect } = require("chai");
const { utils } = require("ethers");

const { loadDefaultFixture } = require("./../_fixture");
const { isCI, oethUnits } = require("./../helpers");
const { MAX_UINT256 } = require("../../utils/constants");
const { hotDeployOption } = require("../_hot-deploy");
const { setERC20TokenBalance } = require("../_fund");
const { parseUnits } = require("ethers").utils;

describe("ForkTest: Harvester", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
    await hotDeployOption(fixture, null, {
      isOethFixture: true
    })
    await hotDeployOption(fixture, null, {
      isOethFixture: false
    })

    const { oethHarvester, oethOracleRouter, harvester, timelock, crv, bal, aura, weth, usdt } = fixture;

    // Cache decimals
    await oethOracleRouter.connect(timelock).cacheDecimals(aura.address)
    await oethOracleRouter.connect(timelock).cacheDecimals(bal.address)

    // CRV with Curve for OETH
    await oethHarvester.connect(timelock).setRewardTokenConfig(
      crv.address,
      {
        allowedSlippageBps: 300,
        harvestRewardBps: 200,
        platform: 3, // Curve
        swapRouterAddr: "0x4ebdf703948ddcea3b11f675b4d1fba9d2414a14",
        liquidationLimit: oethUnits("4000"),
        doSwapRewardToken: true,
      },
      utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        ["2", "1"]
      )
    )
    await setERC20TokenBalance(oethHarvester.address, crv)

    // CRV with Uniswap V3 for OUSD
    await harvester.connect(timelock).setRewardTokenConfig(
      crv.address,
      {
        allowedSlippageBps: 300,
        harvestRewardBps: 200,
        platform: 1, // Uniswap V3
        swapRouterAddr: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        liquidationLimit: oethUnits("4000"),
        doSwapRewardToken: true,
      },
      utils.solidityPack(
        ["address", "uint24", "address", "uint24", "address"],
        [crv.address, 3000, weth.address, 500, usdt.address]
      )
    )
    await setERC20TokenBalance(harvester.address, crv)

    // BAL with Balancer for OETH
    await oethHarvester.connect(timelock).setRewardTokenConfig(
      bal.address,
      {
        allowedSlippageBps: 300,
        harvestRewardBps: 200,
        platform: 2, // Balancer
        swapRouterAddr: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
        liquidationLimit: oethUnits("100"),
        doSwapRewardToken: true,
      },
      utils.defaultAbiCoder.encode(
        ["bytes32"],
        ["0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014"]
      )
    )
    await setERC20TokenBalance(oethHarvester.address, bal)

    // BAL with Balancer for OETH
    await oethHarvester.connect(timelock).setRewardTokenConfig(
      aura.address,
      {
        allowedSlippageBps: 300,
        harvestRewardBps: 200,
        platform: 2, // Balancer
        swapRouterAddr: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
        liquidationLimit: oethUnits("500"),
        doSwapRewardToken: true,
      },
      utils.defaultAbiCoder.encode(
        ["bytes32"],
        ["0xcfca23ca9ca720b6e98e3eb9b6aa0ffc4a5c08b9000200000000000000000274"]
      )
    )
    await setERC20TokenBalance(oethHarvester.address, aura)
  });

  describe("with Curve", () => {
    it("Should swap CRV for WETH", async () => {
      const { oethHarvester, timelock, crv } = fixture;
      const crvBefore = await crv.balanceOf(oethHarvester.address)

      await oethHarvester.connect(timelock)
        .swapRewardToken(crv.address)

      expect(
        await crv.balanceOf(oethHarvester.address)
      ).to.equal(crvBefore.sub(oethUnits("4000")))
    })
  })

  describe("with Uniswap V3", () => {
    it("Should swap CRV for USDT", async () => {
      const { harvester, timelock, crv, } = fixture;
      const crvBefore = await crv.balanceOf(harvester.address)

      await harvester.connect(timelock)
        .swapRewardToken(crv.address)


      expect(
        await crv.balanceOf(harvester.address)
      ).to.equal(crvBefore.sub(oethUnits("4000")))
    })
  })

  describe("with Balancer", () => {
    it("Should swap BAL for WETH", async () => {
      const { oethHarvester, timelock, bal } = fixture;
      const balBefore = await bal.balanceOf(oethHarvester.address)

      await oethHarvester.connect(timelock)
        .swapRewardToken(bal.address)


      expect(
        await bal.balanceOf(oethHarvester.address)
      ).to.equal(balBefore.sub(oethUnits("100")))
    })

    it("Should swap AURA for WETH", async () => {
      const { oethHarvester, timelock, aura } = fixture;
      const auraBefore = await aura.balanceOf(oethHarvester.address)

      await oethHarvester.connect(timelock)
        .swapRewardToken(aura.address)

      // expect(
      //   await aura.balanceOf(oethHarvester.address)
      // ).to.equal(auraBefore.sub(oethUnits("500")))
    })
  })

  describe.skip("Rewards Config", () => {
    it("Should have correct reward token config for CRV", async () => {
      const { harvester, crv } = fixture;

      const config = await harvester.rewardTokenConfigs(crv.address);

      expect(config.allowedSlippageBps).to.equal(300);
      expect(config.harvestRewardBps).to.equal(200);
      expect(config.protocol).to.equal(
        "0" // Uniswap V2 compatible
      );
      expect(config.swapRouterAddr).to.equal(
        "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"
      );
      expect(config.doSwapRewardToken).to.be.true;
      expect(config.liquidationLimit).to.equal(parseUnits("4000", 18));
    });

    it("Should have correct reward token config for CVX", async () => {
      const { harvester, cvx } = fixture;

      const config = await harvester.rewardTokenConfigs(cvx.address);

      expect(config.allowedSlippageBps).to.equal(300);
      expect(config.harvestRewardBps).to.equal(100);
      expect(config.protocol).to.equal(
        "0" // Uniswap V2 compatible
      );
      expect(config.swapRouterAddr).to.equal(
        "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"
      );
      expect(config.doSwapRewardToken).to.be.true;
      expect(config.liquidationLimit).to.equal(utils.parseEther("2500"));
    });

    it("Should have correct reward token config for COMP", async () => {
      const { harvester, comp } = fixture;

      const config = await harvester.rewardTokenConfigs(comp.address);

      expect(config.allowedSlippageBps).to.equal(300);
      expect(config.harvestRewardBps).to.equal(100);
      expect(config.protocol).to.equal(
        "0" // Uniswap V2 compatible
      );
      expect(config.swapRouterAddr).to.equal(
        "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"
      );
      expect(config.doSwapRewardToken).to.be.true;
      expect(config.liquidationLimit).to.equal(MAX_UINT256);
    });

    it("Should have correct reward token config for AAVE", async () => {
      const { harvester, aave } = fixture;

      const config = await harvester.rewardTokenConfigs(aave.address);

      expect(config.allowedSlippageBps).to.equal(300);
      expect(config.harvestRewardBps).to.equal(100);
      expect(config.protocol).to.equal(
        "0" // Uniswap V2 compatible
      );
      expect(config.swapRouterAddr).to.equal(
        "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"
      );
      expect(config.doSwapRewardToken).to.be.true;
      expect(config.liquidationLimit).to.equal(MAX_UINT256);
    });
  });

  describe.skip("Harvest", () => {
    it("Should harvest from all strategies", async () => {
      const { harvester, timelock } = fixture;
      await harvester.connect(timelock)["harvest()"]();
    });

    it("Should swap all coins", async () => {
      const { harvester, timelock } = fixture;
      await harvester.connect(timelock).swap();
    });

    it.skip("Should harvest and swap from all strategies", async () => {
      // Skip this test because we don't call or use this method anywhere.
      // Also, because this test is flaky at times due to slippage and the
      // individual `harvest` and `swap` methods for each strategies are
      // covered in the tests above this.
      const { harvester, timelock } = fixture;
      await harvester.connect(timelock)["harvestAndSwap()"]();
    });

    it("Should swap CRV", async () => {
      const { harvester, timelock, crv } = fixture;
      await harvester.connect(timelock).swapRewardToken(crv.address);
    });

    it("Should swap CVX", async () => {
      const { harvester, timelock, cvx } = fixture;
      await harvester.connect(timelock).swapRewardToken(cvx.address);
    });

    it("Should swap COMP", async () => {
      const { harvester, timelock, comp } = fixture;
      await harvester.connect(timelock).swapRewardToken(comp.address);
    });

    it("Should swap AAVE", async () => {
      const { harvester, timelock, aave } = fixture;
      await harvester.connect(timelock).swapRewardToken(aave.address);
    });

    // TODO: Tests for `harvest(address)` for each strategy
  });
});
