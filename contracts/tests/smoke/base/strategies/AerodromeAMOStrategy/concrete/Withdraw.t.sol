// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_AerodromeAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {Base as BaseAddresses} from "tests/utils/Addresses.sol";
import {INonfungiblePositionManager} from "contracts/interfaces/aerodrome/INonfungiblePositionManager.sol";

contract Smoke_Concrete_AerodromeAMOStrategy_Withdraw_Test is Smoke_AerodromeAMOStrategy_Shared_Test {
    function test_withdraw_sendsWethToVault() public {
        // Deposit WETH so it's on the strategy balance (available for withdrawal)
        _depositToStrategy(5 ether);

        uint256 vaultBalanceBefore = weth.balanceOf(address(oethBaseVault));
        uint256 withdrawAmount = 1 ether;

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdraw(address(oethBaseVault), address(weth), withdrawAmount);

        uint256 vaultBalanceAfter = weth.balanceOf(address(oethBaseVault));
        assertApproxEqAbs(
            vaultBalanceAfter - vaultBalanceBefore, withdrawAmount, 1e6, "Vault should receive ~withdrawAmount WETH"
        );
    }

    function test_withdraw_decreasesCheckBalance() public {
        _depositToStrategy(5 ether);

        uint256 balanceBefore = aerodromeAMOStrategy.checkBalance(address(weth));

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdraw(address(oethBaseVault), address(weth), 1 ether);

        uint256 balanceAfter = aerodromeAMOStrategy.checkBalance(address(weth));
        assertLt(balanceAfter, balanceBefore, "checkBalance should decrease after withdrawal");
    }

    function test_withdraw_lpRestakedInGauge() public {
        // Deposit enough WETH so withdrawal doesn't need to touch the LP position
        _depositToStrategy(5 ether);

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdraw(address(oethBaseVault), address(weth), 1 ether);

        uint256 _tokenId = aerodromeAMOStrategy.tokenId();
        INonfungiblePositionManager pm = INonfungiblePositionManager(BaseAddresses.nonFungiblePositionManager);
        assertEq(pm.ownerOf(_tokenId), BaseAddresses.aerodromeOETHbWETHClGauge, "LP should remain staked in gauge");
    }

    function test_withdrawAll_returnsAllWethToVault() public {
        // Push pool price into range so position has WETH that can be withdrawn
        _pushPoolPriceIntoRange();
        _widenAllowedWethShareInterval();

        uint256 vaultBalanceBefore = weth.balanceOf(address(oethBaseVault));

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdrawAll();

        uint256 vaultBalanceAfter = weth.balanceOf(address(oethBaseVault));
        assertGt(vaultBalanceAfter - vaultBalanceBefore, 0, "Vault should receive WETH from withdrawAll");
        assertApproxEqAbs(
            aerodromeAMOStrategy.checkBalance(address(weth)),
            0,
            0.001 ether,
            "checkBalance should be ~0 after withdrawAll"
        );
    }

    function test_withdrawAll_lpNotStakedInGauge() public {
        uint256 _tokenId = aerodromeAMOStrategy.tokenId();

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdrawAll();

        // After withdrawAll, liquidity is 0, so LP cannot be staked in gauge
        INonfungiblePositionManager pm = INonfungiblePositionManager(BaseAddresses.nonFungiblePositionManager);
        assertNotEq(
            pm.ownerOf(_tokenId),
            BaseAddresses.aerodromeOETHbWETHClGauge,
            "LP should not be staked in gauge after withdrawAll"
        );
    }

    function test_withdrawAndRedeposit_cycle() public {
        _pushPoolPriceIntoRange();
        _widenAllowedWethShareInterval();

        // Withdraw all
        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdrawAll();

        uint256 balanceAfterWithdraw = aerodromeAMOStrategy.checkBalance(address(weth));
        assertApproxEqAbs(balanceAfterWithdraw, 0, 0.001 ether, "Should be ~0 after withdrawAll");

        // Deposit again
        _depositToStrategy(5 ether);

        // Rebalance
        _quoteAndRebalance(type(uint256).max, type(uint256).max);

        uint256 balanceAfterRedeposit = aerodromeAMOStrategy.checkBalance(address(weth));
        assertGt(balanceAfterRedeposit, 4 ether, "checkBalance should reflect redeposited funds");
    }
}
