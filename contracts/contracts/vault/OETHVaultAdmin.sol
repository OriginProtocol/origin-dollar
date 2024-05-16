// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { VaultAdmin } from "./VaultAdmin.sol";
import { IVault } from "../interfaces/IVault.sol";

/**
 * @title OETH VaultAdmin Contract
 * @author Origin Protocol Inc
 */
contract OETHVaultAdmin is VaultAdmin {
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
}
