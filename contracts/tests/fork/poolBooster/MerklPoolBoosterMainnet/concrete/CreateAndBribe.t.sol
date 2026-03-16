// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Vm} from "forge-std/Vm.sol";

import {Fork_MerklPoolBoosterMainnet_Shared_Test} from
    "tests/fork/poolBooster/MerklPoolBoosterMainnet/shared/Shared.t.sol";
import {PoolBoosterMerkl} from "contracts/poolBooster/PoolBoosterMerkl.sol";
import {IMerklDistributor} from "contracts/interfaces/poolBooster/IMerklDistributor.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

contract Fork_Concrete_MerklPoolBoosterMainnet_CreateAndBribe_Test is Fork_MerklPoolBoosterMainnet_Shared_Test {
    bytes32 internal constant BRIBE_EXECUTED_TOPIC = keccak256("BribeExecuted(uint256)");

    function test_createPoolBoosterMerkl() public {
        PoolBoosterMerkl booster = _createMerklBooster(1);

        assertEq(factoryMerkl.poolBoosterLength(), 1);
        assertEq(booster.campaignType(), DEFAULT_CAMPAIGN_ID);
        assertEq(booster.campaignData(), DEFAULT_CAMPAIGN_DATA);
    }

    function test_bribe_twiceInARow() public {
        PoolBoosterMerkl booster = _createMerklBooster(1);

        // Mock the signAndCreateCampaign call on the Merkl distributor.
        // The real call requires specific creator/signer validation that varies by deployment.
        vm.mockCall(
            Mainnet.CampaignCreator,
            abi.encodeWithSelector(IMerklDistributor.signAndCreateCampaign.selector),
            abi.encode(bytes32(uint256(1)))
        );

        // Fund with 1000e18
        _dealOETH(address(booster), 1000e18);

        // First bribe
        vm.recordLogs();
        booster.bribe();
        _assertBribeExecutedEmitted(vm.getRecordedLogs(), address(booster));

        // Warp 1 day forward
        vm.warp(block.timestamp + 86400);

        // Reset balance (mock doesn't transfer tokens) and fund again
        deal(address(oeth), address(booster), 0);
        _dealOETH(address(booster), 1000e18);

        // Second bribe
        vm.recordLogs();
        booster.bribe();
        _assertBribeExecutedEmitted(vm.getRecordedLogs(), address(booster));
    }

    function _assertBribeExecutedEmitted(Vm.Log[] memory entries, address emitter) internal pure {
        uint256 count;
        for (uint256 i; i < entries.length; i++) {
            if (entries[i].topics[0] == BRIBE_EXECUTED_TOPIC && entries[i].emitter == emitter) {
                count++;
            }
        }
        assert(count == 1);
    }
}
