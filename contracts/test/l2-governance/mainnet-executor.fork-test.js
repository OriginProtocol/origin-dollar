const addresses = require("../../utils/addresses");
const { CCIPChainSelectors } = require("../../utils/constants");
const { createFixtureLoader, defaultFixture } = require("../_fixture");
const { fundAccount } = require("../helpers");
const { expect } = require("chai");

const loadFixture = createFixtureLoader(defaultFixture);

describe("Mainnet Governance Executor", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();

    // Send some ETH to the executor
    await fundAccount(fixture.mainnetGovernanceExecutor.address);
  });

  it("Should forward commands to CCIPRouter from Governance", async () => {
    const { mainnetGovernanceExecutor, timelock } = fixture;

    await mainnetGovernanceExecutor
      .connect(timelock)
      .queueL2Proposal(CCIPChainSelectors.ArbitrumOne, 1, 0);
  });

  it("Should revert on Invalid command selector", async () => {
    const { mainnetGovernanceExecutor, timelock } = fixture;

    const tx = mainnetGovernanceExecutor
      .connect(timelock)
      .sendCommandToL2("0x0100", CCIPChainSelectors.ArbitrumOne, 1, 0);

    await expect(tx).to.be.revertedWith("InvalidGovernanceCommand");
  });

  it("Should revert if sent to unconfigured chain", async () => {
    const { mainnetGovernanceExecutor, timelock } = fixture;

    const tx = mainnetGovernanceExecutor
      .connect(timelock)
      .cancelL2Proposal(123, 1, 0);

    await expect(tx).to.be.revertedWith("UnsupportedChain");
  });

  it("Should revert if there isn't enough balance to cover for fees", async () => {
    const { mainnetGovernanceExecutor, timelock } = fixture;

    await fundAccount(mainnetGovernanceExecutor.address, "0.0000001");

    const tx = mainnetGovernanceExecutor
      .connect(timelock)
      .queueL2Proposal(CCIPChainSelectors.ArbitrumOne, 1, 0);

    await expect(tx).to.be.revertedWith("InsufficientBalanceForFees");
  });

  it("Should not allow anyone (other than Governance) to send commands", async () => {
    const { mainnetGovernanceExecutor, governor, strategist, domen, daniel } =
      fixture;

    for (const signer of [governor, strategist, domen, daniel]) {
      await expect(
        mainnetGovernanceExecutor
          .connect(signer)
          .queueL2Proposal(CCIPChainSelectors.ArbitrumOne, 1, 0)
      ).to.be.revertedWith("Caller is not the Governor");
    }
  });

  it("Should allow governance to add chain config", async () => {
    const { mainnetGovernanceExecutor, timelock } = fixture;

    // Pretend timelock is L2 Governance
    await mainnetGovernanceExecutor
      .connect(timelock)
      .addChainConfig(1010, addresses.dead);

    const config = await mainnetGovernanceExecutor.chainConfig(1010);

    expect(config.isSupported).to.be.true;
    expect(config.l2Governance).to.eq(addresses.dead);
  });

  it("Should not allow anyone else to add chain config", async () => {
    const { mainnetGovernanceExecutor, governor, strategist, domen, daniel } =
      fixture;

    for (const signer of [governor, strategist, domen, daniel]) {
      await expect(
        mainnetGovernanceExecutor
          .connect(signer)
          .addChainConfig(1012, addresses.dead)
      ).to.be.revertedWith("Caller is not the Governor");
    }
  });

  it("Should not allow misconfiguration", async () => {
    const { mainnetGovernanceExecutor, timelock } = fixture;

    const tx = mainnetGovernanceExecutor
      .connect(timelock)
      .addChainConfig(1011, addresses.zero);

    await expect(tx).to.be.revertedWith("InvalidGovernanceAddress");
  });

  it("Should fail if already supported", async () => {
    const { mainnetGovernanceExecutor, timelock } = fixture;

    const tx = mainnetGovernanceExecutor
      .connect(timelock)
      .addChainConfig(CCIPChainSelectors.ArbitrumOne, addresses.dead);

    await expect(tx).to.be.revertedWith("DuplicateChainConfig");
  });

  it("Should allow governance to remove chain config", async () => {
    const { mainnetGovernanceExecutor, timelock } = fixture;

    // Pretend timelock is L2 Governance
    await mainnetGovernanceExecutor
      .connect(timelock)
      .removeChainConfig(CCIPChainSelectors.ArbitrumOne);

    const config = await mainnetGovernanceExecutor.chainConfig(1010);

    expect(config.isSupported).to.be.false;
    expect(config.l2Governance).to.eq(addresses.zero);
  });

  it("Should not allow anyone else to remove chain config", async () => {
    const { mainnetGovernanceExecutor, governor, strategist, domen, daniel } =
      fixture;

    for (const signer of [governor, strategist, domen, daniel]) {
      await expect(
        mainnetGovernanceExecutor
          .connect(signer)
          .removeChainConfig(CCIPChainSelectors.ArbitrumOne)
      ).to.be.revertedWith("Caller is not the Governor");
    }
  });
  it("Should fail for unsupported chain config", async () => {
    const { mainnetGovernanceExecutor, timelock } = fixture;

    const tx = mainnetGovernanceExecutor.connect(timelock).removeChainConfig(1);

    await expect(tx).to.be.revertedWith("UnsupportedChain");
  });
});
