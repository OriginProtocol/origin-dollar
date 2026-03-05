// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SwapXSingle_Shared_Test} from "tests/unit/poolBooster/SwapXSingle/shared/Shared.t.sol";
import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";

contract Unit_Concrete_AbstractPoolBoosterFactory_ViewFunctions_Test is Unit_SwapXSingle_Shared_Test {
    function test_poolBoosterLength() public {
        assertEq(factorySwapxSingle.poolBoosterLength(), 0);

        _createSwapxSingleBooster(mockBribeContract, mockAmmPool, 1);

        assertEq(factorySwapxSingle.poolBoosterLength(), 1);
    }

    function test_oToken() public view {
        assertEq(factorySwapxSingle.oToken(), address(oSonic));
    }

    function test_centralRegistry() public view {
        assertEq(address(factorySwapxSingle.centralRegistry()), address(centralRegistry));
    }

    function test_poolBoosters() public {
        address booster1 = _createSwapxSingleBooster(mockBribeContract, mockAmmPool, 1);

        (address boosterAddr, address ammPool, IPoolBoostCentralRegistry.PoolBoosterType boosterType) =
            factorySwapxSingle.poolBoosters(0);

        assertEq(boosterAddr, booster1);
        assertEq(ammPool, mockAmmPool);
        assertEq(uint256(boosterType), uint256(IPoolBoostCentralRegistry.PoolBoosterType.SwapXSingleBooster));
    }

    function test_poolBoosterFromPool() public {
        address booster1 = _createSwapxSingleBooster(mockBribeContract, mockAmmPool, 1);

        (address boosterAddr, address ammPool, IPoolBoostCentralRegistry.PoolBoosterType boosterType) =
            factorySwapxSingle.poolBoosterFromPool(mockAmmPool);

        assertEq(boosterAddr, booster1);
        assertEq(ammPool, mockAmmPool);
        assertEq(uint256(boosterType), uint256(IPoolBoostCentralRegistry.PoolBoosterType.SwapXSingleBooster));
    }
}
