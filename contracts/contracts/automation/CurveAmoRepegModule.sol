// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { AbstractSafeModule } from "./AbstractSafeModule.sol";
import { IVault } from "../interfaces/IVault.sol";
import { VaultValueChecker } from "../strategies/VaultValueChecker.sol";
import { ICurveAMOStrategy } from "../interfaces/strategies/ICurveAMOStrategy.sol";

interface ICurveAmoVaultBinding {
    /// @notice Returns the vault authorized to mint and burn for this AMO.
    function vaultAddress() external view returns (address);
}

/// @title Curve AMO Repegging Safe Module
/// @notice Lets an operator remove and burn OTokens through one fixed Safe, vault, AMO and checker.
/// @dev Atomically calls rebase, takeSnapshot, removeAndBurnOTokens and checkDelta through the Safe.
///      LP sizing and checker values are supplied off-chain; no on-chain price target is enforced.
///      Checker values use 18-decimal vault units: USD for OUSD and ETH for OETH-family vaults.
contract CurveAmoRepegModule is AbstractSafeModule, ReentrancyGuard {
    /// @notice Vault rebased before the Safe's checker snapshot.
    address public immutable vault;
    /// @notice Curve AMO whose LP tokens may be removed for an OToken burn.
    address public immutable amo;
    /// @notice Value checker bound to the configured vault and OToken.
    address public immutable checker;
    /// @notice Maximum profit variance in 18-decimal vault units.
    uint256 public immutable maxProfitVariance;
    /// @notice Maximum vault-value-change variance in 18-decimal vault units.
    uint256 public immutable maxVaultChangeVariance;
    /// @notice Next request nonce, incremented only by a successful repeg.
    uint256 public nonce;

    /// @notice Emitted after all four Safe calls succeed.
    /// @param nonce Request nonce consumed by this execution.
    /// @param lpTokens Amount of 18-decimal Curve LP tokens removed.
    /// @param expectedProfit Off-chain expected profit in 18-decimal vault units.
    /// @param profitVariance Allowed deviation from expectedProfit in the same units.
    /// @param expectedVaultChange Off-chain expected vault-value change in the same units.
    /// @param vaultChangeVariance Allowed deviation from expectedVaultChange in the same units.
    event Repegged(
        uint256 indexed nonce,
        uint256 lpTokens,
        int256 expectedProfit,
        int256 profitVariance,
        int256 expectedVaultChange,
        int256 vaultChangeVariance
    );

    /// @notice Binds the module to one AMO and grants the operator permission to repeg.
    /// @dev Validates the strategist Safe, AMO vault, and checker vault/token bindings.
    /// @param _safe Safe that owns the module's admin role and executes its calls.
    /// @param _operator Initial operator; the Safe can grant and revoke operator roles.
    /// @param _vault Vault to rebase and measure.
    /// @param _amo Curve AMO associated with _vault.
    /// @param _checker Value checker associated with _vault and its OToken.
    /// @param _maxProfitVariance Positive profit-variance cap, at most int256.max, in 18-decimal vault units.
    /// @param _maxVaultChangeVariance Positive vault-change-variance cap with the same units and bound.
    constructor(
        address _safe,
        address _operator,
        address _vault,
        address _amo,
        address _checker,
        uint256 _maxProfitVariance,
        uint256 _maxVaultChangeVariance
    ) AbstractSafeModule(_safe) {
        require(_safe.code.length > 0, "Invalid Safe");
        require(_operator != address(0), "Invalid operator");
        require(_vault.code.length > 0, "Invalid vault");
        require(_amo.code.length > 0, "Invalid AMO");
        require(_checker.code.length > 0, "Invalid checker");
        require(IVault(_vault).strategistAddr() == _safe, "Safe mismatch");
        require(IVault(_vault).oToken().code.length > 0, "Invalid OToken");
        require(
            ICurveAmoVaultBinding(_amo).vaultAddress() == _vault,
            "AMO vault mismatch"
        );
        require(
            address(VaultValueChecker(_checker).vault()) == _vault,
            "Checker vault mismatch"
        );
        require(
            address(VaultValueChecker(_checker).ousd()) ==
                IVault(_vault).oToken(),
            "Checker token mismatch"
        );
        require(
            _maxProfitVariance > 0 &&
                _maxProfitVariance <= uint256(type(int256).max),
            "Invalid profit cap"
        );
        require(
            _maxVaultChangeVariance > 0 &&
                _maxVaultChangeVariance <= uint256(type(int256).max),
            "Invalid vault cap"
        );
        vault = _vault;
        amo = _amo;
        checker = _checker;
        maxProfitVariance = _maxProfitVariance;
        maxVaultChangeVariance = _maxVaultChangeVariance;
        _grantRole(OPERATOR_ROLE, _operator);
    }

    /// @notice Executes a permissioned, atomic remove-and-burn using off-chain checker estimates.
    /// @dev Takes the Safe's snapshot after rebasing. Profit is vault-value change minus total-supply
    ///      change; its checked range must be strictly positive. Any failed Safe call rolls back all effects.
    /// @param lpTokens Positive amount of 18-decimal Curve LP tokens to remove.
    /// @param expectedProfit Expected profit in 18-decimal vault units; must exceed profitVariance.
    /// @param profitVariance Nonnegative profit tolerance, at most maxProfitVariance, in the same units.
    /// @param expectedVaultChange Nonpositive expected vault-value change in the same units.
    /// @param vaultChangeVariance Nonnegative vault-change tolerance, at most maxVaultChangeVariance, in the same units.
    /// @param expectedNonce Must equal the module's current nonce.
    /// @param deadline Inclusive expiry timestamp, between execution time and 300 seconds after it.
    function repeg(
        uint256 lpTokens,
        int256 expectedProfit,
        int256 profitVariance,
        int256 expectedVaultChange,
        int256 vaultChangeVariance,
        uint256 expectedNonce,
        uint256 deadline
    ) external onlyOperator nonReentrant {
        require(lpTokens > 0, "Zero LP amount");
        require(
            profitVariance >= 0 && uint256(profitVariance) <= maxProfitVariance,
            "Invalid profit variance"
        );
        require(
            vaultChangeVariance >= 0 &&
                uint256(vaultChangeVariance) <= maxVaultChangeVariance,
            "Invalid vault variance"
        );
        require(expectedProfit > profitVariance, "Profit required");
        require(expectedVaultChange <= 0, "Positive vault change");
        require(expectedNonce == nonce, "Invalid nonce");
        require(
            deadline >= block.timestamp &&
                deadline - block.timestamp <= 5 minutes,
            "Invalid deadline"
        );
        nonce = expectedNonce + 1;

        _exec(vault, abi.encodeWithSelector(IVault.rebase.selector));
        _exec(
            checker,
            abi.encodeWithSelector(VaultValueChecker.takeSnapshot.selector)
        );
        _exec(
            amo,
            abi.encodeWithSelector(
                ICurveAMOStrategy.removeAndBurnOTokens.selector,
                lpTokens
            )
        );
        _exec(
            checker,
            abi.encodeWithSelector(
                VaultValueChecker.checkDelta.selector,
                expectedProfit,
                profitVariance,
                expectedVaultChange,
                vaultChangeVariance
            )
        );
        emit Repegged(
            expectedNonce,
            lpTokens,
            expectedProfit,
            profitVariance,
            expectedVaultChange,
            vaultChangeVariance
        );
    }
}
