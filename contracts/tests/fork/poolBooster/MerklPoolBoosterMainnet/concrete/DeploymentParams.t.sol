// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_MerklPoolBoosterMainnet_Shared_Test} from
    "tests/fork/poolBooster/MerklPoolBoosterMainnet/shared/Shared.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

contract Fork_Concrete_MerklPoolBoosterMainnet_DeploymentParams_Test is Fork_MerklPoolBoosterMainnet_Shared_Test {
    function test_merklDistributor() public view {
        assertEq(factoryMerkl.merklDistributor(), Mainnet.CampaignCreator);
    }

    function test_oethSupportedByMerklDistributor() public view {
        // Verify that OETH is supported by the Merkl Distributor on mainnet
        uint256 minAmount = merklDistributor.rewardTokenMinAmounts(Mainnet.OETHProxy);
        assertGt(minAmount, 1e13);
    }
}
