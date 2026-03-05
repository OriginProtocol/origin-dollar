// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

import {MockGovernable, MockStrategizable, MockInitializableGovernable} from "tests/mocks/MockGovernable.sol";

abstract contract Unit_Governance_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    MockGovernable internal governable;
    MockStrategizable internal strategizable;
    MockInitializableGovernable internal initGovernable;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _deployContracts();
        _labelContracts();
    }

    function _deployContracts() internal {
        // Deploy MockGovernable and set governor via exposed setter
        governable = new MockGovernable();
        governable.setGovernor(governor);

        // Deploy MockStrategizable and set governor via storage slot
        strategizable = new MockStrategizable();
        _setGovernorViaSlot(address(strategizable), governor);

        // Deploy MockInitializableGovernable (leave uninitialized)
        initGovernable = new MockInitializableGovernable();
    }

    function _labelContracts() internal {
        vm.label(address(governable), "MockGovernable");
        vm.label(address(strategizable), "MockStrategizable");
        vm.label(address(initGovernable), "MockInitializableGovernable");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _setGovernorViaSlot(address _contract, address _governor) internal {
        vm.store(_contract, GOVERNOR_SLOT, bytes32(uint256(uint160(_governor))));
    }
}
