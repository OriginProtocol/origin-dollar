const { expect } = require("chai");

const {
  changeInMultipleBalances,
  setOracleTokenPriceUsd,
  daiUnits,
  ousdUnits,
  usdtUnits,
} = require("../helpers");
const { impersonateAndFund } = require("../../utils/signers");
const addresses = require("../../utils/addresses");
const { utils } = require("ethers");
const { MAX_UINT256 } = require("../../utils/constants");

/**
 *
 * @param {*} context a function that returns a fixture with the additional properties:
 * - strategy: the strategy to test
 * - rewards: array of objects with asset and expected properties
 * @example
    shouldBehaveLikeHarvester(() => ({
        fixture,
        harvester: fixture.harvester,
        strategies: [{ strategy, rewardTokens }],
        rewardProceedsAddress: fixture.vault.address,
    }));
 */
const shouldBehaveLikeHarvester = (context) => {
  describe("Harvest", () => {
    async function _checkBalancesPostHarvesting(harvestFn, strategies) {
      const { harvester } = context();

      if (!Array.isArray(strategies)) {
        strategies = [strategies];
      }

      const rewardTokens = strategies.reduce(
        (all, s) => [...all, ...s.rewardTokens],
        []
      );

      const balanceDiff = await changeInMultipleBalances(
        async () => {
          await harvestFn();
        },
        rewardTokens,
        [...strategies.map((s) => s.strategy.address), harvester.address]
      );

      for (const { strategy, rewardTokens } of strategies) {
        for (const token of rewardTokens) {
          expect(balanceDiff[harvester.address][token.address]).to.equal(
            -1 * balanceDiff[strategy.address][token.address],
            `Balance mismatch for rewardToken: ${await token.symbol()}`
          );
        }
      }
    }

    it("Should allow rewards to be collect from the strategy by the harvester", async () => {
      const { harvester, strategies } = context();
      const { strategy } = strategies[0];

      const harvesterSigner = await impersonateAndFund(harvester.address);

      await _checkBalancesPostHarvesting(
        () => strategy.connect(harvesterSigner).collectRewardTokens(),
        strategies[0]
      );
    });

    it("Should NOT allow rewards to be collected by non-harvester", async () => {
      const { fixture, strategies } = context();
      const { anna, governor, strategist } = fixture;
      const { strategy } = strategies[0];

      for (const signer of [anna, governor, strategist]) {
        await expect(
          strategy.connect(signer).collectRewardTokens()
        ).to.be.revertedWith("Caller is not the Harvester");
      }
    });
  });

  describe("RewardTokenConfig", () => {
    it("Should only allow valid Uniswap V2 path", async () => {
      const { harvester, fixture } = context();
      const { crv, usdt, governor, uniswapRouter } = fixture;

      const config = {
        allowedSlippageBps: 200,
        harvestRewardBps: 500,
        swapRouterAddr: uniswapRouter.address,
        doSwapRewardToken: true,
        platform: 0,
        liquidationLimit: 0,
      };

      let uniV2Path = utils.defaultAbiCoder.encode(
        ["address[]"],
        [[usdt.address, crv.address]]
      );

      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(crv.address, config, uniV2Path)
      ).to.be.revertedWith("Invalid Uniswap V2 path");

      uniV2Path = utils.defaultAbiCoder.encode(["address[]"], [[usdt.address]]);

      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(crv.address, config, uniV2Path)
      ).to.be.revertedWith("Invalid Uniswap V2 path");

      uniV2Path = utils.defaultAbiCoder.encode(
        ["address[]"],
        [[crv.address, usdt.address]]
      );

      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(crv.address, config, uniV2Path)
      ).to.not.be.reverted;
    });

    it("Should only allow valid Uniswap V3 path", async () => {
      const { harvester, fixture } = context();
      const { crv, usdt, governor, uniswapRouter } = fixture;

      const config = {
        allowedSlippageBps: 200,
        harvestRewardBps: 500,
        swapRouterAddr: uniswapRouter.address,
        doSwapRewardToken: true,
        platform: 1,
        liquidationLimit: 0,
      };

      let uniV3Path = utils.solidityPack(
        ["address", "uint24", "address"],
        [usdt.address, 24, crv.address]
      );
      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(crv.address, config, uniV3Path)
      ).to.be.revertedWith("Invalid Reward Token in swap path");

      uniV3Path = utils.solidityPack(
        ["address", "uint24", "address"],
        [crv.address, 24, crv.address]
      );
      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(crv.address, config, uniV3Path)
      ).to.be.revertedWith("Invalid Base Token in swap path");

      uniV3Path = utils.solidityPack(
        ["address", "uint24", "address"],
        [crv.address, 24, usdt.address]
      );
      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(crv.address, config, uniV3Path)
      ).to.not.be.reverted;
    });

    it("Should only allow valid balancer config", async () => {
      const { harvester, fixture } = context();
      const { crv, governor, uniswapRouter } = fixture;

      const config = {
        allowedSlippageBps: 200,
        harvestRewardBps: 500,
        swapRouterAddr: uniswapRouter.address,
        doSwapRewardToken: true,
        platform: 2,
        liquidationLimit: 0,
      };

      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(
            crv.address,
            config,
            utils.defaultAbiCoder.encode(
              ["bytes32"],
              [
                "0x0000000000000000000000000000000000000000000000000000000000000000",
              ]
            )
          )
      ).to.be.revertedWith("Invalid Balancer Pool ID");

      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(
            crv.address,
            config,
            utils.defaultAbiCoder.encode(
              ["bytes32"],
              [
                "0x000000000000000000000000000000000000000000000000000000000000dead",
              ]
            )
          )
      ).to.not.be.reverted;
    });

    it("Should only allow valid Curve config", async () => {
      const { harvester, fixture } = context();
      const { crv, usdt, governor, threePool } = fixture;

      const config = {
        allowedSlippageBps: 200,
        harvestRewardBps: 500,
        swapRouterAddr: threePool.address,
        doSwapRewardToken: true,
        platform: 3,
        liquidationLimit: 0,
      };

      await threePool
        .connect(governor)
        .setCoins([crv.address, crv.address, usdt.address]);

      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(
            crv.address,
            config,
            utils.defaultAbiCoder.encode(["uint256", "uint256"], ["1", "0"])
          )
      ).to.be.revertedWith("Invalid Base Token Index");

      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(
            crv.address,
            config,
            utils.defaultAbiCoder.encode(["uint256", "uint256"], ["2", "2"])
          )
      ).to.be.revertedWith("Invalid Reward Token Index");

      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(
            crv.address,
            config,
            utils.defaultAbiCoder.encode(["uint256", "uint256"], ["0", "2"])
          )
      ).to.not.be.reverted;
    });

    it("Should revert on unsupported platform", async () => {
      const { harvester, fixture } = context();
      const { crv, governor, uniswapRouter } = fixture;

      const config = {
        allowedSlippageBps: 200,
        harvestRewardBps: 500,
        swapRouterAddr: uniswapRouter.address,
        doSwapRewardToken: true,
        platform: 4,
        liquidationLimit: 0,
      };

      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(crv.address, config, [])
      ).to.be.reverted;
    });

    it("Should reset allowance on older router", async () => {
      const { harvester, fixture } = context();
      const { crv, usdt, governor, vault, uniswapRouter } = fixture;

      const oldRouter = vault; // Pretend vault is a router

      const config = {
        allowedSlippageBps: 200,
        harvestRewardBps: 500,
        swapRouterAddr: oldRouter.address,
        doSwapRewardToken: true,
        platform: 0,
        liquidationLimit: 0,
      };

      const uniV2Path = utils.defaultAbiCoder.encode(
        ["address[]"],
        [[crv.address, usdt.address]]
      );

      await harvester
        .connect(governor)
        .setRewardTokenConfig(crv.address, config, uniV2Path);

      // Check allowance on old router
      expect(await crv.allowance(harvester.address, oldRouter.address)).to.eq(
        MAX_UINT256
      );

      // Change router
      await harvester.connect(governor).setRewardTokenConfig(
        crv.address,
        {
          ...config,
          swapRouterAddr: uniswapRouter.address,
        },
        uniV2Path
      );

      // Check allowance on old & new router
      expect(
        await crv.allowance(harvester.address, uniswapRouter.address)
      ).to.eq(MAX_UINT256);
      expect(await crv.allowance(harvester.address, oldRouter.address)).to.eq(
        0
      );
    });

    it("Should not allow setting a valid router address", async () => {
      const { harvester, fixture } = context();
      const { crv, governor } = fixture;

      const config = {
        allowedSlippageBps: 200,
        harvestRewardBps: 500,
        swapRouterAddr: addresses.zero,
        doSwapRewardToken: true,
        platform: 0,
        liquidationLimit: 0,
      };

      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(crv.address, config, [])
      ).to.be.revertedWith("Swap router address should be non zero address");
    });

    it("Should not allow higher slippage", async () => {
      const { harvester, fixture } = context();
      const { crv, governor, uniswapRouter } = fixture;

      const config = {
        allowedSlippageBps: 1001,
        harvestRewardBps: 500,
        swapRouterAddr: uniswapRouter.address,
        doSwapRewardToken: true,
        platform: 0,
        liquidationLimit: 0,
      };

      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(crv.address, config, [])
      ).to.be.revertedWith("Allowed slippage should not be over 10%");
    });

    it("Should not allow higher reward fee", async () => {
      const { harvester, fixture } = context();
      const { crv, governor, uniswapRouter } = fixture;

      const config = {
        allowedSlippageBps: 133,
        harvestRewardBps: 1001,
        swapRouterAddr: uniswapRouter.address,
        doSwapRewardToken: true,
        platform: 0,
        liquidationLimit: 0,
      };

      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(crv.address, config, [])
      ).to.be.revertedWith("Harvest reward fee should not be over 10%");
    });

    it("Should revert for unsupported tokens", async () => {
      const { harvester, fixture } = context();
      const { ousd, governor, uniswapRouter } = fixture;

      const config = {
        allowedSlippageBps: 133,
        harvestRewardBps: 344,
        swapRouterAddr: uniswapRouter.address,
        doSwapRewardToken: true,
        platform: 0,
        liquidationLimit: 0,
      };

      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(ousd.address, config, [])
      ).to.be.revertedWith("Asset not available");
    });

    it("Should revert when it's not Governor", async () => {
      const { harvester, fixture } = context();
      const { ousd, strategist, uniswapRouter } = fixture;

      const config = {
        allowedSlippageBps: 133,
        harvestRewardBps: 344,
        swapRouterAddr: uniswapRouter.address,
        doSwapRewardToken: true,
        platform: 0,
        liquidationLimit: 0,
      };

      await expect(
        harvester
          .connect(strategist)
          .setRewardTokenConfig(ousd.address, config, [])
      ).to.be.revertedWith("Caller is not the Governor");
    });
  });

  describe("Swap", () => {
    async function _swapWithRouter(swapRouterConfig, swapData) {
      const { harvester, strategies, rewardProceedsAddress, fixture } =
        context();
      const { governor, uniswapRouter, domen } = fixture;

      const { strategy, rewardTokens } = strategies[0];

      const baseToken = await ethers.getContractAt(
        "MockUSDT",
        await harvester.baseTokenAddress()
      );
      const swapToken = rewardTokens[0];

      // Configure to use Uniswap V3
      const config = {
        allowedSlippageBps: 200,
        harvestRewardBps: 500,
        swapRouterAddr: uniswapRouter.address,
        doSwapRewardToken: true,
        platform: 1,
        liquidationLimit: 0,
        ...swapRouterConfig,
      };

      await harvester
        .connect(governor)
        .setRewardTokenConfig(swapToken.address, config, swapData);

      await setOracleTokenPriceUsd(await swapToken.symbol(), "1");

      let swapTx;
      const balanceDiff = await changeInMultipleBalances(
        async () => {
          // Do the swap
          // prettier-ignore
          swapTx = await harvester.connect(domen)["harvestAndSwap(address)"](
            strategy.address
          )
        },
        [baseToken, swapToken],
        [
          harvester.address,
          domen.address,
          strategy.address,
          rewardProceedsAddress,
        ]
      );

      const balanceSwapped =
        -1 *
        (balanceDiff[strategy.address][swapToken.address] +
          balanceDiff[harvester.address][swapToken.address]);
      const tokensReceived =
        balanceDiff[rewardProceedsAddress][baseToken.address] +
        balanceDiff[domen.address][baseToken.address];

      const protocolShare = (tokensReceived * 9500) / 10000;
      const farmerShare = (tokensReceived * 500) / 10000;

      await expect(swapTx)
        .to.emit(harvester, "RewardTokenSwapped")
        .withArgs(
          swapToken.address,
          baseToken.address,
          config.platform,
          balanceSwapped.toString(),
          tokensReceived.toString()
        );

      await expect(swapTx)
        .to.emit(harvester, "RewardProceedsTransferred")
        .withArgs(baseToken.address, domen.address, protocolShare, farmerShare);

      expect(balanceDiff[domen.address][baseToken.address]).to.equal(
        farmerShare
      );
      expect(balanceDiff[rewardProceedsAddress][baseToken.address]).to.equal(
        protocolShare
      );
    }

    it("Should harvest and swap with Uniswap V2", async () => {
      const { fixture, harvester, strategies } = context();
      const { uniswapRouter } = fixture;
      const { rewardTokens } = strategies[0];

      const baseToken = await ethers.getContractAt(
        "MockUSDT",
        await harvester.baseTokenAddress()
      );
      const swapToken = rewardTokens[0];

      await _swapWithRouter(
        {
          platform: 0,
          swapRouterAddr: uniswapRouter.address,
        },
        utils.defaultAbiCoder.encode(
          ["address[]"],
          [[swapToken.address, baseToken.address]]
        )
      );
    });

    it("Should harvest and swap with Uniswap V3", async () => {
      const { fixture, harvester, strategies } = context();
      const { uniswapRouter } = fixture;
      const { rewardTokens } = strategies[0];

      const baseToken = await ethers.getContractAt(
        "MockUSDT",
        await harvester.baseTokenAddress()
      );
      const swapToken = rewardTokens[0];

      await _swapWithRouter(
        {
          platform: 1,
          swapRouterAddr: uniswapRouter.address,
        },
        utils.solidityPack(
          ["address", "uint24", "address"],
          [swapToken.address, 3000, baseToken.address]
        )
      );
    });

    it("Should harvest and swap with Balancer", async () => {
      const { fixture } = context();
      const { balancerVault } = fixture;
      await _swapWithRouter(
        {
          platform: 2,
          swapRouterAddr: balancerVault.address,
        },
        utils.defaultAbiCoder.encode(
          ["bytes32"],
          ["0x000000000000000000000000000000000000000000000000000000000000dead"]
        )
      );
    });

    it("Should harvest and swap with Curve", async () => {
      const { fixture, harvester, strategies } = context();
      const { threePool, governor } = fixture;
      const { rewardTokens } = strategies[0];

      const baseToken = await ethers.getContractAt(
        "MockUSDT",
        await harvester.baseTokenAddress()
      );
      const swapToken = rewardTokens[0];

      await threePool
        .connect(governor)
        .setCoins([swapToken.address, baseToken.address, baseToken.address]);

      await _swapWithRouter(
        {
          platform: 3,
          swapRouterAddr: threePool.address,
        },
        utils.defaultAbiCoder.encode(["uint256", "uint256"], ["0", "2"])
      );
    });

    it("Should not swap when disabled", async () => {
      const { harvester, strategies, fixture } = context();
      const { governor, uniswapRouter, domen } = fixture;

      const { strategy, rewardTokens } = strategies[0];

      const swapToken = rewardTokens[0];

      // Configure to use Uniswap V3
      const config = {
        allowedSlippageBps: 200,
        harvestRewardBps: 500,
        swapRouterAddr: uniswapRouter.address,
        doSwapRewardToken: false,
        platform: 2,
        liquidationLimit: 0,
      };

      await harvester
        .connect(governor)
        .setRewardTokenConfig(
          swapToken.address,
          config,
          utils.defaultAbiCoder.encode(
            ["bytes32"],
            [
              "0x000000000000000000000000000000000000000000000000000000000000dead",
            ]
          )
        );

      await setOracleTokenPriceUsd(await swapToken.symbol(), "1");

      // prettier-ignore
      const swapTx = await harvester
        .connect(domen)["harvestAndSwap(address)"](strategy.address);

      await expect(swapTx).to.not.emit(harvester, "RewardTokenSwapped");
      await expect(swapTx).to.not.emit(harvester, "RewardProceedsTransferred");
    });

    it("Should not swap when balance is zero", async () => {
      const { harvester, strategies, fixture } = context();
      const { governor, uniswapRouter } = fixture;

      const { rewardTokens, strategy } = strategies[0];

      const swapToken = rewardTokens[0];

      // Configure to use Uniswap V3
      const config = {
        allowedSlippageBps: 200,
        harvestRewardBps: 500,
        swapRouterAddr: uniswapRouter.address,
        doSwapRewardToken: true,
        platform: 2,
        liquidationLimit: 0,
      };

      await harvester
        .connect(governor)
        .setRewardTokenConfig(
          swapToken.address,
          config,
          utils.defaultAbiCoder.encode(
            ["bytes32"],
            [
              "0x000000000000000000000000000000000000000000000000000000000000dead",
            ]
          )
        );

      await setOracleTokenPriceUsd(await swapToken.symbol(), "1");

      // Remove everything from strategy
      await swapToken
        .connect(await impersonateAndFund(strategy.address))
        .transfer(
          governor.address,
          await swapToken.balanceOf(strategy.address)
        );

      // prettier-ignore
      const swapTx = await harvester
        .connect(governor)["harvestAndSwap(address)"](strategy.address);

      await expect(swapTx).to.not.emit(harvester, "RewardTokenSwapped");
      await expect(swapTx).to.not.emit(harvester, "RewardProceedsTransferred");
    });

    it("Should use liquidation limit", async () => {
      const { harvester, strategies, fixture } = context();
      const { governor, balancerVault, domen } = fixture;

      const { strategy, rewardTokens } = strategies[0];

      const swapToken = rewardTokens[0];
      const baseToken = await ethers.getContractAt(
        "MockUSDT",
        await harvester.baseTokenAddress()
      );

      // Configure to use Balancer
      const config = {
        allowedSlippageBps: 0,
        harvestRewardBps: 0,
        swapRouterAddr: balancerVault.address,
        doSwapRewardToken: true,
        platform: 2,
        liquidationLimit: ousdUnits("100"),
      };

      await harvester
        .connect(governor)
        .setRewardTokenConfig(
          swapToken.address,
          config,
          utils.defaultAbiCoder.encode(
            ["bytes32"],
            [
              "0x000000000000000000000000000000000000000000000000000000000000dead",
            ]
          )
        );

      await setOracleTokenPriceUsd(await swapToken.symbol(), "1");

      await swapToken
        .connect(domen)
        .mintTo(harvester.address, ousdUnits("1000"));

      // prettier-ignore
      const swapTx = await harvester
        .connect(domen)["harvestAndSwap(address)"](strategy.address);

      await expect(swapTx)
        .to.emit(harvester, "RewardTokenSwapped")
        .withArgs(
          swapToken.address,
          baseToken.address,
          2,
          ousdUnits("100"),
          usdtUnits("100")
        );
    });
  });

  describe("Admin function", () => {
    it("Should only allow governor to change RewardProceedsAddress", async () => {
      const { harvester, fixture } = context();
      const { governor, daniel, strategist } = fixture;

      await harvester
        .connect(governor)
        .setRewardProceedsAddress(strategist.address);

      expect(await harvester.rewardProceedsAddress()).to.equal(
        strategist.address
      );

      for (const signer of [daniel, strategist]) {
        await expect(
          harvester.connect(signer).setRewardProceedsAddress(governor.address)
        ).to.be.revertedWith("Caller is not the Governor");
      }
    });

    it("Should not allow to set invalid rewardProceedsAddress", async () => {
      const { harvester, fixture } = context();
      const { governor } = fixture;

      await expect(
        harvester.connect(governor).setRewardProceedsAddress(addresses.zero)
      ).to.be.revertedWith(
        "Rewards proceeds address should be a non zero address"
      );
    });

    it("Should allow governor to set supported strategies", async () => {
      const { harvester, fixture } = context();
      const { governor, strategist } = fixture;

      expect(await harvester.supportedStrategies(strategist.address)).to.be
        .false;
      await harvester
        .connect(governor)
        .setSupportedStrategy(strategist.address, true);
      expect(await harvester.supportedStrategies(strategist.address)).to.be
        .true;

      await expect(
        harvester
          .connect(strategist)
          .setSupportedStrategy(strategist.address, false)
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Should allow governor to transfer any token", async () => {
      const { harvester, fixture } = context();
      const { governor, strategist, dai } = fixture;

      await dai.connect(governor).mintTo(harvester.address, daiUnits("1000"));

      await expect(
        harvester.connect(strategist).transferToken(dai.address, "1")
      ).to.be.revertedWith("Caller is not the Governor");

      await harvester
        .connect(governor)
        .transferToken(dai.address, daiUnits("1000"));

      expect(await dai.balanceOf(harvester.address)).to.eq("0");
    });
  });
};

module.exports = {
  shouldBehaveLikeHarvester,
};
