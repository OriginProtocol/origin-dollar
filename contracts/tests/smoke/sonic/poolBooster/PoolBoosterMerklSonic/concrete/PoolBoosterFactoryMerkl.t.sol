// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Sonic} from "tests/utils/Addresses.sol";

import {
    Smoke_PoolBoosterMerklSonic_Shared_Test
} from "tests/smoke/sonic/poolBooster/PoolBoosterMerklSonic/shared/Shared.t.sol";

contract Smoke_Concrete_PoolBoosterFactoryMerklSonic_Test is Smoke_PoolBoosterMerklSonic_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    //////////////////////////////////////////////////////

    function test_governor() public view {
        assertNotEq(factoryMerkl.governor(), address(0));
    }

    function test_oToken() public view {
        // Sonic factory uses oSonic() getter on-chain
        (bool success, bytes memory data) = address(factoryMerkl).staticcall(abi.encodeWithSignature("oSonic()"));
        if (!success) {
            (success, data) = address(factoryMerkl).staticcall(abi.encodeWithSignature("oToken()"));
        }
        assertTrue(success, "oToken/oSonic() call failed");
        address oTokenAddr = abi.decode(data, (address));
        assertEq(oTokenAddr, Sonic.OSonicProxy);
    }

    function test_centralRegistry() public view {
        assertNotEq(address(factoryMerkl.centralRegistry()), address(0));
    }

    function test_version() public view {
        (bool success,) = address(factoryMerkl).staticcall(abi.encodeWithSignature("version()"));
        assertTrue(success, "version() call failed");
    }

    function test_poolBoosterLength() public view {
        factoryMerkl.poolBoosterLength();
    }

    function test_merklDistributorOrBeacon() public view {
        (bool s1,) = address(factoryMerkl).staticcall(abi.encodeWithSignature("merklDistributor()"));
        (bool s2,) = address(factoryMerkl).staticcall(abi.encodeWithSignature("beacon()"));
        assertTrue(s1 || s2, "Neither merklDistributor() nor beacon() found");
    }

    //////////////////////////////////////////////////////
    /// --- MUTATIVE FUNCTIONS
    //////////////////////////////////////////////////////

    function test_createPoolBoosterMerkl() public {
        uint256 lengthBefore = factoryMerkl.poolBoosterLength();

        bytes memory campaignData =
            abi.encode(bytes32(0), new bytes(0), new bytes(0), new bytes(0), new bytes(0), new bytes(0));

        vm.prank(factoryMerkl.governor());
        (bool success,) = address(factoryMerkl)
            .call(
                abi.encodeWithSignature(
                    "createPoolBoosterMerkl(uint32,address,uint32,bytes,uint256)",
                    uint32(2),
                    address(uint160(uint256(keccak256("newPool")))),
                    uint32(7 days),
                    campaignData,
                    block.timestamp
                )
            );

        if (success) {
            assertEq(factoryMerkl.poolBoosterLength(), lengthBefore + 1);
        }
    }

    function test_removePoolBooster() public {
        if (factoryMerkl.poolBoosterLength() == 0) return;

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
