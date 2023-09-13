// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IOracleReceiver } from "./IOracleReceiver.sol";
import { IVault } from "../interfaces/IVault.sol";
import { AggregatorV3Interface } from "../interfaces/chainlink/AggregatorV3Interface.sol";
import { Governable } from "../governance/Governable.sol";
import { ICurvePool } from "../strategies/ICurvePool.sol";

/**
 * @title OETH Oracle Updater
 * @notice Gathers OETH pricing data and updates the OEHOracle contract.
 * @author Origin Protocol Inc
 */
contract OETHOracleUpdater is Governable {
    ICurvePool public immutable curvePool;
    IVault public immutable vault;

    struct OracleUpdaterConfig {
        address vault;
        address curvePool;
    }

    constructor(address _vault, address _curvePool) Governable() {
        curvePool = ICurvePool(_curvePool);
        vault = IVault(_vault);
    }

    /// @notice Adds new Oracle price to an Oracle
    /// @dev Callable by anyone as the prices are sourced and aggregated on-chain.
    /// @param oracle Address of the Oracle that has this contract set as its priceSource
    function addRoundData(IOracleReceiver oracle) external {
        (bool isBadData, uint256 answer, , ) = _getPrices();

        // Authorization is handled on Oracle side
        oracle.addRoundData({
            isBadData: isBadData,
            answer: uint128(answer),
            timestamp: uint40(block.timestamp)
        });
    }

    function _getPrices()
        internal
        view
        returns (
            bool isBadData,
            uint256 answer,
            uint256 vaultPrice,
            uint256 curvePrice
        )
    {
        // Get price from the Vault
        vaultPrice = vault.price();

        // Get price from the Curve pool
        curvePrice = curvePool.price_oracle();

        // TODO check if the data is bad
        isBadData = false;

        // Return the Curve price with the Vault price as the floor price
        if (curvePrice > vaultPrice) {
            answer = curvePrice;
        } else {
            answer = vaultPrice;
        }
    }

    /// @notice Get the latest price from the Vault and Curve pool
    /// @return isBadData is true when data is stale or otherwise bad
    /// @return answer is the latest Oracle price
    function getPrices()
        external
        view
        returns (
            bool isBadData,
            uint256 answer,
            uint256 vaultPrice,
            uint256 curvePrice
        )
    {
        (isBadData, answer, vaultPrice, curvePrice) = _getPrices();
    }
}
