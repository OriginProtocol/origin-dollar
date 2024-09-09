// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Governable } from "../governance/Governable.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IVault } from "../interfaces/IVault.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";

contract OETHBaseHarvester is Governable {
    using SafeERC20 for IERC20;

    IVault public immutable vault;
    IStrategy public immutable amoStrategy;
    IERC20 public immutable aero;

    constructor(
        address _vault,
        address _amoStrategy,
        address _aero
    ) {
        vault = IVault(_vault);
        amoStrategy = IStrategy(_amoStrategy);
        aero = IERC20(_aero);
    }

    function harvest() public {
        // Collect all AERO
        amoStrategy.collectRewardTokens();

        uint256 aeroBalance = aero.balanceOf(address(this));
        if (aeroBalance == 0) {
            // Do nothing if there's no AERO to transfer
            return;
        }

        // Transfer everything to Strategist
        aero.safeTransfer(vault.strategistAddr(), aeroBalance);
    }

    /**
     * @notice Transfer token to governor. Intended for recovering tokens stuck in
     *      the contract, i.e. mistaken sends.
     *      Also, allows to transfer any AERO left in the contract.
     * @param _asset Address for the asset
     * @param _amount Amount of the asset to transfer
     */
    function transferToken(address _asset, uint256 _amount)
        external
        virtual
        onlyGovernor
    {
        IERC20(_asset).safeTransfer(governor(), _amount);
    }
}
