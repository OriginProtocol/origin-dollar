// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {PoolBoosterFactoryMerkl} from "contracts/poolBooster/PoolBoosterFactoryMerkl.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

import {
    Smoke_PoolBoosterMerklMainnet_Shared_Test
} from "tests/smoke/poolBooster/PoolBoosterMerklMainnet/shared/Shared.t.sol";

contract Smoke_Concrete_PoolBoosterFactoryMerklMainnet_Test is Smoke_PoolBoosterMerklMainnet_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    //////////////////////////////////////////////////////

    function test_governor() public view {
        assertNotEq(factoryMerkl.governor(), address(0));
    }

    function test_oToken() public view {
        assertEq(factoryMerkl.oToken(), Mainnet.OETHProxy);
    }

    function test_centralRegistry() public view {
        assertNotEq(address(factoryMerkl.centralRegistry()), address(0));
    }

    function test_version() public view {
        assertEq(factoryMerkl.version(), 1);
    }

    function test_poolBoosterLength() public view {
        assertGt(factoryMerkl.poolBoosterLength(), 0);
    }

    function test_poolBoosterFromPool() public view {
        (address firstBooster, address firstPool,) = factoryMerkl.poolBoosters(0);
        (address fromPoolBooster,,) = factoryMerkl.poolBoosterFromPool(firstPool);
        assertEq(fromPoolBooster, firstBooster);
    }

    function test_merklDistributor() public view {
        assertNotEq(factoryMerkl.merklDistributor(), address(0));
    }

    //////////////////////////////////////////////////////
    /// --- MUTATIVE FUNCTIONS
    //////////////////////////////////////////////////////

    function test_createPoolBoosterMerkl() public {
        uint32 campaignType = boosterMerkl.campaignType();
        uint32 duration = boosterMerkl.duration();
        bytes memory campaignData = boosterMerkl.campaignData();

        uint256 lengthBefore = factoryMerkl.poolBoosterLength();

        vm.prank(factoryMerkl.governor());
        factoryMerkl.createPoolBoosterMerkl(
            campaignType,
            address(uint160(uint256(keccak256("newPool")))),
            duration,
            campaignData,
            block.timestamp
        );

        assertEq(factoryMerkl.poolBoosterLength(), lengthBefore + 1);
    }

    function test_setMerklDistributor() public {
        address newDistributor = address(uint160(uint256(keccak256("newDistributor"))));

        vm.prank(factoryMerkl.governor());
        factoryMerkl.setMerklDistributor(newDistributor);

        assertEq(factoryMerkl.merklDistributor(), newDistributor);
    }

    function test_removePoolBooster() public {
        (address firstBooster,,) = factoryMerkl.poolBoosters(0);
        uint256 lengthBefore = factoryMerkl.poolBoosterLength();

        vm.prank(factoryMerkl.governor());
        factoryMerkl.removePoolBooster(firstBooster);

        assertEq(factoryMerkl.poolBoosterLength(), lengthBefore - 1);
    }

    function test_bribeAll() public {
        address[] memory exclusionList = new address[](0);
        factoryMerkl.bribeAll(exclusionList);
    }
}
