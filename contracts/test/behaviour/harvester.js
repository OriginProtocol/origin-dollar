const { expect } = require("chai");

const {
  changeInMultipleBalances,
  setOracleTokenPriceUsd,
  usdsUnits,
  ousdUnits,
  usdtUnits,
  oethUnits,
} = require("../helpers");
const { impersonateAndFund } = require("../../utils/signers");
const addresses = require("../../utils/addresses");
const { utils } = require("ethers");
const { MAX_UINT256 } = require("../../utils/constants");

/**
 *
 * @param {*} context a function that returns a fixture with the additional properties:
 * - harvester: OUSD Harvester or OETH Harvester
 * - strategies: an array of objects with the following properties:
 *   - strategy: strategy contract
 *   - rewardTokens: an array of reward tokens.
 * - rewardProceedsAddress: address to send the rewards to. eg vault
 * @example
    shouldBehaveLikeHarvester(() => ({
        ...fixture,
        harvester: fixture.harvester,
        strategies: [
        {
          strategy: fixture.compoundStrategy,
          rewardTokens: [fixture.comp],
        },
        {
          strategy: fixture.aaveStrategy,
          rewardTokens: [fixture.aaveToken],
        },
      ],
      rewardProceedsAddress: fixture.vault.address,
    }));
 */
