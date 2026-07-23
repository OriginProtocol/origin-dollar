// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";

// --- Project imports
import {IClaimBribesSafeModule} from "contracts/interfaces/automation/IClaimBribesSafeModule.sol";

abstract contract Smoke_ClaimBribesSafeModule_Shared_Test is BaseSmoke {
    IClaimBribesSafeModule internal claimBribesModule;
    bool internal isModuleAvailable;

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
        // Mark the module unavailable if it is not yet deployed or initialized on this fork.
        (bool ok, bytes memory data) = address(claimBribesModule).staticcall(abi.encodeWithSignature("safeContract()"));
        isModuleAvailable = ok && data.length >= 32;
        if (!isModuleAvailable) {
            return;
        }

        safe = abi.decode(data, (address));
        operator = claimBribesModule.getRoleMember(claimBribesModule.OPERATOR_ROLE(), 0);
    }

    function _labelContracts() internal virtual {
        vm.label(address(claimBribesModule), "ClaimBribesSafeModule");
    }
}
