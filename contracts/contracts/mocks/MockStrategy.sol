// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockStrategy {
    address[] public assets;

    address public withdrawAllAsset;
    address public withdrawAllRecipient;

    bool public shouldSupportAsset;

    constructor() {
        shouldSupportAsset = true;
    }

    function deposit(address asset, uint256 amount) external {}

    function depositAll() external {}

    function withdraw(
        address recipient,
        address asset,
        uint256 amount
    ) external {
        IERC20(asset).transfer(recipient, amount);
    }

    function withdrawAll() external {
        IERC20(withdrawAllAsset).transfer(
            withdrawAllRecipient,
            IERC20(withdrawAllAsset).balanceOf(address(this))
        );
    }

    function checkBalance(address asset)
        external
        view
        returns (uint256 balance)
    {
        balance = IERC20(asset).balanceOf(address(this));
    }

    function supportsAsset(address) external view returns (bool) {
        return shouldSupportAsset;
    }

    function setShouldSupportAsset(bool _shouldSupportAsset) external {
        shouldSupportAsset = _shouldSupportAsset;
    }

    function collectRewardTokens() external {}

    function getRewardTokenAddresses()
        external
        view
        returns (address[] memory)
    {
        return new address[](0);
    }

    function setWithdrawAll(address asset, address recipient) external {
        withdrawAllAsset = asset;
        withdrawAllRecipient = recipient;
    }
}
