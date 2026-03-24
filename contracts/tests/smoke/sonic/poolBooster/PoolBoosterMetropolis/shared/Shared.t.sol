// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {Sonic} from "tests/utils/Addresses.sol";

import {PoolBoosterFactoryMetropolis} from "contracts/poolBooster/PoolBoosterFactoryMetropolis.sol";
import {PoolBoosterMetropolis} from "contracts/poolBooster/PoolBoosterMetropolis.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OSVault} from "contracts/vault/OSVault.sol";

abstract contract Smoke_PoolBoosterMetropolis_Shared_Test is BaseSmoke {
    PoolBoosterFactoryMetropolis internal factoryMetropolis;
    PoolBoosterMetropolis internal boosterMetropolis;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkSonic();
        _igniteDeployManager();

        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        factoryMetropolis = PoolBoosterFactoryMetropolis(resolver.resolve("POOL_BOOSTER_FACTORY_METROPOLIS"));
        boosterMetropolis = PoolBoosterMetropolis(resolver.resolve("POOL_BOOSTER_METROPOLIS_WS_OS"));

        vm.label(address(factoryMetropolis), "PoolBoosterFactoryMetropolis");
        vm.label(address(boosterMetropolis), "PoolBoosterMetropolis");
    }

    /// @dev Deal wS, mint OS via vault, transfer to booster
    function _mintAndFundBooster(address booster, uint256 amount) internal {
        IERC20 wrappedSonic = IERC20(Sonic.wS);
        OSVault vault = OSVault(payable(Sonic.OSonicVaultProxy));

        deal(address(wrappedSonic), address(this), amount);
        wrappedSonic.approve(address(vault), amount);
        vault.mint(amount);

        IERC20(Sonic.OSonicProxy).transfer(booster, IERC20(Sonic.OSonicProxy).balanceOf(address(this)));
    }
}
