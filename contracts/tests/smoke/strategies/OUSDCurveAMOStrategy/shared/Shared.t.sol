// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

import {OUSD} from "contracts/token/OUSD.sol";
import {OUSDVault} from "contracts/vault/OUSDVault.sol";
import {CurveAMOStrategy} from "contracts/strategies/CurveAMOStrategy.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract Smoke_OUSDCurveAMOStrategy_Shared_Test is BaseSmoke {
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
        curveAMOStrategy = CurveAMOStrategy(resolver.resolve("OUSD_CURVE_AMO_STRATEGY"));
        usdc = IERC20(Mainnet.USDC);
        crv = IERC20(Mainnet.CRV);
    }

    function _resolveActors() internal virtual {
        governor = curveAMOStrategy.governor();
        strategist = ousdVault.strategistAddr();
    }

    function _labelContracts() internal virtual {
        vm.label(address(ousd), "OUSD");
        vm.label(address(ousdVault), "OUSDVault");
        vm.label(address(curveAMOStrategy), "CurveAMOStrategy");
        vm.label(address(usdc), "USDC");
        vm.label(address(crv), "CRV");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Deal USDC to strategy and call deposit as vault
    function _depositToStrategy(uint256 amount) internal {
        deal(address(usdc), address(curveAMOStrategy), amount);
        vm.prank(address(ousdVault));
        curveAMOStrategy.deposit(address(usdc), amount);
    }

    /// @dev Tilt pool toward hardAsset (more USDC, less OUSD)
    function _tiltPoolToHardAsset(uint256 swapAmount) internal {
        deal(address(usdc), address(this), swapAmount);
        usdc.approve(address(curveAMOStrategy.curvePool()), swapAmount);
        uint128 hardIdx = curveAMOStrategy.hardAssetCoinIndex();
        uint128 otokenIdx = curveAMOStrategy.otokenCoinIndex();
        curveAMOStrategy.curvePool().exchange(int128(hardIdx), int128(otokenIdx), swapAmount, 0);
    }

    /// @dev Tilt pool toward oToken (more OUSD, less USDC)
    function _tiltPoolToOToken(uint256 usdcAmount) internal {
        deal(address(usdc), address(this), usdcAmount);
        usdc.approve(address(ousdVault), usdcAmount);
        ousdVault.mint(address(usdc), usdcAmount, 0);

        uint256 ousdBalance = IERC20(address(ousd)).balanceOf(address(this));
        IERC20(address(ousd)).approve(address(curveAMOStrategy.curvePool()), ousdBalance);
        uint128 hardIdx = curveAMOStrategy.hardAssetCoinIndex();
        uint128 otokenIdx = curveAMOStrategy.otokenCoinIndex();
        curveAMOStrategy.curvePool().exchange(int128(otokenIdx), int128(hardIdx), ousdBalance, 0);
    }

    /// @dev Ensure pool has excess hardAsset by tilting if needed.
    ///      Compares scaled balances (hardAsset scaled to 18 decimals).
    function _ensurePoolExcessHardAsset(uint256 targetExcess) internal {
        uint256[] memory balances = curveAMOStrategy.curvePool().get_balances();
        uint128 hardIdx = curveAMOStrategy.hardAssetCoinIndex();
        uint128 otokenIdx = curveAMOStrategy.otokenCoinIndex();
        // Scale hardAsset (6 dec) to oToken (18 dec) for comparison
        int256 scaledHard = int256(balances[hardIdx] * 1e12);
        int256 diff = scaledHard - int256(balances[otokenIdx]);

        if (diff < int256(targetExcess)) {
            uint256 shortfall = uint256(int256(targetExcess) - diff);
            // Scale back to USDC (6 dec) and use 2x for AMM slippage
            _tiltPoolToHardAsset((shortfall * 2) / 1e12);
        }
    }

    /// @dev Ensure pool has excess oToken by tilting if needed.
    function _ensurePoolExcessOToken(uint256 targetExcess) internal {
        uint256[] memory balances = curveAMOStrategy.curvePool().get_balances();
        uint128 hardIdx = curveAMOStrategy.hardAssetCoinIndex();
        uint128 otokenIdx = curveAMOStrategy.otokenCoinIndex();
        int256 scaledHard = int256(balances[hardIdx] * 1e12);
        int256 diff = int256(balances[otokenIdx]) - scaledHard;

        if (diff < int256(targetExcess)) {
            uint256 shortfall = uint256(int256(targetExcess) - diff);
            // Tilt with USDC (6 dec), need 2x for AMM slippage
            _tiltPoolToOToken((shortfall * 2) / 1e12);
        }
    }

    /// @dev Seed vault with extra USDC to maintain solvency after minting OTokens
    function _seedVaultForSolvency(uint256 amount) internal {
        deal(address(usdc), address(ousdVault), usdc.balanceOf(address(ousdVault)) + amount);
    }
}
