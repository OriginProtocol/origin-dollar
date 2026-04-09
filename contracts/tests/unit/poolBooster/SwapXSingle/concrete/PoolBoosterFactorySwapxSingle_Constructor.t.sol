// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SwapXSingle_Shared_Test} from "tests/unit/poolBooster/SwapXSingle/shared/Shared.t.sol";

// --- Test utilities
import {PoolBoosters} from "tests/utils/artifacts/PoolBoosters.sol";

contract Unit_Concrete_PoolBoosterFactorySwapxSingle_Constructor_Test is Unit_SwapXSingle_Shared_Test {
    function test_constructor() public view {
        assertEq(factorySwapxSingle.oToken(), address(oSonic));
        assertEq(factorySwapxSingle.governor(), governor);
        assertEq(address(factorySwapxSingle.centralRegistry()), address(centralRegistry));
        assertEq(factorySwapxSingle.version(), 1);
    }

    function test_constructor_RevertWhen_zeroOToken() public {
        vm.expectRevert("Invalid oToken address");
        vm.deployCode(
            PoolBoosters.POOL_BOOSTER_FACTORY_SWAPX_SINGLE, abi.encode(address(0), governor, address(centralRegistry))
        );
    }

    function test_constructor_RevertWhen_zeroGovernor() public {
        vm.expectRevert("Invalid governor address");
        vm.deployCode(
            PoolBoosters.POOL_BOOSTER_FACTORY_SWAPX_SINGLE,
            abi.encode(address(oSonic), address(0), address(centralRegistry))
        );
    }

    function test_constructor_RevertWhen_zeroCentralRegistry() public {
        vm.expectRevert("Invalid central registry address");
        vm.deployCode(PoolBoosters.POOL_BOOSTER_FACTORY_SWAPX_SINGLE, abi.encode(address(oSonic), governor, address(0)));
    }
}
