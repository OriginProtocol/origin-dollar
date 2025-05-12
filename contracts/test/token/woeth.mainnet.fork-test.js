const { expect } = require("chai");
const { BigNumber } = require("ethers");

const { simpleOETHFixture, createFixtureLoader } = require("./../_fixture");
const { hardhatSetBalance } = require("../_fund");
const { oethUnits } = require("../helpers");

const oethWhaleFixture = async () => {
  const fixture = await simpleOETHFixture();

  const { weth, oeth, oethVault, woeth, domen } = fixture;

  // Domen is a OETH whale
  await oethVault
    .connect(domen)
    .mint(weth.address, oethUnits("20000"), oethUnits("19999"));

  await oeth.connect(domen).approve(woeth.address, oethUnits("20000"));

  return fixture;
};

const loadFixture = createFixtureLoader(oethWhaleFixture);

describe("ForkTest: wOETH", function () {
  this.timeout(0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Should have correct name and symbol and adjuster", async () => {
    const { woeth } = fixture;

    expect(await woeth.name()).to.equal("Wrapped OETH");
    expect(await woeth.symbol()).to.equal("wOETH");
    expect(await woeth.adjuster()).to.be.gt(0);
  });

  it("Should prevent total asset manipulation by donations", async () => {
    const { oeth, woeth, domen } = fixture;
    const totalAssetsBefore = await woeth.totalAssets();
    await oeth.connect(domen).transfer(woeth.address, oethUnits("100"));
    const totalAssetsAfter = await woeth.totalAssets();

    expect(totalAssetsBefore).to.be.equal(totalAssetsAfter);
  });

  it("Deposit should not be manipulated by donations", async () => {
    const { oeth, woeth, domen } = fixture;

    await expect(domen).to.have.approxBalanceOf("0", woeth);

    // Wrap some OETH
    await woeth.connect(domen).deposit(oethUnits("1000"), domen.address);

    const sharePriceBeforeDonate = await woeth.convertToAssets(
      oethUnits("1000")
    );

    // Donate some OETH
    oeth.connect(domen).transfer(woeth.address, oethUnits("10000"));

    // Ensure no change in share price
    const sharePriceAfterDonate = await woeth.convertToAssets(
      oethUnits("1000")
    );
    expect(sharePriceBeforeDonate).to.approxEqual(
      sharePriceAfterDonate,
      "Price manipulation"
    );

    // Wrap again
    await woeth.connect(domen).deposit(oethUnits("1000"), domen.address);

    // Ensure the balance is right
    await expect(domen).to.have.approxBalanceOf(
      // 2000 * 1000 / sharePrice(1000 OETH)
      oethUnits("2000").mul(oethUnits("1000")).div(sharePriceAfterDonate),
      woeth
    );
  });

  it("Withdraw should not be manipulated by donations", async () => {
    const { oeth, woeth, domen } = fixture;

    await expect(domen).to.have.approxBalanceOf("0", woeth);
    await expect(domen).to.have.approxBalanceOf("20000", oeth);

    // Wrap some OETH
    await woeth.connect(domen).deposit(oethUnits("3000"), domen.address);

    const sharePriceBeforeDonate = await woeth.convertToAssets(
      oethUnits("1000")
    );

    // Donate some OETH
    oeth.connect(domen).transfer(woeth.address, oethUnits("10000"));

    // Ensure no change in share price
    const sharePriceAfterDonate = await woeth.convertToAssets(
      oethUnits("1000")
    );
    expect(sharePriceBeforeDonate).to.approxEqual(
      sharePriceAfterDonate,
      "Price manipulation"
    );

    // Withdraw
    await woeth
      .connect(domen)
      .withdraw(
        await woeth.maxWithdraw(domen.address),
        domen.address,
        domen.address
      );

    // Ensure balance is right
    await expect(domen).to.have.approxBalanceOf("10000", oeth);
  });

  describe("Funds in, Funds out", async () => {
    it("should deposit at the correct ratio", async () => {
      const { oeth, woeth, domen } = fixture;

      const totalSupply = await woeth.totalSupply();
      const balanceBefore = await oeth.balanceOf(domen.address);

      // Wrap some OETH
      const txResponse = await woeth
        .connect(domen)
        .deposit(oethUnits("50"), domen.address);
      const txReceipt = await txResponse.wait();
      const mintedShares = txReceipt.events[2].args.shares; // 0. transfer oeth, 1. transfer woeth, 2. deposit
      const assetTransfered = txReceipt.events[2].args.assets; // 0. transfer oeth, 1. transfer woeth, 2. mint

      await expect(assetTransfered).to.be.equal(oethUnits("50"));
      await expect(
        await woeth.convertToShares(assetTransfered)
      ).to.be.approxEqual(mintedShares);
      await expect(woeth).to.have.a.totalSupply(totalSupply.add(mintedShares));
      await expect(await woeth.balanceOf(domen.address)).to.be.equal(
        mintedShares
      );
      await expect(await oeth.balanceOf(domen.address)).to.be.equal(
        balanceBefore.sub(assetTransfered)
      );
    });
    it("should withdraw at the correct ratio", async () => {
      const { oeth, woeth, domen } = fixture;
      // First wrap some OETH
      await woeth.connect(domen).deposit(oethUnits("50"), domen.address);

      const totalSupply = await woeth.totalSupply();
      const balanceBefore = await oeth.balanceOf(domen.address);

      // Then unwrap some WOETH
      const txResponse = await woeth
        .connect(domen)
        .withdraw(
          await woeth.maxWithdraw(domen.address),
          domen.address,
          domen.address
        );
      const txReceipt = await txResponse.wait();
      const burnedShares = txReceipt.events[2].args.shares; // 0. transfer oeth, 1. transfer woeth, 2. withdraw
      const assetTransfered = txReceipt.events[2].args.assets; // 0. transfer oeth, 1. transfer woeth, 2. mint

      await expect(assetTransfered).to.be.approxEqual(oethUnits("50"));
      await expect(
        await woeth.convertToShares(assetTransfered)
      ).to.be.approxEqual(burnedShares);
      await expect(woeth).to.have.a.totalSupply(totalSupply.sub(burnedShares));
      await expect(await woeth.balanceOf(domen.address)).to.be.equal(0);
      await expect(await oeth.balanceOf(domen.address)).to.be.approxEqual(
        balanceBefore.add(assetTransfered)
      );
    });
    it("should mint at the correct ratio", async () => {
      const { oeth, woeth, domen } = fixture;

      const totalSupply = await woeth.totalSupply();
      const balanceBefore = await oeth.balanceOf(domen.address);

      // Mint some WOETH
      const txResponse = await woeth
        .connect(domen)
        .mint(oethUnits("25"), domen.address);
      const txReceipt = await txResponse.wait();
      const mintedShares = txReceipt.events[2].args.shares; // 0. transfer oeth, 1. transfer woeth, 2. mint
      const assetTransfered = txReceipt.events[2].args.assets; // 0. transfer oeth, 1. transfer woeth, 2. mint

      await expect(mintedShares).to.be.equal(oethUnits("25"));
      await expect(await woeth.convertToAssets(mintedShares)).to.be.approxEqual(
        assetTransfered
      );
      await expect(woeth).to.have.a.totalSupply(totalSupply.add(mintedShares));
      await expect(await woeth.balanceOf(domen.address)).to.be.equal(
        mintedShares
      );
      await expect(await oeth.balanceOf(domen.address)).to.be.equal(
        balanceBefore.sub(assetTransfered)
      );
    });
    it("should redeem at the correct ratio", async () => {
      const { oeth, woeth, domen } = fixture;

      // Mint some WOETH
      await woeth.connect(domen).mint(oethUnits("25"), domen.address);

      const totalSupply = await woeth.totalSupply();
      const balanceBefore = await oeth.balanceOf(domen.address);

      // Redeem some WOETH
      const txResponse = await woeth
        .connect(domen)
        .redeem(
          await woeth.maxRedeem(domen.address),
          domen.address,
          domen.address
        );
      const txReceipt = await txResponse.wait();
      const burnedShares = txReceipt.events[2].args.shares; // 0. transfer oeth, 1. transfer woeth, 2. redeem
      const assetTransfered = txReceipt.events[2].args.assets; // 0. transfer oeth, 1. transfer woeth, 2. redeem

      await expect(burnedShares).to.be.equal(oethUnits("25"));
      await expect(await woeth.convertToAssets(burnedShares)).to.be.approxEqual(
        assetTransfered
      );
      await expect(woeth).to.have.a.totalSupply(totalSupply.sub(burnedShares));
      await expect(await woeth.balanceOf(domen.address)).to.be.equal(0);
      await expect(await oeth.balanceOf(domen.address)).to.be.approxEqual(
        balanceBefore.add(assetTransfered)
      );
    });
    it("should redeem at the correct ratio after rebase", async () => {
      const { weth, oeth, oethVault, woeth, domen, josh } = fixture;

      // Mint some WOETH
      const initialDeposit = oethUnits("50");
      await woeth.connect(domen).deposit(initialDeposit, domen.address);
      const initialOethBalance = await oeth.balanceOf(domen.address);

      const totalAssetsBefore = await woeth.totalAssets();
      // Rebase
      await hardhatSetBalance(josh.address, "250");
      await weth.connect(josh).deposit({ value: oethUnits("200") });
      await weth.connect(josh).transfer(oethVault.address, oethUnits("200"));
      await oethVault.rebase();

      const totalAssetsAfter = await woeth.totalAssets();
      const oethBalanceAfter = await oeth.balanceOf(domen.address);
      expect(totalAssetsAfter > totalAssetsBefore).to.be.true;

      // Then unwrap some WOETH
      const txResponse = await woeth
        .connect(domen)
        .redeem(
          await woeth.maxRedeem(domen.address),
          domen.address,
          domen.address
        );

      const txReceipt = await txResponse.wait();
      const burnedShares = txReceipt.events[2].args.shares; // 0. transfer oeth, 1. transfer woeth, 2. redeem
      const assetTransferred = txReceipt.events[2].args.assets; // 0. transfer oeth, 1. transfer woeth, 2. redeem

      // 1e18 denominated
      const oethRateIncrease = oethBalanceAfter
        .sub(initialOethBalance)
        .mul(BigNumber.from("1000000000000000000"))
        .div(initialOethBalance);
      const woethRateIncrease = assetTransferred
        .sub(initialDeposit)
        .mul(BigNumber.from("1000000000000000000"))
        .div(initialDeposit);

      // 2 wei rounding error
      await expect(oethRateIncrease).to.withinRange(
        woethRateIncrease.sub(2),
        woethRateIncrease.add(2)
      );

      await expect(assetTransferred > initialDeposit);
      await expect(burnedShares).to.be.approxEqual(
        await woeth.convertToShares(assetTransferred)
      );
      await expect(domen).to.have.a.balanceOf("0", woeth);
    });
  });
});

