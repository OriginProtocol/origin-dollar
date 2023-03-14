const { expect } = require("chai");
const { uniswapV3FixturSetup } = require("../_fixture");
const {
  units,
  ousdUnits,
  expectApproxSupply,
} = require("../helpers");

const uniswapV3Fixture = uniswapV3FixturSetup();

describe("Uniswap V3 Strategy", function () {
  let fixture;
  let vault, harvester, ousd, usdc, usdt, dai;
  let reserveStrategy, strategy, mockPool, mockPositionManager;
  let governor, strategist, operator, josh, matt, daniel, domen, franck;

  beforeEach(async () => {
    fixture = await uniswapV3Fixture();
    reserveStrategy = fixture.mockStrategy;
    strategy = fixture.UniV3_USDC_USDT_Strategy;
    mockPool = fixture.UniV3_USDC_USDT_Pool;
    mockPositionManager = fixture.UniV3PositionManager;
    ousd = fixture.ousd;
    usdc = fixture.usdc;
    usdt = fixture.usdt;
    dai = fixture.dai;
    vault = fixture.vault;
    harvester = fixture.harvester;
    governor = fixture.governor;
    strategist = fixture.strategist;
    operator = fixture.operator;
    josh = fixture.josh;
    matt = fixture.matt;
    daniel = fixture.daniel;
    domen = fixture.domen;
    franck = fixture.franck;
  });

  const mint = async (user, amount, asset) => {
    await asset.connect(user).mint(units(amount, asset));
    await asset.connect(user).approve(vault.address, units(amount, asset));
    await vault.connect(user).mint(asset.address, units(amount, asset), 0);
  };

  for (const assetSymbol of ["USDC", "USDT"]) {
    describe(`Mint w/ ${assetSymbol}`, function () {
      let asset;
      beforeEach(() => {
        asset = assetSymbol == "USDT" ? usdt : usdc;
      });

      it("Should mint w/o allocate", async () => {
        // Vault has 200 DAI from fixtures
        await expectApproxSupply(ousd, ousdUnits("200"));
        await expect(vault).has.an.approxBalanceOf("200", dai);
        // Mint some OUSD with USDC/USDT
        await mint(daniel, "10000", asset);
        await expectApproxSupply(ousd, ousdUnits("10200"));
        // Make sure it's in vault
        await expect(vault).has.an.approxBalanceOf("10000", asset);
      });

      it("Should mint and allocate to reserve strategy", async () => {
        // Vault has 200 DAI from fixtures
        await expectApproxSupply(ousd, ousdUnits("200"));
        await expect(vault).has.an.approxBalanceOf("200", dai);
        // Mint some OUSD with USDC/USDT
        await mint(franck, "30000", asset);
        await expectApproxSupply(ousd, ousdUnits("30200"));
        // Make sure it went to reserve strategy
        await expect(reserveStrategy).has.an.approxBalanceOf("30000", asset);
      });
    });
  }

  describe("Redeem", function () {
    it("Should withdraw from vault balance", async () => {
      // Vault has 200 DAI from fixtures
      await expectApproxSupply(ousd, ousdUnits("200"));
      await expect(vault).has.an.approxBalanceOf("200", dai);
      // Mint some OUSD with USDC
      await mint(domen, "10000", usdc);

      // Try redeem
      await vault.connect(domen).redeem(ousdUnits("10000"), 0);
      await expectApproxSupply(ousd, ousdUnits("200"));
    });

    it("Should withdraw from reserve strategy", async () => {
      // Vault has 200 DAI from fixtures
      await expectApproxSupply(ousd, ousdUnits("200"));
      await expect(vault).has.an.approxBalanceOf("200", dai);
      // Mint some OUSD with USDT
      await mint(matt, "30000", usdt);
      await expectApproxSupply(ousd, ousdUnits("30200"));
      await expect(reserveStrategy).has.an.approxBalanceOf("30000", usdt);

      // Try redeem
      await vault.connect(matt).redeem(ousdUnits("30000"), 0);
      await expectApproxSupply(ousd, ousdUnits("200"));
    });
  });
  describe("Rewards", function () {
    it("Should show correct amount of fees", async () => {});
  });
  describe("Rebalance", function () {
    it("Should provide liquidity on given tick", async () => {});
    it("Should close existing position", async () => {});
  });
});
