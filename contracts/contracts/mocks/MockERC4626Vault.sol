// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC4626 } from "../../lib/openzeppelin/interfaces/IERC4626.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockERC4626Vault is IERC4626, ERC20 {
    using SafeERC20 for IERC20;

    address public asset;
    uint8 public constant DECIMALS = 18;

    constructor(address _asset) ERC20("Mock Vault Share", "MVS") {
        asset = _asset;
    }

    // ERC20 totalSupply is inherited

    // ERC20 balanceOf is inherited

    function deposit(uint256 assets, address receiver) public override returns (uint256 shares) {
        shares = previewDeposit(assets);
        IERC20(asset).safeTransferFrom(msg.sender, address(this), assets);
        _mint(receiver, shares);
        return shares;
    }

    function mint(uint256 shares, address receiver) public override returns (uint256 assets) {
        assets = previewMint(shares);
        IERC20(asset).safeTransferFrom(msg.sender, address(this), assets);
        _mint(receiver, shares);
        return assets;
    }

    function withdraw(uint256 assets, address receiver, address owner) public override returns (uint256 shares) {
        shares = previewWithdraw(assets);
        if (msg.sender != owner) {
            // No approval check for mock
        }
        _burn(owner, shares);
        IERC20(asset).safeTransfer(receiver, assets);
        return shares;
    }

    function redeem(uint256 shares, address receiver, address owner) public override returns (uint256 assets) {
        assets = previewRedeem(shares);
        if (msg.sender != owner) {
            // No approval check for mock
        }
        _burn(owner, shares);
        IERC20(asset).safeTransfer(receiver, assets);
        return assets;
    }

    function totalAssets() public view override returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }

    function convertToShares(uint256 assets) public view override returns (uint256 shares) {
        uint256 supply = totalSupply(); // Use ERC20 totalSupply
        return supply == 0 || assets == 0 ? assets : (assets * supply) / totalAssets();
    }

    function convertToAssets(uint256 shares) public view override returns (uint256 assets) {
        uint256 supply = totalSupply(); // Use ERC20 totalSupply
        return supply == 0 ? shares : (shares * totalAssets()) / supply;
    }

    function maxDeposit(address receiver) public view override returns (uint256) {
        return type(uint256).max;
    }

    function maxMint(address receiver) public view override returns (uint256) {
        return type(uint256).max;
    }

    function maxWithdraw(address owner) public view override returns (uint256) {
        return convertToAssets(balanceOf(owner));
    }

    function maxRedeem(address owner) public view override returns (uint256) {
        return balanceOf(owner);
    }

    function previewDeposit(uint256 assets) public view override returns (uint256 shares) {
        return convertToShares(assets);
    }

    function previewMint(uint256 shares) public view override returns (uint256 assets) {
        return convertToAssets(shares);
    }

    function previewWithdraw(uint256 assets) public view override returns (uint256 shares) {
        return convertToShares(assets);
    }

    function previewRedeem(uint256 shares) public view override returns (uint256 assets) {
        return convertToAssets(shares);
    }

    function _mint(address account, uint256 amount) internal override {
        super._mint(account, amount);
    }

    function _burn(address account, uint256 amount) internal override {
        super._burn(account, amount);
    }

    // Inherited from ERC20
}

