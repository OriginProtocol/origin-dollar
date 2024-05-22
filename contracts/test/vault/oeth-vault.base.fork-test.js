const { expect } = require("chai");
const {
  formatUnits,
  parseUnits,
  parseEther,
  formatEther,
} = require("ethers/lib/utils");

const addresses = require("../../utils/addresses");
const { createFixtureLoader } = require("../_fixture");
const { defaultBaseFixture } = require("../_fixture-base");

const { isCI, oethUnits } = require("../helpers");
const { impersonateAndFund } = require("../../utils/signers");
const { setERC20TokenBalance } = require("../_fund");

const log = require("../../utils/logger")("test:fork:oeth:vault");

const { oethWhaleAddress } = addresses.mainnet;

const baseFixture = createFixtureLoader(defaultBaseFixture);
describe("ForkTest: OETH Vault Base", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await baseFixture();
  });

  describe("post deployment", () => {
    it("Should have the correct governor address set", async () => {
      const { oethVault, oethDripper, oeth, woeth, aeroHarvester } = fixture;

      const oethContracts = [
        oethVault,
        oethDripper,
        oeth,
        woeth,
        aeroHarvester,
      ];

      for (let i = 0; i < oethContracts.length; i++) {
        expect(await oethContracts[i].governor()).to.equal(
          addresses.base.governor
        );
      }
    });

    it("Should have correct WETH asset index cached", async () => {
      const { oethVault, weth } = fixture;
      const index = await oethVault.wethAssetIndex();
      const assets = await oethVault.getAllAssets();

      expect(assets[index]).to.equal(weth.address);
    });
  });

  describe("user operations", () => {
    let oethWhaleSigner;
    beforeEach(async () => {
      oethWhaleSigner = await impersonateAndFund(oethWhaleAddress);
    });

    it("should mint with WETH", async () => {
      const { oethVault, weth, josh } = fixture;

      const amount = parseUnits("1", 18);
      const minOeth = parseUnits("0.8", 18);

      await weth.connect(josh).approve(oethVault.address, amount);
      await setERC20TokenBalance(josh.address, weth);
      const tx = await oethVault
        .connect(josh)
        .mint(weth.address, amount, minOeth);

      await expect(tx)
        .to.emit(oethVault, "Mint")
        .withArgs(josh.address, amount);
    });

    it("should not mint with any other asset", async () => {
      const { oethVault, oeth, josh } = fixture;

      const amount = parseUnits("1", 18);
      const minOeth = parseUnits("0.8", 18);

      await oeth.connect(josh).approve(oethVault.address, amount);
      const tx = oethVault.connect(josh).mint(oeth.address, amount, minOeth);

      await expect(tx).to.be.revertedWith("Unsupported asset for minting");
    });

    it("should have 0% redeem fee", async () => {
      const { oethVault } = fixture;

      expect(await oethVault.redeemFeeBps()).to.equal(0);
    });
    it("should return only WETH in redeem calculations", async () => {
      const { oethVault } = fixture;

      const output = await oethVault.calculateRedeemOutputs(oethUnits("123"));
      const index = await oethVault.wethAssetIndex();

      expect(output[index]).to.equal(oethUnits("123"));

      output.map((x, i) => {
        if (i !== index.toNumber()) {
          expect(x).to.equal("0");
        }
      });
    });

    it("should partially redeem", async () => {
      const { oeth, oethVault, weth } = fixture;
      const amountToMint = parseUnits("11", 18);
      const minOethAmount = parseUnits("10", 18);

      await weth
        .connect(oethWhaleSigner)
        .approve(oethVault.address, amountToMint);
      await setERC20TokenBalance(oethWhaleAddress, weth);
      await oethVault
        .connect(oethWhaleSigner)
        .mint(weth.address, amountToMint, minOethAmount);

      expect(await oeth.balanceOf(oethWhaleAddress)).to.gt(10);

      const amount = parseUnits("10", 18);
      const minEth = parseUnits("9.94", 18);

      const tx = await oethVault
        .connect(oethWhaleSigner)
        .redeem(amount, minEth);
      await expect(tx)
        .to.emit(oethVault, "Redeem")
        .withNamedArgs({ _addr: oethWhaleAddress });
    });
    it("OETH whale can not redeem due to no strategy and liquidity", async () => {
      const { oethVault } = fixture;

      const tx = oethVault.connect(oethWhaleSigner).redeem(parseUnits("10"), 0);
      await expect(tx).to.revertedWith("Liquidity error");
    });
    // Should remove .skip() after adding Strategy deployment scriot
    it.skip("OETH whale can redeem after withdraw from all strategies", async () => {
      const { oeth, oethVault, timelock, domen, strategist, frxETH } = fixture;

      const allStrats = await oethVault.getAllStrategies();
      if (
        allStrats
          .map((x) => x.toLowerCase())
          .includes(addresses.mainnet.FraxETHStrategy.toLowerCase())
      ) {
        // Remove fraxETH strategy if it exists
        // Because it no longer holds assets and causes this test to fail

        // Send some dust to that first
        await frxETH.connect(domen).transfer(oethVault.address, oethUnits("1"));

        // Now make sure it's deposited
        await oethVault
          .connect(strategist)
          .depositToStrategy(
            addresses.mainnet.FraxETHStrategy,
            [frxETH.address],
            [oethUnits("1")]
          );

        await oethVault
          .connect(timelock)
          .setAssetDefaultStrategy(frxETH.address, addresses.zero);
        await oethVault
          .connect(timelock)
          .removeStrategy(addresses.mainnet.FraxETHStrategy);
      }

      const oethWhaleBalance = await oeth.balanceOf(oethWhaleAddress);
      log(`OETH whale balance: ${formatUnits(oethWhaleBalance)}`);
      expect(oethWhaleBalance, "no longer an OETH whale").to.gt(
        parseUnits("1000", 18)
      );

      await oethVault.connect(timelock).withdrawAllFromStrategies();

      const tx = await oethVault
        .connect(oethWhaleSigner)
        .redeem(oethWhaleBalance, 0);
      await expect(tx)
        .to.emit(oethVault, "Redeem")
        .withNamedArgs({ _addr: oethWhaleAddress });
    });
    it("OETH whale redeem 100 OETH", async () => {
      const { oethVault, weth } = fixture;
      const amountToMint = parseUnits("110", 18);
      const minOethAmount = parseUnits("100", 18);

      await weth
        .connect(oethWhaleSigner)
        .approve(oethVault.address, amountToMint);
      await setERC20TokenBalance(oethWhaleAddress, weth);
      await oethVault
        .connect(oethWhaleSigner)
        .mint(weth.address, amountToMint, minOethAmount);

      const amount = parseUnits("100", 18);
      const minEth = parseUnits("99.4", 18);

      const tx = await oethVault
        .connect(oethWhaleSigner)
        .redeem(amount, minEth);
      await expect(tx)
        .to.emit(oethVault, "Redeem")
        .withNamedArgs({ _addr: oethWhaleAddress });
    });
    it("Vault should have the right WETH address", async () => {
      const { oethVault } = fixture;

      expect((await oethVault.weth()).toLowerCase()).to.equal(
        addresses.base.wethTokenAddress.toLowerCase()
      );
    });
    it("Should return a price for minting with WETH", async () => {
      const { oethVault, weth } = fixture;
      const price = await oethVault.priceUnitMint(weth.address);

      log(`Price for minting with WETH: ${formatEther(price, 6)}`);

      expect(price).to.be.lte(parseEther("1"));
      expect(price).to.be.gt(parseEther("0.998"));
    });
  });
  describe("Rebase", () => {
    it(`Shouldn't be paused`, async () => {
      const { oethVault } = fixture;
      expect(await oethVault.rebasePaused()).to.be.false;
    });

    it(`Should rebase`, async () => {
      const { oethVault } = fixture;
      await oethVault.rebase();
    });
  });
});
