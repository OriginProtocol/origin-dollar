const { expect } = require("chai");
const { loadTokenTransferFixture } = require("../_fixture");

const { isFork, ousdUnits} = require("../helpers");

describe("Token Transfers", function () {
  if (isFork) {
    this.timeout(0);
  }
  let fixture;
  beforeEach(async () => {
    fixture = await loadTokenTransferFixture();
  });

  it("Accounts and ousd contract should have correct initial states", async () => {
    const {
      rebase_eoa_notset_0,
      rebase_eoa_notset_1,
      rebase_eoa_stdRebasing_0,
      rebase_eoa_stdRebasing_1,
      rebase_contract_0,
      rebase_contract_1,
      nonrebase_eoa_0,
      nonrebase_eoa_1,
      nonrebase_cotract_0,
      nonrebase_cotract_1,
      nonrebase_cotract_notSet_0,
      nonrebase_cotract_notSet_1,
      nonrebase_cotract_notSet_altcpt_gt_0,
      nonrebase_cotract_notSet_altcpt_gt_1,
      rebase_source_0,
      rebase_source_1,
      rebase_target_0,
      rebase_target_1,
      ousd,
    } = fixture;
    
    expect(await ousd.rebaseState(rebase_eoa_notset_0.address)).to.equal(0); // rebaseState:NotSet
    await expect(rebase_eoa_notset_0).has.a.balanceOf("11", ousd);
    expect(await ousd.rebaseState(rebase_eoa_notset_1.address)).to.equal(0); // rebaseState:NotSet
    await expect(rebase_eoa_notset_1).has.a.balanceOf("12", ousd);

    expect(await ousd.rebaseState(rebase_eoa_stdRebasing_0.address)).to.equal(2); // rebaseState:StdRebasing
    await expect(rebase_eoa_stdRebasing_0).has.a.balanceOf("21", ousd);
    expect(await ousd.rebaseState(rebase_eoa_stdRebasing_1.address)).to.equal(2); // rebaseState:StdRebasing
    await expect(rebase_eoa_stdRebasing_1).has.a.balanceOf("22", ousd);

    expect(await ousd.rebaseState(rebase_contract_0.address)).to.equal(2); // rebaseState:StdRebasing
    await expect(rebase_contract_0).has.a.balanceOf("33", ousd);
    expect(await ousd.rebaseState(rebase_contract_1.address)).to.equal(2); // rebaseState:StdRebasing
    await expect(rebase_contract_1).has.a.balanceOf("34", ousd);

    expect(await ousd.rebaseState(nonrebase_eoa_0.address)).to.equal(1); // rebaseState:StdNonRebasing
    await expect(nonrebase_eoa_0).has.a.balanceOf("44", ousd);
    expect(await ousd.rebaseState(nonrebase_eoa_1.address)).to.equal(1); // rebaseState:StdNonRebasing
    await expect(nonrebase_eoa_1).has.a.balanceOf("45", ousd);

    expect(await ousd.rebaseState(nonrebase_cotract_0.address)).to.equal(1); // rebaseState:StdNonRebasing
    await expect(nonrebase_cotract_0).has.a.balanceOf("55", ousd);
    expect(await ousd.rebaseState(nonrebase_cotract_1.address)).to.equal(1); // rebaseState:StdNonRebasing
    await expect(nonrebase_cotract_1).has.a.balanceOf("56", ousd);

    expect(await ousd.rebaseState(nonrebase_cotract_notSet_0.address)).to.equal(0); // rebaseState:NotSet
    await expect(nonrebase_cotract_notSet_0).has.a.balanceOf("0", ousd);
    expect(await ousd.rebaseState(nonrebase_cotract_notSet_1.address)).to.equal(0); // rebaseState:NotSet
    await expect(nonrebase_cotract_notSet_1).has.a.balanceOf("0", ousd);

    expect(await ousd.rebaseState(nonrebase_cotract_notSet_altcpt_gt_0.address)).to.equal(0); // rebaseState:NotSet
    await expect(nonrebase_cotract_notSet_altcpt_gt_0).has.a.balanceOf("65", ousd);
    expect(await ousd.rebaseState(nonrebase_cotract_notSet_altcpt_gt_1.address)).to.equal(0); // rebaseState:NotSet
    await expect(nonrebase_cotract_notSet_altcpt_gt_1).has.a.balanceOf("66", ousd);

    expect(await ousd.rebaseState(rebase_source_0.address)).to.equal(3); // rebaseState:YieldDelegationSource
    await expect(rebase_source_0).has.a.balanceOf("76", ousd);
    expect(await ousd.rebaseState(rebase_source_1.address)).to.equal(3); // rebaseState:YieldDelegationSource
    await expect(rebase_source_1).has.a.balanceOf("87", ousd);

    expect(await ousd.rebaseState(rebase_target_0.address)).to.equal(4); // rebaseState:YieldDelegationTarget
    await expect(rebase_target_0).has.a.balanceOf("77", ousd);
    expect(await ousd.rebaseState(rebase_target_1.address)).to.equal(4); // rebaseState:YieldDelegationTarget
    await expect(rebase_target_1).has.a.balanceOf("88", ousd);

    const totalSupply = 11 + 12 + 21 + 22 + 33 + 34 + 44 + 45 + 55 + 56 + 65 + 66 + 76 + 87 + 77 + 88;
    const nonRebasingSupply = 44 + 45 + 55 + 56 + 65 + 66;
    expect(await ousd.totalSupply()).to.equal(ousdUnits(`${totalSupply}`));
    expect(await ousd.nonRebasingSupply()).to.equal(ousdUnits(`${nonRebasingSupply}`));
  });

  const fromAccounts = [
    {name: "rebase_eoa_notset_0", affectsRebasingCredits: true, isContract: false},
    {name: "rebase_eoa_stdRebasing_0", affectsRebasingCredits: true, isContract: false},
    {name: "rebase_contract_0", affectsRebasingCredits: true, isContract: true},
    {name: "nonrebase_eoa_0", affectsRebasingCredits: false, isContract: false},
    {name: "nonrebase_cotract_0", affectsRebasingCredits: false, isContract: true},
    // can not initiate a transfer from below contract since it has the balance of 0
    //{name: "nonrebase_cotract_notSet_0", affectsRebasingCredits: false, isContract: true},
    {name: "nonrebase_cotract_notSet_altcpt_gt_0", affectsRebasingCredits: false, isContract: true},
    {name: "rebase_source_0", affectsRebasingCredits: true, isContract: false},
    {name: "rebase_target_0", affectsRebasingCredits: true, isContract: false},
  ];

  const toAccounts = [
    {name: "rebase_eoa_notset_1", affectsRebasingCredits: true},
    {name: "rebase_eoa_stdRebasing_1", affectsRebasingCredits: true},
    {name: "rebase_contract_1", affectsRebasingCredits: true},
    {name: "nonrebase_eoa_1", affectsRebasingCredits: false},
    {name: "nonrebase_cotract_1", affectsRebasingCredits: false},
    {name: "nonrebase_cotract_notSet_1", affectsRebasingCredits: false},
    {name: "nonrebase_cotract_notSet_altcpt_gt_1", affectsRebasingCredits: false},
    {name: "rebase_source_1", affectsRebasingCredits: true},
    {name: "rebase_target_1", affectsRebasingCredits: true},
  ];

  const totalSupply = ousdUnits("792");
  const nonRebasingSupply = ousdUnits("331");
  for (let i = 0; i < fromAccounts.length; i++) {
    for (let j = 0; j < toAccounts.length; j++) {
      const {name: fromName, affectsRebasingCredits: fromAffectsRC, isContract } = fromAccounts[i];
      const {name: toName, affectsRebasingCredits: toAffectsRC } = toAccounts[j];

      it(`Should transfer from ${fromName} to ${toName}`, async () => {
        const fromAccount = fixture[fromName];
        const toAccount = fixture[toName];
        const { ousd } = fixture;

        const fromBalance = await ousd.balanceOf(fromAccount.address);
        const toBalance = await ousd.balanceOf(toAccount.address);
        // Random transfer between 2-8
        const amount = ousdUnits(`${2 + Math.random() * 6}`);

        if (isContract) {
          await fromAccount.transfer(toAccount.address, amount);
        } else {
          await ousd.connect(fromAccount).transfer(toAccount.address, amount);
        }

        // check balances
        await expect(await ousd.balanceOf(fromAccount.address)).to.equal(fromBalance.sub(amount));
        await expect(await ousd.balanceOf(toAccount.address)).to.equal(toBalance.add(amount));

        let expectedNonRebasingSupply = nonRebasingSupply;
        if (!fromAffectsRC) {
          expectedNonRebasingSupply = expectedNonRebasingSupply.sub(amount);
        }
        if (!toAffectsRC) {
          expectedNonRebasingSupply = expectedNonRebasingSupply.add(amount);
        }
        // check global contract (in)variants
        await expect(await ousd.totalSupply()).to.equal(totalSupply);
        await expect(await ousd.nonRebasingSupply()).to.equal(expectedNonRebasingSupply);
      });
    }
  }
});
