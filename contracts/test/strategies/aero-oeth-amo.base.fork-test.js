const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");
const { run } = require("hardhat");

const addresses = require("../../utils/addresses");
const { oethPoolLpPID } = require("../../utils/constants");
const { units, oethUnits, isCI } = require("../helpers");
const { aeroOETHAMOFixture } = require("../_fixture");
const { impersonateAndFund } = require("../../utils/signers");

const log = require("../../utils/logger")("test:fork:aero-oeth:metapool");

describe("ForkTest: OETH AMO Aerodrome Strategy", function () {
  this.timeout(0);
  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;

  describe("wip", () => {
    beforeEach(async () => {
      fixture = await aeroOETHAMOFixture();
    });
    it("Should have constants and immutables set", async () => {
      const { aerodromeEthStrategy } = fixture;

      expect(await aerodromeEthStrategy.MAX_SLIPPAGE()).to.equal(
        parseUnits("0.01", 18)
      );
      expect(await aerodromeEthStrategy.ETH_ADDRESS()).to.equal(addresses.ETH);

      expect(await aerodromeEthStrategy.aeroRouterAddress()).to.equal(
        addresses.base.aeroRouterAddress
      );
      expect(await aerodromeEthStrategy.aeroFactoryAddress()).to.equal(
        addresses.base.aeroFactoryAddress
      );
    });
    it("Should be able to check balance", async () => {
      const { weth, josh, aerodromeEthStrategy } = fixture;

      const balance = await aerodromeEthStrategy.checkBalance(weth.address);
      log(`check balance ${balance}`);
      expect(balance).gt(0);

      // This uses a transaction to call a view function so the gas usage can be reported.
      const tx = await aerodromeEthStrategy
        .connect(josh)
        .populateTransaction.checkBalance(weth.address);
      await josh.sendTransaction(tx);
    });
  });
  describe.only("with some WETH in the vault", () => {
    beforeEach(async () => {
      fixture = await aeroOETHAMOFixture();
    });
    it("Vault should deposit some WETH to AMO strategy", async function () {
      const { aerodromeEthStrategy, woeth, pool, weth, josh, vault } = fixture;

      const wethDepositAmount = await units("1000", weth);

      // Vault transfers WETH to strategy
      await weth
        .connect(josh)
        .transfer(aerodromeEthStrategy.address, wethDepositAmount);

      const { oethMintAmount, aeroBalances } = await calcWoethMintAmount(
        fixture,
        wethDepositAmount
      );
      const woethSupplyBefore = await woeth.totalSupply();

      log("Before deposit to strategy");
      // await run("amoStrat", {
      //     pool: "OETH",
      //     output: false,
      // });
      let vaultSigner = await impersonateAndFund(vault.address, "2");
      const tx = await aerodromeEthStrategy
        .connect(vaultSigner)
        .deposit(weth.address, wethDepositAmount);

      const receipt = await tx.wait();

      // log("After deposit to strategy");
      // await run("amoStrat", {
      //     pool: "OETH",
      //     output: false,
      //     fromBlock: receipt.blockNumber - 1,
      // });

      // // Check emitted events
      // await expect(tx)
      //     .to.emit(convexEthMetaStrategy, "Deposit")
      //     .withArgs(weth.address, oethMetaPool.address, wethDepositAmount);
      // await expect(tx)
      //     .to.emit(convexEthMetaStrategy, "Deposit")
      //     .withArgs(oeth.address, oethMetaPool.address, oethMintAmount);

      // // Check the ETH and OETH balances in the Curve Metapool
      // const curveBalancesAfter = await oethMetaPool.get_balances();
      // expect(curveBalancesAfter[0]).to.approxEqualTolerance(
      //     curveBalancesBefore[0].add(wethDepositAmount),
      //     0.01 // 0.01% or 1 basis point
      // );
      // expect(curveBalancesAfter[1]).to.approxEqualTolerance(
      //     curveBalancesBefore[1].add(oethMintAmount),
      //     0.01 // 0.01% or 1 basis point
      // );

      // // Check the OETH total supply increase
      // const oethSupplyAfter = await oeth.totalSupply();
      // expect(oethSupplyAfter).to.approxEqualTolerance(
      //     oethSupplyBefore.add(oethMintAmount),
      //     0.01 // 0.01% or 1 basis point
      // );
    });
  });
});

// Calculate the minted OETH amount for a deposit
async function calcWoethMintAmount(fixture, wethDepositAmount) {
  const { pool } = fixture;

  // Get the WETH and WOETH balances in the Aero sAMM pool
  const aeroBalances = await pool.getReserves();
  // WETH balance - WOETH balance
  const balanceDiff = aeroBalances._reserve1.sub(aeroBalances._reserve0);

  let oethMintAmount = balanceDiff.lte(0)
    ? // If more OETH than ETH then mint same amount of WOETH as WETH
      wethDepositAmount
    : // If less OETH than WETH then mint the difference
      balanceDiff.add(wethDepositAmount);
  // Cap the minting to twice the WETH deposit amount
  const doubleWethDepositAmount = wethDepositAmount.mul(2);
  oethMintAmount = oethMintAmount.lte(doubleWethDepositAmount)
    ? oethMintAmount
    : doubleWethDepositAmount;
  log(`OETH mint amount : ${formatUnits(oethMintAmount)}`);

  return { oethMintAmount, aeroBalances };
}
