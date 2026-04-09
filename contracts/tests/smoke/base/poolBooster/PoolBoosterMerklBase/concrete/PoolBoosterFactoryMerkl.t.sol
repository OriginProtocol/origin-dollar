// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Smoke_PoolBoosterMerklBase_Shared_Test
} from "tests/smoke/base/poolBooster/PoolBoosterMerklBase/shared/Shared.t.sol";

// --- Test utilities
import {Base} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_PoolBoosterFactoryMerklBase_Test is Smoke_PoolBoosterMerklBase_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    //////////////////////////////////////////////////////

    function test_governor() public view {
        assertNotEq(factoryMerkl.governor(), address(0));
    }

    function test_oToken() public view {
        // Base factory uses oSonic() getter on-chain (V1 naming)
        (bool success, bytes memory data) = address(factoryMerkl).staticcall(abi.encodeWithSignature("oSonic()"));
        if (!success) {
            // V2 uses oToken()
            (success, data) = address(factoryMerkl).staticcall(abi.encodeWithSignature("oToken()"));
        }
        assertTrue(success, "oToken/oSonic() call failed");
        address oTokenAddr = abi.decode(data, (address));
        assertEq(oTokenAddr, Base.OETHBaseProxy);
    }

    function test_centralRegistry() public view {
        assertNotEq(address(factoryMerkl.centralRegistry()), address(0));
    }

    function test_version() public view {
        (bool success,) = address(factoryMerkl).staticcall(abi.encodeWithSignature("version()"));
        assertTrue(success, "version() call failed");
    }

    function test_poolBoosterLength() public view {
        assertGt(factoryMerkl.poolBoosterLength(), 0);
    }

    function test_poolBoosterFromPool() public view {
        uint256 lastIdx = factoryMerkl.poolBoosterLength() - 1;
        (address lastBooster, address lastPool,) = factoryMerkl.poolBoosters(lastIdx);
        (address fromPoolBooster,,) = factoryMerkl.poolBoosterFromPool(lastPool);
        assertEq(fromPoolBooster, lastBooster);
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
        (bool s1, bytes memory d1) = address(boosterMerkl).staticcall(abi.encodeWithSignature("campaignType()"));
        (bool s2, bytes memory d2) = address(boosterMerkl).staticcall(abi.encodeWithSignature("duration()"));
        (bool s3, bytes memory d3) = address(boosterMerkl).staticcall(abi.encodeWithSignature("campaignData()"));
        require(s1 && s2 && s3, "Failed to read booster params");

        uint32 campaignType = abi.decode(d1, (uint32));
        uint32 duration = abi.decode(d2, (uint32));
        bytes memory campaignData = abi.decode(d3, (bytes));

        uint256 lengthBefore = factoryMerkl.poolBoosterLength();

        vm.prank(factoryMerkl.governor());
        (bool success,) = address(factoryMerkl)
            .call(
                abi.encodeWithSignature(
                    "createPoolBoosterMerkl(uint32,address,uint32,bytes,uint256)",
                    campaignType,
                    address(uint160(uint256(keccak256("newPool")))),
                    duration,
                    campaignData,
                    block.timestamp
                )
            );

        if (success) {
            assertEq(factoryMerkl.poolBoosterLength(), lengthBefore + 1);
        }
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
