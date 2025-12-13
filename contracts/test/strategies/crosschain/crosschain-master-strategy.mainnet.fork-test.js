// const { expect } = require("chai");

const { usdcUnits, isCI } = require("../../helpers");
const { createFixtureLoader, crossChainFixture } = require("../../_fixture");
const { impersonateAndFund } = require("../../../utils/signers");
const { formatUnits } = require("ethers/lib/utils");

const loadFixture = createFixtureLoader(crossChainFixture);

describe("ForkTest: CrossChainMasterStrategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Should initiate a bridge of deposited USDC", async function () {
    const { matt, crossChainMasterStrategy, usdc } = fixture;
    // const govAddr = await crossChainMasterStrategy.governor();
    // const governor = await impersonateAndFund(govAddr);
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

  it("Should handle attestation relay", async function () {
    const { hookWrapper } = fixture;
    const attestation =
      "0xf0b2792bd9b046124075e93647df38c7b1d524676f48969e692b7a79826df13913ae9086db0de46a194be8c4b52fe3b985a1fa5d6b0f038230506891a59869381b61b7567dc2e82817b7c63eb5968fcdddd53fb167eeb225aaef20ffda1aa9b0337529d52344ba8dbd272821adae236d51b8af81bdbe7ad610237f66161bbb34b41b";
    const message =
      "0x000000010000000600000000da5c3cfca2c93e77aeb7cd1c18df6e217d9a446930d4f95fdef03b2b59522bc5000000000000000000000000b8efd2c6ead9816841871c54d7b789eb517cc684000000000000000000000000b8efd2c6ead9816841871c54d7b789eb517cc684000000000000000000000000bfac208544c41ac1a675b9147f03c6df19d6435f00000000000003e8000003f20000000300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

    await hookWrapper.relay(message, attestation);
  });
});
