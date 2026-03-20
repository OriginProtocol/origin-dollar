// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicStakingStrategy_Shared_Test} from
    "tests/unit/strategies/SonicStakingStrategy/shared/Shared.t.sol";
import {SonicValidatorDelegator} from "contracts/strategies/sonic/SonicValidatorDelegator.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

contract Unit_Concrete_SonicStakingStrategy_Deposit_Test is Unit_SonicStakingStrategy_Shared_Test {
    function test_deposit_delegatesToValidator() public {
        uint256 amount = 10 ether;
        _depositAsVault(amount);

        // After deposit, wS is unwrapped and delegated via SFC
        uint256 staked = mockSfc.getStake(address(sonicStakingStrategy), 18);
        assertEq(staked, amount);
    }

    function test_deposit_unwrapsWS() public {
        uint256 amount = 10 ether;
        _depositAsVault(amount);

        // Strategy should have no wS balance after deposit (all unwrapped and delegated)
        uint256 wsBalance = mockWrappedSonic.balanceOf(address(sonicStakingStrategy));
        assertEq(wsBalance, 0);
    }

    function test_deposit_emitsEvents() public {
        uint256 amount = 10 ether;
        _mintWS(address(sonicStakingStrategy), amount);

        // Expect Delegated event
        vm.expectEmit(true, false, false, true);
        emit SonicValidatorDelegator.Delegated(18, amount);

        // Expect Deposit event
        vm.expectEmit(true, true, true, true);
        emit InitializableAbstractStrategy.Deposit(address(mockWrappedSonic), address(0), amount);

        vm.prank(address(oSonicVault));
        sonicStakingStrategy.deposit(address(mockWrappedSonic), amount);
    }

    function test_deposit_RevertWhen_wrongAsset() public {
        vm.prank(address(oSonicVault));
        vm.expectRevert("Unsupported asset");
        sonicStakingStrategy.deposit(address(oSonic), 1 ether);
    }

    function test_deposit_RevertWhen_zeroAmount() public {
        vm.prank(address(oSonicVault));
        vm.expectRevert("Must deposit something");
        sonicStakingStrategy.deposit(address(mockWrappedSonic), 0);
    }

    function test_deposit_RevertWhen_calledByNonVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        sonicStakingStrategy.deposit(address(mockWrappedSonic), 1 ether);
    }

    function test_deposit_RevertWhen_unsupportedValidator() public {
        // Remove support for default validator and set default to 0
        vm.prank(governor);
        sonicStakingStrategy.unsupportValidator(18);

        _mintWS(address(sonicStakingStrategy), 1 ether);

        vm.prank(address(oSonicVault));
        vm.expectRevert("Validator not supported");
        sonicStakingStrategy.deposit(address(mockWrappedSonic), 1 ether);
    }
}
