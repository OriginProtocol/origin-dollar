// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SwapXDouble_Shared_Test} from "tests/unit/poolBooster/SwapXDouble/shared/Shared.sol";
import {PoolBoosterSwapxDouble} from "contracts/poolBooster/PoolBoosterSwapxDouble.sol";

contract Unit_Concrete_PoolBoosterSwapxDouble_Constructor_Test is Unit_SwapXDouble_Shared_Test {
    function test_constructor() public view {
        assertEq(address(boosterSwapxDouble.bribeContractOS()), mockBribeContractOS);
        assertEq(address(boosterSwapxDouble.bribeContractOther()), mockBribeContractOther);
        assertEq(address(boosterSwapxDouble.osToken()), address(oSonic));
        assertEq(boosterSwapxDouble.split(), DEFAULT_SPLIT);
        assertEq(boosterSwapxDouble.MIN_BRIBE_AMOUNT(), 1e10);
    }

    function test_constructor_RevertWhen_zeroBribeContractOS() public {
        vm.expectRevert("Invalid bribeContractOS address");
        new PoolBoosterSwapxDouble(address(0), mockBribeContractOther, address(oSonic), DEFAULT_SPLIT);
    }

    function test_constructor_RevertWhen_zeroBribeContractOther() public {
        vm.expectRevert("Invalid bribeContractOther address");
        new PoolBoosterSwapxDouble(mockBribeContractOS, address(0), address(oSonic), DEFAULT_SPLIT);
    }

    function test_constructor_RevertWhen_splitTooLow() public {
        vm.expectRevert("Unexpected split amount");
        new PoolBoosterSwapxDouble(mockBribeContractOS, mockBribeContractOther, address(oSonic), 1e16);
    }

    function test_constructor_RevertWhen_splitTooHigh() public {
        vm.expectRevert("Unexpected split amount");
        new PoolBoosterSwapxDouble(mockBribeContractOS, mockBribeContractOther, address(oSonic), 99e16);
    }

    function test_constructor_splitMinValid() public {
        PoolBoosterSwapxDouble booster = new PoolBoosterSwapxDouble(
            mockBribeContractOS, mockBribeContractOther, address(oSonic), 1e16 + 1
        );
        assertEq(booster.split(), 1e16 + 1);
    }

    function test_constructor_splitMaxValid() public {
        PoolBoosterSwapxDouble booster = new PoolBoosterSwapxDouble(
            mockBribeContractOS, mockBribeContractOther, address(oSonic), 99e16 - 1
        );
        assertEq(booster.split(), 99e16 - 1);
    }
}
