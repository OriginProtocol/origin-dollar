const { expect } = require("chai");

const { isFork } = require("../helpers");
const addresses = require("../../utils/addresses");

/**
 *
 * @param {*} context a function that returns:
 *    - vault: OUSD Vault or OETH Vault
 *    - harvester: OUSD Harvester or OETH Harvester
 *    - expectedConfigs: Expected Reward Token Config
 * @example
    shouldBehaveLikeHarvester(() => ({
        ...fixture
    }));
 */
const shouldHaveRewardTokensConfigured = (context) => {
  if (!isFork) {
    // Only meant to be used on fork
    return;
  }

  describe("Reward Tokens", () => {
    it("Should have swap config for all reward tokens from strategies", async () => {
      let { vault, harvester, expectedConfigs } = context();
      const strategies = await vault.getAllStrategies();

      expectedConfigs = Object.keys(expectedConfigs).reduce(
        (o, k) => ({
          ...o,
          [k.toLowerCase()]: expectedConfigs[k],
        }),
        {}
      );

      const checkedConfigs = [];

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
            expect(config.swapRouterAddr).to.not.eq(
              addresses.zero,
              `Harvester not configured for token: ${token}`
            );
            expect(config.doSwapRewardToken).to.be.eq(
              true,
              `Swap disabled for token: ${token}`
            );

            expect(config.platform).to.eq(expectedConfig.platform);
            expect(config.swapRouterAddr).to.eq(expectedConfig.swapRouterAddr);
            expect(config.harvestRewardBps).to.eq(
              expectedConfig.harvestRewardBps
            );
            expect(config.allowedSlippageBps).to.eq(
              expectedConfig.allowedSlippageBps
            );
            expect(config.liquidationLimit).to.eq(
              expectedConfig.liquidationLimit
            );

            if (config.platform == 0) {
              // Uniswap V2
              expect(await harvester.uniswapV2Path(token)).to.eq(
                expectedConfig.uniswapV2Path
              );
            } else if (config.platform == 1) {
              // Uniswap V3
              expect(await harvester.uniswapV3Path(token)).to.eq(
                expectedConfig.uniswapV3Path
              );
            } else if (config.platform == 2) {
              // Balancer
              expect(await harvester.balancerPoolId(token)).to.eq(
                expectedConfig.balancerPoolId
              );
            } else if (config.platform == 3) {
              // Curve
              expect(
                (await harvester.curvePoolData(token)).map((x) =>
                  parseInt(x.toString())
                )
              ).to.deep.eq(expectedConfig.curvePoolData);
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
