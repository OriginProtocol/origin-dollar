#!/bin/bash

export NETWORK=holesky
# TODO: fetch these addresses from deployment files
export OETH_VAULT=$(jq -r ".address" deployments/$NETWORK/OETHVault.json)
export OETH_VAULT_PROXY=$(jq -r ".address" deployments/$NETWORK/OETHVaultProxy.json)
export OETH_VAULT_CORE=$(jq -r ".address" deployments/$NETWORK/OETHVaultCore.json)
export OETH_VAULT_ADMIN=$(jq -r ".address" deployments/$NETWORK/OETHVaultAdmin.json)
export OETH_PROXY=$(jq -r ".address" deployments/$NETWORK/OETHProxy.json)
export OETH=$(jq -r ".address" deployments/$NETWORK/OETH.json)
export FEE_ACC=$(jq -r ".address" deployments/$NETWORK/FeeAccumulator.json)
export FEE_ACC_PROXY=$(jq -r ".address" deployments/$NETWORK/NativeStakingFeeAccumulatorProxy.json)
export OETH_DRIPPER=$(jq -r ".address" deployments/$NETWORK/OETHDripper.json)
export OETH_DRIPPER_PROXY=$(jq -r ".address" deployments/$NETWORK/OETHDripperProxy.json)
export OETH_HARVESTER=$(jq -r ".address" deployments/$NETWORK/OETHHarvesterProxy.json)
export OETH_HARVESTER_PROXY=$(jq -r ".address" deployments/$NETWORK/OETHHarvester.json)
export OETH_ORACLE_ROUTER=$(jq -r ".address" deployments/$NETWORK/OETHOracleRouter.json)
export NATIVE_STAKING=$(jq -r ".address" deployments/$NETWORK/NativeStakingSSVStrategy.json)
export NATIVE_STAKING_PROXY=$(jq -r ".address" deployments/$NETWORK/NativeStakingSSVStrategyProxy.json)

if [ NETWORK="holesky" ]; then
	export WETH=0x94373a4919b3240d86ea41593d5eba789fef3848
	export ZERO=0x0000000000000000000000000000000000000000
	export SSV=0xad45A78180961079BFaeEe349704F411dfF947C6
	export SSVNetwork=0x38A4794cCEd47d3baf7370CcC43B560D3a1beEFA
	export beaconChainDepositContract=0x4242424242424242424242424242424242424242
# else mainnet
else
	export WETH=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
	export ZERO=0x0000000000000000000000000000000000000000
	export SSV=0x9D65fF81a3c488d585bBfb0Bfe3c7707c7917f54
	export SSVNetwork=0xDD9BC35aE942eF0cFa76930954a156B3fF30a4E1
	export beaconChainDepositContract=0x00000000219ab540356cBB839Cbe05303d7705Fa
fi

yarn run hardhat verify --contract contracts/vault/OETHVault.sol:OETHVault --network holesky $OETH_VAULT
echo "module.exports = [\"$WETH\"]" > vault_args.js
yarn run hardhat verify --contract contracts/vault/OETHVaultCore.sol:OETHVaultCore --network holesky  --constructor-args vault_args.js $OETH_VAULT_CORE
yarn run hardhat verify --contract contracts/proxies/Proxies.sol:OETHVaultAdmin --network holesky $OETH_VAULT_ADMIN
yarn run hardhat verify --contract contracts/proxies/Proxies.sol:OETHVaultProxy --network holesky $OETH_VAULT_PROXY
yarn run hardhat verify --contract contracts/proxies/Proxies.sol:OETHProxy --network holesky $OETH_PROXY
yarn run hardhat verify --contract contracts/token/OETH.sol:OETH --network holesky $OETH

echo "module.exports = [\"$NATIVE_STAKING_PROXY\"]" > fee_acc_args.js
yarn run hardhat verify --contract contracts/strategies/NativeStaking/FeeAccumulator.sol:FeeAccumulator --network holesky --constructor-args fee_acc_args.js $FEE_ACC
yarn run hardhat verify --contract contracts/proxies/Proxies.sol:NativeStakingFeeAccumulatorProxy --network holesky $FEE_ACC_PROXY
echo "module.exports = [\"$OETH_VAULT_PROXY\", \"$WETH\"]" > dripper_acc_args.js
yarn run hardhat verify --contract contracts/harvest/OETHDripper.sol:OETHDripper --network holesky --constructor-args dripper_acc_args.js $OETH_DRIPPER
yarn run hardhat verify --contract contracts/proxies/Proxies.sol:OETHDripperProxy --network holesky $OETH_DRIPPER_PROXY
echo "module.exports = [\"$OETH_VAULT_PROXY\", \"$WETH\"]" > harvester_acc_args.js
yarn run hardhat verify --contract contracts/harvest/OETHHarvester.sol:OETHHarvester --network holesky --constructor-args harvester_acc_args.js $OETH_HARVESTER
yarn run hardhat verify --contract contracts/proxies/Proxies.sol:OETHHarvesterProxy --network holesky $OETH_HARVESTER_PROXY
echo "module.exports = [\"$ZERO\"]" > oracle_acc_args.js
yarn run hardhat verify --contract contracts/oracle/OETHFixedOracle.sol:OETHFixedOracle --network holesky --constructor-args oracle_acc_args.js $OETH_ORACLE_ROUTER
echo "module.exports = [[\"$ZERO\", \"$OETH_VAULT_PROXY\"], \"$WETH\", \"$SSV\", \"$SSVNetwork\", \"$FEE_ACC_PROXY\", \"$beaconChainDepositContract\"]" > strategy_acc_args.js
yarn run hardhat verify --contract contracts/strategies/NativeStaking/NativeStakingSSVStrategy.sol:NativeStakingSSVStrategy --network holesky --constructor-args strategy_acc_args.js $NATIVE_STAKING
yarn run hardhat verify --contract contracts/proxies/Proxies.sol:NativeStakingSSVStrategyProxy --network holesky $NATIVE_STAKING_PROXY

rm -f vault_args.js fee_acc_args.js dripper_acc_args.js harvester_acc_args.js oracle_acc_args.js strategy_acc_args.js