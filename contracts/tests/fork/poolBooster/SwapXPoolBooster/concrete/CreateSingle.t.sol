// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_SwapXPoolBooster_Shared_Test} from "tests/fork/poolBooster/SwapXPoolBooster/shared/Shared.t.sol";
import {PoolBoosterSwapxSingle} from "contracts/poolBooster/PoolBoosterSwapxSingle.sol";
import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";
import {Sonic} from "tests/utils/Addresses.sol";

contract Fork_Concrete_SwapXPoolBooster_CreateSingle_Test is Fork_SwapXPoolBooster_Shared_Test {
    event PoolBoosterCreated(
        address poolBoosterAddress,
        address ammPoolAddress,
        IPoolBoostCentralRegistry.PoolBoosterType poolBoosterType,
        address factoryAddress
    );

    function test_createPoolBoosterSwapxSingle() public {
        vm.prank(Sonic.timelock);
        factorySwapxSingle.createPoolBoosterSwapxSingle(Sonic.SwapXOsUSDCe_extBribeOS, Sonic.SwapXOsGEMSx_pool, 1e18);

        (address boosterAddr,,) = factorySwapxSingle.poolBoosters(factorySwapxSingle.poolBoosterLength() - 1);
        PoolBoosterSwapxSingle booster = PoolBoosterSwapxSingle(boosterAddr);

        assertEq(address(booster.osToken()), address(oSonic));
        assertEq(address(booster.bribeContract()), Sonic.SwapXOsUSDCe_extBribeOS);
    }

    function test_createPoolBoosterSwapxSingle_computedVsActualAddress() public {
        uint256 salt = 12345e18;

        vm.prank(Sonic.timelock);
        factorySwapxSingle.createPoolBoosterSwapxSingle(Sonic.SwapXOsUSDCe_extBribeOS, Sonic.SwapXOsGEMSx_pool, salt);

        (address boosterAddr,,) = factorySwapxSingle.poolBoosters(factorySwapxSingle.poolBoosterLength() - 1);

        address computedAddr =
            factorySwapxSingle.computePoolBoosterAddress(Sonic.SwapXOsUSDCe_extBribeOS, Sonic.SwapXOsGEMSx_pool, salt);

        assertEq(boosterAddr, computedAddr);
    }
}
