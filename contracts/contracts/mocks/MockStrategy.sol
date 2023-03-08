// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockStrategy {
    using SafeERC20 for IERC20;

    address public vaultAddress;
    mapping(address => bool) public supportsAsset;
    address[] internal allAssets;

    modifier onlyVault() {
        require(msg.sender == vaultAddress, "Not vault");
        _;
    }

    constructor(address _vaultAddress, address[] memory assets) {
        vaultAddress = _vaultAddress;
        for (uint256 i = 0; i < assets.length; i++) {
            address asset = assets[i];
            supportsAsset[asset] = true;
            allAssets.push(asset);
        }
    }

    function deposit(address _asset, uint256 _amount) public onlyVault {
        // Do nothing
    }

    function depositAll() public onlyVault {
        // Do nothing
    }

    function withdraw(address _asset, uint256 _amount) public onlyVault {
        IERC20(_asset).safeTransfer(vaultAddress, _amount);
    }

    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external onlyVault {
        IERC20(_asset).safeTransfer(_recipient, _amount);
    }

    function checkBalance(address _asset)
        external
        view
        returns (uint256 balance)
    {
        balance = IERC20(_asset).balanceOf(address(this));
    }

    function withdrawAll() public onlyVault {
        for (uint256 i = 0; i < allAssets.length; i++) {
            IERC20 asset = IERC20(allAssets[i]);
            asset.safeTransfer(vaultAddress, asset.balanceOf(address(this)));
        }
    }

    function collectRewardTokens() external {
        // Do nothing
    }

    function getRewardTokenAddresses()
        external
        view
        returns (address[] memory)
    {
        return new address[](0);
    }
}
