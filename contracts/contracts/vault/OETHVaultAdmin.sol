// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IStrategy } from "../interfaces/IStrategy.sol";
import { VaultAdmin } from "./VaultAdmin.sol";
import { OETHVaultCommon } from "./OETHVaultCommon.sol";

/**
 * @title OETH VaultAdmin Contract
 * @author Origin Protocol Inc
 */
contract OETHVaultAdmin is OETHVaultCommon, VaultAdmin {
    using SafeERC20 for IERC20;

    constructor(address _weth) OETHVaultCommon(_weth) {}

    /// @dev Simplified version of the deposit function as WETH is the only supported asset.
    function _depositToStrategy(
        address _strategyToAddress,
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) internal override {
        require(
            strategies[_strategyToAddress].isSupported,
            "Invalid to Strategy"
        );
        require(
            _assets.length == 1 && _amounts.length == 1 && _assets[0] == weth,
            "Only WETH is supported"
        );

        // Check the there is enough WETH to transfer once the WETH reserved for the withdrawal queue is accounted for
        require(_amounts[0] <= _wethAvailable(), "Not enough WETH available");

        // Send required amount of funds to the strategy
        IERC20(weth).safeTransfer(_strategyToAddress, _amounts[0]);

        // Deposit all the funds that have been sent to the strategy
        IStrategy(_strategyToAddress).depositAll();
    }

    function _withdrawFromStrategy(
        address _recipient,
        address _strategyFromAddress,
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) internal override {
        super._withdrawFromStrategy(
            _recipient,
            _strategyFromAddress,
            _assets,
            _amounts
        );

        _addWithdrawalQueueLiquidity();
    }

    function _withdrawAllFromStrategy(address _strategyAddr) internal override {
        super._withdrawAllFromStrategy(_strategyAddr);

        _addWithdrawalQueueLiquidity();
    }

    function _withdrawAllFromStrategies() internal override {
        super._withdrawAllFromStrategies();

        _addWithdrawalQueueLiquidity();
    }

    function _swapCollateral(
        address _fromAsset,
        address _toAsset,
        uint256 _fromAssetAmount,
        uint256 _minToAssetAmount,
        bytes calldata _data
    ) internal override returns (uint256 toAssetAmount) {
        require(_fromAsset != weth, "Swap from WETH not supported");
        require(_toAsset == weth, "Only swap to WETH");
        toAssetAmount = super._swapCollateral(
            _fromAsset,
            _toAsset,
            _fromAssetAmount,
            _minToAssetAmount,
            _data
        );

        // Add any new WETH to the withdrawal queue first
        _addWithdrawalQueueLiquidity();
    }
}
