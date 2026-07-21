// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_BaseTimelockController_Shared_Test} from "../shared/Shared.t.sol";

import {GovHelper} from "scripts/deploy/helpers/GovHelper.sol";

contract Fork_Concrete_BaseTimelockController_Governance_Test is Fork_BaseTimelockController_Shared_Test {
    function test_simulate_executesOperationAndIsIdempotent() public {
        bytes32 opId = GovHelper.operationId(govProposal);

        assertEq(uint256(opId), GovHelper.governanceId(govProposal));
        assertFalse(timelock.isOperationDone(opId));

        GovHelper.simulate(false, govProposal);

        assertEq(oethBaseVault.vaultBuffer(), newVaultBuffer);
        assertTrue(timelock.isOperationDone(opId));

        GovHelper.simulate(false, govProposal);

        assertEq(oethBaseVault.vaultBuffer(), newVaultBuffer);
        assertTrue(timelock.isOperationDone(opId));
    }

    function test_simulate_executesPreviouslyScheduledOperation() public {
        bytes32 opId = GovHelper.operationId(govProposal);
        _scheduleProposal();

        assertTrue(timelock.isOperation(opId));
        assertFalse(timelock.isOperationReady(opId));

        GovHelper.simulate(false, govProposal);

        assertEq(oethBaseVault.vaultBuffer(), newVaultBuffer);
        assertTrue(timelock.isOperationDone(opId));
    }
}
