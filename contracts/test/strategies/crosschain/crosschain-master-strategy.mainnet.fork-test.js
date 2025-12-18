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
    const { crossChainMasterStrategy } = fixture;
    const attestation =
      "0xc0ee7623da7bad1b2607f12c21ce71c4314b4ade3d36a0e6e13753fbb0603daa2b10fcbbc4942ce75a2b8d5f5c11f4b6c5ee5f8dce4663d3ec834674d0a9991a1cdeb52adf17d5fb3222b1f94f0767175f06e69f9473e7f948a4b5c478814f11915ed64081cbe6e139fd277630b8807b56be7c355ccdda6c20acbf0324231fc8301b";
    const message =
      "0x0000000100000006000000000384bc6f6bfe10f6df4967b6ad287d897ff729f0c7e43f73a1e18ab156e96bfb0000000000000000000000008ebcca1066d15ad901927ab01c7c6d0b057bbd340000000000000000000000008ebcca1066d15ad901927ab01c7c6d0b057bbd3400000000000000000000000030f8a2fc7d7098061c94f042b2e7e732f95af40f00000000000003e8000003f20000000300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

    await crossChainMasterStrategy.relay(message, attestation);
  });
});
