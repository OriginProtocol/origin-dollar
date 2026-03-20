// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {PoolBoosterFactorySwapxDouble} from "contracts/poolBooster/PoolBoosterFactorySwapxDouble.sol";
import {AbstractPoolBoosterFactory} from "contracts/poolBooster/AbstractPoolBoosterFactory.sol";
import {Sonic} from "tests/utils/Addresses.sol";

import {
    Smoke_PoolBoosterSwapxDouble_Shared_Test
} from "tests/smoke/poolBooster/PoolBoosterSwapxDouble/shared/Shared.t.sol";

contract Smoke_Concrete_PoolBoosterFactorySwapxDouble_Test is Smoke_PoolBoosterSwapxDouble_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    //////////////////////////////////////////////////////

    function test_governor() public view {
        assertNotEq(factorySwapxDouble.governor(), address(0));
    }

    function test_oToken() public view {
        (bool success, bytes memory data) = address(factorySwapxDouble).staticcall(
            abi.encodeWithSignature("oSonic()")
        );
        assertTrue(success, "oSonic() call failed");
        address oTokenAddr = abi.decode(data, (address));
        assertEq(oTokenAddr, Sonic.OSonicProxy);
    }

    function test_centralRegistry() public view {
        assertNotEq(address(factorySwapxDouble.centralRegistry()), address(0));
    }

    function test_version() public view {
        assertEq(factorySwapxDouble.version(), 1);
    }

    function test_poolBoosterLength() public view {
        assertGt(factorySwapxDouble.poolBoosterLength(), 0);
    }

    function test_poolBoosterFromPool() public view {
        (address firstBooster, address firstPool,) = factorySwapxDouble.poolBoosters(0);
        (address fromPoolBooster,,) = factorySwapxDouble.poolBoosterFromPool(firstPool);
        assertEq(fromPoolBooster, firstBooster);
    }

    function test_computePoolBoosterAddress() public view {
        address computed = factorySwapxDouble.computePoolBoosterAddress(
            address(1), address(2), address(3), 50e16, 12345
        );
        assertNotEq(computed, address(0));
    }

    //////////////////////////////////////////////////////
    /// --- MUTATIVE FUNCTIONS
    //////////////////////////////////////////////////////

    function test_createPoolBoosterSwapxDouble() public {
        uint256 lengthBefore = factorySwapxDouble.poolBoosterLength();

        vm.prank(factorySwapxDouble.governor());
        factorySwapxDouble.createPoolBoosterSwapxDouble(
            address(uint160(uint256(keccak256("bribeOS")))),
            address(uint160(uint256(keccak256("bribeOther")))),
            address(uint160(uint256(keccak256("newPool")))),
            50e16,
            block.timestamp
        );

        assertEq(factorySwapxDouble.poolBoosterLength(), lengthBefore + 1);
    }

    function test_removePoolBooster() public {
        (address firstBooster,,) = factorySwapxDouble.poolBoosters(0);
        uint256 lengthBefore = factorySwapxDouble.poolBoosterLength();

        vm.prank(factorySwapxDouble.governor());
        factorySwapxDouble.removePoolBooster(firstBooster);

        assertEq(factorySwapxDouble.poolBoosterLength(), lengthBefore - 1);
    }

    function test_bribeAll() public {
        address[] memory exclusionList = new address[](0);
        factorySwapxDouble.bribeAll(exclusionList);
    }
}
