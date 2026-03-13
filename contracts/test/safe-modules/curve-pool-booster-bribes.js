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

  const poolBoosterFactory = await ethers.getContractFactory(
    "MockCurvePoolBooster"
  );
  const poolBoosterA = await poolBoosterFactory.deploy();
  const poolBoosterB = await poolBoosterFactory.deploy();
  const poolBoosterC = await poolBoosterFactory.deploy();

  const moduleFactory = await ethers.getContractFactory(
    "CurvePoolBoosterBribesModule"
  );
  const bribesModule = await moduleFactory.deploy(
    mockSafe.address,
    mockSafe.address,
    [poolBoosterA.address, poolBoosterB.address, poolBoosterC.address],
    ethers.utils.parseEther("0.001"),
    123456
  );

  await ethers.provider.send("hardhat_setBalance", [
    mockSafe.address,
    ethers.utils.hexStripZeros(ethers.utils.parseEther("1").toHexString()),
  ]);

  return {
    bribesModule,
    mockSafe,
    poolBoosterA,
    poolBoosterB,
    poolBoosterC,
    safeSigner,
    stranger,
  };
});

describe("Unit Test: Curve Pool Booster Bribes Module", function () {
  let f;

  beforeEach(async () => {
    f = await fixture();
  });

  it("Should manage selected pool boosters with default parameters", async () => {
    const {
      bribesModule,
      poolBoosterA,
      poolBoosterB,
      poolBoosterC,
      safeSigner,
    } = f;
    const operatorModule = bribesModule.connect(safeSigner);

    await operatorModule["manageBribes(address[])"]([
      poolBoosterA.address,
      poolBoosterB.address,
      poolBoosterC.address,
    ]);

    for (const poolBooster of [poolBoosterA, poolBoosterB, poolBoosterC]) {
      expect(await poolBooster.callCount()).to.equal(1);
      expect(await poolBooster.lastTotalRewardAmount()).to.equal(
        hre.ethers.constants.MaxUint256
      );
      expect(await poolBooster.lastNumberOfPeriods()).to.equal(1);
      expect(await poolBooster.lastMaxRewardPerVote()).to.equal(0);
      expect(await poolBooster.lastAdditionalGasLimit()).to.equal(123456);
      expect(await poolBooster.lastValue()).to.equal(
        hre.ethers.utils.parseEther("0.001")
      );
    }
  });

  it("Should manage only the selected registered pool boosters", async () => {
    const {
      bribesModule,
      poolBoosterA,
      poolBoosterB,
      poolBoosterC,
      safeSigner,
    } = f;
    const operatorModule = bribesModule.connect(safeSigner);

    await operatorModule["manageBribes(address[],uint256[],uint8[],uint256[])"](
      [poolBoosterB.address, poolBoosterC.address],
      [11, 22],
      [2, 3],
      [101, 202]
    );

    expect(await poolBoosterA.callCount()).to.equal(0);

    expect(await poolBoosterB.callCount()).to.equal(1);
    expect(await poolBoosterB.lastTotalRewardAmount()).to.equal(11);
    expect(await poolBoosterB.lastNumberOfPeriods()).to.equal(2);
    expect(await poolBoosterB.lastMaxRewardPerVote()).to.equal(101);

    expect(await poolBoosterC.callCount()).to.equal(1);
    expect(await poolBoosterC.lastTotalRewardAmount()).to.equal(22);
    expect(await poolBoosterC.lastNumberOfPeriods()).to.equal(3);
    expect(await poolBoosterC.lastMaxRewardPerVote()).to.equal(202);
  });

  it("Should revert for an unregistered pool booster", async () => {
    const { bribesModule, safeSigner } = f;
    const operatorModule = bribesModule.connect(safeSigner);
    const poolBoosterFactory = await hre.ethers.getContractFactory(
      "MockCurvePoolBooster"
    );
    const unknownPoolBooster = await poolBoosterFactory.deploy();

    await expect(
      operatorModule["manageBribes(address[])"]([unknownPoolBooster.address])
    ).to.be.revertedWith("Invalid pool booster");
  });

  it("Should revert for duplicate pool boosters", async () => {
    const { bribesModule, poolBoosterA, safeSigner } = f;
    const operatorModule = bribesModule.connect(safeSigner);

    await expect(
      operatorModule["manageBribes(address[])"]([
        poolBoosterA.address,
        poolBoosterA.address,
      ])
    ).to.be.revertedWith("Duplicate pool booster");
  });

  it("Should revert when selected arrays have a length mismatch", async () => {
    const { bribesModule, poolBoosterA, poolBoosterB, safeSigner } = f;
    const operatorModule = bribesModule.connect(safeSigner);

    await expect(
      operatorModule["manageBribes(address[],uint256[],uint8[],uint256[])"](
        [poolBoosterA.address, poolBoosterB.address],
        [1],
        [1, 1],
        [1, 1]
      )
    ).to.be.revertedWith("Length mismatch");
  });

  it("Should require ETH based on the selected pool booster count only", async () => {
    const { bribesModule, mockSafe, poolBoosterA, poolBoosterB, safeSigner } =
      f;
    const operatorModule = bribesModule.connect(safeSigner);

    await hre.ethers.provider.send("hardhat_setBalance", [
      mockSafe.address,
      hre.ethers.utils.hexStripZeros(
        hre.ethers.utils.parseEther("0.0015").toHexString()
      ),
    ]);

    await expect(
      operatorModule["manageBribes(address[])"]([
        poolBoosterA.address,
        poolBoosterB.address,
      ])
    ).to.be.revertedWith("Not enough ETH for bridge fees");

    await expect(
      operatorModule["manageBribes(address[])"]([poolBoosterA.address])
    ).to.not.be.reverted;
  });

  it("Should revert when called by a non-operator", async () => {
    const { bribesModule, poolBoosterA, stranger } = f;
    const strangerModule = bribesModule.connect(stranger);

    await expect(
      strangerModule["manageBribes(address[])"]([poolBoosterA.address])
    ).to.be.revertedWith("Caller is not an operator");
  });
});
