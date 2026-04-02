// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Sonic} from "tests/utils/Addresses.sol";

import {
    Smoke_PoolBoosterMetropolis_Shared_Test
} from "tests/smoke/sonic/poolBooster/PoolBoosterMetropolis/shared/Shared.t.sol";

contract Smoke_Concrete_PoolBoosterFactoryMetropolis_Test is Smoke_PoolBoosterMetropolis_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    //////////////////////////////////////////////////////

    function test_governor() public view {
        assertNotEq(factoryMetropolis.governor(), address(0));
    }

    function test_oToken() public view {
        (bool success, bytes memory data) = address(factoryMetropolis).staticcall(abi.encodeWithSignature("oSonic()"));
        assertTrue(success, "oSonic() call failed");
        address oTokenAddr = abi.decode(data, (address));
        assertEq(oTokenAddr, Sonic.OSonicProxy);
    }

    function test_centralRegistry() public view {
        assertNotEq(address(factoryMetropolis.centralRegistry()), address(0));
    }

    function test_version() public view {
        assertEq(factoryMetropolis.version(), 1);
    }

    function test_poolBoosterLength() public view {
        assertGt(factoryMetropolis.poolBoosterLength(), 0);
    }

    function test_poolBoosterFromPool() public view {
        (address firstBooster, address firstPool,) = factoryMetropolis.poolBoosters(0);
        (address fromPoolBooster,,) = factoryMetropolis.poolBoosterFromPool(firstPool);
        assertEq(fromPoolBooster, firstBooster);
    }

    function test_rewardFactory() public view {
        assertEq(factoryMetropolis.rewardFactory(), Sonic.Metropolis_RewarderFactory);
    }

    function test_voter() public view {
        assertEq(factoryMetropolis.voter(), Sonic.Metropolis_Voter);
    }

    function test_computePoolBoosterAddress() public view {
        address computed = factoryMetropolis.computePoolBoosterAddress(address(1), 12345);
        assertNotEq(computed, address(0));
    }

    //////////////////////////////////////////////////////
    /// --- MUTATIVE FUNCTIONS
    //////////////////////////////////////////////////////

    function test_createPoolBoosterMetropolis() public {
        uint256 lengthBefore = factoryMetropolis.poolBoosterLength();

        vm.prank(factoryMetropolis.governor());
        factoryMetropolis.createPoolBoosterMetropolis(address(uint160(uint256(keccak256("newPool")))), block.timestamp);

        assertEq(factoryMetropolis.poolBoosterLength(), lengthBefore + 1);
    }

    function test_removePoolBooster() public {
        (address firstBooster,,) = factoryMetropolis.poolBoosters(0);
        uint256 lengthBefore = factoryMetropolis.poolBoosterLength();

        vm.prank(factoryMetropolis.governor());
        factoryMetropolis.removePoolBooster(firstBooster);

        assertEq(factoryMetropolis.poolBoosterLength(), lengthBefore - 1);
    }

    function test_bribeAll() public {
        // Exclude all boosters since Metropolis protocol may limit bribes per period
        (address firstBooster,,) = factoryMetropolis.poolBoosters(0);
        address[] memory exclusionList = new address[](1);
        exclusionList[0] = firstBooster;
        factoryMetropolis.bribeAll(exclusionList);
    }
}
