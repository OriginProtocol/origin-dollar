// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicStakingStrategy_Shared_Test} from "tests/unit/strategies/SonicStakingStrategy/shared/Shared.t.sol";
import {ISonicStakingStrategy} from "contracts/interfaces/strategies/ISonicStakingStrategy.sol";

contract Unit_Concrete_SonicStakingStrategy_Withdraw_Test is Unit_SonicStakingStrategy_Shared_Test {
    function test_withdraw_transfersWSToRecipient() public {
        uint256 amount = 5 ether;
        // Give strategy some wS directly (simulating lingering balance)
        _mintWS(address(sonicStakingStrategy), amount);

        vm.prank(address(oSonicVault));
        sonicStakingStrategy.withdraw(alice, address(mockWrappedSonic), amount);

        assertEq(mockWrappedSonic.balanceOf(alice), amount);
        assertEq(mockWrappedSonic.balanceOf(address(sonicStakingStrategy)), 0);
    }

    function test_withdraw_emitsWithdrawalEvent() public {
        uint256 amount = 5 ether;
        _mintWS(address(sonicStakingStrategy), amount);

        vm.expectEmit(true, true, true, true);
        emit ISonicStakingStrategy.Withdrawal(address(mockWrappedSonic), address(0), amount);

        vm.prank(address(oSonicVault));
        sonicStakingStrategy.withdraw(alice, address(mockWrappedSonic), amount);
    }

    function test_withdraw_RevertWhen_wrongAsset() public {
        vm.prank(address(oSonicVault));
        vm.expectRevert("Unsupported asset");
        sonicStakingStrategy.withdraw(alice, address(oSonic), 1 ether);
    }

    function test_withdraw_RevertWhen_zeroAmount() public {
        vm.prank(address(oSonicVault));
        vm.expectRevert("Must withdraw something");
        sonicStakingStrategy.withdraw(alice, address(mockWrappedSonic), 0);
    }

    function test_withdraw_RevertWhen_zeroRecipient() public {
        _mintWS(address(sonicStakingStrategy), 1 ether);

        vm.prank(address(oSonicVault));
        vm.expectRevert("Must specify recipient");
        sonicStakingStrategy.withdraw(address(0), address(mockWrappedSonic), 1 ether);
    }

    function test_withdraw_RevertWhen_calledByNonVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        sonicStakingStrategy.withdraw(alice, address(mockWrappedSonic), 1 ether);
    }

    function test_withdraw_RevertWhen_insufficientBalance() public {
        // Strategy has no wS
        vm.prank(address(oSonicVault));
        vm.expectRevert();
        sonicStakingStrategy.withdraw(alice, address(mockWrappedSonic), 1 ether);
    }
}
