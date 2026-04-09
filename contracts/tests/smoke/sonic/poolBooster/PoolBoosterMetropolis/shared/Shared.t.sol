// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";

// --- Test utilities
import {Sonic} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Project imports
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IPoolBoosterFactoryMetropolis} from "contracts/interfaces/poolBooster/IPoolBoosterFactoryMetropolis.sol";
import {IPoolBoosterMetropolis} from "contracts/interfaces/poolBooster/IPoolBoosterMetropolis.sol";
import {IVault} from "contracts/interfaces/IVault.sol";

abstract contract Smoke_PoolBoosterMetropolis_Shared_Test is BaseSmoke {
    IPoolBoosterFactoryMetropolis internal factoryMetropolis;
    IPoolBoosterMetropolis internal boosterMetropolis;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkSonic();
        _igniteDeployManager();
        _fetchContracts();
        _labelContracts();
    }

    function _fetchContracts() internal virtual {
        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        factoryMetropolis = IPoolBoosterFactoryMetropolis(resolver.resolve("POOL_BOOSTER_FACTORY_METROPOLIS"));
        boosterMetropolis = IPoolBoosterMetropolis(resolver.resolve("POOL_BOOSTER_METROPOLIS_WS_OS"));
    }

    function _labelContracts() internal virtual {
        vm.label(address(factoryMetropolis), "PoolBoosterFactoryMetropolis");
        vm.label(address(boosterMetropolis), "PoolBoosterMetropolis");
    }

    /// @dev Deal wS, mint OS via vault, transfer to booster
    function _mintAndFundBooster(address booster, uint256 amount) internal {
        IERC20 wrappedSonic = IERC20(Sonic.wS);
        IVault vault = IVault(Sonic.OSonicVaultProxy);
        IOToken oSonic = IOToken(Sonic.OSonicProxy);

        deal(address(wrappedSonic), address(this), amount);
        wrappedSonic.approve(address(vault), amount);
        vault.mint(amount);

        oSonic.transfer(booster, oSonic.balanceOf(address(this)));
    }
}
