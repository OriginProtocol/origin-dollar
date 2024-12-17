const { createFixtureLoader } = require("../_fixture");
const {
  defaultBaseFixture,
  MINTER_ROLE,
  BURNER_ROLE,
} = require("../_fixture-base");
const { expect } = require("chai");
const { oethUnits } = require("../helpers");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("ForkTest: Bridged wOETH (Base)", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await baseFixture();
  });

  it("Should have right config", async () => {
    const { woeth } = fixture;

    expect(await woeth.decimals()).to.equal(18);
    expect(await woeth.symbol()).to.equal("wOETH");
    expect(await woeth.name()).to.equal("Wrapped OETH");
  });

  it("Should allow minter to mint", async () => {
    const { woeth, minter, rafael } = fixture;

    const totalSupplyBefore = await woeth.totalSupply();
    const balanceBefore = await woeth.balanceOf(rafael.address);

    await woeth.connect(minter).mint(rafael.address, oethUnits("1.2344"));

    const totalSupplyDiff = (await woeth.totalSupply()).sub(totalSupplyBefore);
    const balanceDiff = (await woeth.balanceOf(rafael.address)).sub(
      balanceBefore
    );

    expect(totalSupplyDiff).to.equal(oethUnits("1.2344"));
    expect(balanceDiff).to.equal(oethUnits("1.2344"));
  });

  it("Should not allow anyone else to mint", async () => {
    const { woeth, governor, rafael, nick, burner } = fixture;

    for (const signer of [governor, rafael, nick, burner]) {
      await expect(
        woeth.connect(signer).mint(signer.address, oethUnits("1"))
      ).to.be.revertedWith(
        `AccessControl: account ${signer.address.toLowerCase()} is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6`
      );
    }
  });

  it("Should allow burner to burn", async () => {
    const { woeth, burner, nick } = fixture;

    const totalSupplyBefore = await woeth.totalSupply();
    const balanceBefore = await woeth.balanceOf(nick.address);

    // prettier-ignore
    await woeth
      .connect(burner)["burn(address,uint256)"](nick.address, oethUnits("0.787"));

    const totalSupplyDiff = totalSupplyBefore.sub(await woeth.totalSupply());
    const balanceDiff = balanceBefore.sub(await woeth.balanceOf(nick.address));

    expect(totalSupplyDiff).to.equal(oethUnits("0.787"));
    expect(balanceDiff).to.equal(oethUnits("0.787"));
  });

  it("Should allow burner to burn using sugar method", async () => {
    const { woeth, burner, nick } = fixture;

    await woeth.connect(nick).transfer(burner.address, oethUnits("0.787"));

    const totalSupplyBefore = await woeth.totalSupply();
    const balanceBefore = await woeth.balanceOf(burner.address);

    // prettier-ignore
    await woeth.connect(burner)["burn(uint256)"](oethUnits("0.787"));

    const totalSupplyDiff = totalSupplyBefore.sub(await woeth.totalSupply());
    const balanceDiff = balanceBefore.sub(
      await woeth.balanceOf(burner.address)
    );

    expect(totalSupplyDiff).to.equal(oethUnits("0.787"));
    expect(balanceDiff).to.equal(oethUnits("0.787"));
  });

  it("Should not allow anyone else to burn", async () => {
    const { woeth, governor, rafael, nick, minter } = fixture;

    for (const signer of [governor, rafael, nick, minter]) {
      // prettier-ignore
      await expect(
        woeth
          .connect(signer)["burn(address,uint256)"](signer.address, oethUnits("1"))
      ).to.be.revertedWith(
        `AccessControl: account ${signer.address.toLowerCase()} is missing role 0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848`
      );
    }
  });

  it("Should allow Governor to grant roles", async () => {
    const { woeth, governor, rafael, nick } = fixture;

    await woeth.connect(governor).grantRole(MINTER_ROLE, rafael.address);

    expect(await woeth.hasRole(MINTER_ROLE, rafael.address)).to.be.true;

    await woeth.connect(governor).grantRole(BURNER_ROLE, nick.address);

    expect(await woeth.hasRole(BURNER_ROLE, nick.address)).to.be.true;
  });

  it("Should not allow anyone else to grant roles", async () => {
    const { woeth, minter, burner, rafael, nick } = fixture;

    for (const signer of [rafael, nick, minter, burner]) {
      await expect(
        woeth.connect(signer).grantRole(MINTER_ROLE, rafael.address)
      ).to.be.revertedWith(
        `AccessControl: account ${signer.address.toLowerCase()} is missing role 0x0000000000000000000000000000000000000000000000000000000000000000`
      );
    }
  });

  it("Should allow Governor to revoke roles", async () => {
    const { woeth, governor, minter, burner } = fixture;

    await woeth.connect(governor).revokeRole(MINTER_ROLE, minter.address);
    expect(await woeth.hasRole(MINTER_ROLE, minter.address)).to.be.false;

    await woeth.connect(governor).revokeRole(BURNER_ROLE, burner.address);
    expect(await woeth.hasRole(BURNER_ROLE, burner.address)).to.be.false;
  });

  it("Should not allow anyone else to revoke roles", async () => {
    const { woeth, minter, burner, rafael, nick } = fixture;

    for (const signer of [rafael, nick, minter, burner]) {
      await expect(
        woeth.connect(signer).revokeRole(BURNER_ROLE, burner.address)
      ).to.be.revertedWith(
        `AccessControl: account ${signer.address.toLowerCase()} is missing role 0x0000000000000000000000000000000000000000000000000000000000000000`
      );
    }
  });
});
