// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Sonic} from "tests/utils/Addresses.sol";
import {Fork_SonicSwapXAMOStrategy_Shared_Test} from
    "tests/fork/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";
import {IGauge} from "contracts/interfaces/sonic/ISwapXGauge.sol";

contract Fork_Concrete_SonicSwapXAMOStrategy_Withdraw_Test is Fork_SonicSwapXAMOStrategy_Shared_Test {
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
        uint256 gaugeBefore = swapXGauge.balanceOf(address(sonicSwapXAMOStrategy));
        assertGt(gaugeBefore, 0, "No gauge balance");
        uint256 vaultWSBefore = IERC20(Sonic.wS).balanceOf(address(oSonicVault));

        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdrawAll();

        // Gauge should be empty
        assertEq(swapXGauge.balanceOf(address(sonicSwapXAMOStrategy)), 0);
        // Vault should have received wS
        assertGt(IERC20(Sonic.wS).balanceOf(address(oSonicVault)), vaultWSBefore);
        // checkBalance should be 0
        assertEq(sonicSwapXAMOStrategy.checkBalance(Sonic.wS), 0);
        // No residual tokens
        assertEq(oSonic.balanceOf(address(sonicSwapXAMOStrategy)), 0);
        assertEq(IERC20(address(swapXPool)).balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_withdrawAll_emergencyMode() public {
        // Activate emergency mode on the gauge
        (, bytes memory ownerData) = address(swapXGauge).staticcall(abi.encodeWithSignature("owner()"));
        address gaugeOwner = abi.decode(ownerData, (address));
        vm.prank(gaugeOwner);
        (bool success,) = address(swapXGauge).call(abi.encodeWithSignature("activateEmergencyMode()"));
        require(success, "activateEmergencyMode failed");

        uint256 vaultWSBefore = IERC20(Sonic.wS).balanceOf(address(oSonicVault));

        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdrawAll();

        // Gauge should be empty
        assertEq(swapXGauge.balanceOf(address(sonicSwapXAMOStrategy)), 0);
        // Vault should have received wS
        assertGt(IERC20(Sonic.wS).balanceOf(address(oSonicVault)), vaultWSBefore);
        // No residual tokens
        assertEq(oSonic.balanceOf(address(sonicSwapXAMOStrategy)), 0);

        // Try again when strategy is empty - should not revert
        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdrawAll();
    }

    function test_withdrawAll_emptyStrategy() public {
        // First withdraw all
        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdrawAll();

        // Now try again when empty - should silently succeed (no events)
        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdrawAll();

        assertEq(swapXGauge.balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_withdrawAll_noResidualTokens() public {
        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdrawAll();

        assertEq(IERC20(Sonic.wS).balanceOf(address(sonicSwapXAMOStrategy)), 0);
        assertEq(oSonic.balanceOf(address(sonicSwapXAMOStrategy)), 0);
        assertEq(IERC20(address(swapXPool)).balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_withdrawAll_onlyVaultAndGovernor() public {
        // Strategist and nick cannot withdrawAll
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Vault or Governor");
        sonicSwapXAMOStrategy.withdrawAll();

        vm.prank(nick);
        vm.expectRevert("Caller is not the Vault or Governor");
        sonicSwapXAMOStrategy.withdrawAll();

        // Governor (timelock) can withdrawAll
        vm.prank(governor);
        sonicSwapXAMOStrategy.withdrawAll();

        assertEq(swapXGauge.balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    //////////////////////////////////////////////////////
    /// --- WITHDRAW (PARTIAL)
    //////////////////////////////////////////////////////

    function test_withdraw_partial() public {
        uint256 withdrawAmount = 1000 ether;
        uint256 vaultWSBefore = IERC20(Sonic.wS).balanceOf(address(oSonicVault));
        uint256 checkBalBefore = sonicSwapXAMOStrategy.checkBalance(Sonic.wS);

        vm.expectEmit(address(sonicSwapXAMOStrategy));
        emit InitializableAbstractStrategy.Withdrawal(Sonic.wS, address(swapXPool), withdrawAmount);

        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), Sonic.wS, withdrawAmount);

        // Vault should have received exactly the requested amount
        assertEq(IERC20(Sonic.wS).balanceOf(address(oSonicVault)), vaultWSBefore + withdrawAmount);
        // checkBalance should decrease
        assertLt(sonicSwapXAMOStrategy.checkBalance(Sonic.wS), checkBalBefore);
        // Still has gauge balance
        assertGt(swapXGauge.balanceOf(address(sonicSwapXAMOStrategy)), 0);
        // No residual OS
        assertEq(oSonic.balanceOf(address(sonicSwapXAMOStrategy)), 0);
        // No residual pool LP
        assertEq(IERC20(address(swapXPool)).balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_withdraw_burnsOTokens() public {
        uint256 osSupplyBefore = oSonic.totalSupply();

        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), Sonic.wS, 1000 ether);

        // OS supply should decrease (tokens were burned)
        assertLt(oSonic.totalSupply(), osSupplyBefore);
    }

    //////////////////////////////////////////////////////
    /// --- REVERT CASES
    //////////////////////////////////////////////////////

    function test_withdraw_RevertWhen_zeroAmount() public {
        vm.prank(address(oSonicVault));
        vm.expectRevert("Must withdraw something");
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), Sonic.wS, 0);
    }

    function test_withdraw_RevertWhen_unsupportedAsset() public {
        vm.prank(address(oSonicVault));
        vm.expectRevert("Unsupported asset");
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), address(oSonic), 1 ether);
    }

    function test_withdraw_RevertWhen_notToVault() public {
        vm.prank(address(oSonicVault));
        vm.expectRevert("Only withdraw to vault allowed");
        sonicSwapXAMOStrategy.withdraw(nick, Sonic.wS, 1 ether);
    }

    function test_withdraw_RevertWhen_notVault() public {
        address[3] memory unauthorized = [strategist, governor, nick];
        for (uint256 i = 0; i < unauthorized.length; i++) {
            vm.prank(unauthorized[i]);
            vm.expectRevert("Caller is not the Vault");
            sonicSwapXAMOStrategy.withdraw(address(oSonicVault), Sonic.wS, 50 ether);
        }
    }

    //////////////////////////////////////////////////////
    /// --- TILTED POOL SCENARIOS
    //////////////////////////////////////////////////////

    function test_withdrawAll_poolWithMoreOS() public {
        _tiltPoolToMoreOS(1_000_000 ether);

        uint256 vaultWSBefore = IERC20(Sonic.wS).balanceOf(address(oSonicVault));

        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdrawAll();

        assertEq(swapXGauge.balanceOf(address(sonicSwapXAMOStrategy)), 0);
        assertGt(IERC20(Sonic.wS).balanceOf(address(oSonicVault)), vaultWSBefore);
        assertEq(oSonic.balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_withdrawAll_poolWithMoreWS() public {
        _tiltPoolToMoreWS(2_000_000 ether);

        uint256 vaultWSBefore = IERC20(Sonic.wS).balanceOf(address(oSonicVault));

        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdrawAll();

        assertEq(swapXGauge.balanceOf(address(sonicSwapXAMOStrategy)), 0);
        assertGt(IERC20(Sonic.wS).balanceOf(address(oSonicVault)), vaultWSBefore);
        assertEq(oSonic.balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_withdraw_poolWithMoreOS() public {
        _tiltPoolToMoreOS(1_000_000 ether);

        uint256 withdrawAmount = 4000 ether;
        uint256 vaultWSBefore = IERC20(Sonic.wS).balanceOf(address(oSonicVault));

        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), Sonic.wS, withdrawAmount);

        assertEq(IERC20(Sonic.wS).balanceOf(address(oSonicVault)), vaultWSBefore + withdrawAmount);
        assertEq(oSonic.balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_withdraw_poolWithMoreWS() public {
        _tiltPoolToMoreWS(2_000_000 ether);

        uint256 withdrawAmount = 1000 ether;
        uint256 vaultWSBefore = IERC20(Sonic.wS).balanceOf(address(oSonicVault));

        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), Sonic.wS, withdrawAmount);

        assertEq(IERC20(Sonic.wS).balanceOf(address(oSonicVault)), vaultWSBefore + withdrawAmount);
        assertEq(oSonic.balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    //////////////////////////////////////////////////////
    /// --- INSOLVENCY
    //////////////////////////////////////////////////////

    function test_withdraw_RevertWhen_protocolInsolvent() public {
        _makeInsolvent();

        vm.prank(address(oSonicVault));
        vm.expectRevert("Protocol insolvent");
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), Sonic.wS, 10 ether);
    }

    function test_withdrawAll_succeeds_whenProtocolInsolvent() public {
        _makeInsolvent();

        // withdrawAll should succeed even when insolvent (no solvency check)
        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdrawAll();

        assertEq(swapXGauge.balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }
}
