// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { MockMintableBurnableOToken } from "./MockMintableBurnableOToken.sol";

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
 * @notice TEST-ONLY minimal vault that mirrors the production VaultCore user surface
 *         (`mint`/`redeem` against a bridge asset 1:1) plus the strategy surface
 *         (`mintForStrategy` / `burnForStrategy`) used by the V3 strategy.
 *
 *         Skips the rest of the real Vault surface area (assets registry, allocate,
 *         redeem queue, rebase, etc.). Mock OToken is plain ERC-20 — no rebasing on
 *         testnet; observe yield via mock wOETH share rate or `remoteStrategyBalance`.
 */
contract MockOTokenVault {
    using SafeERC20 for IERC20;

    MockMintableBurnableOToken public oToken;
    address public bridgeAsset;
    mapping(address => bool) public isMintWhitelistedStrategy;
    address public strategistAddr;

    event StrategyWhitelisted(address strategy);

    function setOToken(MockMintableBurnableOToken _oToken) external {
        oToken = _oToken;
    }

    function setBridgeAsset(address _bridgeAsset) external {
        bridgeAsset = _bridgeAsset;
    }

    function setStrategistAddr(address _strategist) external {
        strategistAddr = _strategist;
    }

    // --- Production-mirror user surface ------------------------------------
    // `mint(amount)` pulls bridgeAsset from caller, mints OToken to caller 1:1.
    // `redeem(amount, minAmount)` burns caller's OToken, returns bridgeAsset 1:1.
    // Mirrors MockEthOTokenVault on Sepolia and the production VaultCore.mint flow.

    function mint(uint256 _amount) external {
        require(bridgeAsset != address(0), "MockVault: bridge asset not set");
        IERC20(bridgeAsset).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
        oToken.mint(msg.sender, _amount);
    }

    function redeem(uint256 _amount, uint256 _minAmount) external {
        require(bridgeAsset != address(0), "MockVault: bridge asset not set");
        require(_amount >= _minAmount, "MockVault: below min");
        oToken.burn(msg.sender, _amount);
        IERC20(bridgeAsset).safeTransfer(msg.sender, _amount);
    }

    function whitelistStrategy(address _strategy) external {
        isMintWhitelistedStrategy[_strategy] = true;
        emit StrategyWhitelisted(_strategy);
    }

    function mintForStrategy(uint256 _amount) external {
        require(
            isMintWhitelistedStrategy[msg.sender],
            "MockVault: not whitelisted"
        );
        oToken.mint(msg.sender, _amount);
    }

    function burnForStrategy(uint256 _amount) external {
        require(
            isMintWhitelistedStrategy[msg.sender],
            "MockVault: not whitelisted"
        );
        oToken.burn(msg.sender, _amount);
    }

    // --- Test driver helpers -------------------------------------------------
    // These let tests drive `onlyVault`-gated strategy entry points without
    // having to impersonate the vault via hardhat helpers (which trips up
    // ethers v5 arg-parsing when the impersonated signer is involved).

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
