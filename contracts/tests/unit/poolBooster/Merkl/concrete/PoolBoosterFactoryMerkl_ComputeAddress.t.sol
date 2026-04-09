// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Merkl_Shared_Test} from "tests/unit/poolBooster/Merkl/shared/Shared.t.sol";

contract Unit_Concrete_PoolBoosterFactoryMerkl_ComputeAddress_Test is Unit_Merkl_Shared_Test {
    function test_computeAddress_deterministic() public view {
        address computed1 = factoryMerkl.computePoolBoosterAddress(1, _defaultInitData());
        address computed2 = factoryMerkl.computePoolBoosterAddress(1, _defaultInitData());
        assertEq(computed1, computed2);
    }

    function test_computeAddress_differentSalt() public view {
        address computed1 = factoryMerkl.computePoolBoosterAddress(1, _defaultInitData());
        address computed2 = factoryMerkl.computePoolBoosterAddress(2, _defaultInitData());
        assertTrue(computed1 != computed2);
    }

    function test_computeAddress_RevertWhen_zeroSalt() public {
        vm.expectRevert("Invalid salt");
        factoryMerkl.computePoolBoosterAddress(0, _defaultInitData());
    }
}
