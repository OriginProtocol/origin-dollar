// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Metropolis_Shared_Test} from "tests/unit/poolBooster/Metropolis/shared/Shared.t.sol";

contract Unit_Concrete_PoolBoosterFactoryMetropolis_Constructor_Test is Unit_Metropolis_Shared_Test {
    function test_constructor() public view {
        assertEq(factoryMetropolis.oToken(), address(oSonic));
        assertEq(factoryMetropolis.governor(), governor);
        assertEq(address(factoryMetropolis.centralRegistry()), address(centralRegistry));
        assertEq(factoryMetropolis.version(), 1);
        assertEq(factoryMetropolis.rewardFactory(), mockRewardFactory);
        assertEq(factoryMetropolis.voter(), mockVoter);
    }

    function test_constructor_RevertWhen_zeroOToken() public {
        vm.expectRevert("Invalid oToken address");
        vm.deployCode(
            "contracts/poolBooster/PoolBoosterFactoryMetropolis.sol:PoolBoosterFactoryMetropolis",
            abi.encode(address(0), governor, address(centralRegistry), mockRewardFactory, mockVoter)
        );
    }

    function test_constructor_RevertWhen_zeroGovernor() public {
        vm.expectRevert("Invalid governor address");
        vm.deployCode(
            "contracts/poolBooster/PoolBoosterFactoryMetropolis.sol:PoolBoosterFactoryMetropolis",
            abi.encode(address(oSonic), address(0), address(centralRegistry), mockRewardFactory, mockVoter)
        );
    }

    function test_constructor_RevertWhen_zeroCentralRegistry() public {
        vm.expectRevert("Invalid central registry address");
        vm.deployCode(
            "contracts/poolBooster/PoolBoosterFactoryMetropolis.sol:PoolBoosterFactoryMetropolis",
            abi.encode(address(oSonic), governor, address(0), mockRewardFactory, mockVoter)
        );
    }
}
