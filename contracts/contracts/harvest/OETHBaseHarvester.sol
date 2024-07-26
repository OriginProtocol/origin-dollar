// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AbstractHarvester } from "./AbstractHarvester.sol";

contract OETHBaseHarvester is AbstractHarvester {
    // TODO: Add storage gaps in AbstractHarvester

    // TODO: Add support for Aerodrome

    address public immutable aeroTokenAddress;

    struct AeroPerformanceFeeConfig {
        uint16 feeBps;
        address feeRecipient;
    }
    AeroPerformanceFeeConfig public aeroPerformanceFeeConfig;

    event AeroPerformanceFeeUpdated(uint16 feeBps, address feeRecipient);
    event AeroPerformanceFeeDistributed(uint256 fee);

    error InvalidPerformanceFeeBps();

    constructor(
        address _vault,
        address _wethAddress,
        address _aeroTokenAddress
    ) AbstractHarvester(_vault, _wethAddress) {
        aeroTokenAddress = _aeroTokenAddress;
    }

    function setAeroPerformanceFeeConfig(uint16 _feeBps, address _recipient)
        external
        onlyGovernor
    {
        if (_feeBps > 1000) {
            revert InvalidPerformanceFeeBps();
        }

        emit AeroPerformanceFeeUpdated(_feeBps, _recipient);

        aeroPerformanceFeeConfig = AeroPerformanceFeeConfig({
            feeBps: _feeBps,
            feeRecipient: _recipient
        });
    }

    function _harvest(address _strategyAddr) internal virtual override {
        uint256 balanceBefore = IERC20(aeroTokenAddress).balanceOf(
            address(this)
        );

        super._harvest(_strategyAddr);

        uint256 aeroCollected = IERC20(aeroTokenAddress).balanceOf(
            address(this)
        ) - balanceBefore;

        AeroPerformanceFeeConfig memory _config = aeroPerformanceFeeConfig;
        uint256 performanceFee = (aeroCollected * _config.feeBps) / 1e4;

        if (performanceFee > 0) {
            // Distribute performance fee (if any)
            IERC20(aeroTokenAddress).transfer(
                _config.feeRecipient,
                performanceFee
            );
            emit AeroPerformanceFeeDistributed(performanceFee);
        }
    }
}
