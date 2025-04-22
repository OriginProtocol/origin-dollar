// SPDX-License-Identifier: BUSL-1.1
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

    /**
     * @notice Adds a strategy to the mint whitelist.
     *          Reverts if strategy isn't approved on Vault.
     * @param strategyAddr Strategy address
     */
    function addStrategyToMintWhitelist(address strategyAddr)
        external
        onlyGovernor
    {
        require(strategies[strategyAddr].isSupported, "Strategy not approved");

        require(
            !isMintWhitelistedStrategy[strategyAddr],
            "Already whitelisted"
        );

        isMintWhitelistedStrategy[strategyAddr] = true;

        emit StrategyAddedToMintWhitelist(strategyAddr);
    }

    /**
     * @notice Removes a strategy from the mint whitelist.
     * @param strategyAddr Strategy address
     */
    function removeStrategyFromMintWhitelist(address strategyAddr)
        external
        onlyGovernor
    {
        // Intentionally skipping `strategies.isSupported` check since
        // we may wanna remove an address even after removing the strategy

        require(isMintWhitelistedStrategy[strategyAddr], "Not whitelisted");

        isMintWhitelistedStrategy[strategyAddr] = false;

        emit StrategyRemovedFromMintWhitelist(strategyAddr);
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

    /// @dev Calculate how much WETH in the vault is not reserved for the withdrawal queue.
    // That is, it is available to be redeemed or deposited into a strategy.
    function _wethAvailable() internal view returns (uint256 wethAvailable) {
        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;

        // The amount of WETH that is still to be claimed in the withdrawal queue
        uint256 outstandingWithdrawals = queue.queued - queue.claimed;

        // The amount of sitting in WETH in the vault
        uint256 wethBalance = IERC20(weth).balanceOf(address(this));

        // If there is not enough WETH in the vault to cover the outstanding withdrawals
        if (wethBalance <= outstandingWithdrawals) {
            return 0;
        }

        return wethBalance - outstandingWithdrawals;
    }

    function _swapCollateral(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) internal pure override returns (uint256) {
        revert("Collateral swap not supported");
    }
}
