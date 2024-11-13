// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IYieldAggregatorManager {
    function feeBps() external view returns (uint256);
    function feeRecipient() external view returns (address);
}

interface IGauge {
    function notifyRewardAmount(address token, uint256 amount) external;
}

contract YieldAggregator {
    IERC20 public immutable oToken;

    IYieldAggregatorManager public immutable manager;

    IGauge public immutable gauge;

    uint256 public taxedAmount;

    event ProtocolFeeTransferred(uint256 feeAmount);

    event IncentivesDeposited(address asset, uint256 amount);

    constructor(address _oToken, address _manager, address _gauge) {
        manager = IYieldAggregatorManager(_manager);
        oToken = IERC20(_oToken);
        gauge = IGauge(_gauge);
    }

    function pendingFee() public view returns (uint256) {
        uint256 currentBalance = oToken.balanceOf(address(this));

        if (currentBalance == 0) {
            return 0;
        }

        uint256 untaxedAmount = currentBalance - taxedAmount;

        if (untaxedAmount == 0) {
            return 0;
        }

        return (untaxedAmount * manager.feeBps()) / 10000;
    }

    function payPendingFee() public {
        uint256 feeAmount = pendingFee();

        if (feeAmount == 0) {
            return;
        }

        oToken.transfer(manager.feeRecipient(), feeAmount);

        taxedAmount = oToken.balanceOf(address(this));

        emit ProtocolFeeTransferred(feeAmount);
    }

    function deposit() external {
        payPendingFee();

        uint256 availableTokens = oToken.balanceOf(address(this));

        oToken.approve(address(gauge), availableTokens);

        gauge.notifyRewardAmount(address(oToken), availableTokens);

        taxedAmount = 0;

        emit IncentivesDeposited(address(oToken), availableTokens);
    }

    function version() external pure returns (uint256) {
        return 1;
    }
}