// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SwapXSingle_Shared_Test} from "tests/unit/poolBooster/SwapXSingle/shared/Shared.sol";
import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";

contract Unit_Concrete_PoolBoosterFactorySwapxSingle_CreatePoolBooster_Test is Unit_SwapXSingle_Shared_Test {
    function test_createPoolBooster() public {
        vm.prank(governor);
        factorySwapxSingle.createPoolBoosterSwapxSingle(mockBribeContract, mockAmmPool, 1);

        assertEq(factorySwapxSingle.poolBoosterLength(), 1);

        (address boosterAddr, address ammPool,) = factorySwapxSingle.poolBoosters(0);
        assertTrue(boosterAddr != address(0));
        assertEq(ammPool, mockAmmPool);
    }

    function test_createPoolBooster_deploysContract() public {
        vm.prank(governor);
        factorySwapxSingle.createPoolBoosterSwapxSingle(mockBribeContract, mockAmmPool, 1);

        (address boosterAddr,,) = factorySwapxSingle.poolBoosters(0);
        assertTrue(boosterAddr.code.length > 0);
    }

    function test_createPoolBooster_event() public {
        address computed = factorySwapxSingle.computePoolBoosterAddress(mockBribeContract, mockAmmPool, 1);

        vm.expectEmit(true, true, true, true, address(centralRegistry));
        emit IPoolBoostCentralRegistry.PoolBoosterCreated(
            computed,
            mockAmmPool,
            IPoolBoostCentralRegistry.PoolBoosterType.SwapXSingleBooster,
            address(factorySwapxSingle)
        );

        vm.prank(governor);
        factorySwapxSingle.createPoolBoosterSwapxSingle(mockBribeContract, mockAmmPool, 1);
    }

    function test_createPoolBooster_correctType() public {
        vm.prank(governor);
        factorySwapxSingle.createPoolBoosterSwapxSingle(mockBribeContract, mockAmmPool, 1);

        (,, IPoolBoostCentralRegistry.PoolBoosterType boosterType) = factorySwapxSingle.poolBoosters(0);
        assertEq(uint256(boosterType), uint256(IPoolBoostCentralRegistry.PoolBoosterType.SwapXSingleBooster));
    }

    function test_createPoolBooster_matchesComputed() public {
        address computed = factorySwapxSingle.computePoolBoosterAddress(mockBribeContract, mockAmmPool, 1);

        vm.prank(governor);
        factorySwapxSingle.createPoolBoosterSwapxSingle(mockBribeContract, mockAmmPool, 1);

        (address deployed,,) = factorySwapxSingle.poolBoosters(0);
        assertEq(deployed, computed);
    }

    function test_createPoolBooster_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        factorySwapxSingle.createPoolBoosterSwapxSingle(mockBribeContract, mockAmmPool, 1);
    }

    function test_createPoolBooster_RevertWhen_zeroPool() public {
        vm.prank(governor);
        vm.expectRevert("Invalid ammPoolAddress address");
        factorySwapxSingle.createPoolBoosterSwapxSingle(mockBribeContract, address(0), 1);
    }

    function test_createPoolBooster_RevertWhen_zeroSalt() public {
        vm.prank(governor);
        vm.expectRevert("Invalid salt");
        factorySwapxSingle.createPoolBoosterSwapxSingle(mockBribeContract, mockAmmPool, 0);
    }
}
