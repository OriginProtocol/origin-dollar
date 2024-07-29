// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StableMath } from "../utils/StableMath.sol";
import { OETHVaultCore } from "./OETHVaultCore.sol";

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";

/**
 * @title OETH Base VaultCore Contract
 * @author Origin Protocol Inc
 */
contract OETHBaseVaultCore is OETHVaultCore {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    constructor(address _weth) OETHVaultCore(_weth) {}

    function _mintToForStrategy(address receiver, uint256 amount)
        internal
        whenNotCapitalPaused
    {
        require(
            strategies[msg.sender].isSupported == true,
            "Unsupported strategy"
        );
        require(
            mintWhitelistedStrategy[msg.sender] == true,
            "Not whitelisted strategy"
        );

        require(amount < MAX_INT, "Amount too high");

        emit Mint(receiver, amount);

        // Mint matching amount of OTokens
        oUSD.mint(receiver, amount);
    }

    // @inheritdoc VaultCore
    function mintForStrategy(uint256 amount) external override {
        _mintToForStrategy(msg.sender, amount);
    }

    // Same as mintForStrategy(uint256) but transfers
    // minted tokens to a different address
    function mintToForStrategy(address receiver, uint256 amount) external {
        _mintToForStrategy(receiver, amount);
    }

    function _burnFromForStrategy(address receiver, uint256 amount)
        internal
        whenNotCapitalPaused
    {
        require(
            strategies[msg.sender].isSupported == true,
            "Unsupported strategy"
        );
        require(
            mintWhitelistedStrategy[msg.sender] == true,
            "Not whitelisted strategy"
        );

        require(amount < MAX_INT, "Amount too high");

        emit Redeem(receiver, amount);

        // Burn OTokens
        oUSD.burn(receiver, amount);
    }

    function burnFromForStrategy(address user, uint256 amount) external {
        _burnFromForStrategy(user, amount);
    }

    // @inheritdoc VaultCore
    function burnForStrategy(uint256 amount) external override {
        _burnFromForStrategy(msg.sender, amount);
    }
}
