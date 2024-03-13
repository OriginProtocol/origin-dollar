// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockStrategy {
    address[] public assets;

    constructor() {}

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
        require(false, "Not implemented");
    }

    function checkBalance(address asset)
        external
        view
        returns (uint256 balance)
    {
        balance = IERC20(asset).balanceOf(address(this));
    }

    function supportsAsset(address) external view returns (bool) {
        return true;
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
