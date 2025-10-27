// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { StableMath } from "../utils/StableMath.sol";
import { OETHVaultCore } from "./OETHVaultCore.sol";

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";

/**
 * @title OETH Plume VaultCore Contract
 * @author Origin Protocol Inc
 */
contract OETHPlumeVaultCore is OETHVaultCore {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    constructor(address _weth) OETHVaultCore(_weth) {}

    // @inheritdoc OETHVaultCore
    function _mint(
        address,
        uint256,
        uint256
    )
        internal
        virtual
        override
    {
        revert("Minting disabled.");
    }

    // @inheritdoc OETHVaultCore
    function _redeem(uint256 _amount, uint256 _minimumUnitAmount)
        internal
        virtual
        override
    {
        // Only Strategist or Governor can redeem using the Vault for now.
        // We don't have the onlyGovernorOrStrategist modifier on VaultCore.
        // Since we won't be using that modifier anywhere in the VaultCore as well,
        // the check has been added inline instead of moving it to VaultStorage.
        require(
            msg.sender == strategistAddr || isGovernor(),
            "Caller is not the Strategist or Governor"
        );

        super._redeem(_amount, _minimumUnitAmount);
    }
}
