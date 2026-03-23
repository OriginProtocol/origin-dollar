// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseFork} from "tests/fork/BaseFork.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";
import {MockPartialWithdrawal} from "contracts/mocks/MockPartialWithdrawal.sol";
import {ExecutionLayerWithdrawal} from "contracts/mocks/beacon/ExecutionLayerWithdrawal.sol";

abstract contract Fork_PartialWithdrawal_Shared_Test is BaseFork {
    bytes internal constant SWEEPING_VALIDATOR_PUBKEY =
        hex"a258246e1217568a751670447879b7af5d6df585c59a15ebf0380f276069eadb11f30dea77cfb7357447dc24517be560";
    uint64 internal constant WITHDRAW_AMOUNT = 1e18;

    MockPartialWithdrawal internal partialWithdrawal;
    ExecutionLayerWithdrawal internal beaconWithdrawalReplaced;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();
        _deployFreshContracts();
        _configureContracts();
        _labelContracts();
    }

    function _deployFreshContracts() internal {
        partialWithdrawal = new MockPartialWithdrawal();

        ExecutionLayerWithdrawal replacement = new ExecutionLayerWithdrawal();
        vm.etch(Mainnet.beaconChainWithdrawRequest, address(replacement).code);
        beaconWithdrawalReplaced = ExecutionLayerWithdrawal(payable(Mainnet.beaconChainWithdrawRequest));
    }

    function _configureContracts() internal {
        vm.deal(address(partialWithdrawal), 100 ether);
    }

    function _labelContracts() internal {
        vm.label(address(partialWithdrawal), "MockPartialWithdrawal");
        vm.label(address(beaconWithdrawalReplaced), "ExecutionLayerWithdrawal");
    }
}
