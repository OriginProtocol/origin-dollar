// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_ClaimBribesSafeModule_Shared_Test} from
    "tests/unit/automation/ClaimBribesSafeModule/shared/Shared.t.sol";

contract Unit_Concrete_ClaimBribesSafeModule_Constructor_Test is Unit_ClaimBribesSafeModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- CONSTRUCTOR
    //////////////////////////////////////////////////////

    function test_constructor_voterIsSet() public view {
        assertEq(address(claimBribesModule.voter()), address(mockVoter));
    }

    function test_constructor_veNFTIsSet() public view {
        assertEq(claimBribesModule.veNFT(), address(mockVeNFT));
    }

    function test_constructor_safeHasAdminRole() public view {
        assertTrue(
            claimBribesModule.hasRole(claimBribesModule.DEFAULT_ADMIN_ROLE(), address(mockSafe))
        );
    }

    function test_constructor_safeHasOperatorRole() public view {
        assertTrue(
            claimBribesModule.hasRole(claimBribesModule.OPERATOR_ROLE(), address(mockSafe))
        );
    }

    function test_constructor_operatorRoleGranted() public view {
        assertTrue(
            claimBribesModule.hasRole(claimBribesModule.OPERATOR_ROLE(), operator)
        );
    }
}
