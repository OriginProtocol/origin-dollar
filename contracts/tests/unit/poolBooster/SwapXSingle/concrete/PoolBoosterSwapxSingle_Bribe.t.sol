// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SwapXSingle_Shared_Test} from "tests/unit/poolBooster/SwapXSingle/shared/Shared.t.sol";
import {IPoolBooster} from "contracts/interfaces/poolBooster/IPoolBooster.sol";
import {IBribe} from "contracts/interfaces/poolBooster/ISwapXAlgebraBribe.sol";

contract Unit_Concrete_PoolBoosterSwapxSingle_Bribe_Test is Unit_SwapXSingle_Shared_Test {
    function test_bribe() public {
        _dealOSonic(address(boosterSwapxSingle), 1e18);
        _mockBribeNotifyRewardAmount(mockBribeContract);

        vm.expectCall(
            mockBribeContract, abi.encodeWithSelector(IBribe.notifyRewardAmount.selector, address(oSonic), 1e18)
        );

        boosterSwapxSingle.bribe();
    }

    function test_bribe_event() public {
        _dealOSonic(address(boosterSwapxSingle), 1e18);
        _mockBribeNotifyRewardAmount(mockBribeContract);

        vm.expectEmit(true, true, true, true);
        emit IPoolBooster.BribeExecuted(1e18);

        boosterSwapxSingle.bribe();
    }

    function test_bribe_approval() public {
        _dealOSonic(address(boosterSwapxSingle), 1e18);
        _mockBribeNotifyRewardAmount(mockBribeContract);

        boosterSwapxSingle.bribe();

        uint256 allowance = oSonic.allowance(address(boosterSwapxSingle), mockBribeContract);
        assertEq(allowance, 1e18);
    }

    function test_bribe_skipBelowMin() public {
        uint256 amount = 1e10 - 1;
        _dealOSonic(address(boosterSwapxSingle), amount);

        boosterSwapxSingle.bribe();

        assertEq(oSonic.balanceOf(address(boosterSwapxSingle)), amount);
    }

    function test_bribe_skipZeroBalance() public {
        assertEq(oSonic.balanceOf(address(boosterSwapxSingle)), 0);

        boosterSwapxSingle.bribe();

        assertEq(oSonic.balanceOf(address(boosterSwapxSingle)), 0);
    }

    function test_bribe_anyoneCanCall() public {
        _dealOSonic(address(boosterSwapxSingle), 1e18);
        _mockBribeNotifyRewardAmount(mockBribeContract);

        vm.prank(alice);
        boosterSwapxSingle.bribe();

        // Verify notifyRewardAmount was called (bribe executed successfully)
        uint256 allowance = oSonic.allowance(address(boosterSwapxSingle), mockBribeContract);
        assertEq(allowance, 1e18);
    }
}
