const { defaultSonicFixture } = require("./../_fixture-sonic");
const {
  shouldBehaveLikeASFCStakingStrategy,
} = require("../behaviour/sfcStakingStrategy");
const addresses = require("../../utils/addresses");

describe("Sonic ForkTest: Sonic Staking Strategy", function () {
  this.timeout(0);

  let fixture;
  beforeEach(async () => {
    fixture = await defaultSonicFixture();
  });

  shouldBehaveLikeASFCStakingStrategy(async () => {
    return {
      ...fixture,
      addresses: addresses.sonic,
      sfcAddress: await ethers.getContractAt("ISFC", addresses.sonic.SFC),
      // see validators here: https://explorer.soniclabs.com/staking
      testValidatorIds: [15, 16, 17, 18],
    };
  });
});
