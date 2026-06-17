// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_CompoundingStakingSSVStrategy_Shared_Test
} from "tests/unit/strategies/CompoundingStakingSSVStrategy/shared/Shared.t.sol";

contract Unit_Concrete_CompoundingStakingSSVStrategy_Withdraw_Test is Unit_CompoundingStakingSSVStrategy_Shared_Test {
    function setUp() public override {
        super.setUp();
        // Deposit WETH to strategy first
        _depositToStrategy(10 ether);
    }

    function test_withdraw() public {
        uint256 vaultBefore = weth.balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        compoundingStakingSSVStrategy.withdraw(address(oethVault), address(mockWeth), 5 ether);

        assertEq(weth.balanceOf(address(oethVault)), vaultBefore + 5 ether);
    }

    function test_withdraw_convertsEth() public {
        // Send some ETH directly to strategy (simulating validator withdrawal)
        vm.deal(address(compoundingStakingSSVStrategy), 3 ether);

        uint256 vaultBefore = weth.balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        compoundingStakingSSVStrategy.withdraw(address(oethVault), address(mockWeth), 5 ether);

        // Should convert ETH to WETH and transfer
        assertEq(weth.balanceOf(address(oethVault)), vaultBefore + 5 ether);
    }

    function test_withdraw_RevertWhen_notVaultOrRegistrator() public {
        vm.prank(josh);
        vm.expectRevert("Caller not Vault or Registrator");
        compoundingStakingSSVStrategy.withdraw(address(oethVault), address(mockWeth), 1 ether);
    }

    function test_withdraw_RevertWhen_wrongAsset() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Unsupported asset");
        compoundingStakingSSVStrategy.withdraw(address(oethVault), address(mockSsv), 1 ether);
    }

    function test_withdraw_RevertWhen_zeroAmount() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Must withdraw something");
        compoundingStakingSSVStrategy.withdraw(address(oethVault), address(mockWeth), 0);
    }

    function test_withdraw_RevertWhen_recipientNotVault() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Recipient not Vault");
        compoundingStakingSSVStrategy.withdraw(josh, address(mockWeth), 1 ether);
    }

    function test_withdrawAll() public {
        uint256 vaultBefore = weth.balanceOf(address(oethVault));
        uint256 strategyWeth = weth.balanceOf(address(compoundingStakingSSVStrategy));

        vm.prank(address(oethVault));
        compoundingStakingSSVStrategy.withdrawAll();

        assertEq(weth.balanceOf(address(oethVault)), vaultBefore + strategyWeth);
        assertEq(weth.balanceOf(address(compoundingStakingSSVStrategy)), 0);
    }

    function test_withdrawAll_withEth() public {
        vm.deal(address(compoundingStakingSSVStrategy), 2 ether);

        uint256 vaultBefore = weth.balanceOf(address(oethVault));
        uint256 strategyWeth = weth.balanceOf(address(compoundingStakingSSVStrategy));

        vm.prank(address(oethVault));
        compoundingStakingSSVStrategy.withdrawAll();

        // Should include both WETH + converted ETH
        assertEq(weth.balanceOf(address(oethVault)), vaultBefore + strategyWeth + 2 ether);
    }

    function test_withdraw_noEth() public {
        // Strategy has 10 WETH from setUp, no raw ETH
        uint256 vaultBefore = weth.balanceOf(address(oethVault));

        vm.expectEmit(true, false, false, true, address(compoundingStakingSSVStrategy));
        emit Withdrawal(address(mockWeth), address(0), 10 ether);

        vm.prank(address(oethVault));
        compoundingStakingSSVStrategy.withdraw(address(oethVault), address(mockWeth), 10 ether);

        assertEq(weth.balanceOf(address(oethVault)), vaultBefore + 10 ether);
        assertEq(compoundingStakingSSVStrategy.depositedWethAccountedFor(), 0);
        assertEq(compoundingStakingSSVStrategy.checkBalance(address(mockWeth)), 0);
    }

    function test_withdraw_RevertWhen_zeroAddress() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Recipient not Vault");
        compoundingStakingSSVStrategy.withdraw(address(0), address(mockWeth), 10 ether);
    }

    function test_withdrawAll_noEth() public {
        // Strategy has 10 WETH from setUp, no raw ETH
        vm.expectEmit(true, false, false, true, address(compoundingStakingSSVStrategy));
        emit Withdrawal(address(mockWeth), address(0), 10 ether);

        vm.prank(address(oethVault));
        compoundingStakingSSVStrategy.withdrawAll();

        assertEq(compoundingStakingSSVStrategy.depositedWethAccountedFor(), 0);
        assertEq(compoundingStakingSSVStrategy.checkBalance(address(mockWeth)), 0);
    }

    function test_withdrawAll_withSomeEth() public {
        // Strategy has 10 WETH from setUp, add 5 ETH raw
        vm.deal(address(compoundingStakingSSVStrategy), 5 ether);

        vm.expectEmit(true, false, false, true, address(compoundingStakingSSVStrategy));
        emit Withdrawal(address(mockWeth), address(0), 15 ether);

        vm.prank(address(oethVault));
        compoundingStakingSSVStrategy.withdrawAll();

        assertEq(compoundingStakingSSVStrategy.depositedWethAccountedFor(), 0);
        assertEq(compoundingStakingSSVStrategy.checkBalance(address(mockWeth)), 0);
    }

    function test_withdrawAll_RevertWhen_notVaultOrGovernor() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not the Vault or Governor");
        compoundingStakingSSVStrategy.withdrawAll();
    }

    //////////////////////////////////////////////////////
    /// --- EVENTS
    //////////////////////////////////////////////////////

    event Withdrawal(address indexed _asset, address _pToken, uint256 _amount);
}
