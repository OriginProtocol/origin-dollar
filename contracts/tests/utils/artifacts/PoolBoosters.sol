// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

library PoolBoosters {
    string internal constant CURVE_POOL_BOOSTER = "contracts/poolBooster/curve/CurvePoolBooster.sol:CurvePoolBooster";
    string internal constant CURVE_POOL_BOOSTER_FACTORY =
        "contracts/poolBooster/curve/CurvePoolBoosterFactory.sol:CurvePoolBoosterFactory";
    string internal constant CURVE_POOL_BOOSTER_PLAIN =
        "contracts/poolBooster/curve/CurvePoolBoosterPlain.sol:CurvePoolBoosterPlain";
    string internal constant POOL_BOOST_CENTRAL_REGISTRY =
        "contracts/poolBooster/PoolBoostCentralRegistry.sol:PoolBoostCentralRegistry";
    string internal constant POOL_BOOSTER_FACTORY_MERKL =
        "contracts/poolBooster/PoolBoosterFactoryMerkl.sol:PoolBoosterFactoryMerkl";
    string internal constant POOL_BOOSTER_MERKL_V2 = "contracts/poolBooster/PoolBoosterMerklV2.sol:PoolBoosterMerklV2";
}
