// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ERC4626 } from "../../lib/openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { StableMath } from "../utils/StableMath.sol";
import { Governable } from "../governance/Governable.sol";
import { Initializable } from "../utils/Initializable.sol";
import { OETH } from "./OETH.sol";

/**
 * @title OETH Token Contract
 * @author Origin Protocol Inc
 *
 * @dev An important capability of this contract is that it isn't susceptible to changes of the
 * exchange rate of WOETH/OETH if/when someone sends the underlying asset (OETH) to the contract.
 * If OETH weren't rebasing this could be achieved by solely tracking the ERC20 transfers of the OETH
 * token on mint, deposit, redeem, withdraw. The issue is that OETH is rebasing and OETH balances
 * will change when the token rebases. For that reason we are tracking the WOETH contract credits and
 * credits per token in those 4 actions. That way WOETH can keep an accurate track of the OETH balance
 * ignoring any unexpected transfers of OETH to this contract.
 */

contract WOETH is ERC4626, Governable, Initializable {
    using SafeERC20 for IERC20;
    using StableMath for uint256;
    uint256 public oethCreditsHighres;
    bool private _oethCreditsInitialized;
    uint256[48] private __gap;

    // no need to set ERC20 name and symbol since they are overridden in WOETH & WOETHBase
    constructor(
        ERC20 underlying_
    ) ERC20("", "") ERC4626(underlying_) Governable() {}

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
        require(!_oethCreditsInitialized, "Initialize2 already called");

        _oethCreditsInitialized = true;
        /*
         * This contract is using creditsBalanceOfHighres rather than creditsBalanceOf since this
         * ensures better accuracy when rounding. Also creditsBalanceOf can be a little
         * finicky since it reports Highres version of credits and creditsPerToken
         * when the account is a fresh one. That doesn't have an effect on mainnet since
         * WOETH has already seen transactions. But it is rather annoying in unit test
         * environment.
         */
        (oethCreditsHighres, , ) = OETH(asset()).creditsBalanceOfHighres(
            address(this)
        );
    }


    function name()
        public
        view
        virtual
        override(ERC20,IERC20Metadata)
        returns (string memory)
    {
        return "Wrapped OETH";
    }

    function symbol()
        public
        view
        virtual
        override(ERC20,IERC20Metadata)
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
        //@dev TODO: we could implement a feature where if anyone sends OETH directly to
        // the contract, that we can let the governor transfer the excess of the token.
        require(asset_ != address(asset()), "Cannot collect OETH");
        IERC20(asset_).safeTransfer(governor(), amount_);
    }

    /** @dev See {IERC4262-totalAssets} */
    function totalAssets() public view override returns (uint256) {
        uint256 creditsPerTokenHighres = OETH(asset())
            .rebasingCreditsPerTokenHighres();

        return (oethCreditsHighres).divPrecisely(creditsPerTokenHighres);
    }

    function getOETHCredits() internal view returns (uint256 oethCreditsHighres) {
        (oethCreditsHighres, , ) = OETH(asset()).creditsBalanceOfHighres(
            address(this)
        );
    }

    /** @dev See {IERC4262-deposit} */
    function deposit(uint256 oethAmount, address receiver)
        public
        override
        returns (uint256 woethAmount)
    {   
        uint256 creditsBefore = getOETHCredits();
        woethAmount = super.deposit(oethAmount, receiver);
        oethCreditsHighres += getOETHCredits() - creditsBefore;
    }

    /** @dev See {IERC4262-mint} */
    function mint(uint256 woethAmount, address receiver)
        public
        override
        returns (uint256 oethAmount)
    {   
        uint256 creditsBefore = getOETHCredits();
        oethAmount = super.mint(woethAmount, receiver);
        oethCreditsHighres += getOETHCredits() - creditsBefore;
    }

    /** @dev See {IERC4262-withdraw} */
    function withdraw(
        uint256 oethAmount,
        address receiver,
        address owner
    ) public override returns (uint256 woethAmount) {
        uint256 creditsBefore = getOETHCredits();
        woethAmount = super.withdraw(oethAmount, receiver, owner);
        oethCreditsHighres -= creditsBefore - getOETHCredits();
    }

    /** @dev See {IERC4262-redeem} */
    function redeem(
        uint256 woethAmount,
        address receiver,
        address owner
    ) public override returns (uint256 oethAmount) {
        uint256 creditsBefore = getOETHCredits();
        oethAmount = super.redeem(woethAmount, receiver, owner);
        oethCreditsHighres -= creditsBefore - getOETHCredits();
    }
}
