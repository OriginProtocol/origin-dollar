// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {Sonic} from "tests/utils/Addresses.sol";

import {PoolBoosterFactorySwapxSingle} from "contracts/poolBooster/PoolBoosterFactorySwapxSingle.sol";
import {PoolBoosterSwapxSingle} from "contracts/poolBooster/PoolBoosterSwapxSingle.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OSVault} from "contracts/vault/OSVault.sol";

abstract contract Smoke_PoolBoosterSwapxSingle_Shared_Test is BaseSmoke {
    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkSonic();
        _igniteDeployManager();

        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        factorySwapxSingle = PoolBoosterFactorySwapxSingle(resolver.resolve("POOL_BOOSTER_FACTORY_SWAPX_SINGLE"));
        boosterSwapxSingle = PoolBoosterSwapxSingle(resolver.resolve("POOL_BOOSTER_SWAPX_SINGLE_WS_OS"));

        vm.label(address(factorySwapxSingle), "PoolBoosterFactorySwapxSingle");
        vm.label(address(boosterSwapxSingle), "PoolBoosterSwapxSingle");
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
