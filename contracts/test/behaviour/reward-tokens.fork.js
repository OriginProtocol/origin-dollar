const { expect } = require("chai");

const { isFork } = require("../helpers");
const addresses = require("../../utils/addresses");
const { BigNumber } = require("ethers");

/**
 *
 * @param {*} context a function that returns:
 *    - harvester: OUSD Harvester or OETH Harvester
 *    - vault: OUSD Vault or OETH Vault
 *    - expectedConfigs: Expected Reward Token Config
 * @example
    shouldHaveRewardTokensConfigured(() => ({
        harvester: fixture.harvester,
        vault: fixture.vault,
        ignoreTokens: [fixture.weth.address.toLowerCase()],
        expectedConfigs: {
          [fixture.cvx.address]: {
            allowedSlippageBps: 300,
            harvestRewardBps: 100,
            swapPlatformAddr: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            doSwapRewardToken: true,
            swapPlatform: 1,
            liquidationLimit: ousdUnits("2500"),
            uniswapV3Path:
              "0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b002710c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20001f4dac17f958d2ee523a2206206994597c13d831ec7",
          },
          [fixture.crv.address]: {
            allowedSlippageBps: 300,
            harvestRewardBps: 200,
            swapPlatformAddr: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            doSwapRewardToken: true,
            swapPlatform: 1,
            liquidationLimit: ousdUnits("4000"),
            uniswapV3Path:
              "0xd533a949740bb3306d119cc777fa900ba034cd52000bb8c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20001f4dac17f958d2ee523a2206206994597c13d831ec7",
          },
    },
    }));
 */
const shouldHaveRewardTokensConfigured = (context) => {
  if (!isFork) {
    // Only meant to be used on fork
    return;
  }

  describe("Reward Tokens", () => {
    it("Should have swap config for all reward tokens from strategies", async () => {
      let { vault, harvester, expectedConfigs, ignoreTokens } = context();
      let strategies = await vault.getAllStrategies();
      let harvesterAddresses = await Promise.all(
        strategies.map(async (s) => {
          const strategy = await ethers.getContractAt("IStrategy", s);
          const harvesterAddress = await strategy.harvesterAddress();
          return harvesterAddress;
        })
      );
      strategies = strategies.filter((_, i) => {
        // Remove strategy from tests if harvester is the multichainStrategist
        return harvesterAddresses[i] != addresses.multichainStrategist;
      });

      expectedConfigs = Object.keys(expectedConfigs).reduce(
        (o, k) => ({
          ...o,
          [k.toLowerCase()]: expectedConfigs[k],
        }),
        {}
      );

      const checkedConfigs = ignoreTokens || [];

      for (const strategyAddr of strategies) {
        const strategy = await ethers.getContractAt("IStrategy", strategyAddr);
        const rewardTokens = await strategy.getRewardTokenAddresses();

        // If the strategy has tokens,
        if (rewardTokens.length) {
          // It should be whitelisted on Harvester
          expect(await harvester.supportedStrategies(strategy.address)).to.be
            .true;

          for (let token of rewardTokens) {
            token = token.toLowerCase();
            if (checkedConfigs.includes(token)) {
              return;
            }
            checkedConfigs.push(token);

            const config = await harvester.rewardTokenConfigs(token);
            const expectedConfig = expectedConfigs[token.toLowerCase()];

            // Each reward token should have a swap route configured
            expect(config.swapPlatformAddr).to.not.eq(
              addresses.zero,
              `Harvester not configured for token: ${token}`
            );
            expect(config.doSwapRewardToken).to.be.eq(
              true,
              `Swap disabled for token: ${token}`
            );

            expect(config.swapPlatform).to.eq(expectedConfig.swapPlatform);
            expect(config.swapPlatformAddr).to.eq(
              expectedConfig.swapPlatformAddr
            );
            expect(config.harvestRewardBps).to.eq(
              expectedConfig.harvestRewardBps
            );
            expect(config.allowedSlippageBps).to.eq(
              expectedConfig.allowedSlippageBps
            );
            expect(config.liquidationLimit).to.eq(
              expectedConfig.liquidationLimit
            );

            if (config.swapPlatform == 0) {
              // Uniswap V2
              expect(await harvester.uniswapV2Path(token)).to.eq(
                expectedConfig.uniswapV2Path
              );
            } else if (config.swapPlatform == 1) {
              // Uniswap V3
              expect(await harvester.uniswapV3Path(token)).to.eq(
                expectedConfig.uniswapV3Path
              );
            } else if (config.swapPlatform == 2) {
              // Balancer
              expect(await harvester.balancerPoolId(token)).to.eq(
                expectedConfig.balancerPoolId
              );
            } else if (config.swapPlatform == 3) {
              const [rewardTokenIndex, baseTokenIndex] =
                expectedConfig.curvePoolIndices;
              const actualIndices = await harvester.curvePoolIndices(token);
              // Curve
              expect(actualIndices[0].toString()).to.eq(
                BigNumber.from(rewardTokenIndex).toString()
              );
              expect(actualIndices[1].toString()).to.eq(
                BigNumber.from(baseTokenIndex).toString()
              );
            }
          }
        }
      }

      const missingTokenConfigs = Object.keys(expectedConfigs).filter(
        (k) => !checkedConfigs.includes(k)
      );
      expect(missingTokenConfigs.length).to.eq(
        0,
        `Missing config for reward tokens: ${missingTokenConfigs}`
      );
    });
  });
};

module.exports = {
  shouldHaveRewardTokensConfigured,
};
