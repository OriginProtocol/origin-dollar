const { expect } = require("chai");

const { units, ousdUnits, usdcUnits, isCI } = require("../../helpers");
const { createFixtureLoader, crossChainFixture } = require("../../_fixture");
const { impersonateAndFund } = require("../../../utils/signers");
const { formatUnits } = require("ethers/lib/utils");

const loadFixture = createFixtureLoader(crossChainFixture);

describe.only("ForkTest: CrossChainMasterStrategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Should initiate a bridge of deposited USDC", async function () {
    const { matt, hookWrapper, crossChainMasterStrategy, usdc } = fixture;
    const govAddr = await crossChainMasterStrategy.governor();
    const governor = await impersonateAndFund(govAddr);
    const vaultAddr = await crossChainMasterStrategy.vaultAddress();

    const impersonatedVault = await impersonateAndFund(vaultAddr);

    // Let the strategy hold some USDC
    await usdc
      .connect(matt)
      .transfer(crossChainMasterStrategy.address, usdcUnits("1000"));

    const balanceBefore = await usdc.balanceOf(
      crossChainMasterStrategy.address
    );

    // Simulate deposit call
    await crossChainMasterStrategy
      .connect(impersonatedVault)
      .deposit(usdc.address, usdcUnits("1000"));

    const balanceAfter = await usdc.balanceOf(crossChainMasterStrategy.address);

    console.log(`Balance before: ${formatUnits(balanceBefore, 6)}`);
    console.log(`Balance after: ${formatUnits(balanceAfter, 6)}`);
  });
});
