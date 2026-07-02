// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

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
 * @notice TEST-ONLY minimal vault that exposes `mintForStrategy` / `burnForStrategy` to
 *         whitelisted strategies for the V3 strategy unit tests. Skips all the real Vault
 *         surface area (assets registry, allocate, redeem queue, rebase, etc.).
 */
contract MockOTokenVault {
    MockMintableBurnableOToken public oToken;
    mapping(address => bool) public isMintWhitelistedStrategy;
    address public strategistAddr;

    event StrategyWhitelisted(address strategy);

    function setOToken(MockMintableBurnableOToken _oToken) external {
        oToken = _oToken;
    }

    function setStrategistAddr(address _strategist) external {
        strategistAddr = _strategist;
    }

    /// @notice TEST-ONLY: mint OToken to an arbitrary holder, mirroring a real user deposit
    ///         (the vault minting OToken against collateral). Lets a test give a user OToken
    ///         that did NOT come from a bridge-in, so a BRIDGE_OUT can drive `bridgeAdjustment`
    ///         negative.
    function mintOTokenTo(address _to, uint256 _amount) external {
        oToken.mint(_to, _amount);
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
