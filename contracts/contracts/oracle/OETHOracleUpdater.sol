// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IOracleReceiver } from "./IOracleReceiver.sol";
import { IVault } from "../interfaces/IVault.sol";
import { AggregatorV3Interface } from "../interfaces/chainlink/AggregatorV3Interface.sol";
import { Governable } from "../governance/Governable.sol";
import { ICurvePool } from "../strategies/ICurvePool.sol";

/**
 * @title OETH Oracle Updater
 * @notice Gathers on-chain OETH pricing data and updates the OETHOracle contract.
 * @author Origin Protocol Inc
 */
contract OETHOracleUpdater is Governable {
    /// @notice Max OETH price when redeeming via the vault to 18 decimals.
    /// The vault charges a 0.5% withdraw fee and the oracle prices of
    /// the vault collateral assets are capped at 1 so the max price is 0.995.
    /// @dev A new OETHOracleUpdater needs to be deployed if the vault withdraw fee changes.
    uint256 public constant MAX_VAULT_PRICE = 995e15;

    /// @notice The OETH/ETH Curve pool
    ICurvePool public immutable curvePool;
    /// @notice The OETH Vault
    IVault public immutable vault;

    struct OracleUpdaterConfig {
        address vault;
        address curvePool;
    }

    event AddPrice(uint256 answer, uint256 vaultPrice, uint256 marketPrice);

    /**
     * @param _vault Address of the OETH Vault
     * @param _curvePool Address of the OETH/ETH Curve pool
     */
    constructor(address _vault, address _curvePool) Governable() {
        curvePool = ICurvePool(_curvePool);
        vault = IVault(_vault);
    }

    /// @notice Adds a new on-chain, aggregated OETH/ETH price to 18 decimals to the specified Oracle.
    /// @dev Callable by anyone as the prices are sourced and aggregated on-chain.
    /// @param oracle Address of the Oracle that has authorized this contract to add prices.
    function addPrice(IOracleReceiver oracle) external {
        (
            uint256 answer,
            uint256 vaultPrice,
            uint256 marketPrice
        ) = _getPrices();

        emit AddPrice(answer, vaultPrice, marketPrice);

        // Add the new aggregated price to the oracle.
        // Authorization is handled on Oracle side
        oracle.addPrice(uint128(answer));
    }

    /**
     * @dev Gets the OETH/ETH market price, vault floor price and aggregates to a OETH/ETH price to 18 decimals.
     */
    function _getPrices()
        internal
        view
        returns (
            uint256 answer,
            uint256 vaultPrice,
            uint256 marketPrice
        )
    {
        // Get the aggregated market price from on-chain DEXs
        marketPrice = _getMarketPrice();

        // If market price is above the vault price with the withdraw fee
        if (marketPrice > MAX_VAULT_PRICE) {
            answer = marketPrice;
            // Avoid getting the vault price as this is gas intensive.
            // its not going to be higher than 0.995 with a 0.5% withdraw fee
            vaultPrice = MAX_VAULT_PRICE;
        } else {
            // Get the price from the Vault. This includes the withdraw fee
            // and the vault collateral assets priced using oracles
            vaultPrice = vault.floorPrice();

            if (marketPrice > vaultPrice) {
                // Return the market price with the Vault price as the floor price
                answer = marketPrice;
            } else {
                // Return the vault price
                answer = vaultPrice;
            }
        }

        // Cap the OETH/ETH price at 1
        if (answer > 1e18) {
            answer = 1e18;
        }
    }

    /**
     * @dev Gets the market prices from on-chain DEXs.
     * Currently, this is Curve's OETH/ETH Exponential Moving Average (EMA) oracle.
     * This can be expended later to support aggregation across multiple on-chain DEXs.
     * For example, other OETH Curve, Balancer or Uniswap pools.
     */
    function _getMarketPrice() internal view returns (uint256 marketPrice) {
        // Get the EMA oracle price from the Curve pool
        marketPrice = curvePool.price_oracle();
    }

    /// @notice Get the latest prices from the OETH Vault and OETH/ETH Curve pool to 18 decimals.
    /// @return answer the aggregated OETH/ETH price
    /// @return vaultPrice the vault floor price if the market price is below the max vault floor price
    /// @return marketPrice the latest market price
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
