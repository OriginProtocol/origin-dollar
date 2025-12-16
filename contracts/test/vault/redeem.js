const { expect } = require("chai");
const { loadDefaultFixture } = require("../_fixture");

const {
  ousdUnits,
  usdcUnits,
  isFork,
  expectApproxSupply,
} = require("../helpers");

describe("Vault Redeem", function () {
  if (isFork) {
    this.timeout(0);
  }

  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });

  it("Should allow a redeem", async () => {
    const { ousd, vault, usdc, anna } = fixture;

    await expect(anna).has.a.balanceOf("1000.00", usdc);
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"), 0);
    await expect(anna).has.a.balanceOf("50.00", ousd);
    await vault.connect(anna).redeem(ousdUnits("50.0"), 0);
    await expect(anna).has.a.balanceOf("0.00", ousd);
    await expect(anna).has.a.balanceOf("1000.00", usdc);
    expect(await ousd.totalSupply()).to.eq(ousdUnits("200.0"));
  });

  it("Should allow a redeem over the rebase threshold", async () => {
    const { ousd, vault, usdc, anna, matt } = fixture;

    await expect(anna).has.a.balanceOf("1000.00", usdc);

    await expect(anna).has.a.balanceOf("0.00", ousd);
    await expect(matt).has.a.balanceOf("100.00", ousd);

    // Anna mints OUSD with USDC
    await usdc.connect(anna).approve(vault.address, usdcUnits("1000.00"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("1000.00"), 0);
    await expect(anna).has.a.balanceOf("1000.00", ousd);
    await expect(matt).has.a.balanceOf("100.00", ousd);

    // Rebase should do nothing
    await vault.rebase();
    await expect(anna).has.a.balanceOf("1000.00", ousd);
    await expect(matt).has.a.balanceOf("100.00", ousd);

    // Anna redeems over the rebase threshold
    await vault.connect(anna).redeem(ousdUnits("500.0"), 0);
    await expect(anna).has.a.approxBalanceOf("500.00", ousd);
    await expect(matt).has.a.approxBalanceOf("100.00", ousd);

    // Redeem outputs will be 1000/2200 * 1500 USDC and 1200/2200 * 1500 USDS from fixture
    await expect(anna).has.an.approxBalanceOf("500.00", usdc);

    await expectApproxSupply(ousd, ousdUnits("700.0"));
  });

  it("Should have a default redeem fee of 0", async () => {
    const { vault } = fixture;

    await expect(await vault.redeemFeeBps()).to.equal("0");
  });

  it("Should charge a redeem fee if redeem fee set", async () => {
    const { ousd, vault, usdc, anna, governor } = fixture;

    // 1000 basis points = 10%
    await vault.connect(governor).setRedeemFeeBps(1000);
    await expect(anna).has.a.balanceOf("1000.00", usdc);
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"), 0);
    await expect(anna).has.a.balanceOf("50.00", ousd);
    await vault.connect(anna).redeem(ousdUnits("50.0"), 0);
    await expect(anna).has.a.balanceOf("0.00", ousd);
    await expect(anna).has.a.balanceOf("995.00", usdc);
  });

  it("Should revert redeem if balance is insufficient", async () => {
    const { ousd, vault, usdc, anna } = fixture;

    // Mint some OUSD tokens
    await expect(anna).has.a.balanceOf("1000.00", usdc);
    await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"), 0);
    await expect(anna).has.a.balanceOf("50.00", ousd);

    // Try to withdraw more than balance
    await expect(
      vault.connect(anna).redeem(ousdUnits("100.0"), 0)
    ).to.be.revertedWith("Transfer amount exceeds balance");
  });

  it("Should only allow Governor to set a redeem fee", async () => {
    const { vault, anna } = fixture;

    await expect(vault.connect(anna).setRedeemFeeBps(100)).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("Should redeem entire OUSD balance", async () => {
    const { ousd, vault, usdc, anna } = fixture;

    await expect(anna).has.a.balanceOf("1000.00", usdc);

    // Mint 100 OUSD tokens using USDC
    await usdc.connect(anna).approve(vault.address, usdcUnits("100.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("100.0"), 0);
    await expect(anna).has.a.balanceOf("100.00", ousd);

    // Withdraw all
    await vault.connect(anna).redeem(ousd.balanceOf(anna.address), 0);

    await expect(anna).has.a.balanceOf("1000", usdc);
  });

  it("Should have correct balances on consecutive mint and redeem", async () => {
    const { ousd, vault, usdc, anna, matt, josh } = fixture;

    const usersWithBalances = [
      [anna, 0],
      [matt, 100],
      [josh, 100],
    ];

    const assetsWithUnits = [[usdc, usdcUnits]];

    for (const [user, startBalance] of usersWithBalances) {
      for (const [asset, units] of assetsWithUnits) {
        for (const amount of [5.09, 10.32, 20.99, 100.01]) {
          await asset
            .connect(user)
            .approve(vault.address, await units(amount.toString()));
          await vault
            .connect(user)
            .mint(asset.address, await units(amount.toString()), 0);
          await expect(user).has.an.approxBalanceOf(
            (startBalance + amount).toString(),
            ousd
          );
          await vault.connect(user).redeem(ousdUnits(amount.toString()), 0);
          await expect(user).has.an.approxBalanceOf(
            startBalance.toString(),
            ousd
          );
        }
      }
    }
  });

  it("Should correctly handle redeem without a rebase and then full redeem", async function () {
    const { ousd, vault, usdc, anna } = fixture;
    await expect(anna).has.a.balanceOf("0.00", ousd);
    await usdc.connect(anna).mint(usdcUnits("3000.0"));
    await usdc.connect(anna).approve(vault.address, usdcUnits("3000.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("3000.0"), 0);
    await expect(anna).has.a.balanceOf("3000.00", ousd);

    //redeem without rebasing (not over threshold)
    await vault.connect(anna).redeem(ousdUnits("200.00"), 0);
    //redeem with rebasing (over threshold)
    await vault.connect(anna).redeem(ousd.balanceOf(anna.address), 0);

    await expect(anna).has.a.balanceOf("0.00", ousd);
  });

  it("Should respect minimum unit amount argument in redeem", async () => {
    const { ousd, vault, usdc, anna } = fixture;

    await expect(anna).has.a.balanceOf("1000.00", usdc);
    await usdc.connect(anna).approve(vault.address, usdcUnits("100.0"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"), 0);
    await expect(anna).has.a.balanceOf("50.00", ousd);
    await vault.connect(anna).redeem(ousdUnits("50.0"), usdcUnits("50"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"), 0);
    await expect(
      vault.connect(anna).redeem(ousdUnits("50.0"), usdcUnits("51"))
    ).to.be.revertedWith("Redeem amount lower than minimum");
  });

  it("Should calculate redeem outputs", async () => {
    const { vault, anna, usdc, ousd } = fixture;

    // OUSD total supply is 200 backed by 200 USDC
    expect((await vault.calculateRedeemOutputs(ousdUnits("50")))[0]).to.equal(
      usdcUnits("50")
    );

    await usdc.connect(anna).approve(vault.address, usdcUnits("600"));
    await vault.connect(anna).mint(usdc.address, usdcUnits("600"), 0);
    await expect(anna).has.a.balanceOf("600", ousd);

    expect((await vault.calculateRedeemOutputs(ousdUnits("100")))[0]).to.equal(
      usdcUnits("100")
    );
  });
});
