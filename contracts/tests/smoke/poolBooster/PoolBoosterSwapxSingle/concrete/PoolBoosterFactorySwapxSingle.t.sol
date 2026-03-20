// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {PoolBoosterFactorySwapxSingle} from "contracts/poolBooster/PoolBoosterFactorySwapxSingle.sol";
import {AbstractPoolBoosterFactory} from "contracts/poolBooster/AbstractPoolBoosterFactory.sol";
import {Sonic} from "tests/utils/Addresses.sol";

import {
    Smoke_PoolBoosterSwapxSingle_Shared_Test
} from "tests/smoke/poolBooster/PoolBoosterSwapxSingle/shared/Shared.t.sol";

contract Smoke_Concrete_PoolBoosterFactorySwapxSingle_Test is Smoke_PoolBoosterSwapxSingle_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    //////////////////////////////////////////////////////

    function test_governor() public view {
        assertNotEq(factorySwapxSingle.governor(), address(0));
    }

    function test_oToken() public view {
        (bool success, bytes memory data) = address(factorySwapxSingle).staticcall(
            abi.encodeWithSignature("oSonic()")
        );
        assertTrue(success, "oSonic() call failed");
        address oTokenAddr = abi.decode(data, (address));
        assertEq(oTokenAddr, Sonic.OSonicProxy);
    }

    function test_centralRegistry() public view {
        assertNotEq(address(factorySwapxSingle.centralRegistry()), address(0));
    }

    function test_version() public view {
        assertEq(factorySwapxSingle.version(), 1);
    }

    function test_poolBoosterLength() public view {
        assertGt(factorySwapxSingle.poolBoosterLength(), 0);
    }

    function test_poolBoosterFromPool() public view {
        (address firstBooster, address firstPool,) = factorySwapxSingle.poolBoosters(0);
        (address fromPoolBooster,,) = factorySwapxSingle.poolBoosterFromPool(firstPool);
        assertEq(fromPoolBooster, firstBooster);
    }

    function test_computePoolBoosterAddress() public view {
        address computed = factorySwapxSingle.computePoolBoosterAddress(
            address(1), address(2), 12345
        );
        assertNotEq(computed, address(0));
    }

    //////////////////////////////////////////////////////
    /// --- MUTATIVE FUNCTIONS
    //////////////////////////////////////////////////////

    function test_createPoolBoosterSwapxSingle() public {
        uint256 lengthBefore = factorySwapxSingle.poolBoosterLength();

        vm.prank(factorySwapxSingle.governor());
        factorySwapxSingle.createPoolBoosterSwapxSingle(
            address(uint160(uint256(keccak256("newBribe")))),
            address(uint160(uint256(keccak256("newPool")))),
            block.timestamp
        );

        assertEq(factorySwapxSingle.poolBoosterLength(), lengthBefore + 1);
    }

    function test_removePoolBooster() public {
        (address firstBooster,,) = factorySwapxSingle.poolBoosters(0);
        uint256 lengthBefore = factorySwapxSingle.poolBoosterLength();

        vm.prank(factorySwapxSingle.governor());
        factorySwapxSingle.removePoolBooster(firstBooster);

        assertEq(factorySwapxSingle.poolBoosterLength(), lengthBefore - 1);
    }

    function test_bribeAll() public {
        address[] memory exclusionList = new address[](0);
        factorySwapxSingle.bribeAll(exclusionList);
    }
}
