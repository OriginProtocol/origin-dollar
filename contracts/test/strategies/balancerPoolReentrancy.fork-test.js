const hre = require("hardhat");
const { ethers } = hre;
const { expect } = require("chai");
const { isCI } = require("../helpers");
const { balancerREthFixture, createFixtureLoader } = require("../_fixture");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { setERC20TokenBalance } = require("../_fund");

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

    // Fund attacking contract with WETH and rETH
    await setERC20TokenBalance(cEvilContract.address, weth, "1000000", hre);
    await setERC20TokenBalance(cEvilContract.address, reth, "1000000", hre);

    // Do Evil Stuff
    await expect(cEvilContract.doEvilStuff()).to.be.reverted;
  });
});
