// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {Base} from "tests/utils/Addresses.sol";

import {PoolBoosterFactoryMerkl} from "contracts/poolBooster/PoolBoosterFactoryMerkl.sol";
import {PoolBoosterMerkl} from "contracts/poolBooster/PoolBoosterMerkl.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OETHBaseVault} from "contracts/vault/OETHBaseVault.sol";

abstract contract Smoke_PoolBoosterMerklBase_Shared_Test is BaseSmoke {
    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkBase();
        _igniteDeployManager();

        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        factoryMerkl = PoolBoosterFactoryMerkl(resolver.resolve("POOL_BOOSTER_FACTORY_MERKL"));
        boosterMerkl = PoolBoosterMerkl(resolver.resolve("POOL_BOOSTER_MERKL_OETHB_USDC"));

        vm.label(address(factoryMerkl), "PoolBoosterFactoryMerkl");
        vm.label(address(boosterMerkl), "PoolBoosterMerkl");
    }

    /// @dev Deal WETH, mint OETHBase via vault, transfer to booster
    function _mintAndFundBooster(address booster, uint256 amount) internal {
        IERC20 weth = IERC20(Base.WETH);
        OETHBaseVault vault = OETHBaseVault(payable(Base.OETHBaseVaultProxy));

        deal(address(weth), address(this), amount);
        weth.approve(address(vault), amount);
        vault.mint(address(weth), amount, 0);

        IERC20(Base.OETHBaseProxy).transfer(booster, IERC20(Base.OETHBaseProxy).balanceOf(address(this)));
    }
}
