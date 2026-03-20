// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicStakingStrategy_Shared_Test} from
    "tests/unit/strategies/SonicStakingStrategy/shared/Shared.t.sol";

contract Unit_Concrete_SonicStakingStrategy_CheckBalance_Test is Unit_SonicStakingStrategy_Shared_Test {
    function test_checkBalance_includesWSBalance() public {
        uint256 amount = 5 ether;
        _mintWS(address(sonicStakingStrategy), amount);

        uint256 balance = sonicStakingStrategy.checkBalance(address(mockWrappedSonic));
        assertEq(balance, amount);
    }

    function test_checkBalance_includesPendingWithdrawals() public {
        uint256 amount = 10 ether;
        _depositAsVault(amount);

        // Undelegate to create pending withdrawal
        vm.prank(strategist);
        sonicStakingStrategy.undelegate(18, amount);

        uint256 balance = sonicStakingStrategy.checkBalance(address(mockWrappedSonic));
        // Balance should include the pending withdrawal amount
        assertEq(balance, amount);
    }

    function test_checkBalance_includesStakedAmount() public {
        uint256 amount = 10 ether;
        _depositAsVault(amount);

        uint256 balance = sonicStakingStrategy.checkBalance(address(mockWrappedSonic));
        // Balance should include staked amount on SFC
        assertEq(balance, amount);
    }

    function test_checkBalance_includesPendingRewards() public {
        uint256 amount = 10 ether;
        uint256 rewards = 1 ether;
        _depositAsVault(amount);

        // Set pending rewards on the SFC mock
        mockSfc.setRewards(address(sonicStakingStrategy), 18, rewards);

        uint256 balance = sonicStakingStrategy.checkBalance(address(mockWrappedSonic));
        assertEq(balance, amount + rewards);
    }

    function test_checkBalance_multipleValidators() public {
        // Support a second validator
        vm.prank(governor);
        sonicStakingStrategy.supportValidator(19);

        uint256 amount1 = 10 ether;
        _depositAsVault(amount1);

        // Switch to validator 19 and deposit
        vm.prank(strategist);
        sonicStakingStrategy.setDefaultValidatorId(19);

        uint256 amount2 = 5 ether;
        _depositAsVault(amount2);

        // Set rewards for both validators
        mockSfc.setRewards(address(sonicStakingStrategy), 18, 1 ether);
        mockSfc.setRewards(address(sonicStakingStrategy), 19, 0.5 ether);

        uint256 balance = sonicStakingStrategy.checkBalance(address(mockWrappedSonic));
        assertEq(balance, amount1 + amount2 + 1 ether + 0.5 ether);
    }

    function test_checkBalance_RevertWhen_wrongAsset() public {
        vm.expectRevert("Unsupported asset");
        sonicStakingStrategy.checkBalance(address(oSonic));
    }
}
