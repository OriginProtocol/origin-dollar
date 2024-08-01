// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IStrategy } from "../interfaces/IStrategy.sol";
import { OETHVaultLibrary } from "./OETHVaultLibrary.sol";
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
        require(
            _amounts[0] <=
                OETHVaultLibrary._wethAvailable(withdrawalQueueMetadata, weth),
            "Not enough WETH available"
        );

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

        OETHVaultLibrary._addWithdrawalQueueLiquidity(
            withdrawalQueueMetadata,
            weth
        );
    }

    function _withdrawAllFromStrategy(address _strategyAddr) internal override {
        super._withdrawAllFromStrategy(_strategyAddr);

        OETHVaultLibrary._addWithdrawalQueueLiquidity(
            withdrawalQueueMetadata,
            weth
        );
    }

    function _withdrawAllFromStrategies() internal override {
        super._withdrawAllFromStrategies();

        OETHVaultLibrary._addWithdrawalQueueLiquidity(
            withdrawalQueueMetadata,
            weth
        );
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
