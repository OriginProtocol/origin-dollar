const { expect } = require("chai");
const { deployments } = require("@nomiclabs/buidler");

describe("Vault", function () {
  beforeEach(async () => {
    await deployments.fixture();
  });

  it("Should error when adding a market that already exists", async function () {
    const vaultContract = await ethers.getContract("Vault");
    const usdtContract = await ethers.getContract("MockUSDT");
    await expect(vaultContract.createMarket(usdtContract.address)).to.be.reverted;
  });
});
