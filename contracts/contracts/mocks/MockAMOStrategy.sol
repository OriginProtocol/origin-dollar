// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IVaultBurn {
    function burnForStrategy(uint256 amount) external;
}

interface IOToken {
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title MockAMOStrategy
 * @notice Mock AMO strategy that calls vault.burnForStrategy() in withdrawAll(),
 *         simulating real AMO behavior (CurveAMOStrategy, AerodromeAMOStrategy, etc.)
 */
contract MockAMOStrategy {
    address public vaultAddress;
    address public oTokenAddress;
    address public assetAddress;

    bool public shouldSupportAsset = true;

    function initialize(
        address _vault,
        address _oToken,
        address _asset
    ) external {
        vaultAddress = _vault;
        oTokenAddress = _oToken;
        assetAddress = _asset;
    }

    function deposit(address, uint256) external {}

    function depositAll() external {}

    function withdraw(
        address recipient,
        address asset,
        uint256 amount
    ) external {
        IERC20(asset).transfer(recipient, amount);
    }

    function withdrawAll() external {
        // Simulate AMO: burn any oTokens held by this strategy
        uint256 oTokenBalance = IOToken(oTokenAddress).balanceOf(address(this));
        if (oTokenBalance > 0) {
            IVaultBurn(vaultAddress).burnForStrategy(oTokenBalance);
        }
        // Transfer remaining asset back to vault
        uint256 assetBalance = IERC20(assetAddress).balanceOf(address(this));
        if (assetBalance > 0) {
            IERC20(assetAddress).transfer(vaultAddress, assetBalance);
        }
    }

    function checkBalance(address asset) external view returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }

    function supportsAsset(address) external view returns (bool) {
        return shouldSupportAsset;
    }

    function collectRewardTokens() external {}

    function getRewardTokenAddresses()
        external
        view
        returns (address[] memory)
    {
        return new address[](0);
    }
}
