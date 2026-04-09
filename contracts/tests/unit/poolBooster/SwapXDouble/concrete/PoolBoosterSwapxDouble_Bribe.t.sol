// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SwapXDouble_Shared_Test} from "tests/unit/poolBooster/SwapXDouble/shared/Shared.t.sol";

// --- Test utilities
import {PoolBoosters} from "tests/utils/artifacts/PoolBoosters.sol";

import {IPoolBooster} from "contracts/interfaces/poolBooster/IPoolBooster.sol";
import {IBribe} from "contracts/interfaces/poolBooster/ISwapXAlgebraBribe.sol";
import {IPoolBoosterSwapxDouble} from "contracts/interfaces/poolBooster/IPoolBoosterSwapxDouble.sol";

contract Unit_Concrete_PoolBoosterSwapxDouble_Bribe_Test is Unit_SwapXDouble_Shared_Test {
    function test_bribe() public {
        _dealOSonic(address(boosterSwapxDouble), 1e18);
        _mockBribeNotifyRewardAmount(mockBribeContractOS);
        _mockBribeNotifyRewardAmount(mockBribeContractOther);

        vm.expectCall(
            mockBribeContractOS, abi.encodeWithSelector(IBribe.notifyRewardAmount.selector, address(oSonic), 5e17)
        );
        vm.expectCall(
            mockBribeContractOther, abi.encodeWithSelector(IBribe.notifyRewardAmount.selector, address(oSonic), 5e17)
        );

        boosterSwapxDouble.bribe();
    }

    function test_bribe_event() public {
        _dealOSonic(address(boosterSwapxDouble), 1e18);
        _mockBribeNotifyRewardAmount(mockBribeContractOS);
        _mockBribeNotifyRewardAmount(mockBribeContractOther);

        vm.expectEmit(true, true, true, true);
        emit IPoolBooster.BribeExecuted(1e18);

        boosterSwapxDouble.bribe();
    }

    function test_bribe_correctSplit() public {
        uint256 balance = 1e18;
        _dealOSonic(address(boosterSwapxDouble), balance);
        _mockBribeNotifyRewardAmount(mockBribeContractOS);
        _mockBribeNotifyRewardAmount(mockBribeContractOther);

        // With 50% split: osBribe = 5e17, otherBribe = 5e17
        uint256 expectedOS = 5e17;
        uint256 expectedOther = 5e17;

        vm.expectCall(
            mockBribeContractOS, abi.encodeWithSelector(IBribe.notifyRewardAmount.selector, address(oSonic), expectedOS)
        );
        vm.expectCall(
            mockBribeContractOther,
            abi.encodeWithSelector(IBribe.notifyRewardAmount.selector, address(oSonic), expectedOther)
        );

        boosterSwapxDouble.bribe();
    }

    function test_bribe_asymmetricSplit() public {
        // Deploy new booster with 30% split
        IPoolBoosterSwapxDouble asymmetricBooster = IPoolBoosterSwapxDouble(
            vm.deployCode(
                PoolBoosters.POOL_BOOSTER_SWAPX_DOUBLE,
                abi.encode(mockBribeContractOS, mockBribeContractOther, address(oSonic), 30e16)
            )
        );

        uint256 balance = 1e18;
        _dealOSonic(address(asymmetricBooster), balance);
        _mockBribeNotifyRewardAmount(mockBribeContractOS);
        _mockBribeNotifyRewardAmount(mockBribeContractOther);

        // 30% to OS = 3e17, 70% to Other = 7e17
        uint256 expectedOS = 3e17;
        uint256 expectedOther = 7e17;

        vm.expectCall(
            mockBribeContractOS, abi.encodeWithSelector(IBribe.notifyRewardAmount.selector, address(oSonic), expectedOS)
        );
        vm.expectCall(
            mockBribeContractOther,
            abi.encodeWithSelector(IBribe.notifyRewardAmount.selector, address(oSonic), expectedOther)
        );

        asymmetricBooster.bribe();
    }

    function test_bribe_skipBelowMin() public {
        uint256 amount = 1e10 - 1;
        _dealOSonic(address(boosterSwapxDouble), amount);

        boosterSwapxDouble.bribe();

        assertEq(oSonic.balanceOf(address(boosterSwapxDouble)), amount);
    }
}
