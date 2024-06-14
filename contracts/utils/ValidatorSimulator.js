const { expect } = require("chai");

const hre = require("hardhat");
const { ethers } = hre;
const { BigNumber } = ethers;
const { parseEther, formatEther } = require("ethers/lib/utils");
const { setBalance } = require("@nomicfoundation/hardhat-network-helpers");

const log = require("./logger")("test:unit:staking:simulator");

class ValidatorSimulator {
  nativeStakingContract;
  depositContract;
  ssvNetworkContract;
  registrator;

  constructor(
    _nativeStakingContract,
    _depositContract,
    _ssvNetworkContract,
    _registrator
  ) {
    this.nativeStakingContract = _nativeStakingContract;
    this.depositContract = _depositContract;
    this.ssvNetworkContract = _ssvNetworkContract;
    this.registrator = _registrator;
  }

  async executeSimulation({ validatorSlashes, validatorFullWithdrawals }) {
    const [
      stakedValidators,
      registeredValidators,
      exitedValidators,
      removedValidators,
      activeDepositedValidators,
    ] = await this.fetchStats();

    log(
      `Running test starting with ${stakedValidators} staked validators of which ${validatorSlashes} are slashed ` +
        `and ${validatorFullWithdrawals} have fully withdrawn.`
    );

    expect(stakedValidators).to.equal(
      registeredValidators,
      "stakedValidators and registeredValidators should match"
    );
    expect(exitedValidators).to.equal(
      removedValidators,
      "exitedValidators and removedValidators should match"
    );

    // check here to update yearly non MEV APY: https://www.blocknative.com/ethereum-staking-calculator
    const yearlyNonMEVApy = 0.0395; // 3.95%
    // check here the "Sweep delay" stat to update: https://www.validatorqueue.com/
    const validatorSweepCycleLength = 8.9; // in days

    const rewardsPerCyclePerValidator = parseEther("32")
      .mul(BigNumber.from(`${yearlyNonMEVApy * 10000}`))
      .div(BigNumber.from("10000")) // gets rewards per year
      .div(BigNumber.from("365")) // gets rewards per day
      .mul(BigNumber.from(`${validatorSweepCycleLength * 10}`)) // gets rewards per cycle * 10
      .div(BigNumber.from("10")); // gets rewards per cycle

    /* Validators that have been slashed or have done a full withdrawal might still have earned some of the ETH.
     * We just halve the rewards, assuming the median/average earnings of exited validators is still half
     * of the beacon chain sweep cycle.
     */
    const rewardsPerCyclePerExitedValidator = rewardsPerCyclePerValidator.div(
      BigNumber.from("2")
    );

    const fullyStakedValidators =
      stakedValidators - validatorSlashes - validatorFullWithdrawals;
    const beaconChainPartialSweeps =
      // rewards from fully staked validators
      rewardsPerCyclePerValidator
        .mul(BigNumber.from(fullyStakedValidators.toString()))
        .add(
          // rewards of slashed and fully exited validators
          rewardsPerCyclePerExitedValidator.mul(
            BigNumber.from(`${validatorSlashes + validatorFullWithdrawals}`)
          )
        );

    const beaconChainSlashes = parseEther("30.9").mul(
      BigNumber.from(validatorSlashes.toString())
    );
    const beaconChainFullWithdrawals = parseEther("32").mul(
      BigNumber.from(validatorFullWithdrawals.toString())
    );
    const totalBeaconChainRewards = beaconChainPartialSweeps
      .add(beaconChainSlashes)
      .add(beaconChainFullWithdrawals);

    log(
      `The test ran with ${activeDepositedValidators} active deposited validators of which ` +
        `${validatorSlashes} have been slashed and ${validatorFullWithdrawals} fully withdrawn.`
    );

    log(
      `The test yielded ${formatEther(
        beaconChainPartialSweeps
      )} ETH in partial withdrawal sweeps,` +
        `${formatEther(beaconChainSlashes)} ETH from slashes and ${formatEther(
          beaconChainFullWithdrawals
        )} ` +
        `ETH from full withdrawals. Totaling to: ${formatEther(
          totalBeaconChainRewards
        )} ETH. `
    );

    await setBalance(
      this.nativeStakingContract.address,
      totalBeaconChainRewards
    );

    // do the accounting
    await this.nativeStakingContract.connect(this.registrator).doAccounting();

    const [, , , , activeDepositedValidatorsAfter, paused] =
      await this.fetchStats();

    expect(paused).to.equal(false, "Fuse is blown, it shouldn't be");
    expect(activeDepositedValidatorsAfter).to.equal(
      stakedValidators - validatorSlashes - validatorFullWithdrawals,
      "Unexpected number of active validators"
    );
    // TODO: check that ether remaining on the native staking wasn't close (1 ETH vicinity) to
    // blow the fuse
    log(`activeDepositedValidatorsAfter`, activeDepositedValidatorsAfter);
  }

  async fetchStats() {
    let depositCount,
      registeredValidators,
      exitedValidators,
      removedValidators,
      activeDepositedValidators,
      paused;

    depositCount = Number(await this.depositContract.deposit_count());
    registeredValidators = Number(
      await this.ssvNetworkContract.registeredValidators()
    );
    exitedValidators = Number(await this.ssvNetworkContract.exitedValidators());
    removedValidators = Number(
      await this.ssvNetworkContract.removedValidators()
    );
    removedValidators = Number(
      await this.ssvNetworkContract.removedValidators()
    );
    activeDepositedValidators = Number(
      await this.nativeStakingContract.activeDepositedValidators()
    );
    paused = await this.nativeStakingContract.paused();

    return [
      depositCount,
      registeredValidators,
      exitedValidators,
      removedValidators,
      activeDepositedValidators,
      paused,
    ];
  }
}

module.exports = ValidatorSimulator;
