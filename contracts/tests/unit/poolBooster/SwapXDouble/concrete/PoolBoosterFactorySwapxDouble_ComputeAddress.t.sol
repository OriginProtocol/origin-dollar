// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SwapXDouble_Shared_Test} from "tests/unit/poolBooster/SwapXDouble/shared/Shared.sol";

contract Unit_Concrete_PoolBoosterFactorySwapxDouble_ComputeAddress_Test is Unit_SwapXDouble_Shared_Test {
    function test_computeAddress_deterministic() public view {
        address computed1 = factorySwapxDouble.computePoolBoosterAddress(
            mockBribeContractOS, mockBribeContractOther, mockAmmPool, DEFAULT_SPLIT, 1
        );
        address computed2 = factorySwapxDouble.computePoolBoosterAddress(
            mockBribeContractOS, mockBribeContractOther, mockAmmPool, DEFAULT_SPLIT, 1
        );
        assertEq(computed1, computed2);
    }

    function test_computeAddress_differentSalt() public view {
        address computed1 = factorySwapxDouble.computePoolBoosterAddress(
            mockBribeContractOS, mockBribeContractOther, mockAmmPool, DEFAULT_SPLIT, 1
        );
        address computed2 = factorySwapxDouble.computePoolBoosterAddress(
            mockBribeContractOS, mockBribeContractOther, mockAmmPool, DEFAULT_SPLIT, 2
        );
        assertTrue(computed1 != computed2);
    }

    function test_computeAddress_RevertWhen_zeroPool() public {
        vm.expectRevert("Invalid ammPoolAddress address");
        factorySwapxDouble.computePoolBoosterAddress(
            mockBribeContractOS, mockBribeContractOther, address(0), DEFAULT_SPLIT, 1
        );
    }

    function test_computeAddress_RevertWhen_zeroSalt() public {
        vm.expectRevert("Invalid salt");
        factorySwapxDouble.computePoolBoosterAddress(
            mockBribeContractOS, mockBribeContractOther, mockAmmPool, DEFAULT_SPLIT, 0
        );
    }
}
