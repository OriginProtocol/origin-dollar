const hre = require("hardhat");
const { expect } = require("chai");

const { units, oethUnits, isCI } = require("../helpers");

const {
  createFixtureLoader,
  //fraxETHStrategyFixture,
} = require("./../_fixture");
const { impersonateAndFund } = require("../../utils/signers");
const { setERC20TokenBalance } = require("../_fund");

//const loadFixture = createFixtureLoader(fraxETHStrategyFixture);

describe("ForkTest: Native SSV Staking Strategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  describe("Initial setup", function () {
    // this needs to be a unit test
    it.skip("Should not allow sending of ETH to the strategy via a transaction", async () => {

    });
  });

  describe("Deposit/Allocation", function () {
    
  });

  describe("Withdraw", function () {
   
  });

  describe("Balance/Assets", function () {
  });
});
