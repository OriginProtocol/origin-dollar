// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IStrategy } from "../interfaces/IStrategy.sol";
import { IVault } from "../interfaces/IVault.sol";
import { VaultAdmin } from "./VaultAdmin.sol";

/**
 * @title OETH VaultAdmin Contract
 * @author Origin Protocol Inc
 */
contract OETHVaultAdmin is VaultAdmin {
    using SafeERC20 for IERC20;

    address public immutable weth;

    constructor(address _weth) {
        weth = _weth;
    }

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

        IVault(address(this)).addWithdrawalQueueLiquidity();
    }

    function _withdrawAllFromStrategy(address _strategyAddr) internal override {
        super._withdrawAllFromStrategy(_strategyAddr);

        IVault(address(this)).addWithdrawalQueueLiquidity();
    }

    function _withdrawAllFromStrategies() internal override {
        super._withdrawAllFromStrategies();

        IVault(address(this)).addWithdrawalQueueLiquidity();
    }

    // TODO move to a library?
    function _wethAvailable() internal view returns (uint256 wethAvailable) {
        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;

        // Check if the claimable WETH is less than the queued amount
        uint256 queueShortfall = queue.queued - queue.claimable;
        uint256 wethBalance = IERC20(weth).balanceOf(address(this));
        // Of the claimable withdrawal requests, how much is unclaimed?
        uint256 unclaimed = queue.claimable - queue.claimed;

        if (wethBalance > queueShortfall + unclaimed) {
            wethAvailable = wethBalance - queueShortfall - unclaimed;
        }
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
        IVault(address(this)).addWithdrawalQueueLiquidity();
    }
}
