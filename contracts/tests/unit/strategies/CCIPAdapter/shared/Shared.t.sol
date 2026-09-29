// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Adapters} from "tests/utils/artifacts/Adapters.sol";

// --- Project imports
import {IAdapter} from "contracts/interfaces/crosschainV3/IAdapter.sol";

abstract contract Unit_CCIPAdapter_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    uint64 internal constant CHAIN_SELECTOR = 1;
    uint32 internal constant DEST_GAS_LIMIT = 500_000;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IAdapter internal adapter;

    /// @dev Lane-config tests never send, so the router only has to be non-zero.
    address internal router = makeAddr("CCIPRouter");

    /// @dev Stand-in for the strategy that uses the lane.
    address internal sender = makeAddr("Sender");

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        // Standalone deploy: the constructor makes `msg.sender` the governor.
        vm.prank(governor);
        adapter = IAdapter(vm.deployCode(Adapters.CCIP_ADAPTER, abi.encode(router)));

        vm.label(address(adapter), "CCIPAdapter");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _cfg(uint32 destGasLimit) internal pure returns (IAdapter.ChainConfig memory) {
        return IAdapter.ChainConfig({paused: false, chainSelector: CHAIN_SELECTOR, destGasLimit: destGasLimit});
    }
}
