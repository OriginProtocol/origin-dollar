// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BridgedWOETHStrategy_Shared_Test} from "tests/unit/strategies/BridgedWOETHStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_BridgedWOETHStrategy_WithdrawBridgedWOETH_Test is Unit_BridgedWOETHStrategy_Shared_Test {
    function testFuzz_withdrawBridgedWOETH_correctAmounts(uint128 oethToBurn, uint128 oraclePrice) public {
        // Bound oracle price > 1 ether and reasonable upper bound
        oraclePrice = uint128(bound(uint256(oraclePrice), 1 ether + 1, 10 ether));
        // Bound oethToBurn below MAX_SUPPLY (type(uint128).max)
        oethToBurn = uint128(bound(uint256(oethToBurn), 1, uint256(type(uint128).max) - 1));
        // Ensure woethAmount is non-zero
        uint256 woethAmount = (uint256(oethToBurn) * 1 ether) / uint256(oraclePrice);
        vm.assume(woethAmount > 0);

        _setupWithdraw(governor, oethToBurn, oraclePrice);

        vm.prank(governor);
        bridgedWOETHStrategy.withdrawBridgedWOETH(oethToBurn);

        assertEq(bridgedWOETH.balanceOf(governor), woethAmount);
    }
}
