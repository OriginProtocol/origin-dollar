// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";

// --- Project imports
import {IAutoWithdrawalModule} from "contracts/interfaces/automation/IAutoWithdrawalModule.sol";

abstract contract Smoke_AutoWithdrawalModule_Shared_Test is BaseSmoke {
    IAutoWithdrawalModule internal autoWithdrawalModule;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();
        _igniteDeployManager();

        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        autoWithdrawalModule = IAutoWithdrawalModule(payable(resolver.resolve("AUTO_WITHDRAWAL_MODULE")));
        vm.label(address(autoWithdrawalModule), "AutoWithdrawalModule");
    }
}
