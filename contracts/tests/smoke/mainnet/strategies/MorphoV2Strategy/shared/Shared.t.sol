// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";

// --- Test utilities
import {Mainnet} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Project imports
import {IMorphoV2Strategy} from "contracts/interfaces/strategies/IMorphoV2Strategy.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IVault} from "contracts/interfaces/IVault.sol";

abstract contract Smoke_MorphoV2Strategy_Shared_Test is BaseSmoke {
    IOToken internal ousd;
    IVault internal ousdVault;
    IMorphoV2Strategy internal morphoV2Strategy;

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

        ousd = IOToken(resolver.resolve("OUSD_PROXY"));
        ousdVault = IVault(resolver.resolve("OUSD_VAULT_PROXY"));
        morphoV2Strategy = IMorphoV2Strategy(resolver.resolve("MORPHO_OUSD_V2_STRATEGY_PROXY"));
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
