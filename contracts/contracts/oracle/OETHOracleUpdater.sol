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

    event AddPrice(uint256 answer, uint256 vaultPrice, uint256 marketPrice);

    constructor(address _vault, address _curvePool) Governable() {
        curvePool = ICurvePool(_curvePool);
        vault = IVault(_vault);
    }

    /// @notice Adds new Oracle price to an Oracle
    /// @dev Callable by anyone as the prices are sourced and aggregated on-chain.
    /// @param oracle Address of the Oracle that has this contract set as its priceSource
    function addPrice(IOracleReceiver oracle) external {
        (
            uint256 answer,
            uint256 vaultPrice,
            uint256 marketPrice
        ) = _getPrices();

        emit AddPrice(answer, vaultPrice, marketPrice);

        // Authorization is handled on Oracle side
        oracle.addPrice(uint128(answer));
    }

    function _getPrices()
        internal
        view
        returns (
            uint256 answer,
            uint256 vaultPrice,
            uint256 marketPrice
        )
    {
        // Get price from the Vault
        vaultPrice = vault.price();

        // Get price from the Curve pool
        marketPrice = curvePool.price_oracle();

        // TODO check if the data is bad

        // Return the market price with the Vault price as the floor price
        if (marketPrice > vaultPrice) {
            answer = marketPrice;
        } else {
            answer = vaultPrice;
        }
    }

    /// @notice Get the latest price from the Vault and Curve pool
    /// @return answer is the latest Oracle price
    function getPrices()
        external
        view
        returns (
            uint256 answer,
            uint256 vaultPrice,
            uint256 marketPrice
        )
    {
        (answer, vaultPrice, marketPrice) = _getPrices();
    }
}