// we mustn't use the fixture above tests use
describe("ForkTest: wOETH redeem balances", function () {
  // manually test these values locally with the fork set to 22116006
  it.skip("upgrade of WOETH shouldn't change WOETH balances, or redemption amounts", async () => {
    const { woeth } = await simpleOETHFixture();

    // the values pulled from the mainnet at block number 22116006 before 112_upgrade_woeth
    // written down is the account's WOETH balance, and how much OETH one would receive
    // when redeeming the whole balance amount. It is important that the upgrade doesn't
    // affect both of the numbers.
    const accountBalances = {
      "0xdCa0A2341ed5438E06B9982243808A76B9ADD6d0": {
        woethBalance: BigNumber.from("16231824385055731314284"),
        oethRedeemAmount: BigNumber.from("18229274520877989755302"),
      },
      "0xC460B0b6c9b578A4Cb93F99A691e16dB96Ee5833": {
        woethBalance: BigNumber.from("575896531839923556165"),
        oethRedeemAmount: BigNumber.from("646765004690227456060"),
      },
      "0x8a9D46d28003673Cd4FE7a56EcFCFA2BE6372e64": {
        woethBalance: BigNumber.from("182355401624955452064"),
        oethRedeemAmount: BigNumber.from("204795628496744585951"),
      },
      "0x66ceac5EE8F093059C4BC9628C06e63076505B15": {
        woethBalance: BigNumber.from("934212489717768182"),
        oethRedeemAmount: BigNumber.from("1049174481679166505"),
      },
      "0xc407d71801610E5023f2caC3F691FAa09959E5e9": {
        woethBalance: BigNumber.from("1824215988713080"),
        oethRedeemAmount: BigNumber.from("2048699718205546"),
      },
    };

    for (const account of Object.keys(accountBalances)) {
      expect(accountBalances[account].woethBalance).to.equal(
        await woeth.balanceOf(account)
      );
      const previewRedeemAmount = await woeth.previewRedeem(
        accountBalances[account].woethBalance
      );

      // allow 1 WEI difference for rounding errors
      expect(accountBalances[account].oethRedeemAmount)
        .to.gte(previewRedeemAmount.sub(1))
        .to.lte(previewRedeemAmount.add(1));
    }
  });
});
