const { compoundVaultFixture } = require("./../_fixture");
const { expect } = require("chai");
const { utils, constants } = require("ethers");

const {
  loadFixture,
  isFork,
  setOracleTokenPriceUsd,
  changeInBalance,
  usdtUnits,
} = require("./../helpers");
const addresses = require("./../../utils/addresses");
const { MAX_UINT256 } = require("../../utils/constants");

describe("Harvester", function () {
  if (isFork) {
    this.timeout(0);
  }

  const sendRewardsToCompStrategy = async (
    amount,
    governor,
    compoundStrategy,
    comp
  ) => {
    const compAmount = utils.parseUnits(amount, 18);
    await comp.connect(governor).mint(compAmount);
    await comp.connect(governor).transfer(compoundStrategy.address, compAmount);
  };

  it("Should correctly set reward token config and have correct allowances set for Uniswap like routers", async () => {
    const { harvester, governor, comp } = await loadFixture(
      compoundVaultFixture
    );
    const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");

    await harvester
      .connect(governor)
      .setRewardTokenConfig(
        comp.address,
        300,
        100,
        mockUniswapRouter.address,
        utils.parseUnits("1.44", 18),
        true
      );

    let compConfig = await harvester.rewardTokenConfigs(comp.address);

    expect(compConfig.liquidationLimit).to.equal(utils.parseUnits("1.44", 18));
    expect(compConfig.allowedSlippageBps).to.equal(300);
    expect(compConfig.harvestRewardBps).to.equal(100);
    expect(compConfig.uniswapV2CompatibleAddr).to.equal(
      mockUniswapRouter.address
    );

    expect(
      await comp.allowance(harvester.address, mockUniswapRouter.address)
    ).to.equal(constants.MaxUint256);
    expect(
      await comp.allowance(harvester.address, addresses.mainnet.uniswapV3Router)
    ).to.equal(0);

    await harvester
      .connect(governor)
      .setRewardTokenConfig(
        comp.address,
        350,
        120,
        addresses.mainnet.uniswapV3Router,
        utils.parseUnits("1.22", 18),
        true
      );

    compConfig = await harvester.rewardTokenConfigs(comp.address);

    expect(
      await comp.allowance(harvester.address, mockUniswapRouter.address)
    ).to.equal(0);
    expect(
      await comp.allowance(harvester.address, addresses.mainnet.uniswapV3Router)
    ).to.equal(constants.MaxUint256);

    expect(compConfig.liquidationLimit).to.equal(utils.parseUnits("1.22", 18));
    expect(compConfig.allowedSlippageBps).to.equal(350);
    expect(compConfig.harvestRewardBps).to.equal(120);
  });

  it("Should fail when calling harvest or harvestAndSwap with the non valid strategy address", async () => {
    const { harvester, governor, anna } = await loadFixture(
      compoundVaultFixture
    );
    const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");

    // prettier-ignore
    await expect(
      harvester
        .connect(anna)["harvestAndSwap(address)"](mockUniswapRouter.address)
    ).to.be.revertedWith("Not a valid strategy address");

    await expect(
      harvester.connect(governor)["harvest(address)"](mockUniswapRouter.address)
    ).to.be.revertedWith("Not a valid strategy address");

    // prettier-ignore
    await expect(
      harvester
        .connect(anna)["harvestAndSwap(address,address)"](
          mockUniswapRouter.address,
          anna.address
        )
    ).to.be.revertedWith("Not a valid strategy address");
  });

  it("Should not allow adding reward token config without price feed", async () => {
    const { harvester, governor } = await loadFixture(compoundVaultFixture);

    await expect(
      harvester
        .connect(governor)
        .setRewardTokenConfig(
          harvester.address,
          350,
          120,
          addresses.mainnet.uniswapV3Router,
          utils.parseUnits("11", 18),
          true
        )
    ).to.be.revertedWith("Asset not available");
  });

  it("Should not allow non-Governor to set reward token config", async () => {
    const { harvester, anna, comp } = await loadFixture(compoundVaultFixture);

    await expect(
      // Use the vault address for an address that definitely won't have a price
      // feed
      harvester
        .connect(anna)
        .setRewardTokenConfig(
          comp.address,
          350,
          120,
          addresses.mainnet.uniswapV3Router,
          utils.parseUnits("11", 18),
          true
        )
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should allow Governor to set reward token config", async () => {
    const { harvester, governor, comp } = await loadFixture(
      compoundVaultFixture
    );

    await harvester
      .connect(governor)
      .setRewardTokenConfig(
        comp.address,
        350,
        120,
        addresses.mainnet.uniswapV3Router,
        utils.parseUnits("11", 18),
        true
      );
  });

  it("Should skip swapping when token configuration is missing and leave harvested funds on harvester", async () => {
    const { harvester, governor, comp, compoundStrategy, anna, usdt, vault } =
      await loadFixture(compoundVaultFixture);

    await sendRewardsToCompStrategy("100", governor, compoundStrategy, comp);

    const balanceBeforeAnna = await usdt.balanceOf(anna.address);
    // prettier-ignore
    await harvester
      .connect(anna)["harvestAndSwap(address)"](compoundStrategy.address);
    const balanceAfterAnna = await usdt.balanceOf(anna.address);

    await expect(await comp.balanceOf(compoundStrategy.address)).to.be.equal(
      "0"
    );
    await expect(balanceAfterAnna - balanceBeforeAnna).to.be.equal(
      utils.parseUnits("0", 6)
    );
    await expect(await usdt.balanceOf(vault.address)).to.be.equal("0");
    await expect(await comp.balanceOf(harvester.address)).to.be.equal(
      utils.parseUnits("100", 18)
    );
    await expect(await usdt.balanceOf(harvester.address)).to.be.equal("0");
  });

  it("Should swap when slippage is just under threshold", async () => {
    const {
      harvester,
      governor,
      comp,
      compoundStrategy,
      anna,
      josh,
      usdt,
      vault,
    } = await loadFixture(compoundVaultFixture);

    await sendRewardsToCompStrategy("10", governor, compoundStrategy, comp);

    const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");
    mockUniswapRouter.initialize([comp.address], [usdt.address]);
    await usdt
      .connect(josh)
      .transfer(mockUniswapRouter.address, usdtUnits("100"));

    await setOracleTokenPriceUsd("COMP", "1.0404"); // 1/1.0404 = 0,9611687812

    await harvester
      .connect(governor)
      .setRewardTokenConfig(
        comp.address,
        400,
        100,
        mockUniswapRouter.address,
        MAX_UINT256,
        true
      );

    // prettier-ignore
    const annaBalanceChange = await changeInBalance(
      async () => {
        harvester
          .connect(anna)["harvestAndSwap(address)"](compoundStrategy.address);
      },
      usdt,
      anna.address
    );

    await expect(await comp.balanceOf(compoundStrategy.address)).to.be.equal(
      "0"
    );
    await expect(annaBalanceChange).to.be.equal(utils.parseUnits("0.1", 6));
    await expect(await usdt.balanceOf(vault.address)).to.be.equal(
      utils.parseUnits("9.9", 6)
    );
    await expect(await comp.balanceOf(harvester.address)).to.be.equal("0");
    await expect(await usdt.balanceOf(harvester.address)).to.be.equal("0");
  });

  it("Should fail when slippage is just over threshold", async () => {
    const { harvester, governor, comp, compoundStrategy, anna, josh, usdt } =
      await loadFixture(compoundVaultFixture);

    await sendRewardsToCompStrategy("10", governor, compoundStrategy, comp);

    const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");
    mockUniswapRouter.initialize([comp.address], [usdt.address]);
    await usdt
      .connect(josh)
      .transfer(mockUniswapRouter.address, usdtUnits("100"));

    await setOracleTokenPriceUsd("COMP", "1.042"); // 1/1.042 = 0,95969

    await harvester
      .connect(governor)
      .setRewardTokenConfig(
        comp.address,
        400,
        100,
        mockUniswapRouter.address,
        MAX_UINT256,
        true
      );

    // prettier-ignore
    await expect(
      harvester
        .connect(anna)["harvestAndSwap(address)"](compoundStrategy.address)
    ).to.be.revertedWith("Slippage error");
  });

  it("Should correctly distribute rewards when reward share is 1%", async () => {
    const {
      harvester,
      governor,
      comp,
      compoundStrategy,
      anna,
      josh,
      usdt,
      vault,
    } = await loadFixture(compoundVaultFixture);

    await sendRewardsToCompStrategy("10", governor, compoundStrategy, comp);

    const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");
    mockUniswapRouter.initialize([comp.address], [usdt.address]);
    await usdt
      .connect(josh)
      .transfer(mockUniswapRouter.address, usdtUnits("100"));

    await harvester
      .connect(governor)
      .setRewardTokenConfig(
        comp.address,
        300,
        100,
        mockUniswapRouter.address,
        MAX_UINT256,
        true
      );

    // prettier-ignore
    const annaBalanceChange = await changeInBalance(
      async () => {
        harvester
          .connect(anna)["harvestAndSwap(address)"](compoundStrategy.address);
      },
      usdt,
      anna.address
    );

    await expect(await comp.balanceOf(compoundStrategy.address)).to.be.equal(
      "0"
    );
    await expect(annaBalanceChange).to.be.equal(utils.parseUnits("0.1", 6));
    await expect(await usdt.balanceOf(vault.address)).to.be.equal(
      utils.parseUnits("9.9", 6)
    );
    await expect(await comp.balanceOf(harvester.address)).to.be.equal("0");
    await expect(await usdt.balanceOf(harvester.address)).to.be.equal("0");
  });

  it("Should fail setting rewards percentage to 11%", async () => {
    const { harvester, governor, comp } = await loadFixture(
      compoundVaultFixture
    );

    const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");
    await expect(
      harvester
        .connect(governor)
        .setRewardTokenConfig(
          comp.address,
          300,
          1100,
          mockUniswapRouter.address,
          MAX_UINT256,
          true
        )
    ).to.be.revertedWith("Harvest reward fee should not be over 10%");
  });

  it("Should fail setting rewards percentage to a negative value", async () => {
    const { harvester, governor, comp } = await loadFixture(
      compoundVaultFixture
    );

    const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");

    try {
      await harvester
        .connect(governor)
        .setRewardTokenConfig(
          comp.address,
          300,
          -100,
          mockUniswapRouter.address,
          MAX_UINT256,
          true
        );

      // if no exception fail
      expect.fail(
        "setRewardTokenConfig should fail when setting a negative value as reward"
      );
    } catch (e) {
      expect(e.message).to.include("value out-of-bounds");
    }
  });

  it("Should correctly distribute rewards when reward share is 9%", async () => {
    const {
      harvester,
      governor,
      comp,
      compoundStrategy,
      anna,
      josh,
      usdt,
      vault,
    } = await loadFixture(compoundVaultFixture);

    await sendRewardsToCompStrategy("10", governor, compoundStrategy, comp);

    const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");
    mockUniswapRouter.initialize([comp.address], [usdt.address]);
    await usdt
      .connect(josh)
      .transfer(mockUniswapRouter.address, usdtUnits("100"));

    await harvester
      .connect(governor)
      .setRewardTokenConfig(
        comp.address,
        300,
        900,
        mockUniswapRouter.address,
        MAX_UINT256,
        true
      );

    // prettier-ignore
    const annaBalanceChange = await changeInBalance(
      async () => {
        harvester
          .connect(anna)["harvestAndSwap(address)"](compoundStrategy.address);
      },
      usdt,
      anna.address
    );

    await expect(await comp.balanceOf(compoundStrategy.address)).to.be.equal(
      "0"
    );
    await expect(annaBalanceChange).to.be.equal(utils.parseUnits("0.9", 6));
    await expect(await usdt.balanceOf(vault.address)).to.be.equal(
      utils.parseUnits("9.1", 6)
    );
    await expect(await comp.balanceOf(harvester.address)).to.be.equal("0");
    await expect(await usdt.balanceOf(harvester.address)).to.be.equal("0");
  });

  it("Should fail when setting setSupportedStrategy from a non vault/governor address", async () => {
    const { harvester, anna, compoundStrategy } = await loadFixture(
      compoundVaultFixture
    );

    // prettier-ignore
    await expect(
      harvester
        .connect(anna)["setSupportedStrategy(address,bool)"](compoundStrategy.address, true)
    ).to.be.revertedWith("Caller is not the Vault or Governor");
  });

  it("Should succeed when governor sets a supported strategy address", async () => {
    const { harvester, governor, compoundStrategy } = await loadFixture(
      compoundVaultFixture
    );

    // prettier-ignore
    await harvester
      .connect(governor)["setSupportedStrategy(address,bool)"](compoundStrategy.address, true)
  });

  it("Harvest should work even when the vault removed the strategy", async () => {
    const {
      harvester,
      governor,
      comp,
      compoundStrategy,
      anna,
      josh,
      usdt,
      usdc,
      vault,
      dai,
      threePoolStrategy,
    } = await loadFixture(compoundVaultFixture);
    // load another strategy to override default asset strategies to lift restriction of removing compound strategy
    await vault.connect(governor).approveStrategy(threePoolStrategy.address);

    await vault
      .connect(governor)
      .setAssetDefaultStrategy(dai.address, threePoolStrategy.address);
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(usdc.address, threePoolStrategy.address);
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(usdt.address, threePoolStrategy.address);

    await sendRewardsToCompStrategy("10", governor, compoundStrategy, comp);
    const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");
    mockUniswapRouter.initialize([comp.address], [usdt.address]);
    await usdt
      .connect(josh)
      .transfer(mockUniswapRouter.address, usdtUnits("100"));

    await harvester
      .connect(governor)
      .setRewardTokenConfig(
        comp.address,
        300,
        100,
        mockUniswapRouter.address,
        MAX_UINT256,
        true
      );

    await vault.connect(governor).removeStrategy(compoundStrategy.address);

    // prettier-ignore
    const annaBalanceChange = await changeInBalance(
      async () => {
        harvester
          .connect(anna)["harvestAndSwap(address)"](compoundStrategy.address);
      },
      usdt,
      anna.address
    );

    await expect(await comp.balanceOf(compoundStrategy.address)).to.be.equal(
      "0"
    );
    await expect(annaBalanceChange).to.be.equal(utils.parseUnits("0.1", 6));
    await expect(await usdt.balanceOf(vault.address)).to.be.equal(
      utils.parseUnits("9.9", 6)
    );
    await expect(await comp.balanceOf(harvester.address)).to.be.equal("0");
    await expect(await usdt.balanceOf(harvester.address)).to.be.equal("0");
  });

  it("Should fail harvestAndSwap when governor sets a strategy as not supported one", async () => {
    const { harvester, governor, anna, compoundStrategy } = await loadFixture(
      compoundVaultFixture
    );

    // prettier-ignore
    await harvester
      .connect(governor)["setSupportedStrategy(address,bool)"](compoundStrategy.address, false)

    // prettier-ignore
    await expect(
      harvester
        .connect(anna)["harvestAndSwap(address)"](compoundStrategy.address)
    ).to.be.revertedWith("Not a valid strategy address");
  });

  it("Should not swap any coins when liquidation limit is 0", async () => {
    const {
      harvester,
      governor,
      comp,
      compoundStrategy,
      anna,
      josh,
      usdt,
      vault,
    } = await loadFixture(compoundVaultFixture);

    await sendRewardsToCompStrategy("10", governor, compoundStrategy, comp);

    const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");
    mockUniswapRouter.initialize([comp.address], [usdt.address]);
    await usdt
      .connect(josh)
      .transfer(mockUniswapRouter.address, usdtUnits("100"));

    await harvester
      .connect(governor)
      .setRewardTokenConfig(
        comp.address,
        300,
        900,
        mockUniswapRouter.address,
        0,
        true
      );

    let annaBalanceChange;

    // prettier-ignore
    const vaultBalanceChange = await changeInBalance(
      async () => {
        annaBalanceChange = await changeInBalance(
          async () => {
            harvester
              .connect(anna)["harvestAndSwap(address)"](compoundStrategy.address);
          },
          usdt,
          anna.address
        );
      },
      usdt,
      vault.address
    );

    await expect(await comp.balanceOf(compoundStrategy.address)).to.be.equal(
      "0"
    );
    await expect(annaBalanceChange).to.be.equal(0);
    await expect(vaultBalanceChange).to.be.equal(0);
    await expect(await comp.balanceOf(harvester.address)).to.be.equal(
      utils.parseUnits("10", 18)
    );
    await expect(await usdt.balanceOf(harvester.address)).to.be.equal("0");
  });

  it("Should correctly swap coins when liquidation limit is set", async () => {
    const {
      harvester,
      governor,
      comp,
      compoundStrategy,
      anna,
      josh,
      usdt,
      vault,
    } = await loadFixture(compoundVaultFixture);

    await sendRewardsToCompStrategy("10", governor, compoundStrategy, comp);

    const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");
    mockUniswapRouter.initialize([comp.address], [usdt.address]);
    await usdt
      .connect(josh)
      .transfer(mockUniswapRouter.address, usdtUnits("100"));

    await harvester
      .connect(governor)
      .setRewardTokenConfig(
        comp.address,
        300,
        100,
        mockUniswapRouter.address,
        utils.parseUnits("3", 18),
        true
      );

    let annaBalanceChange;

    // prettier-ignore
    const vaultBalanceChange = await changeInBalance(
      async () => {
        annaBalanceChange = await changeInBalance(
          async () => {
            harvester
              .connect(anna)["harvestAndSwap(address,address)"](compoundStrategy.address, anna.address);
          },
          usdt,
          anna.address
        );
      },
      usdt,
      vault.address
    );

    await expect(await comp.balanceOf(compoundStrategy.address)).to.be.equal(
      "0"
    );
    await expect(annaBalanceChange).to.be.equal(utils.parseUnits("0.03", 6));
    await expect(vaultBalanceChange).to.be.equal(utils.parseUnits("2.97", 6));
    await expect(await comp.balanceOf(harvester.address)).to.be.equal(
      utils.parseUnits("7", 18)
    );
    await expect(await usdt.balanceOf(harvester.address)).to.be.equal("0");
  });

  it("Should correctly swap coins and set rewards when rewardTo is non caller address", async () => {
    const {
      harvester,
      governor,
      comp,
      compoundStrategy,
      anna,
      josh,
      usdt,
      vault,
    } = await loadFixture(compoundVaultFixture);

    await sendRewardsToCompStrategy("10", governor, compoundStrategy, comp);

    const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");
    mockUniswapRouter.initialize([comp.address], [usdt.address]);
    await usdt
      .connect(josh)
      .transfer(mockUniswapRouter.address, usdtUnits("100"));

    await harvester
      .connect(governor)
      .setRewardTokenConfig(
        comp.address,
        300,
        100,
        mockUniswapRouter.address,
        utils.parseUnits("3", 18),
        true
      );

    let joshBalanceChange;

    // prettier-ignore
    const vaultBalanceChange = await changeInBalance(
      async () => {
        joshBalanceChange = await changeInBalance(
          async () => {
            harvester
              .connect(anna)["harvestAndSwap(address,address)"](compoundStrategy.address, josh.address);
          },
          usdt,
          josh.address
        );
      },
      usdt,
      vault.address
    );

    await expect(await comp.balanceOf(compoundStrategy.address)).to.be.equal(
      "0"
    );
    await expect(joshBalanceChange).to.be.equal(utils.parseUnits("0.03", 6));
    await expect(vaultBalanceChange).to.be.equal(utils.parseUnits("2.97", 6));
    await expect(await comp.balanceOf(harvester.address)).to.be.equal(
      utils.parseUnits("7", 18)
    );
    await expect(await usdt.balanceOf(harvester.address)).to.be.equal("0");
  });

  it("Should correctly distribute rewards to a changed proceeds address", async () => {
    const { harvester, governor, comp, compoundStrategy, anna, josh, usdt } =
      await loadFixture(compoundVaultFixture);

    await sendRewardsToCompStrategy("10", governor, compoundStrategy, comp);

    const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");
    mockUniswapRouter.initialize([comp.address], [usdt.address]);
    await usdt
      .connect(josh)
      .transfer(mockUniswapRouter.address, usdtUnits("100"));

    await harvester
      .connect(governor)
      .setRewardTokenConfig(
        comp.address,
        300,
        100,
        mockUniswapRouter.address,
        MAX_UINT256,
        true
      );

    await harvester.connect(governor).setRewardsProceedsAddress(josh.address);

    let annaBalanceChange;
    // prettier-ignore
    const joshBalanceChange = await changeInBalance(
      async () => {
        annaBalanceChange = await changeInBalance(
          async () => {
            harvester
              .connect(anna)["harvestAndSwap(address)"](compoundStrategy.address);
          },
          usdt,
          anna.address
        )
      },
      usdt,
      josh.address
    );

    await expect(await comp.balanceOf(compoundStrategy.address)).to.be.equal(
      "0"
    );
    await expect(annaBalanceChange).to.be.equal(utils.parseUnits("0.1", 6));
    await expect(joshBalanceChange).to.be.equal(utils.parseUnits("9.9", 6));
    await expect(await comp.balanceOf(harvester.address)).to.be.equal("0");
    await expect(await usdt.balanceOf(harvester.address)).to.be.equal("0");
  });
});
