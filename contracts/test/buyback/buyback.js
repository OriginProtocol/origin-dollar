const { expect } = require("chai");
const { utils } = require("ethers");

const { defaultFixture } = require("../_fixture");
const { ousdUnits, usdcUnits, daiUnits, loadFixture } = require("../helpers");

describe("OGN Buyback", function () {
  before(async () => {});

  it("Should allow Governor to set Trustee address", async () => {
    const { vault, governor, ousd } = await loadFixture(defaultFixture);
    // Pretend OUSD is trustee
    await vault.connect(governor).setTrusteeAddress(ousd.address);
  });

  it("Should not allow non-Governor to set Trustee address", async () => {
    const { vault, anna, ousd } = await loadFixture(defaultFixture);
    // Pretend OUSD is trustee
    await expect(
      vault.connect(anna).setTrusteeAddress(ousd.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should swap OUSD balance for OGN", async () => {
    const {
      anna,
      ogn,
      ousd,
      governor,
      buyback,
      dai,
      vault,
    } = await loadFixture(defaultFixture);
    const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");
    mockUniswapRouter.initialize(ousd.address, ogn.address);

    // Give Uniswap mock some OGN so it can swap
    await ogn.connect(anna).mint(utils.parseUnits("1000", 18));
    await ogn
      .connect(anna)
      .transfer(mockUniswapRouter.address, utils.parseUnits("1000", 18));

    await dai
      .connect(anna)
      .approve(vault.address, utils.parseUnits("1000", 18));
    await vault
      .connect(anna)
      .mint(dai.address, utils.parseUnits("1000", 18), 0);
    // Give the Buyback contract some OUSD to trigger the swap
    await ousd
      .connect(anna)
      .transfer(buyback.address, utils.parseUnits("1000", 18));

    // Calling allocate on Vault calls buyback.swap()
    await vault.connect(governor).allocate();

    await expect(await ogn.balanceOf(buyback.address)).to.be.equal(
      utils.parseUnits("1000", 18)
    );
  });

  it("Should allow withdrawal of arbitrary token by Governor", async () => {
    const { vault, ousd, usdc, matt, governor, buyback } = await loadFixture(
      defaultFixture
    );
    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"), 0);
    // Matt sends his OUSD directly to Vault
    await ousd.connect(matt).transfer(buyback.address, ousdUnits("8.0"));
    // Matt asks Governor for help
    await buyback
      .connect(governor)
      .transferToken(ousd.address, ousdUnits("8.0"));
    await expect(governor).has.a.balanceOf("8.0", ousd);
  });

  it("Should not allow withdrawal of arbitrary token by non-Governor", async () => {
    const { vault, ousd, matt } = await loadFixture(defaultFixture);
    // Naughty Matt
    await expect(
      vault.connect(matt).transferToken(ousd.address, ousdUnits("8.0"))
    ).to.be.revertedWith("Caller is not the Governor");
  });
});
