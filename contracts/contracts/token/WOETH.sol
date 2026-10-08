// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { ERC4626 } from "../../lib/openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { Governable } from "../governance/Governable.sol";
import { Initializable } from "../utils/Initializable.sol";
import { OETH } from "./OETH.sol";

/**
 * @title Wrapped OETH Token Contract
 * @author Origin Protocol Inc
 *
 * @dev An important capability of this contract is that it isn't susceptible to changes of the
 * exchange rate of WOETH/OETH if/when someone sends the underlying asset (OETH) to the contract.
 * If OETH weren't rebasing this could be achieved by solely tracking the ERC20 transfers of the OETH
 * token on mint, deposit, redeem, withdraw. The issue is that OETH is rebasing and OETH balances
 * will change when the token rebases.
 * For that reason the contract logic checks the actual underlying OETH token balance only once
 * (either on a fresh contract creation or upgrade) and considering the WOETH supply and
 * rebasingCreditsPerToken calculates the _adjuster. Once the adjuster is calculated any donations
 * to the contract are ignored. The totalSupply (instead of querying OETH balance) works off of
 * adjuster the current WOETH supply and rebasingCreditsPerToken. This makes WOETH value accrual
 * completely follow OETH's value accrual.
 * WOETH is safe to use in lending markets as the VualtCore's _rebase contains safeguards preventing
 * any sudden large rebases.
 */

contract WOETH is ERC4626, Governable, Initializable {
    using SafeERC20 for IERC20;
    /* This is a 1e27 adjustment constant that expresses the difference in exchange rate between
     * OETH's rebase since inception (expressed with rebasingCreditsPerToken) and WOETH to OETH
     * conversion.
     *
     * If WOETH and OETH are deployed at the same time, the value of adjuster is a neutral 1e27
     */
    uint256 public adjuster;
    uint256[49] private __gap;

    // no need to set ERC20 name and symbol since they are overridden in WOETH & WOETHBase
    constructor(ERC20 underlying_) ERC20("", "") ERC4626(underlying_) {}

    /**
     * @notice Enable OETH rebasing for this contract
     */
    function initialize() external onlyGovernor initializer {
        OETH(address(asset())).rebaseOptIn();

        initialize2();
    }

    /**
     * @notice secondary initializer that newly deployed contracts will execute as part
     *         of primary initialize function and the existing contracts will have it called
     *         as a governance operation.
     */
    function initialize2() public onlyGovernor {
        require(adjuster == 0, "Initialize2 already called");

        if (totalSupply() == 0) {
            adjuster = 1e27;
        } else {
            adjuster =
                (rebasingCreditsPerTokenHighres() *
                    ERC20(asset()).balanceOf(address(this))) /
                totalSupply();
        }
    }

    function name()
        public
        view
        virtual
        override(ERC20, IERC20Metadata)
        returns (string memory)
    {
        return "Wrapped OETH";
    }

    function symbol()
        public
        view
        virtual
        override(ERC20, IERC20Metadata)
        returns (string memory)
    {
        return "wOETH";
    }

    /**
     * @notice Transfer token to governor. Intended for recovering tokens stuck in
     *      contract, i.e. mistaken sends. Cannot transfer OETH
     * @param asset_ Address for the asset
     * @param amount_ Amount of the asset to transfer
     */
    function transferToken(address asset_, uint256 amount_)
        external
        onlyGovernor
    {
        require(asset_ != address(asset()), "Cannot collect core asset");
        IERC20(asset_).safeTransfer(governor(), amount_);
    }

    /// @inheritdoc ERC4626
    function convertToShares(uint256 assets)
        public
        view
        virtual
        override
        returns (uint256 shares)
    {
        return (assets * rebasingCreditsPerTokenHighres()) / adjuster;
    }

    /// @inheritdoc ERC4626
    function convertToAssets(uint256 shares)
        public
        view
        virtual
        override
        returns (uint256 assets)
    {
        return (shares * adjuster) / rebasingCreditsPerTokenHighres();
    }

    /// @inheritdoc ERC4626
    function totalAssets() public view override returns (uint256) {
        return (totalSupply() * adjuster) / rebasingCreditsPerTokenHighres();
    }

    function rebasingCreditsPerTokenHighres() internal view returns (uint256) {
        return OETH(asset()).rebasingCreditsPerTokenHighres();
    }
}
