// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Metropolis_Shared_Test} from "tests/unit/poolBooster/Metropolis/shared/Shared.t.sol";

contract Unit_Concrete_PoolBoosterMetropolis_Constructor_Test is Unit_Metropolis_Shared_Test {
    function test_constructor() public view {
        assertEq(address(boosterMetropolis.osToken()), address(oSonic));
        assertEq(boosterMetropolis.pool(), mockAmmPool);
        assertEq(address(boosterMetropolis.rewardFactory()), mockRewardFactory);
        assertEq(address(boosterMetropolis.voter()), mockVoter);
        assertEq(boosterMetropolis.MIN_BRIBE_AMOUNT(), 1e10);
    }

    function test_constructor_RevertWhen_zeroPool() public {
        vm.expectRevert("Invalid pool address");
        vm.deployCode(
            "contracts/poolBooster/PoolBoosterMetropolis.sol:PoolBoosterMetropolis",
            abi.encode(address(oSonic), mockRewardFactory, address(0), mockVoter)
        );
    }
}
