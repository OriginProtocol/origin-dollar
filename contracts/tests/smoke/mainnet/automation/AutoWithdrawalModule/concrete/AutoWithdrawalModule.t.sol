// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Smoke_AutoWithdrawalModule_Shared_Test
} from "tests/smoke/mainnet/automation/AutoWithdrawalModule/shared/Shared.t.sol";

// --- Test utilities
import {Mainnet} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_AutoWithdrawalModule_Test is Smoke_AutoWithdrawalModule_Shared_Test {
    function test_vault() public view {
        assertEq(address(autoWithdrawalModule.vault()), Mainnet.VaultProxy);
    }

    function test_asset() public view {
        // OUSD vault uses USDC as its base asset
        assertEq(autoWithdrawalModule.asset(), Mainnet.USDC);
    }

    function test_strategy() public view {
        assertNotEq(autoWithdrawalModule.strategy(), address(0));
    }

    function test_safeContract() public view {
        assertNotEq(address(autoWithdrawalModule.safeContract()), address(0));
    }

    function test_pendingShortfall() public view {
        // Should return a valid value (not revert)
        uint256 shortfall = autoWithdrawalModule.pendingShortfall();
        // Shortfall is queued - claimable, which is always >= 0
        assertGe(shortfall, 0);
    }

    function test_operatorRole() public view {
        bytes32 operatorRole = autoWithdrawalModule.OPERATOR_ROLE();
        // validatorRegistrator should be operator or some operator should exist
        assertTrue(
            autoWithdrawalModule.hasRole(operatorRole, Mainnet.validatorRegistrator)
                || autoWithdrawalModule.getRoleMemberCount(operatorRole) > 0
        );
    }

    function test_fundWithdrawals() public {
        bytes32 operatorRole = autoWithdrawalModule.OPERATOR_ROLE();
        address operator = autoWithdrawalModule.getRoleMember(operatorRole, 0);

        uint256 shortfallBefore = autoWithdrawalModule.pendingShortfall();

        vm.prank(operator);
        autoWithdrawalModule.fundWithdrawals();

        uint256 shortfallAfter = autoWithdrawalModule.pendingShortfall();
        assertLe(shortfallAfter, shortfallBefore, "Shortfall should not increase");
    }
}