const shouldBehaveLikeHarvester = (context) => {
  describe.skip("Harvest behaviour", () => {
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
      const { anna, governor, strategist, strategies } = context();
      const { strategy } = strategies[0];

      for (const signer of [anna, governor, strategist]) {
        await expect(
          strategy.connect(signer).collectRewardTokens()
        ).to.be.revertedWith("Caller is not the Harvester");
      }
    });
  });

  describe.skip("RewardTokenConfig", () => {
    it("Should only allow valid Uniswap V2 path", async () => {
      const { harvester, crv, usdt, governor, uniswapRouter } = context();

      const config = {
        allowedSlippageBps: 200,
        harvestRewardBps: 500,
        swapPlatformAddr: uniswapRouter.address,
        doSwapRewardToken: true,
        swapPlatform: 0,
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
      ).to.be.revertedWith("InvalidTokenInSwapPath");

      uniV2Path = utils.defaultAbiCoder.encode(
        ["address[]"],
        [[crv.address, crv.address]]
      );

      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(crv.address, config, uniV2Path)
      ).to.be.revertedWith("InvalidTokenInSwapPath");

      uniV2Path = utils.defaultAbiCoder.encode(["address[]"], [[usdt.address]]);
      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(crv.address, config, uniV2Path)
      ).to.be.revertedWith("InvalidUniswapV2PathLength");

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
      const { harvester, crv, usdt, governor, uniswapRouter } = context();

      const config = {
        allowedSlippageBps: 200,
        harvestRewardBps: 500,
        swapPlatformAddr: uniswapRouter.address,
        doSwapRewardToken: true,
        swapPlatform: 1,
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
      ).to.be.revertedWith("InvalidTokenInSwapPath");

      uniV3Path = utils.solidityPack(
        ["address", "uint24", "address"],
        [crv.address, 24, crv.address]
      );
      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(crv.address, config, uniV3Path)
      ).to.be.revertedWith("InvalidTokenInSwapPath");

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
      const { harvester, crv, governor, balancerVault } = context();

      const config = {
        allowedSlippageBps: 200,
        harvestRewardBps: 500,
        swapPlatformAddr: balancerVault.address,
        doSwapRewardToken: true,
        swapPlatform: 2,
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
      ).to.be.revertedWith("EmptyBalancerPoolId");

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
      const { harvester, crv, usdt, governor, threePool } = context();

      const config = {
        allowedSlippageBps: 200,
        harvestRewardBps: 500,
        swapPlatformAddr: threePool.address,
        doSwapRewardToken: true,
        swapPlatform: 3,
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
      ).to.be.revertedWith("InvalidCurvePoolAssetIndex");

      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(
            crv.address,
            config,
            utils.defaultAbiCoder.encode(["uint256", "uint256"], ["2", "2"])
          )
      ).to.be.revertedWith("InvalidCurvePoolAssetIndex");

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
      const { harvester, crv, governor, uniswapRouter } = context();

      const config = {
        allowedSlippageBps: 200,
        harvestRewardBps: 500,
        swapPlatformAddr: uniswapRouter.address,
        doSwapRewardToken: true,
        swapPlatform: 4,
        liquidationLimit: 0,
      };

      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(
            crv.address,
            config,
            utils.defaultAbiCoder.encode(["uint256"], ["0"])
          )
      ).to.be.reverted;
    });

    it("Should reset allowance on older router", async () => {
      const { harvester, crv, usdt, governor, vault, uniswapRouter } =
        context();

      const oldRouter = vault; // Pretend vault is a router

      const config = {
        allowedSlippageBps: 200,
        harvestRewardBps: 500,
        swapPlatformAddr: oldRouter.address,
        doSwapRewardToken: true,
        swapPlatform: 0,
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
          swapPlatformAddr: uniswapRouter.address,
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
      const { harvester, crv, governor } = context();

      const config = {
        allowedSlippageBps: 200,
        harvestRewardBps: 500,
        swapPlatformAddr: addresses.zero,
        doSwapRewardToken: true,
        swapPlatform: 0,
        liquidationLimit: 0,
      };

      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(crv.address, config, [])
      ).to.be.revertedWith("EmptyAddress");
    });

    it("Should not allow higher slippage", async () => {
      const { harvester, crv, governor, uniswapRouter } = context();

      const config = {
        allowedSlippageBps: 1001,
        harvestRewardBps: 500,
        swapPlatformAddr: uniswapRouter.address,
        doSwapRewardToken: true,
        swapPlatform: 0,
        liquidationLimit: 0,
      };

      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(crv.address, config, [])
      ).to.be.revertedWith("InvalidSlippageBps");
    });

    it("Should not allow higher reward fee", async () => {
      const { harvester, crv, governor, uniswapRouter } = context();

      const config = {
        allowedSlippageBps: 133,
        harvestRewardBps: 1001,
        swapPlatformAddr: uniswapRouter.address,
        doSwapRewardToken: true,
        swapPlatform: 0,
        liquidationLimit: 0,
      };

      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(crv.address, config, [])
      ).to.be.revertedWith("InvalidHarvestRewardBps");
    });

    it.skip("Should revert for unsupported tokens", async () => {
      const { harvester, governor, uniswapRouter, usdc } = context();

      const config = {
        allowedSlippageBps: 133,
        harvestRewardBps: 344,
        swapPlatformAddr: uniswapRouter.address,
        doSwapRewardToken: true,
        swapPlatform: 0,
        liquidationLimit: 0,
      };

      await expect(
        harvester
          .connect(governor)
          .setRewardTokenConfig(usdc.address, config, [])
      ).to.be.revertedWith("Asset not available");
    });

    it("Should revert when it's not Governor", async () => {
      const { harvester, ousd, strategist, uniswapRouter } = context();

      const config = {
        allowedSlippageBps: 133,
        harvestRewardBps: 344,
        swapPlatformAddr: uniswapRouter.address,
        doSwapRewardToken: true,
        swapPlatform: 0,
        liquidationLimit: 0,
      };

      await expect(
        harvester
          .connect(strategist)
          .setRewardTokenConfig(ousd.address, config, [])
      ).to.be.revertedWith("Caller is not the Governor");
    });
  });

  describe.skip("Swap", () => {
    async function _swapWithRouter(swapRouterConfig, swapData) {
      const {
        harvester,
        strategies,
        rewardProceedsAddress,
        governor,
        uniswapRouter,
        domen,
      } = context();

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
        swapPlatformAddr: uniswapRouter.address,
        doSwapRewardToken: true,
        swapPlatform: 1,
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

      const protocolYield = (tokensReceived * 9500) / 10000;
      const farmerFee = (tokensReceived * 500) / 10000;

      await expect(swapTx)
        .to.emit(harvester, "RewardTokenSwapped")
        .withArgs(
          swapToken.address,
          baseToken.address,
          config.swapPlatform,
          balanceSwapped.toString(),
          tokensReceived.toString()
        );

      await expect(swapTx)
        .to.emit(harvester, "RewardProceedsTransferred")
        .withArgs(baseToken.address, domen.address, protocolYield, farmerFee);

      expect(balanceDiff[domen.address][baseToken.address]).to.equal(farmerFee);
      expect(balanceDiff[rewardProceedsAddress][baseToken.address]).to.equal(
        protocolYield
      );
    }

    it("Should harvest and swap with Uniswap V2", async () => {
      const { harvester, strategies, uniswapRouter } = context();
      const { rewardTokens } = strategies[0];

      const baseToken = await ethers.getContractAt(
        "MockUSDT",
        await harvester.baseTokenAddress()
      );
      const swapToken = rewardTokens[0];

      await _swapWithRouter(
        {
          swapPlatform: 0,
          swapPlatformAddr: uniswapRouter.address,
        },
        utils.defaultAbiCoder.encode(
          ["address[]"],
          [[swapToken.address, baseToken.address]]
        )
      );
    });

    it("Should harvest and swap with Uniswap V3", async () => {
      const { uniswapRouter, domen, daniel, governor, harvester, strategies } =
        context();
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
        swapPlatformAddr: uniswapRouter.address,
        doSwapRewardToken: true,
        swapPlatform: 1,
        liquidationLimit: 0,
      };

      await harvester
        .connect(governor)
        .setRewardTokenConfig(
          swapToken.address,
          config,
          utils.solidityPack(
            ["address", "uint24", "address"],
            [swapToken.address, 500, baseToken.address]
          )
        );

      await setOracleTokenPriceUsd(await swapToken.symbol(), "1");

      const balBefore = await baseToken.balanceOf(daniel.address);

      // prettier-ignore
      await harvester.connect(domen)["harvestAndSwap(address,address)"](
        strategy.address,
        daniel.address
      )

      expect(await baseToken.balanceOf(daniel.address)).to.be.gt(balBefore);
    });

    it("Should harvest and swap with Balancer", async () => {
      const { balancerVault } = context();
      await _swapWithRouter(
        {
          swapPlatform: 2,
          swapPlatformAddr: balancerVault.address,
        },
        utils.defaultAbiCoder.encode(
          ["bytes32"],
          ["0x000000000000000000000000000000000000000000000000000000000000dead"]
        )
      );
    });

    it("Should harvest and swap with Curve", async () => {
      const { threePool, governor, harvester, strategies } = context();
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
          swapPlatform: 3,
          swapPlatformAddr: threePool.address,
        },
        utils.defaultAbiCoder.encode(["uint256", "uint256"], ["0", "2"])
      );
    });

    it("Should not swap when disabled", async () => {
      const { harvester, strategies, governor, balancerVault, domen } =
        context();

      const { strategy, rewardTokens } = strategies[0];

      const swapToken = rewardTokens[0];

      // Configure to use Uniswap V3
      const config = {
        allowedSlippageBps: 200,
        harvestRewardBps: 500,
        swapPlatformAddr: balancerVault.address,
        doSwapRewardToken: false,
        swapPlatform: 2,
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

    it("Should harvest and swap and send rewards to external address", async () => {
      const { harvester, strategies, uniswapRouter } = context();
      const { rewardTokens } = strategies[0];

      const baseToken = await ethers.getContractAt(
        "MockUSDT",
        await harvester.baseTokenAddress()
      );
      const swapToken = rewardTokens[0];

      await _swapWithRouter(
        {
          swapPlatform: 0,
          swapPlatformAddr: uniswapRouter.address,
        },
        utils.defaultAbiCoder.encode(
          ["address[]"],
          [[swapToken.address, baseToken.address]]
        )
      );
    });

    it("Should not swap when balance is zero", async () => {
      const { harvester, strategies, governor, balancerVault } = context();

      const { rewardTokens, strategy } = strategies[0];

      const swapToken = rewardTokens[0];

      // Configure to use Uniswap V3
      const config = {
        allowedSlippageBps: 200,
        harvestRewardBps: 500,
        swapPlatformAddr: balancerVault.address,
        doSwapRewardToken: true,
        swapPlatform: 2,
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

    it("Should revert when swap platform doesn't return enough tokens", async () => {
      const { harvester, strategies, governor, balancerVault } = context();

      const { rewardTokens, strategy } = strategies[0];

      const swapToken = rewardTokens[0];

      // Configure to use Uniswap V3
      const config = {
        allowedSlippageBps: 200,
        harvestRewardBps: 500,
        swapPlatformAddr: balancerVault.address,
        doSwapRewardToken: true,
        swapPlatform: 2,
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

      // Disable transfer on mock balancerVault
      await balancerVault.connect(governor).disableTransfer();

      // prettier-ignore
      const swapTx = harvester
        .connect(governor)["harvestAndSwap(address)"](strategy.address);

      await expect(swapTx).to.be.revertedWith("BalanceMismatchAfterSwap");
    });

    it("Should revert when slippage is high", async () => {
      const { harvester, strategies, governor, balancerVault } = context();

      const { rewardTokens, strategy } = strategies[0];

      const swapToken = rewardTokens[0];

      // Configure to use Uniswap V3
      const config = {
        allowedSlippageBps: 200,
        harvestRewardBps: 500,
        swapPlatformAddr: balancerVault.address,
        doSwapRewardToken: true,
        swapPlatform: 2,
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

      // Disable transfer on mock balancerVault
      await balancerVault.connect(governor).disableSlippageError();
      await balancerVault.connect(governor).setSlippage(oethUnits("0.1"));

      // prettier-ignore
      const swapTx = harvester
        .connect(governor)["harvestAndSwap(address)"](strategy.address);

      await expect(swapTx).to.be.revertedWith("SlippageError");
    });

    it("Should use liquidation limit", async () => {
      const { harvester, strategies, governor, balancerVault, domen } =
        context();

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
        swapPlatformAddr: balancerVault.address,
        doSwapRewardToken: true,
        swapPlatform: 2,
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

    it("Should not harvest from unsupported strategies", async () => {
      const { harvester, domen } = context();

      // prettier-ignore
      await expect(
        harvester
          .connect(domen)["harvestAndSwap(address)"](domen.address)
      ).to.be.revertedWith("UnsupportedStrategy");
    });
  });

  describe.skip("Admin function", () => {
    it("Should only allow governor to change RewardProceedsAddress", async () => {
      const { harvester, governor, daniel, strategist } = context();

      const tx = await harvester
        .connect(governor)
        .setRewardProceedsAddress(strategist.address);

      await expect(tx)
        .to.emit(harvester, "RewardProceedsAddressChanged")
        .withArgs(strategist.address);

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
      const { harvester, governor } = context();

      await expect(
        harvester.connect(governor).setRewardProceedsAddress(addresses.zero)
      ).to.be.revertedWith("EmptyAddress");
    });

    it("Should allow governor to set supported strategies", async () => {
      const { harvester, governor, strategist } = context();

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
      const { governor, strategist, usds, harvester } = context();

      await usds.connect(governor).mintTo(harvester.address, usdsUnits("1000"));

      await expect(
        harvester.connect(strategist).transferToken(usds.address, "1")
      ).to.be.revertedWith("Caller is not the Governor");

      await harvester
        .connect(governor)
        .transferToken(usds.address, usdsUnits("1000"));

      expect(await usds.balanceOf(harvester.address)).to.eq("0");
    });
  });
};

module.exports = {
  shouldBehaveLikeHarvester,
};
