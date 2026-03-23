// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

import {OUSD} from "contracts/token/OUSD.sol";
import {OUSDVault} from "contracts/vault/OUSDVault.sol";
import {MorphoV2Strategy} from "contracts/strategies/MorphoV2Strategy.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract Smoke_MorphoV2Strategy_Shared_Test is BaseSmoke {
    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();
        _igniteDeployManager();
        _fetchContracts();
        _resolveActors();
        _labelContracts();
    }

    function _fetchContracts() internal virtual {
        require(address(resolver).code.length > 0, "Resolver not initialized on fork");

        ousd = OUSD(resolver.resolve("OUSD_PROXY"));
        ousdVault = OUSDVault(payable(resolver.resolve("OUSD_VAULT_PROXY")));
        morphoV2Strategy = MorphoV2Strategy(resolver.resolve("MORPHO_OUSD_V2_STRATEGY_PROXY"));
        usdc = IERC20(Mainnet.USDC);
    }

    function _resolveActors() internal virtual {
        governor = morphoV2Strategy.governor();
        strategist = ousdVault.strategistAddr();
    }

    function _labelContracts() internal virtual {
        vm.label(address(ousd), "OUSD");
        vm.label(address(ousdVault), "OUSDVault");
        vm.label(address(morphoV2Strategy), "MorphoV2Strategy");
        vm.label(address(usdc), "USDC");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _depositToStrategy(uint256 amount) internal {
        deal(address(usdc), address(morphoV2Strategy), amount);
        vm.prank(address(ousdVault));
        morphoV2Strategy.deposit(address(usdc), amount);
    }
}
