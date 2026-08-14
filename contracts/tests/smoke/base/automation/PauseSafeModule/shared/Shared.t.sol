// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";

// --- Test utilities
import {CrossChain} from "tests/utils/Addresses.sol";

// --- Project imports
import {IPauseSafeModule} from "contracts/interfaces/automation/IPauseSafeModule.sol";
import {IVault} from "contracts/interfaces/IVault.sol";

abstract contract Smoke_Base_PauseSafeModule_Shared_Test is BaseSmoke {
    IPauseSafeModule internal pauseSafeModule;

    IVault internal oethBaseVault;

    /// @dev The 5/8 that holds `adminAddr`, i.e. the only account able to lift what the module trips.
    address internal admin;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkBase();
        _igniteDeployManager();

        require(address(resolver).code.length > 0, "Resolver not initialized on fork");

        pauseSafeModule = IPauseSafeModule(payable(resolver.resolve("PAUSE_SAFE_MODULE")));
        oethBaseVault = IVault(resolver.resolve("OETHBASE_VAULT_PROXY"));

        strategist = oethBaseVault.strategistAddr();
        admin = oethBaseVault.adminAddr();

        vm.label(address(pauseSafeModule), "PauseSafeModule");
        vm.label(address(oethBaseVault), "OETHBaseVault");
        vm.label(CrossChain.multichainStrategist, "GuardianSafe");
        vm.label(admin, "AdminSafe");
    }
}
