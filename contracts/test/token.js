const { expect } = require("chai");
const { deployments } = require("@nomiclabs/buidler");
const { parseUnits } = require("ethers").utils;

const HUNDRED_DOLLARS = parseUnits("100.0", 18);
const DOLLAR = parseUnits("1.0", 18);

describe("Token", function () {
  let ousdContract, vaultContract, mockUsdtContract;
  let user, bUser;

  before(async () => {
    const accounts = await ethers.getSigners();
    user = accounts[3];
    bUser = accounts[4];
  });

  beforeEach(async () => {
    await deployments.fixture();
    ousdContract = await ethers.getContract("OUSD");
    vaultContract = await ethers.getContract("Vault");
    mockUsdtContract = await ethers.getContract("MockUSDT");
  });

  it("Should return the token name and symbol", async () => {
    expect(await ousdContract.name()).to.equal("Origin Dollar");
    expect(await ousdContract.symbol()).to.equal("OUSD");
  });

  it("Should have 18 decimals", async () => {
    expect(await ousdContract.decimals()).to.equal(18);
  });

  it("Simple allowances should work", async () => {
    const userUsdt = mockUsdtContract.connect(user);
    const userOusd = ousdContract.connect(user);

    // Create some USDT for an end user
    await userUsdt.mint(HUNDRED_DOLLARS);
    await userUsdt.approve(vaultContract.address, HUNDRED_DOLLARS);

    // Deposit USDT to create OUSD
    await vaultContract
      .connect(user)
      .depositAndMint(mockUsdtContract.address, HUNDRED_DOLLARS);
    expect(await userOusd.balanceOf(user.getAddress())).to.equal(
      HUNDRED_DOLLARS
    );

    // Send OUSD with a simple transfer
    await userOusd.transfer(bUser.getAddress(), DOLLAR);
    expect(await userOusd.balanceOf(user.getAddress())).to.equal(
      HUNDRED_DOLLARS.sub(DOLLAR)
    );
    expect(await userOusd.balanceOf(bUser.getAddress())).to.equal(DOLLAR);

    // Approve OUSD for transferFrom
    await userOusd.approve(bUser.getAddress(), HUNDRED_DOLLARS);
    expect(
      await userOusd.allowance(user.getAddress(), bUser.getAddress())
    ).to.equal(HUNDRED_DOLLARS);

    // Allow an approved user to transfer OUSD
    await ousdContract
      .connect(bUser)
      .transferFrom(user.getAddress(), bUser.getAddress(), DOLLAR);
  });

  it("Should increase users balance on supply increase", async () => {
    const userUsdt = mockUsdtContract.connect(user);
    const userOusd = ousdContract.connect(user);

    // Create some USDT for an end user
    await userUsdt.mint(HUNDRED_DOLLARS.mul(2));
    await userUsdt.approve(vaultContract.address, HUNDRED_DOLLARS.mul(2));

    // Deposit USDT to create OUSD
    await vaultContract
      .connect(user)
      .depositAndMint(mockUsdtContract.address, HUNDRED_DOLLARS);
    expect(await userOusd.balanceOf(user.getAddress())).to.equal(
      HUNDRED_DOLLARS
    );

    await userOusd.transfer(bUser.getAddress(), DOLLAR);
    expect(await userOusd.balanceOf(user.getAddress())).to.equal(
      HUNDRED_DOLLARS.sub(DOLLAR)
    );
    expect(await userOusd.balanceOf(bUser.getAddress())).to.equal(DOLLAR);

    // User has 99 OUSD and bUser has 1 OUSD

    // Increase total supply thus increasing users balance
    await vaultContract
      .connect(user)
      .depositYield(mockUsdtContract.address, DOLLAR);

    // User should have (99/100) * 101 OUSD
    expect(await userOusd.balanceOf(user.getAddress())).to.equal(
      parseUnits("99.99", 18)
    );
  });
});
