// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IStrategy } from "./../interfaces/IStrategy.sol";
import "hardhat/console.sol";

interface IERC20MintableBurnable {
    function mintTo(address to, uint256 value) external;

    function burnFrom(address account, uint256 value) external;

    function transfer(address account, uint256 value) external;

    function balanceOf(address) external view returns (uint256);
}

contract MockVaultForBase {
    address public immutable strategistAddr;
    address public immutable oTokenAddr;
    address public immutable wethAddr;
    uint256 public constant ETH_PRICE = 3000 ether;
    int256 public netOusdMintedForStrategy;

    constructor(
        address _strategistAddr,
        address _oTokenAddr,
        address _wethAddr
    ) {
        strategistAddr = _strategistAddr;
        oTokenAddr = _oTokenAddr;
        wethAddr = _wethAddr;
    }

    function mintForStrategy(uint256 _amount) external {
        netOusdMintedForStrategy += int256(_amount);
        IERC20MintableBurnable(oTokenAddr).mintTo(msg.sender, _amount);
    }

    function burnForStrategy(uint256 _amount) external {
        netOusdMintedForStrategy -= int256(_amount);

        IERC20MintableBurnable(oTokenAddr).burnFrom(msg.sender, _amount);
    }

    function totalValue() external view returns (uint256) {
        uint256 sumAssets = IERC20MintableBurnable(oTokenAddr).balanceOf(
            address(this)
        ) + IERC20MintableBurnable(wethAddr).balanceOf(address(this));

        return (sumAssets * ETH_PRICE) / 1e18;
    }

    function depositToStrategy(
        address _strategyToAddress,
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) external {
        require(_assets.length == _amounts.length, "Parameter length mismatch");

        uint256 assetCount = _assets.length;
        for (uint256 i = 0; i < assetCount; ++i) {
            address assetAddr = _assets[i];
            require(
                IStrategy(_strategyToAddress).supportsAsset(assetAddr),
                "Asset unsupported"
            );
            // Send required amount of funds to the strategy
            IERC20MintableBurnable(assetAddr).transfer(
                _strategyToAddress,
                _amounts[i]
            );
        }

        // Deposit all the funds that have been sent to the strategy
        IStrategy(_strategyToAddress).depositAll();
    }
}
