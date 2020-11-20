const { expect } = require("chai");
const { defaultFixture } = require("./_fixture");
const { loadFixture, advanceTime } = require("./helpers");
const { proposeArgs } = require("../utils/governor");

async function propose(fixture, governorArgsArray, description) {
  const { testGovernorContract, anna } = fixture;
  const lastProposalId = await testGovernorContract.proposalCount();
  await testGovernorContract
    .connect(anna)
    .propose(...(await proposeArgs(governorArgsArray)), description);
  const proposalId = await testGovernorContract.proposalCount();
  expect(proposalId).not.to.be.equal(lastProposalId);
  return proposalId;
}

async function proposeAndExecute(fixture, governorArgsArray, description) {
  const { testGovernorContract, governor, anna } = fixture;
  const proposalId = await propose(fixture, governorArgsArray, description);
  await testGovernorContract.connect(governor).queue(proposalId);
  // go forward a minute and a second
  advanceTime(3 * 24 * 60 * 60);
  await testGovernorContract.connect(anna).execute(proposalId);
}

describe("Can claim governance with Governor contract and govern", () => {
  it.only("Can claim governance and call governance methods", async () => {
    const fixture = await loadFixture(defaultFixture);
    const { minuteTimelock, vault, governor } = fixture;

    //transfer governance
    await vault.connect(governor).transferGovernance(minuteTimelock.address);

    await proposeAndExecute(
      fixture,
      [
        {
          contract: vault,
          signature: "claimGovernance()",
        },
        {
          contract: vault,
          signature: "pauseDeposits()",
        },
        {
          contract: vault,
          signature: "setRedeemFeeBps(uint256)",
          args: [69],
        },
      ],
      "Accept admin for the vault and set pauseDeposits and Redeem!"
    );

    expect(await vault.depositPaused()).to.be.true;
    expect(await vault.redeemFeeBps()).to.be.equal(69);
  });

  it("Can claim governance and call governance methods in multiple calls", async () => {
    const fixture = await loadFixture(defaultFixture);
    const { minuteTimelock, vault, governor } = fixture;

    //transfer governance
    await vault.connect(governor).transferGovernance(minuteTimelock.address);

    await proposeAndExecute(
      fixture,
      [
        {
          contract: vault,
          signature: "claimGovernance()",
        },
        {
          contract: vault,
          signature: "pauseDeposits()",
        },
      ],
      "Accept admin for the vault and set pauseDeposits"
    );
    await proposeAndExecute(
      fixture,
      [
        {
          contract: vault,
          signature: "setRedeemFeeBps(uint256)",
          args: [69],
        },
      ],
      "Set Redeem!"
    );

    expect(await vault.depositPaused()).to.be.true;
    expect(await vault.redeemFeeBps()).to.be.equal(69);
  });

  it("Should not allow anyone else to propose and queue", async () => {
    const fixture = await loadFixture(defaultFixture);
    const { minuteTimelock, testGovernorContract, vault, governor, anna } = fixture;

    await vault.connect(governor).transferGovernance(minuteTimelock.address);

    const governorArgsArray = [
      { contract: vault, signature: "claimGovernance()" },
    ];
    testGovernorContract
      .connect(anna)
      .propose(
        ...(await proposeArgs(governorArgsArray)),
        "Should fail to claim governance"
      );
    const proposalId = await testGovernorContract.proposalCount();
    // this should except
    await expect(
      testGovernorContract.connect(anna).queue(proposalId)
    ).to.be.revertedWith("Caller is not the guardian");
  });

  it("Should be able to do one call to rule them all[Push simulation here]", async () => {
    const fixture = await loadFixture(defaultFixture);
    const {
      minuteTimelock,
      compoundStrategy,
      viewVault,
      vault,
      governor,
      ousd,
      rebaseHooks,
    } = fixture;

    // Transfer everyone to the minuteTimelock
    await vault.connect(governor).transferGovernance(minuteTimelock.address);
    await ousd.connect(governor).transferGovernance(minuteTimelock.address);
    await compoundStrategy
      .connect(governor)
      .transferGovernance(minuteTimelock.address);

    const cVaultProxy = await ethers.getContract("VaultProxy");
    // We are using MockVault here, because VaultCore is already deployed but this won't be the case on live(first time)
    const cMockVault = await ethers.getContract("MockVault");
    const cVaultAdmin = await ethers.getContract("VaultAdmin");
    const cCallableMockVault = await ethers.getContractAt(
      "MockVault",
      cVaultProxy.address
    );
    const cVaultCore = await ethers.getContractAt(
      "VaultCore",
      cVaultProxy.address
    );

    // One call to accept governance, upgrade code, setImpl, setRebaseHooks
    //
    await proposeAndExecute(
      fixture,
      [
        {
          contract: vault,
          signature: "claimGovernance()",
        },
        {
          contract: ousd,
          signature: "claimGovernance()",
        },
        {
          contract: compoundStrategy,
          signature: "claimGovernance()",
        },
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [cMockVault.address], // Do not use MockVault on live deploy!
        },
        {
          // This is test that Mock vault upgrade works! do not do this call on live
          // this call will not work if the proxy hasn't been upgradedTo MockVault
          contract: cCallableMockVault,
          signature: "setTotalValue(uint256)",
          args: [54],
        },
        {
          // This is needed on live, but does nothing here because we already did it
          contract: cVaultCore,
          signature: "setAdminImpl(address)",
          args: [cVaultAdmin.address],
        },
        {
          contract: vault,
          signature: "setRebaseHooksAddr(address)",
          args: [rebaseHooks.address],
        },
      ],
      "Accept all governance and upgrade code + intiail deploy"
    );

    expect(
      await (await ethers.getContractAt("Governable", vault.address)).governor()
    ).to.be.equal(minuteTimelock.address);
    expect(
      await (await ethers.getContractAt("Governable", ousd.address)).governor()
    ).to.be.equal(minuteTimelock.address);
    expect(
      await (
        await ethers.getContractAt("Governable", compoundStrategy.address)
      ).governor()
    ).to.be.equal(minuteTimelock.address);
    expect(await viewVault.totalValue()).to.be.equal(54);
  });

  it("Should be able transfer governance", async () => {
    const fixture = await loadFixture(defaultFixture);
    const { minuteTimelock, vault, governor } = fixture;

    await vault.connect(governor).transferGovernance(minuteTimelock.address);

    await proposeAndExecute(
      fixture,
      [
        {
          contract: vault,
          signature: "claimGovernance()",
        },
      ],
      "Accept admin for the vault"
    );

    // verify that the govenor is the minuteTimelock
    expect(
      await (await ethers.getContractAt("Governable", vault.address)).governor()
    ).to.be.equal(minuteTimelock.address);

    await proposeAndExecute(
      fixture,
      [
        {
          contract: vault,
          signature: "transferGovernance(address)",
          args: [governor.address],
        },
      ],
      "Accept admin for the vault"
    );

    await vault.connect(governor).claimGovernance();

    // verify that we transfer the governance back
    expect(
      await (await ethers.getContractAt("Governable", vault.address)).governor()
    ).to.be.equal(governor.address);
  });

  it("Can cancel queued and pending transactions", async () => {
    const fixture = await loadFixture(defaultFixture);
    const { minuteTimelock, vault, governor, testGovernorContract } = fixture;

    //transfer governance
    await vault.connect(governor).transferGovernance(minuteTimelock.address);

    const proposalId = await propose(
      fixture,
      [
        {
          contract: vault,
          signature: "claimGovernance()",
        },
      ],
      "Accept admin for the vault"
    );

    const tx = await testGovernorContract.connect(governor).cancel(proposalId);
    const events = (await tx.wait()).events || [];
    const cancelEvent = events.find((e) => e.event === "ProposalCancelled");

    expect(cancelEvent).to.not.be.undefined;

    // Expired = 2 in ProposalState enum
    expect(await testGovernorContract.connect(governor).state(proposalId)).to.equal(
      2
    );
  });

  it("Should not allow cancelled events to be queued/executed", async () => {
    const fixture = await loadFixture(defaultFixture);
    const { minuteTimelock, vault, governor, testGovernorContract, anna } = fixture;

    //transfer governance
    await vault.connect(governor).transferGovernance(minuteTimelock.address);

    const proposalId = await propose(
      fixture,
      [
        {
          contract: vault,
          signature: "claimGovernance()",
        },
        {
          contract: vault,
          signature: "pauseDeposits()",
        },
        {
          contract: vault,
          signature: "setRedeemFeeBps(uint256)",
          args: [69],
        },
      ],
      "Accept admin for the vault and set pauseDeposits and Redeem!"
    );

    const tx = await testGovernorContract.connect(governor).cancel(proposalId);
    const events = (await tx.wait()).events || [];
    const cancelEvent = events.find((e) => e.event === "ProposalCancelled");

    expect(cancelEvent).to.not.be.undefined;

    // Expired = 2 in ProposalState enum
    expect(await testGovernorContract.connect(governor).state(proposalId)).to.equal(
      2
    );

    expect(
      testGovernorContract.connect(governor).queue(proposalId)
    ).to.be.revertedWith(
      "Governor::queue: proposal can only be queued if it is pending"
    );
  });

  it("Should not allow proposing setPendingAdmin tx", async () => {
    const fixture = await loadFixture(defaultFixture);
    const { minuteTimelock, vault, governor, testGovernorContract, anna } = fixture;

    //transfer governance
    await vault.connect(governor).transferGovernance(minuteTimelock.address);

    expect(
      testGovernorContract.connect(anna).propose(
        ...(await proposeArgs([
          {
            contract: vault,
            signature: "claimGovernance()",
          },
          {
            contract: minuteTimelock,
            signature: "setPendingAdmin(address)",
            args: [anna.getAddress()],
          },
        ])),
        "Accept admin for the vault and set pendingAdmin!"
      )
    ).to.be.revertedWith(
      "Governor::propose: setPendingAdmin transaction cannot be proposed or queued"
    );
  });
});
