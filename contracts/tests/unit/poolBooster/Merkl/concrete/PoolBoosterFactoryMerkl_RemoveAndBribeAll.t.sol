// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Merkl_Shared_Test} from "tests/unit/poolBooster/Merkl/shared/Shared.t.sol";

// --- Project imports
import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";
import {IPoolBooster} from "contracts/interfaces/poolBooster/IPoolBooster.sol";

contract Unit_Concrete_PoolBoosterFactoryMerkl_RemoveAndBribeAll_Test is Unit_Merkl_Shared_Test {
    function _createBooster(address pool, uint256 salt) internal returns (address booster) {
        vm.prank(governor);
        factoryMerkl.createPoolBoosterMerkl(pool, _defaultInitData(), salt);
        (booster,,) = factoryMerkl.poolBoosterFromPool(pool);
    }

    function test_removePoolBooster() public {
        address pool = makeAddr("Pool1");
        address booster = _createBooster(pool, 1);

        vm.expectEmit(true, true, true, true, address(centralRegistry));
        emit IPoolBoostCentralRegistry.PoolBoosterRemoved(booster);

        vm.prank(governor);
        factoryMerkl.removePoolBooster(booster);

        assertEq(factoryMerkl.poolBoosterLength(), 0);
        (address mappedBooster,,) = factoryMerkl.poolBoosterFromPool(pool);
        assertEq(mappedBooster, address(0));
    }

    function test_removePoolBooster_RevertWhen_notFound() public {
        vm.prank(governor);
        vm.expectRevert("Pool booster not found");
        factoryMerkl.removePoolBooster(makeAddr("MissingBooster"));
    }

    function test_removePoolBooster_RevertWhen_notGovernor() public {
        address booster = _createBooster(makeAddr("Pool1"), 1);

        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        factoryMerkl.removePoolBooster(booster);
    }

    function test_removePoolBoosterByIndex() public {
        address pool1 = makeAddr("Pool1");
        address pool2 = makeAddr("Pool2");
        address booster1 = _createBooster(pool1, 1);
        address booster2 = _createBooster(pool2, 2);

        vm.expectEmit(true, true, true, true, address(centralRegistry));
        emit IPoolBoostCentralRegistry.PoolBoosterRemoved(booster1);

        vm.prank(governor);
        factoryMerkl.removePoolBoosterByIndex(0);

        assertEq(factoryMerkl.poolBoosterLength(), 1);
        (address remainingBooster, address remainingPool,) = factoryMerkl.poolBoosters(0);
        assertEq(remainingBooster, booster2);
        assertEq(remainingPool, pool2);

        (address removedBooster,,) = factoryMerkl.poolBoosterFromPool(pool1);
        assertEq(removedBooster, address(0));
    }

    function test_removePoolBoosterByIndex_RevertWhen_outOfBounds() public {
        vm.prank(governor);
        vm.expectRevert("Index out of bounds");
        factoryMerkl.removePoolBoosterByIndex(0);
    }

    function test_removePoolBoosterByIndex_RevertWhen_notGovernor() public {
        _createBooster(makeAddr("Pool1"), 1);

        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        factoryMerkl.removePoolBoosterByIndex(0);
    }

    function test_bribeAll_executesFundedBoosters() public {
        address booster = _createBooster(makeAddr("Pool1"), 1);
        _dealOETH(booster, 1 ether);
        _mockMerklDistributor(1e10);

        vm.expectEmit(true, true, true, true, booster);
        emit IPoolBooster.BribeExecuted(1 ether);

        address[] memory exclusionList = new address[](0);
        vm.prank(governor);
        factoryMerkl.bribeAll(exclusionList);

        assertEq(oeth.allowance(booster, mockMerklDistributor), 1 ether);
    }

    function test_bribeAll_skipsExcludedBoosters() public {
        address booster = _createBooster(makeAddr("Pool1"), 1);
        _dealOETH(booster, 1 ether);
        _mockMerklDistributor(1e10);

        address[] memory exclusionList = new address[](1);
        exclusionList[0] = booster;

        vm.prank(governor);
        factoryMerkl.bribeAll(exclusionList);

        assertEq(oeth.allowance(booster, mockMerklDistributor), 0);
        assertEq(oeth.balanceOf(booster), 1 ether);
    }

    function test_bribeAll_RevertWhen_notGovernor() public {
        address[] memory exclusionList = new address[](0);

        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        factoryMerkl.bribeAll(exclusionList);
    }
}
