// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SwapXSingle_Shared_Test} from "tests/unit/poolBooster/SwapXSingle/shared/Shared.t.sol";

contract Unit_Concrete_PoolBoosterFactorySwapxSingle_ComputeAddress_Test is Unit_SwapXSingle_Shared_Test {
    function test_computeAddress() public view {
        address computed = factorySwapxSingle.computePoolBoosterAddress(mockBribeContract, mockAmmPool, 1);
        assertTrue(computed != address(0));
    }

    function test_computeAddress_deterministic() public view {
        address computed1 = factorySwapxSingle.computePoolBoosterAddress(mockBribeContract, mockAmmPool, 1);
        address computed2 = factorySwapxSingle.computePoolBoosterAddress(mockBribeContract, mockAmmPool, 1);
        assertEq(computed1, computed2);
    }

    function test_computeAddress_differentSalt() public view {
        address computed1 = factorySwapxSingle.computePoolBoosterAddress(mockBribeContract, mockAmmPool, 1);
        address computed2 = factorySwapxSingle.computePoolBoosterAddress(mockBribeContract, mockAmmPool, 2);
        assertTrue(computed1 != computed2);
    }

    function test_computeAddress_RevertWhen_zeroPool() public {
        vm.expectRevert("Invalid ammPoolAddress address");
        factorySwapxSingle.computePoolBoosterAddress(mockBribeContract, address(0), 1);
    }

    function test_computeAddress_RevertWhen_zeroSalt() public {
        vm.expectRevert("Invalid salt");
        factorySwapxSingle.computePoolBoosterAddress(mockBribeContract, mockAmmPool, 0);
    }
}
