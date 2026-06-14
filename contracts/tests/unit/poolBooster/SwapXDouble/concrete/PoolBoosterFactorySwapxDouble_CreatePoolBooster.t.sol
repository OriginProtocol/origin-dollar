// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_SwapXDouble_Shared_Test} from "tests/unit/poolBooster/SwapXDouble/shared/Shared.t.sol";

// --- Project imports
import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";

contract Unit_Concrete_PoolBoosterFactorySwapxDouble_CreatePoolBooster_Test is Unit_SwapXDouble_Shared_Test {
    function test_createPoolBooster() public {
        vm.prank(governor);
        factorySwapxDouble.createPoolBoosterSwapxDouble(
            mockBribeContractOS, mockBribeContractOther, mockAmmPool, DEFAULT_SPLIT, 1
        );

        assertEq(factorySwapxDouble.poolBoosterLength(), 1);

        (address boosterAddr, address ammPool,) = factorySwapxDouble.poolBoosters(0);
        assertTrue(boosterAddr != address(0));
        assertEq(ammPool, mockAmmPool);
    }

    function test_createPoolBooster_matchesComputed() public {
        address computed = factorySwapxDouble.computePoolBoosterAddress(
            mockBribeContractOS, mockBribeContractOther, mockAmmPool, DEFAULT_SPLIT, 1
        );

        vm.prank(governor);
        factorySwapxDouble.createPoolBoosterSwapxDouble(
            mockBribeContractOS, mockBribeContractOther, mockAmmPool, DEFAULT_SPLIT, 1
        );

        (address deployed,,) = factorySwapxDouble.poolBoosters(0);
        assertEq(deployed, computed);
    }

    function test_createPoolBooster_event() public {
        address computed = factorySwapxDouble.computePoolBoosterAddress(
            mockBribeContractOS, mockBribeContractOther, mockAmmPool, DEFAULT_SPLIT, 1
        );

        vm.expectEmit(true, true, true, true, address(centralRegistry));
        emit IPoolBoostCentralRegistry.PoolBoosterCreated(
            computed,
            mockAmmPool,
            IPoolBoostCentralRegistry.PoolBoosterType.SwapXDoubleBooster,
            address(factorySwapxDouble)
        );

        vm.prank(governor);
        factorySwapxDouble.createPoolBoosterSwapxDouble(
            mockBribeContractOS, mockBribeContractOther, mockAmmPool, DEFAULT_SPLIT, 1
        );
    }

    function test_createPoolBooster_correctType() public {
        vm.prank(governor);
        factorySwapxDouble.createPoolBoosterSwapxDouble(
            mockBribeContractOS, mockBribeContractOther, mockAmmPool, DEFAULT_SPLIT, 1
        );

        (,, IPoolBoostCentralRegistry.PoolBoosterType boosterType) = factorySwapxDouble.poolBoosters(0);
        assertEq(uint256(boosterType), uint256(IPoolBoostCentralRegistry.PoolBoosterType.SwapXDoubleBooster));
    }

    function test_createPoolBooster_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        factorySwapxDouble.createPoolBoosterSwapxDouble(
            mockBribeContractOS, mockBribeContractOther, mockAmmPool, DEFAULT_SPLIT, 1
        );
    }

    function test_createPoolBooster_RevertWhen_zeroPool() public {
        vm.prank(governor);
        vm.expectRevert("Invalid ammPoolAddress address");
        factorySwapxDouble.createPoolBoosterSwapxDouble(
            mockBribeContractOS, mockBribeContractOther, address(0), DEFAULT_SPLIT, 1
        );
    }

    function test_createPoolBooster_RevertWhen_zeroSalt() public {
        vm.prank(governor);
        vm.expectRevert("Invalid salt");
        factorySwapxDouble.createPoolBoosterSwapxDouble(
            mockBribeContractOS, mockBribeContractOther, mockAmmPool, DEFAULT_SPLIT, 0
        );
    }
}
