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
    using SafeCast for uint256;
    using SafeCast for uint128;
    using SafeCast for int256;

    int256 public hardAssets;
    uint128 public yieldAssets;
    uint128 public yieldEnd;
    bool private _oethCreditsInitialized;
    uint256[47] private __gap;

    uint256 public constant YIELD_TIME = 1 days - 1 hours;

    event YiedPeriodStarted(
        int256 hardAssets,
        uint256 yieldAssets,
        uint256 yieldEnd
    );

    // no need to set ERC20 name and symbol since they are overridden in WOETH & WOETHBase
    constructor(ERC20 underlying_)
        ERC20("", "")
        ERC4626(underlying_)
        Governable()
    {}

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
        hardAssets = IERC20(asset()).balanceOf(address(this)).toInt256();
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

    // @notice Called to start a yield period, if one is not active
    function startYield() public {
        // If we are currently distributing yield, continue until done
        if (block.timestamp < yieldEnd) {
            return;
        }
        // Change to next yield period
        yieldEnd = (block.timestamp + YIELD_TIME).toUint128();
        // Compute yield and set future yield
        uint256 _computedAssets = totalAssets();
        uint256 _actualAssets = IERC20(asset()).balanceOf(address(this));
        if (_actualAssets <= _computedAssets) {
            yieldAssets = 0;
            hardAssets = _actualAssets;
        } else if (_actualAssets > _computedAssets) {
            uint256 _newYield = _actualAssets - _computedAssets;
            uint256 _maxYield = (_actualAssets * 5) / 100; // Maximum of 5% increase in assets per day
            _newYield = _min(_min(_newYield, _maxYield), type(uint128).max);
            yieldAssets = _newYield.toUint128();
            hardAssets = _computedAssets.toInt256();
        }
        emit YiedPeriodStarted(hardAssets, yieldAssets, yieldEnd);
    }

    function totalAssets() public view override returns (uint256) {
        uint256 _end = yieldEnd;
        if (block.timestamp >= _end) {
            return (hardAssets + uint256(yieldAssets).toInt256()).toUint256();
        } else if (block.timestamp <= _end - YIELD_TIME) {
            return hardAssets.toUint256();
        }
        uint256 elapsed = (block.timestamp + YIELD_TIME) - _end;
        uint256 _unlockedYield = (yieldAssets * elapsed) / YIELD_TIME;
        return (hardAssets + _unlockedYield.toInt256()).toUint256();
    }

    function deposit(uint256 oethAmount, address receiver)
        public
        override
        returns (uint256 woethAmount)
    {
        woethAmount = super.deposit(oethAmount, receiver);
        hardAssets += oethAmount.toInt256();
        startYield();
    }

    function mint(uint256 woethAmount, address receiver)
        public
        override
        returns (uint256 oethAmount)
    {
        oethAmount = super.mint(woethAmount, receiver);
        hardAssets += oethAmount.toInt256();
        startYield();
    }

    function withdraw(
        uint256 oethAmount,
        address receiver,
        address owner
    ) public override returns (uint256 woethAmount) {
        woethAmount = super.withdraw(oethAmount, receiver, owner);
        hardAssets -= oethAmount.toInt256();
        startYield();
    }

    function redeem(
        uint256 woethAmount,
        address receiver,
        address owner
    ) public override returns (uint256 oethAmount) {
        oethAmount = super.redeem(woethAmount, receiver, owner);
        hardAssets -= oethAmount.toInt256();
        startYield();
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal override {
        super._transfer(sender, recipient, amount);
        startYield();
    }

    function _min(uint256 a, uint256 b) internal returns (uint256) {
        return a < b ? a : b;
    }
}
