// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {Sonic} from "tests/utils/Addresses.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {IPoolBoosterFactorySwapxDouble} from "contracts/interfaces/poolBooster/IPoolBoosterFactorySwapxDouble.sol";
import {IPoolBoosterSwapxDouble} from "contracts/interfaces/poolBooster/IPoolBoosterSwapxDouble.sol";

abstract contract Smoke_PoolBoosterSwapxDouble_Shared_Test is BaseSmoke {
    IPoolBoosterFactorySwapxDouble internal factorySwapxDouble;
    IPoolBoosterSwapxDouble internal boosterSwapxDouble;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkSonic();
        _igniteDeployManager();
        _fetchContracts();
        _labelContracts();
    }

    function _fetchContracts() internal virtual {
        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        factorySwapxDouble = IPoolBoosterFactorySwapxDouble(resolver.resolve("POOL_BOOSTER_FACTORY_SWAPX_DOUBLE"));
        boosterSwapxDouble = IPoolBoosterSwapxDouble(resolver.resolve("POOL_BOOSTER_SWAPX_DOUBLE_SILO_OS"));
    }

    function _labelContracts() internal virtual {
        vm.label(address(factorySwapxDouble), "PoolBoosterFactorySwapxDouble");
        vm.label(address(boosterSwapxDouble), "PoolBoosterSwapxDouble");
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
