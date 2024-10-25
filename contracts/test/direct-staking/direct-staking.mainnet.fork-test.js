const { createFixtureLoader, directStakingFixture } = require("../_fixture");
// const { expect } = require("chai");
const addresses = require("../../utils/addresses");
const { oethUnits } = require("../helpers");
const ccipChainSelectors = require("../../utils/ccip-chain-selectors");
const { impersonateAndFund } = require("../../utils/signers");
const { utils } = require("ethers");
// const { replaceContractAt } = require("../../utils/hardhat");

const runFixtures = createFixtureLoader(directStakingFixture);

describe("ForkTest: Direct Staking (Mainnet)", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await runFixtures();
  });

  it("Should handle incoming requests", async () => {
    const {
      directStakingHandler,
      weth,
      domen,
      strategist,
      oeth,
      oethVault,
      //   woeth,
      //   mockRouter,
    } = fixture;

    // Mock token transfer
    await weth
      .connect(domen)
      .transfer(directStakingHandler.address, oethUnits("1"));

    // Mock request
    const messageId =
      "0x000000000000000000000000000000000000000000000000000000000000dead";

    await oethVault.rebase();
    const supBefore = await oeth.totalSupply();

    // // Mock router
    // await replaceContractAt(addresses.mainnet.ccipRouter, mockRouter)
    // const ccipRouter = await ethers.getContractAt("MockCCIPRouter", addresses.mainnet.ccipRouter)
    // await ccipRouter.setFee(oethUnits("0.001"));

    // await ccipRouter.mockSend(
    //     directStakingHandler.address,
    //     ccipChainSelectors.BASE_SELECTOR,
    //     await strategist.getAddress(),
    //     utils.defaultAbiCoder.encode(["bytes32"], [messageId]), // encoded message
    //     [{
    //         token: addresses.mainnet.WETH,
    //         amount: oethUnits("1")
    //     }]
    // )

    // Impersoanted router
    const ccipRouterSigner = await impersonateAndFund(
      addresses.mainnet.ccipRouter
    );
    await directStakingHandler.connect(ccipRouterSigner).ccipReceive({
      messageId, // Just any value to mock
      sourceChainSelector: ccipChainSelectors.BASE_SELECTOR, // from base
      sender: utils.defaultAbiCoder.encode(
        ["address"],
        [await strategist.getAddress()]
      ), // Just mock set in fixtures
      data: utils.defaultAbiCoder.encode(["bytes32"], [messageId]), // encoded message
      destTokenAmounts: [
        {
          token: addresses.mainnet.WETH,
          amount: oethUnits("1"),
        },
      ],
    });

    const supAfter = await oeth.totalSupply();

    console.log("Supply diff", supAfter - supBefore);
  });
});
