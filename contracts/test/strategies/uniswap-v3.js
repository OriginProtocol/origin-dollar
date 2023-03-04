const { expect } = require("chai");
const { uniswapV3Fixture } = require("../_fixture");
const {
  loadFixture,
  units,
  ousdUnits,
  expectApproxSupply,
} = require("../helpers");

describe("Uniswap V3 Strategy", function () {
  this.timeout(0);

  let fixture;
  let vault, harvester, ousd, usdc, usdt, dai;
  let reserveStrategy, uniV3Strategy, mockPool, mockPositionManager;
  let governor, strategist, operator, josh, matt, daniel, domen, franck;

  beforeEach(async () => {
    fixture = await loadFixture(uniswapV3Fixture);
    reserveStrategy = fixture.mockStrategy;
    uniV3Strategy = fixture.UniV3_USDC_USDT_Strategy;
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

  describe.only("Mint", function () {
    it("Should deposit to reserve strategy", async () => {
      // Vault has 200 DAI from fixtures
      await expectApproxSupply(ousd, ousdUnits("200"));
      await expect(vault).has.an.approxBalanceOf("200", dai);

      // Mint some OUSD with USDC
      await mint(daniel, "10000", usdc);
      await expectApproxSupply(ousd, ousdUnits("10200"));

      console.log(await usdc.balanceOf(reserveStrategy.address));

      // Make sure it went to reserve strategy
      await expect(reserveStrategy).has.an.approxBalanceOf("10000", usdc);
    });
  });

  describe("Redeem", function () {
    it("Should withdraw from reserve strategy", async () => {});
  });

  describe("Rewards", function () {
    it("Should show correct amount of fees", async () => {});
  });

  describe("Rebalance", function () {
    it("Should provide liquidity on given tick", async () => {});

    it("Should close existing position", async () => {});
  });
});
