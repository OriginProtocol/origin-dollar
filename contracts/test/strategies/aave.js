const { expect } = require("chai");
const { utils } = require("ethers");

const { aaveVaultFixture } = require("../_fixture");
const {
  daiUnits,
  ousdUnits,
  units,
  loadFixture,
  expectApproxSupply,
  getBlockTimestamp,
  isFork,
} = require("../helpers");

describe("Aave Strategy", function () {
  if (isFork) {
    this.timeout(0);
  }

  let anna,
    matt,
    josh,
    ousd,
    vault,
    governor,
    adai,
    aaveStrategy,
    usdt,
    usdc,
    dai,
    aaveAddressProvider,
    aaveCoreAddress;

  const emptyVault = async () => {
    await vault.connect(matt).redeemAll(0);
    await vault.connect(josh).redeemAll(0);
  };

  const mint = async (amount, asset) => {
    await asset.connect(anna).mint(units(amount, asset));
    await asset.connect(anna).approve(vault.address, units(amount, asset));
    await vault.connect(anna).mint(asset.address, units(amount, asset), 0);
  };

  beforeEach(async function () {
    const fixture = await loadFixture(aaveVaultFixture);
    anna = fixture.anna;
    matt = fixture.matt;
    josh = fixture.josh;
    vault = fixture.vault;
    ousd = fixture.ousd;
    governor = fixture.governor;
    aaveStrategy = fixture.aaveStrategy;
    adai = fixture.adai;
    usdt = fixture.usdt;
    usdc = fixture.usdc;
    dai = fixture.dai;
    aaveAddressProvider = fixture.aaveAddressProvider;
    aaveCoreAddress = await aaveAddressProvider.getLendingPool();
  });

  describe("Mint", function () {
    it("Should be able to mint DAI and it should show up in the Aave core", async function () {
      await expectApproxSupply(ousd, ousdUnits("200"));
      // we already have 200 dai in vault
      await expect(vault).has.an.approxBalanceOf("200", dai);
      await mint("30000.00", dai);
      await expectApproxSupply(ousd, ousdUnits("30200"));
      // should allocate all of it to strategy
      await expect(aaveStrategy).has.an.approxBalanceOf("30200", adai);
      await expect(anna).to.have.a.balanceOf("30000", ousd);
      expect(await dai.balanceOf(aaveCoreAddress)).to.be.equal(
        utils.parseUnits("30200", 18)
      );
    });

    it("Should not send USDC to Aave strategy", async function () {
      await emptyVault();
      // should be all empty
      await expectApproxSupply(ousd, ousdUnits("0"));
      await mint("30000.00", usdc);
      await expectApproxSupply(ousd, ousdUnits("30000"));
      await expect(aaveStrategy).has.an.approxBalanceOf("0", dai);
      await vault.connect(anna).redeem(ousdUnits("30000.00"), 0);
    });

    it("Should be able to mint and redeem DAI", async function () {
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("30000.00", dai);
      await vault.connect(anna).redeem(ousdUnits("20000"), 0);
      await expectApproxSupply(ousd, ousdUnits("10200"));
      // Anna started with 1000 DAI
      await expect(anna).to.have.a.balanceOf("21000", dai);
      await expect(anna).to.have.a.balanceOf("10000", ousd);
    });

    it("Should be able to withdrawAll", async function () {
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("30000.00", dai);
      await vault
        .connect(governor)
        .withdrawAllFromStrategy(aaveStrategy.address);
      await expect(aaveStrategy).to.have.a.balanceOf("0", dai);
    });

    it("Should be able to redeem and return assets after multiple mints", async function () {
      await mint("30000.00", usdt);
      await mint("30000.00", usdc);
      await mint("30000.00", dai);
      await vault.connect(anna).redeem(ousdUnits("60000.00"), 0);
      // Anna had 1000 of each asset before the mints
      // 200 DAI was already in the Vault
      // 30200 DAI, 30000 USDT, 30000 USDC
      // 30200 / 90200 * 30000 + 1000 DAI
      // 30000 / 90200 * 30000 + 1000 USDC and USDT
      await expect(anna).to.have.an.approxBalanceOf("21088.69", dai);
      await expect(anna).to.have.an.approxBalanceOf("20955.65", usdc);
      await expect(anna).to.have.an.approxBalanceOf("20955.65", usdt);
      await expectApproxSupply(ousd, ousdUnits("30200"));
    });

    it("Should allow transfer of arbitrary token by Governor", async () => {
      await dai.connect(anna).approve(vault.address, daiUnits("8.0"));
      await vault.connect(anna).mint(dai.address, daiUnits("8.0"), 0);
      // Anna sends her OUSD directly to Strategy
      await ousd.connect(anna).transfer(aaveStrategy.address, ousdUnits("8.0"));
      // Anna asks Governor for help
      await aaveStrategy
        .connect(governor)
        .transferToken(ousd.address, ousdUnits("8.0"));
      await expect(governor).has.a.balanceOf("8.0", ousd);
    });

    it("Should not allow transfer of arbitrary token by non-Governor", async () => {
      // Naughty Anna
      await expect(
        aaveStrategy.connect(anna).transferToken(ousd.address, ousdUnits("8.0"))
      ).to.be.revertedWith("Caller is not the Governor");
    });
  });

  describe("Rewards", function () {
    const STAKE_AMOUNT = "10000000000";
    const REWARD_AMOUNT = "70000000000";
    const ZERO_COOLDOWN = -1;
    const DAY = 24 * 60 * 60;

    const collectRewards = function (setupOpts, verificationOpts) {
      return async function () {
        let currentTimestamp;

        const fixture = await loadFixture(aaveVaultFixture);
        const aaveStrategy = fixture.aaveStrategy;
        const aaveIncentives = fixture.aaveIncentivesController;
        const aave = fixture.aaveToken;
        const stkAave = fixture.stkAave;
        const vault = fixture.vault;
        const governor = fixture.governor;

        let { cooldownAgo, hasStkAave, hasRewards } = setupOpts;
        // Options
        let stkAaveAmount = hasStkAave ? STAKE_AMOUNT : 0;
        cooldownAgo = cooldownAgo == ZERO_COOLDOWN ? 0 : cooldownAgo;
        let rewardsAmount = hasRewards ? REWARD_AMOUNT : 0;

        // Configure
        // ----
        // - Give some AAVE to stkAAVE so that we can redeem the stkAAVE
        await aave.connect(governor).mint(stkAaveAmount);
        await aave.connect(governor).transfer(stkAave.address, stkAaveAmount);

        // Setup for test
        // ----
        if (cooldownAgo > 0) {
          currentTimestamp = await getBlockTimestamp();
          let cooldown = currentTimestamp - cooldownAgo;
          await stkAave.setCooldown(aaveStrategy.address, cooldown);
        }
        if (stkAaveAmount > 0) {
          await stkAave.connect(governor).mint(stkAaveAmount);
          await stkAave
            .connect(governor)
            .transfer(aaveStrategy.address, stkAaveAmount);
        }
        if (rewardsAmount > 0) {
          await aaveIncentives.setRewardsBalance(
            aaveStrategy.address,
            rewardsAmount
          );
        }

        // Run
        // ----
        await vault.connect(governor)["harvest()"]();
        currentTimestamp = await getBlockTimestamp();

        // Verification
        // ----
        const {
          shouldConvertStkAAVEToAAVE,
          shouldResetCooldown,
          shouldClaimRewards,
        } = verificationOpts;
        if (shouldConvertStkAAVEToAAVE) {
          const stratAave = await aave.balanceOf(aaveStrategy.address);
          expect(stratAave).to.equal("0", "AAVE:Strategy");
          const vaultAave = await aave.balanceOf(vault.address);
          expect(vaultAave).to.equal(STAKE_AMOUNT, "AAVE:Vault");
        } else {
          const stratAave = await aave.balanceOf(aaveStrategy.address);
          expect(stratAave).to.equal("0", "AAVE:Strategy");
          const vaultAave = await aave.balanceOf(vault.address);
          expect(vaultAave).to.equal("0", "AAVE:Vault");
        }

        if (shouldResetCooldown) {
          const cooldown = await stkAave.stakersCooldowns(aaveStrategy.address);
          expect(currentTimestamp).to.equal(cooldown, "Cooldown should reset");
        } else {
          const cooldown = await stkAave.stakersCooldowns(aaveStrategy.address);
          expect(currentTimestamp).to.not.equal(cooldown, "Cooldown not reset");
        }

        if (shouldClaimRewards === true) {
          const stratStkAave = await stkAave.balanceOf(aaveStrategy.address);
          expect(stratStkAave).to.be.at.least(
            REWARD_AMOUNT,
            "StkAAVE:Strategy"
          );
        } else if (shouldClaimRewards === false) {
          const stratStkAave = await stkAave.balanceOf(aaveStrategy.address);
          expect(stratStkAave).to.be.below(REWARD_AMOUNT, "StkAAVE:Strategy");
        } else {
          expect(false).to.be.true("shouldclaimRewards is not defined");
        }
      };
    };

    it(
      "In cooldown window",
      collectRewards(
        {
          cooldownAgo: 11 * DAY,
          hasStkAave: true,
          hasRewards: true,
        },
        {
          shouldConvertStkAAVEToAAVE: true,
          shouldResetCooldown: true,
          shouldClaimRewards: true,
        }
      )
    );
    it(
      "Before cooldown window",
      collectRewards(
        {
          cooldownAgo: 2 * DAY,
          hasStkAave: true,
          hasRewards: true,
        },
        {
          shouldConvertStkAAVEToAAVE: false,
          shouldResetCooldown: false,
          shouldClaimRewards: false,
        }
      )
    );
    it(
      "No cooldown set",
      collectRewards(
        {
          cooldownAgo: ZERO_COOLDOWN,
          hasStkAave: true,
          hasRewards: true,
        },
        {
          shouldConvertStkAAVEToAAVE: false,
          shouldResetCooldown: true,
          shouldClaimRewards: true,
        }
      )
    );
    it(
      "After window",
      collectRewards(
        {
          cooldownAgo: 13 * DAY,
          hasStkAave: true,
          hasRewards: true,
        },
        {
          shouldConvertStkAAVEToAAVE: false,
          shouldResetCooldown: true,
          shouldClaimRewards: true,
        }
      )
    );
    it(
      "No pending rewards",
      collectRewards(
        {
          cooldownAgo: 11 * DAY,
          hasStkAave: true,
          hasRewards: false,
        },
        {
          shouldConvertStkAAVEToAAVE: true,
          shouldResetCooldown: false,
          shouldClaimRewards: false,
        }
      )
    );
  });
});
