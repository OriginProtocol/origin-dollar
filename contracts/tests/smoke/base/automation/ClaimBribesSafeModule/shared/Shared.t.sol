// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {ClaimBribesSafeModule} from "contracts/automation/ClaimBribesSafeModule.sol";

abstract contract Smoke_ClaimBribesSafeModule_Shared_Test is BaseSmoke {
    //////////////////////////////////////////////////////
    /// --- ADDRESSES
    //////////////////////////////////////////////////////

    address internal safe;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkBase();
        _igniteDeployManager();

        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        claimBribesModule = ClaimBribesSafeModule(payable(resolver.resolve("CLAIM_BRIBES_MODULE")));
        vm.label(address(claimBribesModule), "ClaimBribesSafeModule");

        // Skip if contract not yet deployed or not properly initialized on this fork
        (bool ok,) = address(claimBribesModule).staticcall(abi.encodeWithSignature("safeContract()"));
        if (!ok) {
            vm.skip(true);
            return;
        }

        safe = address(claimBribesModule.safeContract());
        operator = claimBribesModule.getRoleMember(claimBribesModule.OPERATOR_ROLE(), 0);
    }
}
