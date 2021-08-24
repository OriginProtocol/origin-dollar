const { expect } = require("chai");
const { defaultFixture } = require("./_fixture");
const {
  isFork,
  loadFixture,
  advanceTime,
  propose,
  proposeAndExecute,
} = require("./helpers");

const DAY = 24 * 60 * 60;
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

describe("Governor's Timelock controls oracleRouter", function () {
  let oracle, governor, governorContract, fixture, proposalId, anna;

  before(async () => {
    fixture = await loadFixture(defaultFixture);
    oracle = fixture.oracleRouter;
    governor = fixture.governor;
    governorContract = fixture.governorContract;
    anna = fixture.anna;
  });

  if (isFork) {
    this.timeout(0);
  }

  it("Should add the transaction to the queue", async () => {
    const args = [
      {
        contract: oracle,
        signature: "setFeed(address,address)",
        args: [WETH, WETH],
      },
    ];
    proposalId = await propose(fixture, args, "Set Feed");
    await governorContract.connect(governor).queue(proposalId);
  });

  it("Should not be able to execute the transaction before the delay", async () => {
    const tx = governorContract.connect(governor).execute(proposalId);
    await expect(tx).to.be.reverted;
  });

  it("Non-admin should not be able to execute the transaction after delayy", async () => {
    const tx = governorContract.connect(anna).execute(proposalId);
    await expect(tx).to.be.reverted;
  });

  it("Admin should be able to execute the transaction after two days", async () => {
    await advanceTime(2.2 * DAY);
    await governorContract.connect(governor).execute(proposalId);
  });

  it("Should have changed the oracle price", async () => {
    expect(await oracle.assetToFeed(WETH)).to.eq(WETH);
  });
});

describe("Governor can instantly pause deposits", () => {
  let vault, governor, governorContract, anna;

  before(async () => {
    const fixture = await loadFixture(defaultFixture);
    vault = fixture.vault;
    governor = fixture.governor;
    governorContract = fixture.governorContract;
    anna = fixture.anna;

    // Transfer Vault's governance to the Governor contract.
    await vault.connect(governor).transferGovernance(governorContract.address);
    const args = [
      {
        contract: vault,
        signature: "claimGovernance()",
      },
    ];
    await proposeAndExecute(fixture, args, "Claim vault governance");
  });

  it("Should allow pausing deposits immediately", async () => {
    await governorContract.connect(governor).unpauseCapital(vault.address);
    await governorContract.connect(governor).pauseCapital(vault.address);
    expect(await vault.capitalPaused()).to.be.true;
  });

  it("Should allow unpausing deposits immediately", async () => {
    await governorContract.connect(governor).pauseCapital(vault.address);
    await governorContract.connect(governor).unpauseCapital(vault.address);
    expect(await vault.capitalPaused()).to.be.false;
  });

  it("Should not allow a non-admin to pause deposits", async () => {
    await expect(
      governorContract.connect(anna).pauseCapital(vault.address)
    ).to.be.revertedWith("Timelock::pauseCapital: Call must come from admin.");
  });

  it("Should not allow a non-admin to unpause deposits", async () => {
    await expect(
      governorContract.connect(anna).unpauseCapital(vault.address)
    ).to.be.revertedWith(
      "Timelock::unpauseCapital: Call must come from admin."
    );
  });
});
