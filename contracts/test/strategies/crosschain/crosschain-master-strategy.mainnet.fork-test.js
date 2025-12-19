const { expect } = require("chai");

const { usdcUnits, isCI } = require("../../helpers");
const { createFixtureLoader, crossChainFixture } = require("../../_fixture");
const { impersonateAndFund } = require("../../../utils/signers");
// const { formatUnits } = require("ethers/lib/utils");
const addresses = require("../../../utils/addresses");

const loadFixture = createFixtureLoader(crossChainFixture);

const DEPOSIT_FOR_BURN_EVENT_TOPIC =
  "0x0c8c1cbdc5190613ebd485511d4e2812cfa45eecb79d845893331fedad5130a5";
// const MESSAGE_SENT_EVENT_TOPIC =
//   "0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036";

// const ORIGIN_MESSAGE_VERSION_HEX = "0x000003f2"; // 1010

describe("ForkTest: CrossChainMasterStrategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  const decodeDepositForBurnEvent = (event) => {
    const [
      amount,
      mintRecipient,
      destinationDomain,
      destinationTokenMessenger,
      destinationCaller,
      maxFee,
      hookData,
    ] = ethers.utils.defaultAbiCoder.decode(
      [
        "uint256",
        "address",
        "uint32",
        "address",
        "address",
        "uint256",
        "bytes",
      ],
      event.data
    );

    const [burnToken] = ethers.utils.defaultAbiCoder.decode(
      ["address"],
      event.topics[1]
    );
    const [depositer] = ethers.utils.defaultAbiCoder.decode(
      ["address"],
      event.topics[2]
    );
    const [minFinalityThreshold] = ethers.utils.defaultAbiCoder.decode(
      ["uint256"],
      event.topics[3]
    );

    return {
      amount,
      mintRecipient,
      destinationDomain,
      destinationTokenMessenger,
      destinationCaller,
      maxFee,
      hookData,
      burnToken,
      depositer,
      minFinalityThreshold,
    };
  };

  it("Should initiate bridging of deposited USDC", async function () {
    const { matt, crossChainMasterStrategy, usdc } = fixture;
    // const govAddr = await crossChainMasterStrategy.governor();
    // const governor = await impersonateAndFund(govAddr);
    const vaultAddr = await crossChainMasterStrategy.vaultAddress();

    const impersonatedVault = await impersonateAndFund(vaultAddr);

    // Let the strategy hold some USDC
    await usdc
      .connect(matt)
      .transfer(crossChainMasterStrategy.address, usdcUnits("1000"));

    const usdcBalanceBefore = await usdc.balanceOf(
      crossChainMasterStrategy.address
    );
    const strategyBalanceBefore = await crossChainMasterStrategy.checkBalance(
      usdc.address
    );

    // Simulate deposit call
    const tx = await crossChainMasterStrategy
      .connect(impersonatedVault)
      .deposit(usdc.address, usdcUnits("1000"));

    const usdcBalanceAfter = await usdc.balanceOf(
      crossChainMasterStrategy.address
    );
    expect(usdcBalanceAfter).to.eq(usdcBalanceBefore.sub(usdcUnits("1000")));

    const strategyBalanceAfter = await crossChainMasterStrategy.checkBalance(
      usdc.address
    );
    expect(strategyBalanceAfter).to.eq(strategyBalanceBefore);

    expect(await crossChainMasterStrategy.pendingAmount()).to.eq(
      usdcUnits("1000")
    );

    // Check for message sent event
    const receipt = await tx.wait();
    const depositForBurnEvent = receipt.events.find((e) =>
      e.topics.includes(DEPOSIT_FOR_BURN_EVENT_TOPIC)
    );
    const burnEventData = decodeDepositForBurnEvent(depositForBurnEvent);

    expect(burnEventData.amount).to.eq(usdcUnits("1000"));
    expect(burnEventData.mintRecipient.toLowerCase()).to.eq(
      crossChainMasterStrategy.address.toLowerCase()
    );
    expect(burnEventData.destinationDomain).to.eq(6);
    expect(burnEventData.destinationTokenMessenger.toLowerCase()).to.eq(
      addresses.CCTPTokenMessengerV2.toLowerCase()
    );
    expect(burnEventData.destinationCaller.toLowerCase()).to.eq(
      crossChainMasterStrategy.address.toLowerCase()
    );
    expect(burnEventData.maxFee).to.eq(0);
    expect(burnEventData.burnToken).to.eq(usdc.address);

    expect(burnEventData.depositer.toLowerCase()).to.eq(
      crossChainMasterStrategy.address.toLowerCase()
    );
    expect(burnEventData.minFinalityThreshold).to.eq(2000);
    expect(burnEventData.burnToken.toLowerCase()).to.eq(
      usdc.address.toLowerCase()
    );

    // TODO: Check Hook Data
    // expect(burnEventData.hookData).to.eq("");
  });

  it.skip("Should handle attestation relay", async function () {
    const { crossChainMasterStrategy } = fixture;
    const attestation =
      "0xc0ee7623da7bad1b2607f12c21ce71c4314b4ade3d36a0e6e13753fbb0603daa2b10fcbbc4942ce75a2b8d5f5c11f4b6c5ee5f8dce4663d3ec834674d0a9991a1cdeb52adf17d5fb3222b1f94f0767175f06e69f9473e7f948a4b5c478814f11915ed64081cbe6e139fd277630b8807b56be7c355ccdda6c20acbf0324231fc8301b";
    const message =
      "0x0000000100000006000000000384bc6f6bfe10f6df4967b6ad287d897ff729f0c7e43f73a1e18ab156e96bfb0000000000000000000000008ebcca1066d15ad901927ab01c7c6d0b057bbd340000000000000000000000008ebcca1066d15ad901927ab01c7c6d0b057bbd3400000000000000000000000030f8a2fc7d7098061c94f042b2e7e732f95af40f00000000000003e8000003f20000000300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

    await crossChainMasterStrategy.relay(message, attestation);
  });
});
