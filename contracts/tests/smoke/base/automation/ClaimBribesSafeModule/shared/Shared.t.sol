// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";

// --- Project imports
import {IClaimBribesSafeModule} from "contracts/interfaces/automation/IClaimBribesSafeModule.sol";

abstract contract Smoke_ClaimBribesSafeModule_Shared_Test is BaseSmoke {
    IClaimBribesSafeModule internal claimBribesModule;

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
        _fetchContracts();
        _resolveActors();
        _labelContracts();
    }

    function _fetchContracts() internal virtual {
        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        claimBribesModule = IClaimBribesSafeModule(resolver.resolve("CLAIM_BRIBES_MODULE"));
    }

    function _resolveActors() internal virtual {
        // Skip if contract not yet deployed or not properly initialized on this fork
        (bool ok,) = address(claimBribesModule).staticcall(abi.encodeWithSignature("safeContract()"));
        if (!ok) {
            vm.skip(true);
            return;
        }

        safe = address(claimBribesModule.safeContract());
        operator = claimBribesModule.getRoleMember(claimBribesModule.OPERATOR_ROLE(), 0);
    }

    function _labelContracts() internal virtual {
        vm.label(address(claimBribesModule), "ClaimBribesSafeModule");
    }
}
