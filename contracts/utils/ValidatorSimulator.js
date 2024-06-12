const hre = require("hardhat");
const { ethers } = hre;

class ValidatorSimulator {
  nativeStakingContract;
  depositContract;
  ssvNetworkContract;

  // simulation data

  constructor(_nativeStakingContract, _depositContract, _ssvNetworkContract) {
    this.nativeStakingContract = _nativeStakingContract;
    this.depositContract = _depositContract;
    this.ssvNetworkContract = _ssvNetworkContract;
  }
  
  async startSimulation() {
    const []
  }

  async fetchStats() {
    let depositCount, registeredValidators, exitedValidators, removedValidators;

    depositCount = Number(await this.depositContract.deposit_count());
    registeredValidators = Number(await this.ssvNetworkContract.registeredValidators());
    exitedValidators = Number(await this.ssvNetworkContract.exitedValidators());
    removedValidators = Number(await this.ssvNetworkContract.removedValidators());

    return [depositCount, registeredValidators, exitedValidators, removedValidators];
  }


}

module.exports = ValidatorSimulator;