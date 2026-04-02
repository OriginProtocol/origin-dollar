// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

import {IPoolBoosterFactoryMerkl} from "contracts/interfaces/poolBooster/IPoolBoosterFactoryMerkl.sol";
import {IPoolBoosterMerkl} from "contracts/interfaces/poolBooster/IPoolBoosterMerkl.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract Smoke_PoolBoosterMerklMainnet_Shared_Test is BaseSmoke {
    IPoolBoosterFactoryMerkl internal factoryMerkl;
    IPoolBoosterMerkl internal boosterMerkl;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();
        _igniteDeployManager();

        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        factoryMerkl = IPoolBoosterFactoryMerkl(resolver.resolve("POOL_BOOSTER_FACTORY_MERKL"));
        boosterMerkl = IPoolBoosterMerkl(resolver.resolve("POOL_BOOSTER_MERKL_OETH_OGN"));

        vm.label(address(factoryMerkl), "PoolBoosterFactoryMerkl");
        vm.label(address(boosterMerkl), "PoolBoosterMerkl");
    }

    /// @dev Transfer OETH from whale to booster
    function _fundBooster(address booster, uint256 amount) internal {
        vm.prank(Mainnet.oethWhaleAddress);
        IERC20(Mainnet.OETHProxy).transfer(booster, amount);
    }
}
