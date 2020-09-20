const { defaultFixture } = require("./_fixture");

const { utils } = require("ethers");
const addresses = require("../utils/addresses");

const {
  ousdUnits,
  daiUnits,
  usdcUnits,
  usdtUnits,
  loadFixture,
  isGanacheFork,
  expectApproxSupply,
} = require("./helpers");

const logGas = async (tx, label = "Gas Used:") => {
  console.log(label, (await tx.wait()).gasUsed.toString());
};

describe("Vault (Gas Reports)", function () {
  if (isGanacheFork) {
    this.timeout(0);
  } else {
    this.timeout(60000);
  }

  it("should mint tokens on vault with multiple strategies and assets", async () => {
    if (!process.env.GAS_REPORT) {
      return;
    }

    const {
      matt,
      josh,
      anna,
      vault,
      governor,
      CompoundStrategyFactory,
      ousd,
      dai,
      usdc,
      usdt,
      cdai,
      cusdc,
      cusdt,
    } = await loadFixture(defaultFixture);

    const out = [];

    const assetAddresses = [dai.address, usdc.address, usdt.address];
    const cTokenAddresses = [cdai.address, cusdc.address, cusdt.address];

    // Deploy multiple strategies
    for (let i = 0; i < 3; i++) {
      const cStrategy = await CompoundStrategyFactory.connect(
        governor
      ).deploy();

      await cStrategy
        .connect(governor)
        .initialize(
          addresses.dead,
          vault.address,
          [assetAddresses[i]],
          [cTokenAddresses[i]]
        );

      out.push(cStrategy);
    }

    const [cStrategy1, cStrategy2, cStrategy3] = out;

    // Add them to vault.
    await vault
      .connect(governor)
      .addStrategy(cStrategy1.address, utils.parseUnits("3", 17)); // 30% target weight.

    await vault
      .connect(governor)
      .addStrategy(cStrategy2.address, utils.parseUnits("3", 17)); // 30% target weight.

    await vault
      .connect(governor)
      .addStrategy(cStrategy3.address, utils.parseUnits("4", 17)); // 40% target weight.

    await expectApproxSupply(ousd, ousdUnits("200"));

    // Deposit some tokens to each CompoundStrategy contract
    await dai.connect(matt).approve(vault.address, daiUnits("150.0"));
    await logGas(await vault.connect(matt).mint(dai.address, daiUnits("150")));

    await usdc.connect(josh).approve(vault.address, usdcUnits("250.0"));
    await logGas(
      await vault.connect(josh).mint(usdc.address, usdcUnits("250"))
    );

    await usdt.connect(anna).approve(vault.address, usdtUnits("350.0"));
    await logGas(
      await vault.connect(anna).mint(usdt.address, usdtUnits("350"))
    );

    await expectApproxSupply(ousd, ousdUnits("950"));
  });
});
