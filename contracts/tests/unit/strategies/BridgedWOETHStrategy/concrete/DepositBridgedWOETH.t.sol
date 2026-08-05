// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BridgedWOETHStrategy_Shared_Test} from "tests/unit/strategies/BridgedWOETHStrategy/shared/Shared.t.sol";

// --- Project imports
import {IBridgedWOETHStrategy} from "contracts/interfaces/strategies/IBridgedWOETHStrategy.sol";

contract Unit_Concrete_BridgedWOETHStrategy_DepositBridgedWOETH_Test is Unit_BridgedWOETHStrategy_Shared_Test {
    function test_depositBridgedWOETH_mintsAndTransfers() public {
        uint256 woethAmount = 10e18;
        uint256 oraclePrice = 1.1e18;
        uint256 expectedOeth = (woethAmount * oraclePrice) / 1 ether;

        _setupDeposit(governor, woethAmount, oraclePrice);

        vm.prank(governor);
        bridgedWOETHStrategy.depositBridgedWOETH(woethAmount);

        // Governor should have received OETH
        assertEq(oeth.balanceOf(governor), expectedOeth);
        // Strategy should have received bridgedWOETH
        assertEq(bridgedWOETH.balanceOf(address(bridgedWOETHStrategy)), woethAmount);
    }

    function test_depositBridgedWOETH_emitsDeposit() public {
        uint256 woethAmount = 10e18;
        uint256 oraclePrice = 1.1e18;
        uint256 expectedOeth = (woethAmount * oraclePrice) / 1 ether;

        _setupDeposit(governor, woethAmount, oraclePrice);

        vm.expectEmit(true, true, true, true);
        emit IBridgedWOETHStrategy.Deposit(address(mockWeth), address(bridgedWOETH), expectedOeth);

        vm.prank(governor);
        bridgedWOETHStrategy.depositBridgedWOETH(woethAmount);
    }

    function test_depositBridgedWOETH_updatesOraclePrice() public {
        uint256 woethAmount = 10e18;
        uint256 oraclePrice = 1.1e18;

        _setupDeposit(governor, woethAmount, oraclePrice);

        vm.prank(governor);
        bridgedWOETHStrategy.depositBridgedWOETH(woethAmount);

        assertEq(bridgedWOETHStrategy.lastOraclePrice(), uint128(oraclePrice));
    }

    function test_depositBridgedWOETH_calledByStrategist() public {
        uint256 woethAmount = 10e18;
        uint256 oraclePrice = 1.1e18;

        _setupDeposit(strategist, woethAmount, oraclePrice);

        vm.prank(strategist);
        bridgedWOETHStrategy.depositBridgedWOETH(woethAmount);

        assertEq(bridgedWOETH.balanceOf(address(bridgedWOETHStrategy)), woethAmount);
    }

    function test_depositBridgedWOETH_RevertWhen_calledByNonGovernorOrStrategist() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        bridgedWOETHStrategy.depositBridgedWOETH(10e18);
    }

    function test_depositBridgedWOETH_RevertWhen_zeroMintAmount() public {
        _mockOraclePrice(1e18 + 1);

        vm.prank(governor);
        vm.expectRevert("Invalid deposit amount");
        bridgedWOETHStrategy.depositBridgedWOETH(0);
    }

    function test_depositBridgedWOETH_RevertWhen_invalidOraclePrice() public {
        _mockOraclePrice(1 ether);

        vm.prank(governor);
        vm.expectRevert("Invalid wOETH value");
        bridgedWOETHStrategy.depositBridgedWOETH(10e18);
    }
}
