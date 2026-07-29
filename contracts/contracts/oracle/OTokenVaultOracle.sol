// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IOToken } from "../interfaces/IOToken.sol";
import { IOTokenVaultOracle } from "../interfaces/IOTokenVaultOracle.sol";
import { IVault } from "../interfaces/IVault.sol";

/**
 * @title OToken Vault Oracle
 * @notice Reports the value of one OToken in the Vault's underlying asset.
 * @dev The price has 18 decimals and is calculated from the Vault's total value
 *      divided by the OToken's total supply.
 * @author Origin Protocol Inc
 */
contract OTokenVaultOracle is IOTokenVaultOracle {
    /// @notice The number of decimals in the reported price.
    uint8 public constant override decimals = 18;

    /// @notice The Chainlink-compatible oracle version.
    uint256 public constant override version = 1;

    /// @notice The Vault used to calculate the OToken price.
    IVault public immutable vault;

    /// @notice The OToken whose price is reported.
    IOToken public immutable oToken;

    /// @notice A human-readable description of the price pair.
    string public override description;

    /**
     * @notice Constructs an OToken Vault Oracle.
     * @param _vault The Vault used to calculate the price and resolve the OToken.
     * @param _description A human-readable description of the price pair.
     */
    constructor(address _vault, string memory _description) {
        require(_vault != address(0), "Vault is zero address");

        vault = IVault(_vault);
        address _oToken = vault.oToken();
        require(_oToken != address(0), "OToken is zero address");
        oToken = IOToken(_oToken);
        description = _description;
    }

    /**
     * @notice Returns the value of one OToken in the Vault's underlying asset.
     * @return The price with 18 decimals.
     */
    function price() public view override returns (uint256) {
        uint256 supply = oToken.totalSupply();
        require(supply > 0, "No data present");

        return (vault.totalValue() * 1e18) / supply;
    }

    /**
     * @notice Legacy Chainlink-compatible latest price accessor.
     * @return The latest price with 18 decimals.
     */
    function latestAnswer() external view override returns (int256) {
        return int256(price());
    }

    /**
     * @notice Returns data for the current synthetic round.
     * @dev This is a live calculated feed, so only round 1 exists.
     * @param _roundId The requested round ID, which must be 1.
     * @return roundId The synthetic round ID.
     * @return answer The current price with 18 decimals.
     * @return startedAt The timestamp at which the price was read.
     * @return updatedAt The timestamp at which the price was read.
     * @return answeredInRound The synthetic round ID in which the answer was calculated.
     */
    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        require(_roundId == 1, "No data present");
        return _latestRoundData();
    }

    /**
     * @notice Returns the latest calculated price as Chainlink round data.
     * @return roundId The synthetic round ID.
     * @return answer The current price with 18 decimals.
     * @return startedAt The timestamp at which the price was read.
     * @return updatedAt The timestamp at which the price was read.
     * @return answeredInRound The synthetic round ID in which the answer was calculated.
     */
    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return _latestRoundData();
    }

    function _latestRoundData()
        internal
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (1, int256(price()), block.timestamp, block.timestamp, 1);
    }
}
