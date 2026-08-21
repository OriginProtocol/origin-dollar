// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IStrategyForMock {
    function deposit(address asset, uint256 amount) external;

    function depositAll() external;

    function withdraw(
        address recipient,
        address asset,
        uint256 amount
    ) external;

    function withdrawAll() external;
}

/**
 * @title MockOTokenVault
 * @notice TEST-ONLY vault stand-in for the Master side of the V3 strategy unit tests.
 *         Master holds bridgeAsset and accounting only — it never mints, burns or holds
 *         the OToken — so this mock carries no OToken surface. It does two jobs:
 *
 *           - Serves as the strategy's `vaultAddress`, so `onlyVault` and the
 *             `IVault(vaultAddress).strategistAddr()` lookup in the shared modifiers resolve.
 *           - Drives the `onlyVault`-gated entry points via the `call*` helpers below, which
 *             avoids impersonating the vault through hardhat helpers (that trips up ethers v5
 *             arg-parsing when the impersonated signer is involved).
 *
 *         Skips all the real Vault surface area (assets registry, allocate, redeem queue,
 *         rebase, etc.).
 */
contract MockOTokenVault {
    address public strategistAddr;

    function setStrategistAddr(address _strategist) external {
        strategistAddr = _strategist;
    }

    // --- Test driver helpers -------------------------------------------------

    function callDeposit(
        address _strategy,
        address _asset,
        uint256 _amount
    ) external {
        IStrategyForMock(_strategy).deposit(_asset, _amount);
    }

    function callDepositAll(address _strategy) external {
        IStrategyForMock(_strategy).depositAll();
    }

    function callWithdraw(
        address _strategy,
        address _recipient,
        address _asset,
        uint256 _amount
    ) external {
        IStrategyForMock(_strategy).withdraw(_recipient, _asset, _amount);
    }

    function callWithdrawAll(address _strategy) external {
        IStrategyForMock(_strategy).withdrawAll();
    }
}
