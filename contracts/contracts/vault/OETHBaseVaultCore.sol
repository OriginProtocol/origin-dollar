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

    function _mintForStrategy(address receiver, uint256 amount)
        internal
        whenNotCapitalPaused
    {
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
        _mintForStrategy(msg.sender, amount);
    }

    // Same as mintForStrategy(uint256) but transfers
    // minted tokens to a different address
    function mintForStrategyAndTransfer(address receiver, uint256 amount)
        external
    {
        _mintForStrategy(receiver, amount);
    }

    // @inheritdoc VaultCore
    function burnForStrategy(uint256 amount)
        external
        override
        whenNotCapitalPaused
    {
        require(
            mintWhitelistedStrategy[msg.sender] == true,
            "Not whitelisted strategy"
        );

        require(amount < MAX_INT, "Amount too high");

        emit Redeem(msg.sender, amount);

        // Burn OTokens
        oUSD.burn(msg.sender, amount);
    }
}
