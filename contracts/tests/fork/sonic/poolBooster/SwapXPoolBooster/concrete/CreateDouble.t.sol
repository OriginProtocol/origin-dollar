// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_SwapXPoolBooster_Shared_Test} from "tests/fork/sonic/poolBooster/SwapXPoolBooster/shared/Shared.t.sol";
import {PoolBoosterSwapxDouble} from "contracts/poolBooster/PoolBoosterSwapxDouble.sol";
import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";
import {Sonic} from "tests/utils/Addresses.sol";

contract Fork_Concrete_SwapXPoolBooster_CreateDouble_Test is Fork_SwapXPoolBooster_Shared_Test {
    event PoolBoosterCreated(
        address poolBoosterAddress,
        address ammPoolAddress,
        IPoolBoostCentralRegistry.PoolBoosterType poolBoosterType,
        address factoryAddress
    );

    function test_createPoolBoosterSwapxDouble() public {
        vm.prank(Sonic.timelock);
        factorySwapxDouble.createPoolBoosterSwapxDouble(
            Sonic.SwapXOsUSDCe_extBribeOS, Sonic.SwapXOsUSDCe_extBribeUSDC, Sonic.SwapXOsGEMSx_pool, 0.5e18, 1e18
        );

        (address boosterAddr,,) = factorySwapxDouble.poolBoosters(factorySwapxDouble.poolBoosterLength() - 1);
        PoolBoosterSwapxDouble booster = PoolBoosterSwapxDouble(boosterAddr);

        assertEq(address(booster.osToken()), address(oSonic));
        assertEq(address(booster.bribeContractOS()), Sonic.SwapXOsUSDCe_extBribeOS);
        assertEq(address(booster.bribeContractOther()), Sonic.SwapXOsUSDCe_extBribeUSDC);
        assertEq(booster.split(), 0.5e18);
    }

    function test_createPoolBoosterSwapxDouble_computedVsActualAddress() public {
        uint256 salt = 1337e18;

        vm.prank(Sonic.timelock);
        factorySwapxDouble.createPoolBoosterSwapxDouble(
            Sonic.SwapXOsUSDCe_extBribeOS, Sonic.SwapXOsUSDCe_extBribeUSDC, Sonic.SwapXOsGEMSx_pool, 0.5e18, salt
        );

        (address boosterAddr,,) = factorySwapxDouble.poolBoosters(factorySwapxDouble.poolBoosterLength() - 1);

        address computedAddr = factorySwapxDouble.computePoolBoosterAddress(
            Sonic.SwapXOsUSDCe_extBribeOS, Sonic.SwapXOsUSDCe_extBribeUSDC, Sonic.SwapXOsGEMSx_pool, 0.5e18, salt
        );

        assertEq(boosterAddr, computedAddr);
    }
}
