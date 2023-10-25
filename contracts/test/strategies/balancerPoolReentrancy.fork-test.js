const hre = require("hardhat");
const { ethers } = hre;
const { expect } = require("chai");
const { isCI } = require("../helpers");
const {
  balancerREthFixture,
  mintWETH,
  impersonateAndFundContract,
  createFixtureLoader,
} = require("../_fixture");
const { deployWithConfirmation } = require("../../utils/deploy");
const { utils } = require("ethers").ethers;
const { findBestMainnetTokenHolder } = require("../../utils/funding");
const addresses = require("../../utils/addresses");

describe("ForkTest: Balancer MetaStablePool - Read-only Reentrancy", function () {
  this.timeout(0);
  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  const loadFixture = createFixtureLoader(balancerREthFixture, {
    defaultStrategy: true,
  });

  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Should not allow read-only reentrancy", async () => {
    const { weth, reth, oethVault, rEthBPT, balancerREthPID, daniel } = fixture;

    // Deploy the attacking contract
    const dEvilContract = await deployWithConfirmation(
      "MockEvilReentrantContract",
      [
        addresses.mainnet.balancerVault,
        oethVault.address,
        reth.address,
        weth.address,
        rEthBPT.address,
        balancerREthPID,
      ]
    );
    const cEvilContract = await ethers.getContractAt(
      "MockEvilReentrantContract",
      dEvilContract.address
    );

    // Approve movement of tokens
    await cEvilContract.connect(daniel).approveAllTokens();

    // Fund the attacking contract with WETH
    await mintWETH(
      weth,
      await impersonateAndFundContract(cEvilContract.address),
      "100000"
    );

    // ... and rETH
    const rethHolder = await findBestMainnetTokenHolder(reth, hre);
    await impersonateAndFundContract(await rethHolder.getAddress());
    await reth
      .connect(rethHolder)
      .transfer(cEvilContract.address, utils.parseEther("1000"));

    // Do Evil Stuff
    await expect(cEvilContract.doEvilStuff()).to.be.reverted;
  });
});
