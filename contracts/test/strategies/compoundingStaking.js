const { expect } = require("chai");
const { parseEther, parseUnits } = require("ethers").utils;

const { MAX_UINT256 } = require("../../utils/constants");
const { calcDepositRoot } = require("../../tasks/beaconTesting");
const { hashPubKey } = require("../../utils/beacon");
const { impersonateAndFund } = require("../../utils/signers");
const {
  createFixtureLoader,
  compoundingStakingStrategyFixture,
} = require("../_fixture");
const {
  testValidators,
} = require("./compoundingSSVStaking-validatorsData.json");

const loadFixture = createFixtureLoader(compoundingStakingStrategyFixture);

describe("Unit test: Compounding Staking Strategy", function () {
  let fixture;
  let sVault;

  beforeEach(async () => {
    fixture = await loadFixture();
    const { compoundingStakingStrategy, josh, weth } = fixture;
    sVault = await impersonateAndFund(
      await compoundingStakingStrategy.vaultAddress()
    );
    await weth
      .connect(josh)
      .approve(compoundingStakingStrategy.address, MAX_UINT256);
  });

  const depositToStrategy = async (amount) => {
    const { compoundingStakingStrategy, weth, josh } = fixture;

    await weth
      .connect(josh)
      .transfer(compoundingStakingStrategy.address, parseEther(amount));
    await compoundingStakingStrategy.connect(sVault).depositAll();
  };

  const stakeValidator = async ({
    validator = testValidators[0],
    amount = "1",
  } = {}) => {
    const { compoundingStakingStrategy, validatorRegistrator } = fixture;
    const depositDataRoot = await calcDepositRoot(
      compoundingStakingStrategy.address,
      "0x02",
      validator.publicKey,
      validator.signature,
      amount
    );

    return compoundingStakingStrategy.connect(validatorRegistrator).stakeEth(
      {
        pubkey: validator.publicKey,
        signature: validator.signature,
        depositDataRoot,
      },
      parseUnits(amount, 9)
    );
  };

  it("allows the first deposit to a vanilla validator without SSV registration", async () => {
    const { compoundingStakingStrategy } = fixture;
    const validator = testValidators[0];
    const pubKeyHash = hashPubKey(validator.publicKey);

    expect(
      (await compoundingStakingStrategy.validator(pubKeyHash)).state
    ).to.equal(0);

    await depositToStrategy("1");

    const stakeTx = await stakeValidator({ validator });
    const receipt = await stakeTx.wait();
    const event = receipt.events.find((event) => event.event === "ETHStaked");

    await expect(stakeTx)
      .to.emit(compoundingStakingStrategy, "ETHStaked")
      .withArgs(
        pubKeyHash,
        event.args.pendingDepositRoot,
        validator.publicKey,
        parseEther("1")
      );

    const validatorData = await compoundingStakingStrategy.validator(
      pubKeyHash
    );
    expect(validatorData.state).to.equal(2);
    expect(await compoundingStakingStrategy.firstDeposit()).to.equal(true);
  });

  it("allows the first deposit to be less than the initial deposit amount", async () => {
    const { compoundingStakingStrategy, governor } = fixture;
    const validator = testValidators[0];
    const pubKeyHash = hashPubKey(validator.publicKey);

    await compoundingStakingStrategy
      .connect(governor)
      .setInitialDepositAmount(parseEther("2"));
    await depositToStrategy("1");

    const stakeTx = await stakeValidator({ validator, amount: "1" });
    const receipt = await stakeTx.wait();
    const event = receipt.events.find((event) => event.event === "ETHStaked");

    await expect(stakeTx)
      .to.emit(compoundingStakingStrategy, "ETHStaked")
      .withArgs(
        pubKeyHash,
        event.args.pendingDepositRoot,
        validator.publicKey,
        parseEther("1")
      );

    expect(await compoundingStakingStrategy.firstDeposit()).to.equal(true);
  });

  it("allows a large 2030 ETH initial deposit to a compounding validator", async () => {
    const { compoundingStakingStrategy, governor } = fixture;
    const validator = testValidators[0];
    const pubKeyHash = hashPubKey(validator.publicKey);

    expect(
      (await compoundingStakingStrategy.validator(pubKeyHash)).state
    ).to.equal(0);

    await compoundingStakingStrategy
      .connect(governor)
      .setInitialDepositAmount(parseEther("2030"));
    await depositToStrategy("2030");

    const stakeTx = await stakeValidator({ validator, amount: "2030" });
    const receipt = await stakeTx.wait();
    const event = receipt.events.find((event) => event.event === "ETHStaked");

    await expect(stakeTx)
      .to.emit(compoundingStakingStrategy, "ETHStaked")
      .withArgs(
        pubKeyHash,
        event.args.pendingDepositRoot,
        validator.publicKey,
        parseEther("2030")
      );

    const validatorData = await compoundingStakingStrategy.validator(
      pubKeyHash
    );
    expect(validatorData.state).to.equal(2);
    expect(await compoundingStakingStrategy.firstDeposit()).to.equal(true);
  });

  it("allows a 32.25 ETH initial deposit when initialDepositAmount is set to 2040 ETH", async () => {
    const { compoundingStakingStrategy, governor } = fixture;
    const validator = testValidators[0];
    const pubKeyHash = hashPubKey(validator.publicKey);

    expect(
      (await compoundingStakingStrategy.validator(pubKeyHash)).state
    ).to.equal(0);

    await compoundingStakingStrategy
      .connect(governor)
      .setInitialDepositAmount(parseEther("2040"));
    await depositToStrategy("32.25");

    const stakeTx = await stakeValidator({ validator, amount: "32.25" });
    const receipt = await stakeTx.wait();
    const event = receipt.events.find((event) => event.event === "ETHStaked");

    await expect(stakeTx)
      .to.emit(compoundingStakingStrategy, "ETHStaked")
      .withArgs(
        pubKeyHash,
        event.args.pendingDepositRoot,
        validator.publicKey,
        parseEther("32.25")
      );

    const validatorData = await compoundingStakingStrategy.validator(
      pubKeyHash
    );
    expect(validatorData.state).to.equal(2);
    expect(await compoundingStakingStrategy.firstDeposit()).to.equal(true);
  });

  it("does not allow a follow-up deposit before the validator is verified or active", async () => {
    const validator = testValidators[0];

    await depositToStrategy("2");
    await stakeValidator({ validator });

    await expect(stakeValidator({ validator })).to.be.revertedWith(
      "Not registered or verified"
    );
  });

  it("still only allows one pending first deposit at a time", async () => {
    await depositToStrategy("2");
    await stakeValidator({ validator: testValidators[0] });

    await expect(
      stakeValidator({ validator: testValidators[1] })
    ).to.be.revertedWith("Existing first deposit");
  });
});
