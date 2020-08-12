const { expect } = require("chai");
const { deployments } = require("@nomiclabs/buidler");

describe("Token", function () {
  beforeEach(async () => {
    await deployments.fixture();
  });

  it("Should return the token name and symbol", async function () {
    const ousdContract = await ethers.getContract("OUSD");

    expect(await ousdContract.name()).to.equal("Origin Dollar");
    expect(await ousdContract.symbol()).to.equal("OUSD");
  });
});
