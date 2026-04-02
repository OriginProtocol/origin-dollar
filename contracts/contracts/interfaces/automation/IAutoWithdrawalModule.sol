// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IAbstractSafeModule} from "contracts/interfaces/automation/IAbstractSafeModule.sol";

interface IAutoWithdrawalModule is IAbstractSafeModule {
    event LiquidityWithdrawn(address indexed strategy, uint256 amount, uint256 remainingShortfall);
    event InsufficientStrategyLiquidity(address indexed strategy, uint256 shortfall, uint256 available);
    event WithdrawalFailed(address indexed strategy, uint256 attemptedAmount);
    event StrategyUpdated(address oldStrategy, address newStrategy);

    function vault() external view returns (address);

    function asset() external view returns (address);

    function strategy() external view returns (address);

    function fundWithdrawals() external;

    function setStrategy(address _strategy) external;

    function pendingShortfall() external view returns (uint256 shortfall);
}
