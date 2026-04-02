// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SwapXDouble_Shared_Test} from "tests/unit/poolBooster/SwapXDouble/shared/Shared.t.sol";
import {IPoolBoosterSwapxDouble} from "contracts/interfaces/poolBooster/IPoolBoosterSwapxDouble.sol";
import {IBribe} from "contracts/interfaces/poolBooster/ISwapXAlgebraBribe.sol";
import {StableMath} from "contracts/utils/StableMath.sol";

contract Unit_Fuzz_PoolBoosterSwapxDouble_Bribe_Test is Unit_SwapXDouble_Shared_Test {
    using StableMath for uint256;

    function testFuzz_bribeSplit(uint256 balance, uint256 split) public {
        balance = bound(balance, 1e10, 1e30);
        split = bound(split, 1e16 + 1, 99e16 - 1);

        // Deploy a new PoolBoosterSwapxDouble with the fuzzed split
        IPoolBoosterSwapxDouble fuzzedBooster = IPoolBoosterSwapxDouble(
            vm.deployCode(
                "contracts/poolBooster/PoolBoosterSwapxDouble.sol:PoolBoosterSwapxDouble",
                abi.encode(mockBribeContractOS, mockBribeContractOther, address(oSonic), split)
            )
        );

        // Deal oSonic to the booster
        _dealOSonic(address(fuzzedBooster), balance);

        // Mock both bribe contracts
        _mockBribeNotifyRewardAmount(mockBribeContractOS);
        _mockBribeNotifyRewardAmount(mockBribeContractOther);

        // Compute expected amounts using StableMath (same logic as the contract)
        uint256 expectedOsBribeAmount = balance.mulTruncate(split);
        uint256 expectedOtherBribeAmount = balance - expectedOsBribeAmount;

        // Verify total split equals the original balance (no rounding leakage)
        assertEq(expectedOsBribeAmount + expectedOtherBribeAmount, balance);

        // Verify the contract will call notifyRewardAmount with the expected amounts
        vm.expectCall(
            mockBribeContractOS,
            abi.encodeWithSelector(IBribe.notifyRewardAmount.selector, address(oSonic), expectedOsBribeAmount)
        );
        vm.expectCall(
            mockBribeContractOther,
            abi.encodeWithSelector(IBribe.notifyRewardAmount.selector, address(oSonic), expectedOtherBribeAmount)
        );

        // Execute the bribe
        fuzzedBooster.bribe();
    }
}
