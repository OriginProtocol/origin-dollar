#!/bin/bash

export OETH_VAULT=0xa7191fEE1Ed313908FCb09D09b82ABB7BC56F71B
export OETH_VAULT_PROXY=0x19d2bAaBA949eFfa163bFB9efB53ed8701aA5dD9
export OETH_VAULT_CORE=0xE92e25B81E44B8377Df1362f8fFBc426A00d6ef4
export OETH_VAULT_ADMIN=0xa94c4aab0Cf9f6E79bB064DB145fBe2506b9Fa75
export OETH_PROXY=0xB1876706d2402d300bf263F9e53335CEFc53d9Cb
export OETH=0x7909c19E355E95043e277e76Dd6680fE899F61D6
export FEE_ACC=0x79681d3f14a0068479420eE5fDdF59B62301f810
export FEE_ACC_PROXY=0x590B781b511e953dbFC49e7E7864A6E787aFBDCc
export OETH_DRIPPER=0x3833C32826A7f2a93C48D50ae44D45F45Ab17B7F
export OETH_DRIPPER_PROXY=0xaFF1E6263F4004C95Ae611DEb2ADaC049B5aD121
export OETH_HARVESTER=0x22b00a89531E199bd90eC162F9810298b9FBC8b3
export OETH_HARVESTER_PROXY=0xB7491cdf36367C89001cc41312F22f63A3a17931
export OETH_ORACLE_ROUTER=0x7e2bf9A89180f20591EcFA42C0dd7e52b2C546E3
export NATIVE_STAKING=0x33Eeb0996f6981ff7d11F643630734856BEc09f5
export NATIVE_STAKING_PROXY=0x4Eac8847c7AE50e3A3551B1Aa4FF7Cc162151410
export WETH=0x94373a4919b3240d86ea41593d5eba789fef3848
export ZERO=0x0000000000000000000000000000000000000000
export SSV=0xad45A78180961079BFaeEe349704F411dfF947C6
export SSVNetwork=0x38A4794cCEd47d3baf7370CcC43B560D3a1beEFA
export beaconChainDepositContract=0x4242424242424242424242424242424242424242

yarn run hardhat verify --contract contracts/vault/OETHVault.sol:OETHVault --network holesky $OETH_VAULT
echo "module.exports = [\"0xD8724322f44E5c58D7A815F542036fb17DbbF839\"]" > vault_args.js
yarn run hardhat verify --contract contracts/vault/OETHVaultCore.sol:OETHVaultCore --network holesky  --constructor-args vault_args.js $OETH_VAULT_CORE
yarn run hardhat verify --contract contracts/proxies/Proxies.sol:OETHVaultAdmin --network holesky --constructor-args vault_args.js $OETH_VAULT_ADMIN
yarn run hardhat verify --contract contracts/proxies/Proxies.sol:OETHVaultProxy --network holesky $OETH_VAULT_PROXY
yarn run hardhat verify --contract contracts/proxies/Proxies.sol:OETHProxy --network holesky $OETH_PROXY
yarn run hardhat verify --contract contracts/token/OETH.sol:OETH --network holesky $OETH

echo "module.exports = [\"$NATIVE_STAKING_PROXY\"]" > fee_acc_args.js
yarn run hardhat verify --contract contracts/strategies/NativeStaking/FeeAccumulator.sol:FeeAccumulator --network holesky --constructor-args fee_acc_args.js $FEE_ACC
yarn run hardhat verify --contract contracts/proxies/Proxies.sol:NativeStakingFeeAccumulatorProxy --network holesky $FEE_ACC_PROXY
echo "module.exports = [\"$OETH_VAULT_PROXY\", \"$OETH_PROXY\"]" > dripper_acc_args.js
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