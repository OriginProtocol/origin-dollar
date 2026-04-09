// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Automation} from "tests/utils/artifacts/Automation.sol";

import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";
import {IEthereumBridgeHelperModule} from "contracts/interfaces/automation/IEthereumBridgeHelperModule.sol";

abstract contract Unit_EthereumBridgeHelperModule_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////
    MockSafeContract internal mockSafe;
    IEthereumBridgeHelperModule internal ethereumBridgeHelperModule;

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
        ethereumBridgeHelperModule = IEthereumBridgeHelperModule(
            vm.deployCode(Automation.ETHEREUM_BRIDGE_HELPER_MODULE, abi.encode(address(mockSafe)))
        );

        // Grant OPERATOR_ROLE to operator via safe
        mockSafe.execTransactionFromModule(
            address(ethereumBridgeHelperModule),
            0,
            abi.encodeWithSelector(
                ethereumBridgeHelperModule.grantRole.selector, ethereumBridgeHelperModule.OPERATOR_ROLE(), operator
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
