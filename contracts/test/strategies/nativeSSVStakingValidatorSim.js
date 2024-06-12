tasks/tasks.js//const { expect } = require("chai");
const { isCI } = require("../helpers");
const ValidatorSimulator = require("../../utils/ValidatorSimulator")
const {
  createFixtureLoader,
  nativeStakingValidatorDepositsFixture,
} = require("./../_fixture");
const loadFixture = createFixtureLoader(nativeStakingValidatorDepositsFixture);

let validatorSimulator;
describe("Unit test: Native SSV Staking Strategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
    const {
      nativeStakingSSVStrategy,
      depositContract,
      ssvNetwork
    } = fixture;

    validatorSimulator = new ValidatorSimulator(nativeStakingSSVStrategy, depositContract, ssvNetwork);
  });

  describe.only("Native SSV Staking validator simulations", function () {
    it("Should what?!", async () => {
      await validatorSimulator.startSimulation();

    });

    it("Should what again", async () => {
      await validatorSimulator.startSimulation();

    });
  });
});