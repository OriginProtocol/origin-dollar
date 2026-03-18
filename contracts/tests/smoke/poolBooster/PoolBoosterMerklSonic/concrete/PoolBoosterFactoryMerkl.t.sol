// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {PoolBoosterFactoryMerkl} from "contracts/poolBooster/PoolBoosterFactoryMerkl.sol";
import {Sonic} from "tests/utils/Addresses.sol";

import {
    Smoke_PoolBoosterMerklSonic_Shared_Test
} from "tests/smoke/poolBooster/PoolBoosterMerklSonic/shared/Shared.t.sol";

contract Smoke_Concrete_PoolBoosterFactoryMerklSonic_Test is Smoke_PoolBoosterMerklSonic_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    //////////////////////////////////////////////////////

    function test_governor() public view {
        assertNotEq(factoryMerkl.governor(), address(0));
    }

    function test_oToken() public view {
        (bool success, bytes memory data) = address(factoryMerkl).staticcall(
            abi.encodeWithSignature("oSonic()")
        );
        assertTrue(success, "oSonic() call failed");
        address oTokenAddr = abi.decode(data, (address));
        assertEq(oTokenAddr, Sonic.OSonicProxy);
    }

    function test_centralRegistry() public view {
        assertNotEq(address(factoryMerkl.centralRegistry()), address(0));
    }

    function test_version() public view {
        assertEq(factoryMerkl.version(), 1);
    }

    function test_poolBoosterLength() public view {
        factoryMerkl.poolBoosterLength();
    }

    function test_merklDistributor() public view {
        assertNotEq(factoryMerkl.merklDistributor(), address(0));
    }

    //////////////////////////////////////////////////////
    /// --- MUTATIVE FUNCTIONS
    //////////////////////////////////////////////////////

    function test_createPoolBoosterMerkl() public {
        uint256 lengthBefore = factoryMerkl.poolBoosterLength();

        // Provide campaign data directly since no existing boosters
        bytes memory campaignData = abi.encode(
            bytes32(0), new bytes(0), new bytes(0), new bytes(0), new bytes(0), new bytes(0)
        );

        vm.prank(factoryMerkl.governor());
        factoryMerkl.createPoolBoosterMerkl(
            2,
            address(uint160(uint256(keccak256("newPool")))),
            7 days,
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
        // First create a booster so we have one to remove
        bytes memory campaignData = abi.encode(
            bytes32(0), new bytes(0), new bytes(0), new bytes(0), new bytes(0), new bytes(0)
        );

        vm.prank(factoryMerkl.governor());
        factoryMerkl.createPoolBoosterMerkl(
            2,
            address(uint160(uint256(keccak256("removePool")))),
            7 days,
            campaignData,
            block.timestamp
        );

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
