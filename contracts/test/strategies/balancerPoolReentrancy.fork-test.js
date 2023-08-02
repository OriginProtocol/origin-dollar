const hre = require("hardhat");
const { ethers } = hre;
const { expect } = require("chai");
const { forkOnlyDescribe } = require("../helpers");
const {
  defaultFixtureSetup,
  balancerREthFixtureSetup,
  mintWETH,
  impersonateAndFundContract,
} = require("../_fixture");
const { deployWithConfirmation } = require("../../utils/deploy");
const { utils } = require("ethers");
const { findBestMainnetTokenHolder } = require("../../utils/funding");
const addresses = require("../../utils/addresses");

const balancerREthFixture = balancerREthFixtureSetup({
  defaultStrategy: true,
});

forkOnlyDescribe(
  "ForkTest: Balancer MetaStablePool - Read-only Reentrancy",
  function () {
    this.timeout(0);

    after(async () => {
      // This is needed to revert fixtures
      // The other tests as of now don't use proper fixtures
      // Rel: https://github.com/OriginProtocol/origin-dollar/issues/1259
      const f = defaultFixtureSetup();
      await f();
    });

    it.only("Should not allow read-only reentrancy", async () => {
      const { weth, reth, oethVault, rEthBPT, balancerREthPID, daniel } =
        await balancerREthFixture();

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
      await reth
        .connect(rethHolder)
        .transfer(cEvilContract.address, utils.parseEther("1000"));

      // Do Evil Stuff
      await expect(cEvilContract.doEvilStuff()).to.be.reverted;
    });
  }
);
