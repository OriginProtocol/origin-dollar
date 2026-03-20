// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_NativeStakingSSVStrategy_Shared_Test} from
    "tests/fork/strategies/NativeStakingSSVStrategy/shared/Shared.t.sol";

contract Fork_Concrete_NativeStakingSSVStrategy_Deposit_Test is Fork_NativeStakingSSVStrategy_Shared_Test {
    /// @dev Test that the strategy accepts WETH allocation via deposit()
    function test_deposit() public {
        uint256 depositAmount = 32 ether;
        uint256 wethBalanceBefore = weth.balanceOf(address(nativeStakingSSVStrategy));
        uint256 strategyBalanceBefore = nativeStakingSSVStrategy.checkBalance(address(weth));

        // Transfer WETH from domen to strategy
        vm.prank(domen);
        weth.transfer(address(nativeStakingSSVStrategy), depositAmount);

        // Call deposit by impersonating the Vault
        vm.prank(address(oethVault));
        vm.expectEmit(true, false, false, true, address(nativeStakingSSVStrategy));
        emit Deposit(address(weth), address(0), depositAmount);
        nativeStakingSSVStrategy.deposit(address(weth), depositAmount);

        assertEq(
            weth.balanceOf(address(nativeStakingSSVStrategy)),
            wethBalanceBefore + depositAmount,
            "WETH not transferred"
        );
        assertEq(
            nativeStakingSSVStrategy.checkBalance(address(weth)),
            strategyBalanceBefore + depositAmount,
            "strategy checkBalance not increased"
        );
    }

    /// @dev Test that staking works when half the WETH is supplied by a third party
    function test_deposit_withThirdPartyWeth() public {
        _resetStakeETHTally();

        // Skip if strategy is full
        if (nativeStakingSSVStrategy.activeDepositedValidators() >= 500) return;

        // Deposit 16 WETH via vault
        _depositToStrategy(16 ether);

        // Third party sends 16 WETH directly to strategy
        vm.prank(domen);
        weth.transfer(address(nativeStakingSSVStrategy), 16 ether);

        // Should be able to register and stake the full 32 ETH
        _registerAndStakeEth();
    }

    event Deposit(address indexed _asset, address _pToken, uint256 _amount);
}
