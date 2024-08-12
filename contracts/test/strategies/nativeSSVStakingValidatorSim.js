const { isCI } = require("../helpers");
const ValidatorSimulator = require("../../utils/ValidatorSimulator");
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
      ssvNetwork,
      validatorRegistrator,
    } = fixture;

    validatorSimulator = new ValidatorSimulator(
      nativeStakingSSVStrategy,
      depositContract,
      ssvNetwork,
      validatorRegistrator
    );
  });

  describe("Native SSV Staking validator simulations", function () {
    const maxSlashedValidators = 5;
    const maxWithdrawnValidators = 50;

    // loop through possible combinations of slashed and withdrawn validators
    for (let i = 0; i < maxSlashedValidators + 1; i++) {
      for (let j = 0; j < maxWithdrawnValidators + 1; j++) {
        it(`Should correctly do accounting when ${i} validators are slashed and ${j} validators are fully withdrawn`, async () => {
          await validatorSimulator.executeSimulation({
            validatorSlashes: i,
            validatorFullWithdrawals: j,
          });
        });
      }
    }
  });
});
