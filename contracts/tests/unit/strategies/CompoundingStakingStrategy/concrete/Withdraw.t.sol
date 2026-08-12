// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_CompoundingStakingStrategy_Shared_Test
} from "tests/unit/strategies/CompoundingStakingStrategy/shared/Shared.t.sol";

// --- Project imports
import {ICompoundingStakingStrategy} from "contracts/interfaces/strategies/ICompoundingStakingStrategy.sol";

contract Unit_Concrete_CompoundingStakingStrategy_Withdraw_Test is Unit_CompoundingStakingStrategy_Shared_Test {
    function setUp() public override {
        super.setUp();
        // Deposit WETH to strategy first
        _depositToStrategy(10 ether);
    }

    function test_withdraw() public {
        uint256 vaultBefore = weth.balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        compoundingStakingStrategy.withdraw(address(oethVault), address(mockWeth), 5 ether);

        assertEq(weth.balanceOf(address(oethVault)), vaultBefore + 5 ether);
    }

    function test_withdraw_convertsEth() public {
        // Send some ETH directly to strategy (simulating validator withdrawal)
        vm.deal(address(compoundingStakingStrategy), 3 ether);

        uint256 vaultBefore = weth.balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        compoundingStakingStrategy.withdraw(address(oethVault), address(mockWeth), 5 ether);

        // Should convert ETH to WETH and transfer
        assertEq(weth.balanceOf(address(oethVault)), vaultBefore + 5 ether);
    }

    function test_withdraw_RevertWhen_notVaultOrRegistrator() public {
        vm.prank(josh);
        vm.expectRevert("Caller not Vault or Registrator");
        compoundingStakingStrategy.withdraw(address(oethVault), address(mockWeth), 1 ether);
    }

    function test_withdraw_RevertWhen_wrongAsset() public {
        vm.prank(address(oethVault));
        vm.expectRevert(ICompoundingStakingStrategy.UnsupportedAsset.selector);
        compoundingStakingStrategy.withdraw(address(oethVault), address(mockSsv), 1 ether);
    }

    function test_withdraw_RevertWhen_zeroAmount() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Must withdraw something");
        compoundingStakingStrategy.withdraw(address(oethVault), address(mockWeth), 0);
    }

    function test_withdraw_RevertWhen_recipientNotVault() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Recipient not Vault");
        compoundingStakingStrategy.withdraw(josh, address(mockWeth), 1 ether);
    }

    function test_withdrawAll() public {
        uint256 vaultBefore = weth.balanceOf(address(oethVault));
        uint256 strategyWeth = weth.balanceOf(address(compoundingStakingStrategy));

        vm.prank(address(oethVault));
        compoundingStakingStrategy.withdrawAll();

        assertEq(weth.balanceOf(address(oethVault)), vaultBefore + strategyWeth);
        assertEq(weth.balanceOf(address(compoundingStakingStrategy)), 0);
    }

    function test_withdrawAll_withEth() public {
        vm.deal(address(compoundingStakingStrategy), 2 ether);

        uint256 vaultBefore = weth.balanceOf(address(oethVault));
        uint256 strategyWeth = weth.balanceOf(address(compoundingStakingStrategy));

        vm.prank(address(oethVault));
        compoundingStakingStrategy.withdrawAll();

        // Should include both WETH + converted ETH
        assertEq(weth.balanceOf(address(oethVault)), vaultBefore + strategyWeth + 2 ether);
    }

    function test_withdraw_noEth() public {
        // Strategy has 10 WETH from setUp, no raw ETH
        uint256 vaultBefore = weth.balanceOf(address(oethVault));

        vm.expectEmit(true, false, false, true, address(compoundingStakingStrategy));
        emit Withdrawal(address(mockWeth), address(0), 10 ether);

        vm.prank(address(oethVault));
        compoundingStakingStrategy.withdraw(address(oethVault), address(mockWeth), 10 ether);

        assertEq(weth.balanceOf(address(oethVault)), vaultBefore + 10 ether);
        assertEq(compoundingStakingStrategy.depositedWethAccountedFor(), 0);
        assertEq(compoundingStakingStrategy.checkBalance(address(mockWeth)), 0);
    }

    function test_withdraw_RevertWhen_zeroAddress() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Recipient not Vault");
        compoundingStakingStrategy.withdraw(address(0), address(mockWeth), 10 ether);
    }

    function test_withdrawAll_noEth() public {
        // Strategy has 10 WETH from setUp, no raw ETH
        vm.expectEmit(true, false, false, true, address(compoundingStakingStrategy));
        emit Withdrawal(address(mockWeth), address(0), 10 ether);

        vm.prank(address(oethVault));
        compoundingStakingStrategy.withdrawAll();

        assertEq(compoundingStakingStrategy.depositedWethAccountedFor(), 0);
        assertEq(compoundingStakingStrategy.checkBalance(address(mockWeth)), 0);
    }

    function test_withdrawAll_withSomeEth() public {
        // Strategy has 10 WETH from setUp, add 5 ETH raw
        vm.deal(address(compoundingStakingStrategy), 5 ether);

        vm.expectEmit(true, false, false, true, address(compoundingStakingStrategy));
        emit Withdrawal(address(mockWeth), address(0), 15 ether);

        vm.prank(address(oethVault));
        compoundingStakingStrategy.withdrawAll();

        assertEq(compoundingStakingStrategy.depositedWethAccountedFor(), 0);
        assertEq(compoundingStakingStrategy.checkBalance(address(mockWeth)), 0);
    }

    function test_withdrawAll_RevertWhen_notVaultOrGovernor() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not the Vault or Governor");
        compoundingStakingStrategy.withdrawAll();
    }

    //////////////////////////////////////////////////////
    /// --- EVENTS
    //////////////////////////////////////////////////////

    event Withdrawal(address indexed _asset, address _pToken, uint256 _amount);
}
