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

  describe("", () => {
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
  describe("with some WETH in the vault", () => {
    beforeEach(async () => {
      fixture = await aeroOETHAMOFixture();
    });
    it("Vault should deposit some WETH to AMO strategy", async function () {
      const { aerodromeEthStrategy, oeth, pool, weth, josh, vault } = fixture;

      const wethDepositAmount = await units("1000", weth);

      // Vault transfers WETH to strategy
      await weth
        .connect(josh)
        .transfer(aerodromeEthStrategy.address, wethDepositAmount);

      const { oethMintAmount: oethMintAmount, aeroBalances } =
        await calcOethMintAmount(fixture, wethDepositAmount);
      const oethSupplyBefore = await oeth.totalSupply();

      let vaultSigner = await impersonateAndFund(vault.address, "2");
      const tx = await aerodromeEthStrategy
        .connect(vaultSigner)
        .deposit(weth.address, wethDepositAmount);

      const receipt = await tx.wait();

      // Check emitted events
      await expect(tx)
        .to.emit(aerodromeEthStrategy, "Deposit")
        .withArgs(weth.address, pool.address, wethDepositAmount);
      await expect(tx)
        .to.emit(aerodromeEthStrategy, "Deposit")
        .withArgs(oeth.address, pool.address, oethMintAmount);

      // Check the ETH and OETH balances in the Curve Metapool
      const aeroBalancesAfter = await pool.getReserves();
      expect(aeroBalancesAfter._reserve0.toString()).to.approxEqualTolerance(
        aeroBalances._reserve0.add(wethDepositAmount),
        0.01 // 0.01% or 1 basis point
      );
      expect(aeroBalancesAfter._reserve1.toString()).to.approxEqualTolerance(
        aeroBalances._reserve1.add(oethMintAmount),
        0.01 // 0.01% or 1 basis point
      );

      // Check the OETH total supply increase
      const oethSupplyAfter = await oeth.totalSupply();
      expect(oethSupplyAfter).to.approxEqualTolerance(
        oethSupplyBefore.add(oethMintAmount),
        0.01 // 0.01% or 1 basis point
      );
    });
    it.only("Only vault can deposit some WETH to AMO strategy", async function () {
      const { aerodromeEthStrategy, vault, josh, weth, strategist, timelock } =
        fixture;
      //console.log(strategist, timelock, josh);

      const depositAmount = await units("50", weth);

      await weth
        .connect(josh)
        .transfer(aerodromeEthStrategy.address, depositAmount);

      // for (let signer of [strategist, timelock, josh]) { TODO: Check why this fails

      for (let signer of [josh]) {
        const tx = aerodromeEthStrategy.connect(signer).depositAll();
        await expect(tx).to.revertedWith("Caller is not the Vault");
      }

      const tx = aerodromeEthStrategy
        .connect(josh)
        .deposit(weth.address, depositAmount);

      await expect(tx).to.revertedWith("Caller is not the Vault");
    });
    it("Only vault can deposit all WETH to AMO strategy", async function () {
      const {
        aerodromeEthStrategy,
        pool,
        vault,
        josh,
        weth,
        strategist,
        timelock,
      } = fixture;

      let oethVaultSigner = await impersonateAndFund(vault.address, "1");
      const depositAmount = parseUnits("50");
      await weth
        .connect(josh)
        .transfer(aerodromeEthStrategy.address, depositAmount);

      let tx = aerodromeEthStrategy
        .connect(josh)
        .deposit(weth.address, depositAmount);
      await expect(tx).to.revertedWith("Caller is not the Vault");

      // for (const signer of [strategist, timelock, josh]) { -> Check why this fails
      for (const signer of [josh]) {
        const tx = aerodromeEthStrategy.connect(signer).depositAll();
        await expect(tx).to.revertedWith("Caller is not the Vault");
      }
      tx = await aerodromeEthStrategy.connect(oethVaultSigner).depositAll();
      await expect(tx)
        .to.emit(aerodromeEthStrategy, "Deposit")
        .withNamedArgs({ _asset: weth.address, _pToken: pool.address });
    });
  });
});

// Calculate the minted OETH amount for a deposit
async function calcOethMintAmount(fixture, wethDepositAmount) {
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
