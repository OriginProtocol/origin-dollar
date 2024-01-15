const { expect } = require("chai");

const { loadDefaultFixture } = require("./../_fixture");
const { isCI } = require("./../helpers");
const { hotDeployOption } = require("../_hot-deploy");
const { parseUnits } = require("ethers/lib/utils");

describe.only("ForkTest: OETH Vault Gas Tests", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();

    await hotDeployOption(fixture, null, {
      isOethFixture: true,
    });
  });

  it("Mint", async () => {
    const { oethVault, weth, josh } = fixture;

    const amount = parseUnits("0.9", 18);
    const minOeth = parseUnits("0.8", 18);

    await weth.connect(josh).approve(oethVault.address, amount);

    const tx = await oethVault
      .connect(josh)
      .mint(weth.address, amount, minOeth);

    const r = await tx.wait();
    console.log("Gas Used:", r.gasUsed.toString());
    console.log("Cumulative Gas Used:", r.cumulativeGasUsed.toString());
  });

  it("Mint w/ Rebase", async () => {
    const { oethVault, weth, josh } = fixture;

    const amount = parseUnits("2.5", 18);
    const minOeth = parseUnits("2.3", 18);

    await weth.connect(josh).approve(oethVault.address, amount);

    const tx = await oethVault
      .connect(josh)
      .mint(weth.address, amount, minOeth);

    const r = await tx.wait();
    console.log("Gas Used:", r.gasUsed.toString());
    console.log("Cumulative Gas Used:", r.cumulativeGasUsed.toString());
  });

  it("Mint w/ Rebase & Allocation", async () => {
    const { oethVault, weth, josh } = fixture;

    const amount = parseUnits("12.5", 18);
    const minOeth = parseUnits("12.3", 18);

    await weth.connect(josh).approve(oethVault.address, amount);

    const tx = await oethVault
      .connect(josh)
      .mint(weth.address, amount, minOeth);

    const r = await tx.wait();
    console.log("Gas Used:", r.gasUsed.toString());
    console.log("Cumulative Gas Used:", r.cumulativeGasUsed.toString());
  });

  it("Redeem", async () => {
    const { oethVault, weth, josh } = fixture;

    const amount = parseUnits("0.9", 18);
    const minOeth = parseUnits("0.8", 18);

    await weth.connect(josh).approve(oethVault.address, amount);

    // Mint some
    await oethVault.connect(josh).mint(weth.address, amount, minOeth);

    const tx = await oethVault.connect(josh).redeem(amount, 0);

    const r = await tx.wait();
    console.log("Gas Used:", r.gasUsed.toString());
    console.log("Cumulative Gas Used:", r.cumulativeGasUsed.toString());
  });

  it("Redeem w/ Rebase", async () => {
    const { oethVault, weth, josh } = fixture;

    const amount = parseUnits("12.9", 18);
    const minOeth = parseUnits("12.1", 18);

    await weth.connect(josh).approve(oethVault.address, amount);

    // Mint some
    await oethVault.connect(josh).mint(weth.address, amount, minOeth);

    const tx = await oethVault.connect(josh).redeem(amount, 0);

    const r = await tx.wait();
    console.log("Gas Used:", r.gasUsed.toString());
    console.log("Cumulative Gas Used:", r.cumulativeGasUsed.toString());
  });
});
