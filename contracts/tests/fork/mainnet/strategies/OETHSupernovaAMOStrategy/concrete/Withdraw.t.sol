// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Mainnet} from "tests/utils/Addresses.sol";
import {
    Fork_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/fork/mainnet/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";
import {IGauge} from "contracts/interfaces/algebra/IAlgebraGauge.sol";
import {IOETHSupernovaAMOStrategy} from "contracts/interfaces/strategies/IOETHSupernovaAMOStrategy.sol";

contract Fork_Concrete_OETHSupernovaAMOStrategy_Withdraw_Test is Fork_OETHSupernovaAMOStrategy_Shared_Test {
    uint256 internal constant DEPOSIT_AMOUNT = 100_000 ether;

    function setUp() public override {
        super.setUp();
        // Deposit to strategy so there's something to withdraw
        _depositAsVault(DEPOSIT_AMOUNT);
    }

    //////////////////////////////////////////////////////
    /// --- WITHDRAW ALL
    //////////////////////////////////////////////////////

    function test_withdrawAll() public {
        uint256 gaugeBefore = supernovaGauge.balanceOf(address(oethSupernovaAMOStrategy));
        assertGt(gaugeBefore, 0, "No gauge balance");
        uint256 vaultWETHBefore = IERC20(Mainnet.WETH).balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdrawAll();

        // Gauge should be empty
        assertEq(supernovaGauge.balanceOf(address(oethSupernovaAMOStrategy)), 0);
        // Vault should have received WETH
        assertGt(IERC20(Mainnet.WETH).balanceOf(address(oethVault)), vaultWETHBefore);
        // checkBalance should be 0
        assertEq(oethSupernovaAMOStrategy.checkBalance(Mainnet.WETH), 0);
        // No residual tokens
        assertEq(oeth.balanceOf(address(oethSupernovaAMOStrategy)), 0);
        assertEq(IERC20(address(supernovaPool)).balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_withdrawAll_emergencyMode() public {
        // Activate emergency mode on the gauge
        (, bytes memory ownerData) = address(supernovaGauge).staticcall(abi.encodeWithSignature("owner()"));
        address gaugeOwner = abi.decode(ownerData, (address));
        vm.prank(gaugeOwner);
        (bool success,) = address(supernovaGauge).call(abi.encodeWithSignature("activateEmergencyMode()"));
        require(success, "activateEmergencyMode failed");

        uint256 vaultWETHBefore = IERC20(Mainnet.WETH).balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdrawAll();

        // Gauge should be empty
        assertEq(supernovaGauge.balanceOf(address(oethSupernovaAMOStrategy)), 0);
        // Vault should have received WETH
        assertGt(IERC20(Mainnet.WETH).balanceOf(address(oethVault)), vaultWETHBefore);
        // No residual tokens
        assertEq(oeth.balanceOf(address(oethSupernovaAMOStrategy)), 0);

        // Try again when strategy is empty - should not revert
        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdrawAll();
    }

    function test_withdrawAll_emptyStrategy() public {
        // First withdraw all
        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdrawAll();

        // Now try again when empty - should silently succeed (no events)
        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdrawAll();

        assertEq(supernovaGauge.balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_withdrawAll_noResidualTokens() public {
        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdrawAll();

        assertEq(IERC20(Mainnet.WETH).balanceOf(address(oethSupernovaAMOStrategy)), 0);
        assertEq(oeth.balanceOf(address(oethSupernovaAMOStrategy)), 0);
        assertEq(IERC20(address(supernovaPool)).balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_withdrawAll_onlyVaultAndGovernor() public {
        // Strategist and nick cannot withdrawAll
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Vault or Governor");
        oethSupernovaAMOStrategy.withdrawAll();

        vm.prank(nick);
        vm.expectRevert("Caller is not the Vault or Governor");
        oethSupernovaAMOStrategy.withdrawAll();

        // Governor (timelock) can withdrawAll
        vm.prank(governor);
        oethSupernovaAMOStrategy.withdrawAll();

        assertEq(supernovaGauge.balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    //////////////////////////////////////////////////////
    /// --- WITHDRAW (PARTIAL)
    //////////////////////////////////////////////////////

    function test_withdraw_partial() public {
        uint256 withdrawAmount = 1000 ether;
        uint256 vaultWETHBefore = IERC20(Mainnet.WETH).balanceOf(address(oethVault));
        uint256 checkBalBefore = oethSupernovaAMOStrategy.checkBalance(Mainnet.WETH);

        vm.expectEmit(address(oethSupernovaAMOStrategy));
        emit IOETHSupernovaAMOStrategy.Withdrawal(Mainnet.WETH, address(supernovaPool), withdrawAmount);

        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdraw(address(oethVault), Mainnet.WETH, withdrawAmount);

        // Vault should have received exactly the requested amount
        assertEq(IERC20(Mainnet.WETH).balanceOf(address(oethVault)), vaultWETHBefore + withdrawAmount);
        // checkBalance should decrease
        assertLt(oethSupernovaAMOStrategy.checkBalance(Mainnet.WETH), checkBalBefore);
        // Still has gauge balance
        assertGt(supernovaGauge.balanceOf(address(oethSupernovaAMOStrategy)), 0);
        // No residual OETH
        assertEq(oeth.balanceOf(address(oethSupernovaAMOStrategy)), 0);
        // No residual pool LP
        assertEq(IERC20(address(supernovaPool)).balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_withdraw_burnsOTokens() public {
        uint256 oethSupplyBefore = oeth.totalSupply();

        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdraw(address(oethVault), Mainnet.WETH, 1000 ether);

        // OETH supply should decrease (tokens were burned)
        assertLt(oeth.totalSupply(), oethSupplyBefore);
    }

    //////////////////////////////////////////////////////
    /// --- REVERT CASES
    //////////////////////////////////////////////////////

    function test_withdraw_RevertWhen_zeroAmount() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Must withdraw something");
        oethSupernovaAMOStrategy.withdraw(address(oethVault), Mainnet.WETH, 0);
    }

    function test_withdraw_RevertWhen_unsupportedAsset() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Unsupported asset");
        oethSupernovaAMOStrategy.withdraw(address(oethVault), address(oeth), 1 ether);
    }

    function test_withdraw_RevertWhen_notToVault() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Only withdraw to vault allowed");
        oethSupernovaAMOStrategy.withdraw(nick, Mainnet.WETH, 1 ether);
    }

    function test_withdraw_RevertWhen_notVault() public {
        address[3] memory unauthorized = [strategist, governor, nick];
        for (uint256 i = 0; i < unauthorized.length; i++) {
            vm.prank(unauthorized[i]);
            vm.expectRevert("Caller is not the Vault");
            oethSupernovaAMOStrategy.withdraw(address(oethVault), Mainnet.WETH, 50 ether);
        }
    }

    //////////////////////////////////////////////////////
    /// --- TILTED POOL SCENARIOS
    //////////////////////////////////////////////////////

    function test_withdrawAll_poolWithMoreOETH() public {
        _tiltPoolToMoreOETH(1_000_000 ether);

        uint256 vaultWETHBefore = IERC20(Mainnet.WETH).balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdrawAll();

        assertEq(supernovaGauge.balanceOf(address(oethSupernovaAMOStrategy)), 0);
        assertGt(IERC20(Mainnet.WETH).balanceOf(address(oethVault)), vaultWETHBefore);
        assertEq(oeth.balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_withdrawAll_poolWithMoreWETH() public {
        _tiltPoolToMoreWETH(2_000_000 ether);

        uint256 vaultWETHBefore = IERC20(Mainnet.WETH).balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdrawAll();

        assertEq(supernovaGauge.balanceOf(address(oethSupernovaAMOStrategy)), 0);
        assertGt(IERC20(Mainnet.WETH).balanceOf(address(oethVault)), vaultWETHBefore);
        assertEq(oeth.balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_withdraw_poolWithMoreOETH() public {
        _tiltPoolToMoreOETH(1_000_000 ether);

        uint256 withdrawAmount = 4000 ether;
        uint256 vaultWETHBefore = IERC20(Mainnet.WETH).balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdraw(address(oethVault), Mainnet.WETH, withdrawAmount);

        assertEq(IERC20(Mainnet.WETH).balanceOf(address(oethVault)), vaultWETHBefore + withdrawAmount);
        assertEq(oeth.balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_withdraw_poolWithMoreWETH() public {
        _tiltPoolToMoreWETH(2_000_000 ether);

        uint256 withdrawAmount = 1000 ether;
        uint256 vaultWETHBefore = IERC20(Mainnet.WETH).balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdraw(address(oethVault), Mainnet.WETH, withdrawAmount);

        assertEq(IERC20(Mainnet.WETH).balanceOf(address(oethVault)), vaultWETHBefore + withdrawAmount);
        assertEq(oeth.balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    //////////////////////////////////////////////////////
    /// --- INSOLVENCY
    //////////////////////////////////////////////////////

    function test_withdraw_RevertWhen_protocolInsolvent() public {
        _makeInsolvent();

        vm.prank(address(oethVault));
        vm.expectRevert("Protocol insolvent");
        oethSupernovaAMOStrategy.withdraw(address(oethVault), Mainnet.WETH, 10 ether);
    }

    function test_withdrawAll_succeeds_whenProtocolInsolvent() public {
        _makeInsolvent();

        // withdrawAll should succeed even when insolvent (no solvency check)
        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdrawAll();

        assertEq(supernovaGauge.balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }
}
