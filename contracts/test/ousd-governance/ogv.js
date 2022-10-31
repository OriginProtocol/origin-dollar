const { expect } = require("chai");
const { ethers } = require("hardhat");
const { bnDecimal, deploy } = require("../../utils/governance-helpers");
const { deploymentFixture } = require("./fixture");

// Tests for OGV
describe("Contract: OriginDollarGovernance", async () => {
  let ogv;
  let admin, user1;
  beforeEach(async () => {
    ({ ogv } = await deploymentFixture());
    [admin, user1] = await ethers.getSigners();
  });

  describe("OGV", async () => {
    it("name should be Origin Dollar Governance", async () => {
      expect(await ogv.name()).to.be.eq("Origin Dollar Governance");
    }),
      it("symbol should be OGV", async () => {
        expect(await ogv.symbol()).to.be.eq("OGV");
      }),
      it("decimals should be 18", async () => {
        expect(await ogv.decimals()).to.be.eq(18);
      }),
      it("total supply should be 1000000000", async () => {
        expect(await ogv.totalSupply()).to.be.eq(bnDecimal(1000000000));
      }),
      it("owner should be admin address", async () => {
        expect(await ogv.owner()).to.be.eq(admin.address);
      }),
      it("should be able to transfer ownership", async () => {
        await ogv.transferOwnership(user1.address);
        expect(await ogv.owner()).to.be.eq(user1.address);
      }),
      it("non-owner shouldn't be able to mint", async () => {
        await expect(
          ogv.connect(user1).mint(user1.address, 10000)
        ).to.be.revertedWith(
          "AccessControl: account " +
            user1.address.toLowerCase() +
            " is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"
        );
      }),
      it("minter can mint", async () => {
        await ogv.grantMinterRole(admin.address);
        await ogv.mint(user1.address, 100);
        expect(await ogv.totalSupply()).to.be.eq(
          bnDecimal(1000000000).add(100)
        );
      }),
      it("can't upgrade to non-uups token", async () => {
        let nonuupsToken = await deploy("NonUUPSToken");
        await expect(ogv.upgradeTo(nonuupsToken.address)).to.be.revertedWith(
          "ERC1967Upgrade: new implementation is not UUPS"
        );
      }),
      it("non-owner should't be able to upgrade", async () => {
        let testToken = await deploy("TestToken");
        await expect(
          ogv.connect(user1).upgradeTo(testToken.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      }),
      it("should be able to upgrade", async () => {
        let testToken = await deploy("TestToken");
        await expect(ogv.upgradeTo(testToken.address)).to.emit(ogv, "Upgraded");
      }),
      it("should be able to burn from self", async () => {
        expect(await ogv.balanceOf(admin.address)).to.be.gt(0);
        await ogv.burn(await ogv.balanceOf(admin.address));
        expect(await ogv.balanceOf(admin.address)).to.be.eq(0);
      }),
      it("should be able to burn from another address", async () => {
        let balanceBefore = await ogv.balanceOf(admin.address);
        await ogv.approve(user1.address, 100);
        await ogv.connect(user1).burnFrom(admin.address, 100);
        expect(await ogv.balanceOf(admin.address)).to.be.eq(
          balanceBefore.sub(100)
        );
      }),
      it("should't be able to burn from another address if not approved", async () => {
        await ogv.approve(user1.address, 90);
        await expect(
          ogv.connect(user1).burnFrom(admin.address, 100)
        ).to.be.revertedWith("ERC20: insufficient allowance");
      });
  });
});
