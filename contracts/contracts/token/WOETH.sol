// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ERC4626 } from "../../lib/openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { StableMath } from "../utils/StableMath.sol";
import { Governable } from "../governance/Governable.sol";
import { Initializable } from "../utils/Initializable.sol";
import { OETH } from "./OETH.sol";

/**
 * @title OETH Token Contract
 * @author Origin Protocol Inc
 */

contract WOETH is ERC4626, Governable, Initializable {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    uint256 oethCredits;
    bool oethCreditsInitialized;

    constructor(
        ERC20 underlying_,
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) ERC4626(underlying_) Governable() {}

    /**
     * @notice Enable OETH rebasing for this contract
     */
    function initialize() external onlyGovernor initializer {
        OETH(address(asset())).rebaseOptIn();
    }

    function initialize2() external onlyGovernor {
        if (!oethCreditsInitialized) {
            oethCreditsInitialized = true;
            (oethCredits, ) = OETH(asset()).creditsBalanceOf(address(this));
        }
    }

    function name() public view override returns (string memory) {
        return "Wrapped OETH";
    }

    function symbol() public view override returns (string memory) {
        return "WOETH";
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
        require(asset_ != address(asset()), "Cannot collect OETH");
        IERC20(asset_).safeTransfer(governor(), amount_);
    }

    function _oethToOethCredits(uint256 oethAmount) internal returns(uint256){
        (,uint256 creditsPerToken) = OETH(asset()).creditsBalanceOf(address(this));
        return oethAmount.mulTruncate(creditsPerToken);   
    }

    /** @dev See {IERC4262-deposit} */
    function deposit(uint256 assets, address receiver) public virtual override returns (uint256) {
        require(assets <= maxDeposit(receiver), "ERC4626: deposit more then max");

        address caller = _msgSender();
        uint256 shares = previewDeposit(assets);

        // if _asset is ERC777, transferFrom can call reenter BEFORE the transfer happens through
        // the tokensToSend hook, so we need to transfer before we mint to keep the invariants.
        SafeERC20.safeTransferFrom(IERC20(asset()), caller, address(this), assets);
        _mint(receiver, shares);
        oethCredits += _oethToOethCredits(assets);

        emit Deposit(caller, receiver, assets, shares);

        return shares;
    }

    /** @dev See {IERC4262-mint} */
    function mint(uint256 shares, address receiver) public virtual override returns (uint256) {
        require(shares <= maxMint(receiver), "ERC4626: mint more then max");

        address caller = _msgSender();
        uint256 assets = previewMint(shares);

        // if _asset is ERC777, transferFrom can call reenter BEFORE the transfer happens through
        // the tokensToSend hook, so we need to transfer before we mint to keep the invariants.
        SafeERC20.safeTransferFrom(IERC20(asset()), caller, address(this), assets);
        _mint(receiver, shares);
        oethCredits += _oethToOethCredits(assets);

        emit Deposit(caller, receiver, assets, shares);

        return assets;
    }

    /** @dev See {IERC4262-withdraw} */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public virtual override returns (uint256) {
        require(assets <= maxWithdraw(owner), "ERC4626: withdraw more then max");

        address caller = _msgSender();
        uint256 shares = previewWithdraw(assets);

        if (caller != owner) {
            _spendAllowance(owner, caller, shares);
        }

        // if _asset is ERC777, transfer can call reenter AFTER the transfer happens through
        // the tokensReceived hook, so we need to transfer after we burn to keep the invariants.
        _burn(owner, shares);
        SafeERC20.safeTransfer(IERC20(asset()), receiver, assets);
        oethCredits -= _oethToOethCredits(assets);

        emit Withdraw(caller, receiver, owner, assets, shares);

        return shares;
    }

    /** @dev See {IERC4262-redeem} */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public virtual override returns (uint256) {
        require(shares <= maxRedeem(owner), "ERC4626: redeem more then max");

        address caller = _msgSender();
        uint256 assets = previewRedeem(shares);

        if (caller != owner) {
            _spendAllowance(owner, caller, shares);
        }

        // if _asset is ERC777, transfer can call reenter AFTER the transfer happens through
        // the tokensReceived hook, so we need to transfer after we burn to keep the invariants.
        _burn(owner, shares);
        SafeERC20.safeTransfer(IERC20(asset()), receiver, assets);
        oethCredits -= _oethToOethCredits(assets);

        emit Withdraw(caller, receiver, owner, assets, shares);

        return assets;
    }

        /** @dev See {IERC4262-totalAssets} */
    function totalAssets() public view virtual override returns (uint256) {
        (,uint256 creditsPerToken) = OETH(asset()).creditsBalanceOf(address(this));

        return oethCredits.divPrecisely(creditsPerToken);
    }
}
