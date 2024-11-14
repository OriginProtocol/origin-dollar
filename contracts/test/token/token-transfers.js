const { expect } = require("chai");
const { loadTokenTransferFixture } = require("../_fixture");

const { isFork } = require("../helpers");

describe.only("Token Transfers", function () {
  if (isFork) {
    this.timeout(0);
  }
  let fixture;
  beforeEach(async () => {
    fixture = await loadTokenTransferFixture();
  });

  it("Accounts should have correct initial states", async () => {
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
      ousd
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
  });
});
