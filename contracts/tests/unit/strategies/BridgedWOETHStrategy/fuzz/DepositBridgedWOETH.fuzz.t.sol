// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BridgedWOETHStrategy_Shared_Test} from "tests/unit/strategies/BridgedWOETHStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_BridgedWOETHStrategy_DepositBridgedWOETH_Test is Unit_BridgedWOETHStrategy_Shared_Test {
    function testFuzz_depositBridgedWOETH_correctAmounts(uint128 woethAmount, uint128 oraclePrice) public {
        // Bound oracle price > 1 ether and reasonable upper bound
        oraclePrice = uint128(bound(uint256(oraclePrice), 1 ether + 1, 10 ether));
        // Bound woethAmount so oethToMint stays below MAX_SUPPLY (type(uint128).max)
        uint256 maxWoeth = (uint256(type(uint128).max) * 1 ether) / uint256(oraclePrice);
        woethAmount = uint128(bound(uint256(woethAmount), 1, maxWoeth));
        uint256 oethToMint = (uint256(woethAmount) * uint256(oraclePrice)) / 1 ether;
        vm.assume(oethToMint > 0);

        _setupDeposit(governor, woethAmount, oraclePrice);

        vm.prank(governor);
        bridgedWOETHStrategy.depositBridgedWOETH(woethAmount);

        assertEq(oeth.balanceOf(governor), oethToMint);
        assertEq(bridgedWOETH.balanceOf(address(bridgedWOETHStrategy)), woethAmount);
    }
}
