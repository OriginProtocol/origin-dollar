const { expect } = require("chai");

describe("Token", function() {
  it("Should return the token name and symbol", async function() {
    const Token = await ethers.getContractFactory("OUSD");
    const token = await Token.deploy();

    await token.deployed();
    expect(await token.name()).to.equal("Origin Dollar");
    expect(await token.symbol()).to.equal("OUSD");
  });
});
