const { createFixtureLoader } = require("../_fixture");
const { defaultBaseFixture } = require("../_fixture-base");
const { expect } = require("chai");
const { oethUnits } = require("../helpers");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("ForkTest: WOETH", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await baseFixture();
  });

  it("Should have right config", async () => {
    const { woeth } = fixture;

    expect(await woeth.decimals()).to.equal(18);
    expect(await woeth.symbol()).to.equal("WOETH");
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
    const { woeth, minter, burner, nick } = fixture;

    // Mint something
    await woeth.connect(minter).mint(nick.address, oethUnits("1.23"));

    const totalSupplyBefore = await woeth.totalSupply();
    const balanceBefore = await woeth.balanceOf(nick.address);

    // Mint something
    await woeth.connect(burner).burn(nick.address, oethUnits("0.787"));

    const totalSupplyDiff = totalSupplyBefore.sub(await woeth.totalSupply());
    const balanceDiff = balanceBefore.sub(await woeth.balanceOf(nick.address));

    expect(totalSupplyDiff).to.equal(oethUnits("0.787"));
    expect(balanceDiff).to.equal(oethUnits("0.787"));
  });

  it("Should not allow anyone else to burn", async () => {
    const { woeth, governor, rafael, nick, minter } = fixture;

    for (const signer of [governor, rafael, nick, minter]) {
      await expect(
        woeth.connect(signer).burn(signer.address, oethUnits("1"))
      ).to.be.revertedWith(
        `AccessControl: account ${signer.address.toLowerCase()} is missing role 0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848`
      );
    }
  });
});
