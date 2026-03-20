const { expect } = require("chai");
const hre = require("hardhat");

const { createFixtureLoader } = require("../_fixture");
const { impersonateAndFund } = require("../../utils/signers");

const fixture = createFixtureLoader(async () => {
  const { ethers } = hre;
  const mockSafeFactory = await ethers.getContractFactory("MockSafeContract");
  const mockSafe = await mockSafeFactory.deploy();
  const safeSigner = await impersonateAndFund(mockSafe.address);
  const stranger = await impersonateAndFund(
    "0x0000000000000000000000000000000000000002"
  );

  const poolBoosterFactoryFactory = await ethers.getContractFactory(
    "MockPoolBoosterFactory"
  );
  const mockFactory = await poolBoosterFactoryFactory.deploy();

  const moduleFactory = await ethers.getContractFactory(
    "MerklPoolBoosterBribesModule"
  );
  const bribesModule = await moduleFactory.deploy(
    mockSafe.address,
    mockSafe.address,
    mockFactory.address
  );

  return {
    bribesModule,
    mockSafe,
    mockFactory,
    safeSigner,
    stranger,
  };
});

describe("Unit Test: Merkl Pool Booster Bribes Module", function () {
  let f;

  beforeEach(async () => {
    f = await fixture();
  });

  it("Should call bribeAll with empty exclusion list", async () => {
    const { bribesModule, mockFactory, safeSigner } = f;
    const operatorModule = bribesModule.connect(safeSigner);

    await operatorModule.bribeAll([]);

    expect(await mockFactory.callCount()).to.equal(1);
    expect(await mockFactory.getLastExclusionList()).to.deep.equal([]);
  });

  it("Should call bribeAll and pass through the exclusion list", async () => {
    const { bribesModule, mockFactory, safeSigner } = f;
    const operatorModule = bribesModule.connect(safeSigner);

    const exclusionList = [
      "0x0000000000000000000000000000000000000010",
      "0x0000000000000000000000000000000000000020",
    ];

    await operatorModule.bribeAll(exclusionList);

    expect(await mockFactory.callCount()).to.equal(1);
    expect(await mockFactory.getLastExclusionList()).to.deep.equal(
      exclusionList
    );
  });

  it("Should revert when called by a non-operator", async () => {
    const { bribesModule, stranger } = f;
    const strangerModule = bribesModule.connect(stranger);

    await expect(strangerModule.bribeAll([])).to.be.revertedWith(
      "Caller is not an operator"
    );
  });

  it("Should revert on construction with zero factory address", async () => {
    const { ethers } = hre;
    const mockSafeFactory = await ethers.getContractFactory("MockSafeContract");
    const mockSafe = await mockSafeFactory.deploy();

    const moduleFactory = await ethers.getContractFactory(
      "MerklPoolBoosterBribesModule"
    );

    await expect(
      moduleFactory.deploy(
        mockSafe.address,
        mockSafe.address,
        hre.ethers.constants.AddressZero
      )
    ).to.be.revertedWith("Zero address");
  });

  it("Should store the correct factory address", async () => {
    const { bribesModule, mockFactory } = f;

    expect(await bribesModule.factory()).to.equal(mockFactory.address);
  });

  it("Should allow the Safe to update the factory address", async () => {
    const { bribesModule, safeSigner } = f;
    const newFactory = "0x0000000000000000000000000000000000000042";

    await bribesModule.connect(safeSigner).setFactory(newFactory);

    expect(await bribesModule.factory()).to.equal(newFactory);
  });

  it("Should revert when non-Safe tries to update the factory address", async () => {
    const { bribesModule, stranger } = f;
    const newFactory = "0x0000000000000000000000000000000000000042";

    await expect(
      bribesModule.connect(stranger).setFactory(newFactory)
    ).to.be.revertedWith("Caller is not the safe contract");
  });

  it("Should revert when setting factory to zero address", async () => {
    const { bribesModule, safeSigner } = f;

    await expect(
      bribesModule
        .connect(safeSigner)
        .setFactory(hre.ethers.constants.AddressZero)
    ).to.be.revertedWith("Zero address");
  });
});
