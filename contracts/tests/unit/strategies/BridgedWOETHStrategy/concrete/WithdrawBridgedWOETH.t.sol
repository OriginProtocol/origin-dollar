// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BridgedWOETHStrategy_Shared_Test} from "tests/unit/strategies/BridgedWOETHStrategy/shared/Shared.t.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

contract Unit_Concrete_BridgedWOETHStrategy_WithdrawBridgedWOETH_Test is Unit_BridgedWOETHStrategy_Shared_Test {
    function test_withdrawBridgedWOETH_burnsAndTransfers() public {
        uint256 oethToBurn = 11e18;
        uint256 oraclePrice = 1.1e18;
        uint256 expectedWoeth = (oethToBurn * 1 ether) / oraclePrice;

        _setupWithdraw(governor, oethToBurn, oraclePrice);

        vm.prank(governor);
        bridgedWOETHStrategy.withdrawBridgedWOETH(oethToBurn);

        // Governor should have received bridgedWOETH
        assertEq(bridgedWOETH.balanceOf(governor), expectedWoeth);
    }

    function test_withdrawBridgedWOETH_emitsWithdrawal() public {
        uint256 oethToBurn = 11e18;
        uint256 oraclePrice = 1.1e18;

        _setupWithdraw(governor, oethToBurn, oraclePrice);

        vm.expectEmit(true, true, true, true);
        emit InitializableAbstractStrategy.Withdrawal(address(mockWeth), address(bridgedWOETH), oethToBurn);

        vm.prank(governor);
        bridgedWOETHStrategy.withdrawBridgedWOETH(oethToBurn);
    }

    function test_withdrawBridgedWOETH_calledByStrategist() public {
        uint256 oethToBurn = 11e18;
        uint256 oraclePrice = 1.1e18;

        _setupWithdraw(strategist, oethToBurn, oraclePrice);

        vm.prank(strategist);
        bridgedWOETHStrategy.withdrawBridgedWOETH(oethToBurn);

        uint256 expectedWoeth = (oethToBurn * 1 ether) / oraclePrice;
        assertEq(bridgedWOETH.balanceOf(strategist), expectedWoeth);
    }

    function test_withdrawBridgedWOETH_RevertWhen_calledByNonGovernorOrStrategist() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        bridgedWOETHStrategy.withdrawBridgedWOETH(11e18);
    }

    function test_withdrawBridgedWOETH_RevertWhen_zeroWoethAmount() public {
        _mockOraclePrice(1e18 + 1);

        vm.prank(governor);
        vm.expectRevert("Invalid withdraw amount");
        bridgedWOETHStrategy.withdrawBridgedWOETH(0);
    }

    function test_withdrawBridgedWOETH_RevertWhen_invalidOraclePrice() public {
        _mockOraclePrice(1 ether);

        vm.prank(governor);
        vm.expectRevert("Invalid wOETH value");
        bridgedWOETHStrategy.withdrawBridgedWOETH(11e18);
    }
}
