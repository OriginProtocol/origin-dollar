const { expect } = require("chai");
const { defaultFixture } = require("./_fixture");
const {
  isGanacheFork,
  oracleUnits,
  loadFixture,
  advanceTime,
} = require("./helpers");

const DAY = 24 * 60 * 60;

async function governorArgs({ contract, value = 0, signature, args=[]}) {
  const method = signature.split("(")[0];
  const tx = await contract.populateTransaction[method](...args);
  const data = "0x" + tx.data.slice(10) ;
  return [tx.to, value, signature, data];
}


async function proposeArgs(governorArgsArray) {
  const targets=[], values=[], sigs=[], datas=[];
  for (g of governorArgsArray) {
    const [t, v, s, d] = await governorArgs(g);
    targets.push(t);
    values.push(v);
    sigs.push(s);
    datas.push(d);
  }
  return [targets, values, sigs, datas];
}

async function proposeAndExecute(fixture, governorArgsArray, description) {
  const {governorContract, governor, anna} = fixture;
  const lastProposalId = governorContract.proposalCount();
  await governorContract.connect(governor).proposeAndQueue(...await proposeArgs(governorArgsArray), description);
  const proposalId = governorContract.proposalCount();
  expect(proposalId).not.to.be.equal(lastProposalId);
  // go forward a minute and a second
  advanceTime(61);
  await governorContract.connect(anna).execute(proposalId);
}


describe("Can claim governance with Governor contract and govern", () => {

  it("Can claim governance and call governance methods", async () => {
    const fixture = await loadFixture(defaultFixture);
    const {minuteTimelock, governorContract, vault, governor} = fixture;
    
    //transfer governance
    await vault.connect(governor).transferGovernance(minuteTimelock.address);

    await proposeAndExecute(fixture,  [ { 
          contract:vault, 
          signature:"claimGovernance()"
        },
        {
          contract:vault,
          signature:"pauseDeposits()"
        },
        {
          contract:vault,
          signature:"setRedeemFeeBps(uint256)",
          args:[69]
        }], "Accept admin for the vault and set pauseDeposits and Redeem!");

    expect(await vault.depositPaused()).to.be.true;
    expect(await vault.redeemFeeBps()).to.be.equal(69);
  });

  it("Can claim governance and call governance methods in multiple calls", async () => {
    const fixture = await loadFixture(defaultFixture);
    const {minuteTimelock, governorContract, vault, governor} = fixture;

    //transfer governance
    await vault.connect(governor).transferGovernance(minuteTimelock.address);

    await proposeAndExecute(fixture,  [ {
          contract:vault,
          signature:"claimGovernance()"
        },
        {
          contract:vault,
          signature:"pauseDeposits()"
        }], "Accept admin for the vault and set pauseDeposits");
    await proposeAndExecute(fixture,  [ {
          contract:vault,
          signature:"setRedeemFeeBps(uint256)",
          args:[69]
        }], "Set Redeem!");

    expect(await vault.depositPaused()).to.be.true;
    expect(await vault.redeemFeeBps()).to.be.equal(69);
  });

  it("Should not allow anyone else to propose and queue", async () => {
      const fixture = await loadFixture(defaultFixture);
      const {minuteTimelock, governorContract, vault, governor, anna} = fixture;
 
      await vault.connect(governor).transferGovernance(minuteTimelock.address);

      const governorArgsArray = [ { contract:vault,
        signature:"claimGovernance()" } ];
      // this should except
      await expect(governorContract.connect(anna).proposeAndQueue(...await proposeArgs(governorArgsArray), "Should fail to claim governance")).to.be.revertedWith("Governor::proposeAndQueue: sender must be gov guardian");
  });

  it("Should be able to do one call to rule them all[Push simulation here]", async () => {
    const fixture = await loadFixture(defaultFixture);
    const {minuteTimelock, governorContract, compoundStrategy, viewVault,
      mixOracle, vault, governor, ousd, rebaseHooks } = fixture;

    // Transfer everyone to the minuteTimelock
    await vault.connect(governor).transferGovernance(minuteTimelock.address);
    await ousd.connect(governor).transferGovernance(minuteTimelock.address);
    await compoundStrategy.connect(governor).transferGovernance(minuteTimelock.address);

    const cVaultProxy = await ethers.getContract("VaultProxy");
    // We are using MockVault here, because VaultCore is already deployed but this won't be the case on live(first time)
    const cMockVault = await ethers.getContract("MockVault");
    const cVaultAdmin = await ethers.getContract("VaultAdmin");
    const cCallableMockVault = await ethers.getContractAt("MockVault", cVaultProxy.address);
    const cVaultCore = await ethers.getContractAt("VaultCore", cVaultProxy.address);

    // One call to accept governance, upgrade code, setImpl, setRebaseHooks
    //
    await proposeAndExecute(fixture,  [ { 
          contract:vault, 
          signature:"claimGovernance()"
        },
        { 
          contract:ousd, 
          signature:"claimGovernance()"
        },
        { 
          contract:compoundStrategy, 
          signature:"claimGovernance()"
        },
        {
          contract:cVaultProxy,
          signature:"upgradeTo(address)",
          args:[cMockVault.address]  // Do not use MockVault on live deploy!
        },
        {  // This is test that Mock vault upgrade works! do not do this call on live
           // this call will not work if the proxy hasn't been upgradedTo MockVault
          contract:cCallableMockVault,
          signature:"setTotalValue(uint256)",
          args:[54]
        },
        { // This is needed on live, but does nothing here because we already did it
          contract:cVaultCore,
          signature:"setAdminImpl(address)",
          args:[cVaultAdmin.address]
        },
        {
          contract:vault,
          signature:"setRebaseHooksAddr(address)",
          args:[rebaseHooks.address]
        }], "Accept all governance and upgrade code + intiail deploy");

    expect(await (await ethers.getContractAt("Governable", vault.address)).governor()).to.be.equal(minuteTimelock.address);
    expect(await (await ethers.getContractAt("Governable", ousd.address)).governor()).to.be.equal(minuteTimelock.address);
    expect(await (await ethers.getContractAt("Governable", compoundStrategy.address)).governor()).to.be.equal(minuteTimelock.address);
    expect(await viewVault.totalValue()).to.be.equal(54);
  });


  it("Should be able transfer governance", async () => {
    const fixture = await loadFixture(defaultFixture);
    const {minuteTimelock, governorContract, vault, governor} = fixture;

    //transfer governance
    await vault.connect(governor).transferGovernance(minuteTimelock.address);

    await proposeAndExecute(fixture,  [ {
          contract:vault,
          signature:"claimGovernance()"
        } ], "Accept admin for the vault");

    // verify that the govenor is the minuteTimelock
    expect(await (await ethers.getContractAt("Governable", vault.address)).governor()).to.be.equal(minuteTimelock.address);

    await proposeAndExecute(fixture,  [ {
          contract:vault,
          signature:"transferGovernance(address)",
          args:[governor._address]
        } ], "Accept admin for the vault");

    await vault.connect(governor).claimGovernance();

    // verify that we transfer the governance back
    expect(await (await ethers.getContractAt("Governable", vault.address)).governor()).to.be.equal(governor._address);
  });
});
