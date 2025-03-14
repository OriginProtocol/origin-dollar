// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ERC4626 } from "../../lib/openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { Governable } from "../governance/Governable.sol";
import { Initializable } from "../utils/Initializable.sol";
import { OETH } from "./OETH.sol";
import { IVault } from "../interfaces/IVault.sol";

/**
 * @title Wapped Token Contract
 * @author Origin Protocol
 *
 * @dev An ERC4626 contract that wraps a rebasing token
 *     and allows it to be treated as a non-rebasing value accrual token.
 *     This contract distributes yield slowly over 23 hours which prevents
 *     donation attacks against lending platforms.
 *     It is designed to work only with up-only rebasing tokens.
 *     The asset token must not make reenterable external calls on transfers.
 */

contract WOETH is ERC4626, Governable, Initializable {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    uint256 public trackedAssets;
    uint128 public yieldAssets;
    uint64 public yieldEnd;
    bool private _initialized2;
    uint256[48] private __gap;

    IVault public immutable vault;
    uint256 public constant YIELD_TIME = 1 days - 1 hours;

    event YiedPeriodStarted(
        uint256 trackedAssets,
        uint256 yieldAssets,
        uint256 yieldEnd
    );

    // no need to set ERC20 name and symbol since they are overridden in WOETH & WOETHBase
    constructor(address underlying_, address vault_)
        ERC20("", "")
        ERC4626(IERC20Metadata(underlying_))
        Governable()
    {
        vault = IVault(vault_);
    }

    /**
     * @notice Enable OETH rebasing for this contract
     */
    function initialize() external onlyGovernor initializer {
        OETH(address(asset())).rebaseOptIn();

        initialize2();
    }

    /**
     * @notice Upgrade contract to support yield periods.
     *     Called automatically on new contracts via initialize()
     */
    function initialize2() public onlyGovernor {
        require(!_initialized2, "Initialize2 already called");
        _initialized2 = true;

        trackedAssets = IERC20(asset()).balanceOf(address(this));
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
     *      contract, i.e. mistaken sends. Cannot transfer the core asset
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

    /* @notice Start the next yield period, if one is not active.
     *     New yield will not start until time has moved forward.
     */
    function scheduleYield() public {
        // If we are currently in a yield period, do not alter rate
        if (block.timestamp < yieldEnd) {
            return;
        }

        // Read current assets
        uint256 _computedAssets = totalAssets();
        uint256 _actualAssets = IERC20(asset()).balanceOf(address(this));

        // Compute next yield period values
        if (_actualAssets <= _computedAssets) {
            yieldAssets = 0;
            trackedAssets = _actualAssets;
        } else if (_actualAssets > _computedAssets) {
            uint256 _newYield = _actualAssets - _computedAssets;
            uint256 _maxYield = (_computedAssets * 5) / 100; // Maximum of 5% increase in assets per day
            _newYield = _min(_min(_newYield, _maxYield), type(uint128).max);
            yieldAssets = _newYield.toUint128();
            trackedAssets = _computedAssets + yieldAssets;
        }
        // raw cast is deliberate, since this will not perma revert
        yieldEnd = uint64(block.timestamp + YIELD_TIME);
        emit YiedPeriodStarted(trackedAssets, yieldAssets, yieldEnd);
    }

    /**
     * @notice Returns the assets currently backing the total supply.
     *    Does not include future yield held that will stream per block.
     * @return totalAssets()
     */
    function totalAssets() public view override returns (uint256) {
        uint256 _end = yieldEnd;
        if (block.timestamp >= _end) {
            return trackedAssets;
        } else if (block.timestamp <= _end - YIELD_TIME) {
            return trackedAssets - yieldAssets;
        }
        uint256 elapsed = (block.timestamp + YIELD_TIME) - _end;
        uint256 _unlockedYield = (yieldAssets * elapsed) / YIELD_TIME;
        return trackedAssets + _unlockedYield - yieldAssets;
    }

    function deposit(uint256 oethAmount, address receiver)
        public
        override
        returns (uint256 woethAmount)
    {
        woethAmount = super.deposit(oethAmount, receiver);
        trackedAssets += oethAmount;
        vault.rebase();
        scheduleYield();
    }

    function mint(uint256 woethAmount, address receiver)
        public
        override
        returns (uint256 oethAmount)
    {
        oethAmount = super.mint(woethAmount, receiver);
        trackedAssets += oethAmount;
        vault.rebase();
        scheduleYield();
    }

    function withdraw(
        uint256 oethAmount,
        address receiver,
        address owner
    ) public override returns (uint256 woethAmount) {
        vault.rebase();
        woethAmount = super.withdraw(oethAmount, receiver, owner);
        trackedAssets -= oethAmount;
        scheduleYield();
    }

    function redeem(
        uint256 woethAmount,
        address receiver,
        address owner
    ) public override returns (uint256 oethAmount) {
        vault.rebase();
        oethAmount = super.redeem(woethAmount, receiver, owner);
        trackedAssets -= oethAmount;
        scheduleYield();
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal override {
        super._transfer(sender, recipient, amount);
        scheduleYield();
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
