// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {Base} from "tests/utils/Addresses.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {IPoolBoosterFactoryMerkl} from "contracts/interfaces/poolBooster/IPoolBoosterFactoryMerkl.sol";
import {IPoolBoosterMerkl} from "contracts/interfaces/poolBooster/IPoolBoosterMerkl.sol";

abstract contract Smoke_PoolBoosterMerklBase_Shared_Test is BaseSmoke {
    IPoolBoosterFactoryMerkl internal factoryMerkl;
    IPoolBoosterMerkl internal boosterMerkl;
    IVault internal oethBaseVault;
    IOToken internal oethBase;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkBase();
        _igniteDeployManager();
        _fetchContracts();
        _labelContracts();
    }

    function _fetchContracts() internal virtual {
        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        factoryMerkl = IPoolBoosterFactoryMerkl(resolver.resolve("POOL_BOOSTER_FACTORY_MERKL"));
        boosterMerkl = IPoolBoosterMerkl(resolver.resolve("POOL_BOOSTER_MERKL_OETHB_USDC"));
        oethBaseVault = IVault(resolver.resolve("OETHBASE_VAULT_PROXY"));
        oethBase = IOToken(resolver.resolve("OETHBASE_PROXY"));
    }

    function _labelContracts() internal virtual {
        vm.label(address(factoryMerkl), "PoolBoosterFactoryMerkl");
        vm.label(address(boosterMerkl), "PoolBoosterMerkl");
        vm.label(address(oethBaseVault), "OETHBaseVault");
        vm.label(address(oethBase), "OETHBase");
    }

    /// @dev Deal WETH, mint OETHBase via vault, transfer to booster
    function _mintAndFundBooster(address booster, uint256 amount) internal {
        IERC20 weth = IERC20(Base.WETH);

        deal(address(weth), address(this), amount);
        weth.approve(address(oethBaseVault), amount);
        (bool success,) = address(oethBaseVault)
            .call(abi.encodeWithSignature("mint(address,uint256,uint256)", address(weth), amount, 0));
        require(success, "OETHBase mint failed");

        oethBase.transfer(booster, oethBase.balanceOf(address(this)));
    }
}
