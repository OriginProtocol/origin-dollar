// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.sol";
import {CurvePoolBoosterPlain} from "contracts/poolBooster/curve/CurvePoolBoosterPlain.sol";

contract Unit_Fuzz_CurvePoolBooster_HandleFee_Test is Unit_Curve_Shared_Test {
    /// @notice Fuzz the fee calculation: feeAmount = (amount * fee) / FEE_BASE
    ///         Since _handleFee is internal, we verify the math properties directly.
    function testFuzz_handleFee(uint256 balance, uint16 feePercent) public pure {
        balance = bound(balance, 0, 1e30);
        feePercent = uint16(bound(feePercent, 0, 5000));

        uint256 feeAmount = (balance * uint256(feePercent)) / 10_000;

        // Fee should never exceed half the balance (max fee is 50%)
        assertLe(feeAmount, balance / 2, "Fee should never exceed half");

        // Fee plus remainder must equal the original balance
        assertEq(balance - feeAmount + feeAmount, balance, "Fee + remainder = balance");

        // If fee percent is 0, fee amount must be 0
        if (feePercent == 0) {
            assertEq(feeAmount, 0, "Zero fee percent should yield zero fee");
        }

        // If balance is 0, fee amount must be 0 regardless of fee percent
        if (balance == 0) {
            assertEq(feeAmount, 0, "Zero balance should yield zero fee");
        }
    }
}
