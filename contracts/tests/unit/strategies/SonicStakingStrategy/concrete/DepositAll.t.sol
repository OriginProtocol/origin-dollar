// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicStakingStrategy_Shared_Test} from
    "tests/unit/strategies/SonicStakingStrategy/shared/Shared.t.sol";

contract Unit_Concrete_SonicStakingStrategy_DepositAll_Test is Unit_SonicStakingStrategy_Shared_Test {
    function test_depositAll_delegatesEntireBalance() public {
        uint256 amount = 10 ether;
        _mintWS(address(sonicStakingStrategy), amount);

        vm.prank(address(oSonicVault));
        sonicStakingStrategy.depositAll();

        // All wS should be delegated
        uint256 staked = mockSfc.getStake(address(sonicStakingStrategy), 18);
        assertEq(staked, amount);
        assertEq(mockWrappedSonic.balanceOf(address(sonicStakingStrategy)), 0);
    }

    function test_depositAll_noOpOnZero() public {
        // No wS balance
        assertEq(mockWrappedSonic.balanceOf(address(sonicStakingStrategy)), 0);

        vm.prank(address(oSonicVault));
        sonicStakingStrategy.depositAll();

        // No delegation should have happened
        uint256 staked = mockSfc.getStake(address(sonicStakingStrategy), 18);
        assertEq(staked, 0);
    }

    function test_depositAll_RevertWhen_calledByNonVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        sonicStakingStrategy.depositAll();
    }
}
