const { expect } = require("chai");
const { isCI } = require("../../helpers");
const { createFixtureLoader, crossChainFixtureUnit } = require("../../_fixture");
const {
  units
} = require("../../helpers");

const loadFixture = createFixtureLoader(crossChainFixtureUnit);

describe.only("ForkTest: CrossChainRemoteStrategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture,
    josh,
    governor,
    usdc,
    crossChainRemoteStrategy,
    crossChainMasterStrategy,
    vault;
  beforeEach(async () => {
    fixture = await loadFixture();
    josh = fixture.josh;
    governor = fixture.governor;
    usdc = fixture.usdc;
    crossChainRemoteStrategy = fixture.crossChainRemoteStrategy;
    crossChainMasterStrategy = fixture.crossChainMasterStrategy;
    vault = fixture.vault;
  });
  
  const mint = async (amount) => {
    await usdc
      .connect(josh)
      .approve(vault.address, await units(amount, usdc));
    await vault
      .connect(josh)
      .mint(usdc.address, await units(amount, usdc), 0);
  };

  const depositToMasterStrategy = async (amount) => {
    await vault
      .connect(governor)
      .depositToStrategy(
        crossChainMasterStrategy.address,
        [usdc.address],
        [await units(amount, usdc)]
      );
  };

  it("Should initiate a bridge of deposited USDC", async function () {
    const { messageTransmitter } = fixture;
    const amount = "1000";

    await mint(amount);
    await depositToMasterStrategy(amount);
    await expect(await messageTransmitter.messagesInQueue()).to.eq(1);
    await expect(await crossChainRemoteStrategy.checkBalance(usdc.address)).to.eq(0);
    // Simulate off chain component to process a message
    //emit Deposit(_asset, address(shareToken), _amount);
    await expect(messageTransmitter.processFront()).to.emit(crossChainRemoteStrategy, "Deposit");

    await expect(await crossChainRemoteStrategy.checkBalance(usdc.address)).to.eq(await units(amount, usdc));
  });
});
