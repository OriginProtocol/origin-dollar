// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { VaultAdmin } from "./VaultAdmin.sol";

/**
 * @title Origin S VaultAdmin Contract on Sonic
 * @author Origin Protocol Inc
 */
contract OSonicVaultAdmin is VaultAdmin {
    using SafeERC20 for IERC20;

    /// @notice Sonic's Wrapped S token
    address public immutable wS;

    constructor(address _wS) {
        wS = _wS;
    }

    /// @dev Simplified version of the deposit function as wS is the only supported asset.
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
            _assets.length == 1 && _amounts.length == 1 && _assets[0] == wS,
            "Only wS is supported"
        );

        // Check the there is enough wS to transfer once the wS reserved for the withdrawal queue is accounted for
        require(_amounts[0] <= _wSAvailable(), "Not enough wS available");

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

    /// @dev Calculate how much Wrapped S tokens in the vault is not reserved for the withdrawal queue.
    // That is, it is available to be redeemed or deposited into a strategy.
    function _wSAvailable() internal view returns (uint256 wSAvailable) {
        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;

        // The amount that is still to be claimed in the withdrawal queue
        uint256 outstandingWithdrawals = queue.queued - queue.claimed;

        // The amount of sitting in WETH in the vault
        uint256 wSBalance = IERC20(sW).balanceOf(address(this));

        // If there is not enough wS in the vault to cover the outstanding withdrawals
        if (wSBalance <= outstandingWithdrawals) {
            return 0;
        }

        return wSBalance - outstandingWithdrawals;
    }
}
