const { createFixtureLoader } = require("../../_fixture");
const { defaultBaseFixture } = require("../../_fixture-base");
const { expect } = require("chai");
const { oethUnits } = require("../../helpers");
const { deployWithConfirmation } = require("../../../utils/deploy");
const { replaceContractAt } = require("../../../utils/hardhat");
const addresses = require("../../../utils/addresses");
const { impersonateAndFund } = require("../../../utils/signers");
const { formatEther } = require("ethers/lib/utils");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("ForkTest: Bridged WOETH Strategy exploit", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await baseFixture();
  });

  it("with bad strategist", async () => {
    const { woeth, oethb, oethbVault, weth, woethStrategy, strategist, governor } = fixture;

    // Rebase
    await oethbVault.rebase();

    const amount = oethUnits("100")
    
    // Mint 100 superOETHb
    await impersonateAndFund(strategist.address, "10000")
    await weth.connect(strategist).deposit({ value: amount });
    await weth.connect(strategist).approve(oethbVault.address, amount);
    await oethbVault.connect(strategist).mint(weth.address, amount, "0");

    // Get current price
    const oracleFeed = await ethers.getContractAt(
      "AggregatorV3Interface",
      addresses.base.BridgedWOETHOracleFeed
    );
    const roundData = await oracleFeed.latestRoundData();

    // Deploy a mock oracle feed
    const dMockOracleFeed = await deployWithConfirmation(
      "MockChainlinkOracleFeed",
      [
        roundData.answer, // Initial price
        18, // Decimals
      ]
    );
    // Replace the feed with mock
    await replaceContractAt(
      addresses.base.BridgedWOETHOracleFeed,
      dMockOracleFeed
    );

    const cMockOracleFeed = await ethers.getContractAt(
      "MockChainlinkOracleFeed",
      addresses.base.BridgedWOETHOracleFeed
    );
    // Set price on hacked oracle
    await cMockOracleFeed.connect(strategist).setPrice(roundData.answer);
    await cMockOracleFeed.connect(strategist).setDecimals(18);


    let nextPrice = roundData.answer.mul(1010).div(1000)
    for (let i = 0; i < 1000; i++) {
      // Increase the price by 0.9%
      await cMockOracleFeed.setPrice(nextPrice);
      
      // Pull inflated price
      await woethStrategy.updateWOETHOraclePrice();

      // Set up for next price
      nextPrice = nextPrice.mul(1010).div(1000)
    }

    // Rebase
    await oethbVault.rebase();

    console.log((await oethb.balanceOf(strategist.address)).toString())

    console.log("Balance", formatEther(await oethb.balanceOf(strategist.address)))
    
    // // Try to redeem
    // await oethbVault.connect(strategist).redeem(oethUnits("1"), "0");


  });

});
