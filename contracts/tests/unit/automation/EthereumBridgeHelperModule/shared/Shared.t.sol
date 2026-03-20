// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";
import {EthereumBridgeHelperModule} from "contracts/automation/EthereumBridgeHelperModule.sol";

abstract contract Unit_EthereumBridgeHelperModule_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _deployContracts();
        label();
    }

    function _deployContracts() internal {
        // Deploy mock safe
        mockSafe = new MockSafeContract();

        // Deploy EthereumBridgeHelperModule
        ethereumBridgeHelperModule = new EthereumBridgeHelperModule(address(mockSafe));

        // Grant OPERATOR_ROLE to operator via safe
        mockSafe.execTransactionFromModule(
            address(ethereumBridgeHelperModule),
            0,
            abi.encodeWithSelector(
                ethereumBridgeHelperModule.grantRole.selector,
                ethereumBridgeHelperModule.OPERATOR_ROLE(),
                operator
            ),
            0
        );
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////

    function label() public {
        vm.label(address(mockSafe), "MockSafe");
        vm.label(address(ethereumBridgeHelperModule), "EthereumBridgeHelperModule");
    }
}
