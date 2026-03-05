// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SwapXDouble_Shared_Test} from "tests/unit/poolBooster/SwapXDouble/shared/Shared.t.sol";
import {PoolBoosterFactorySwapxDouble} from "contracts/poolBooster/PoolBoosterFactorySwapxDouble.sol";

contract Unit_Concrete_PoolBoosterFactorySwapxDouble_Constructor_Test is Unit_SwapXDouble_Shared_Test {
    function test_constructor() public view {
        assertEq(factorySwapxDouble.oToken(), address(oSonic));
        assertEq(factorySwapxDouble.governor(), governor);
        assertEq(address(factorySwapxDouble.centralRegistry()), address(centralRegistry));
        assertEq(factorySwapxDouble.version(), 1);
    }

    function test_constructor_RevertWhen_zeroOToken() public {
        vm.expectRevert("Invalid oToken address");
        new PoolBoosterFactorySwapxDouble(address(0), governor, address(centralRegistry));
    }

    function test_constructor_RevertWhen_zeroGovernor() public {
        vm.expectRevert("Invalid governor address");
        new PoolBoosterFactorySwapxDouble(address(oSonic), address(0), address(centralRegistry));
    }

    function test_constructor_RevertWhen_zeroCentralRegistry() public {
        vm.expectRevert("Invalid central registry address");
        new PoolBoosterFactorySwapxDouble(address(oSonic), governor, address(0));
    }
}
