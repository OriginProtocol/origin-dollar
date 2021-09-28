// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "../interfaces/IPriceOracle.sol";
import "../interfaces/IMinMaxOracle.sol";

/**
 * Mock of both price Oracle and min max oracles
 */
contract MockOracle is IPriceOracle, IMinMaxOracle {
    mapping(bytes32 => uint256) prices;
    mapping(bytes32 => uint256[]) pricesMinMax;
    uint256 ethMin;
    uint256 ethMax;

    /**
     * @dev returns the asset price in USD, 6 decimal digits.
     * Compatible with the Open Price Feed.
     */
    function price(string calldata symbol)
        external
        view
        override
        returns (uint256)
    {
        return prices[keccak256(abi.encodePacked(symbol))];
    }

    /**
     * @dev sets the price of the asset in USD, 6 decimal digits
     *
     */
    function setPrice(string calldata symbol, uint256 _price) external {
        prices[keccak256(abi.encodePacked(symbol))] = _price;
    }

    /**
     * @dev sets the min and max price of ETH in USD, 6 decimal digits
     *
     */
    function setEthPriceMinMax(uint256 _min, uint256 _max) external {
        ethMin = _min;
        ethMax = _max;
    }

    /**
     * @dev sets the prices Min Max for a specific symbol in ETH, 8 decimal digits
     *
     */
    function setTokPriceMinMax(
        string calldata symbol,
        uint256 _min,
        uint256 _max
    ) external {
        pricesMinMax[keccak256(abi.encodePacked(symbol))] = [_min, _max];
    }

    /**
     * @dev get the price of asset in ETH, 8 decimal digits.
     */
    function priceMin(string calldata symbol)
        external
        view
        override
        returns (uint256)
    {
        uint256[] storage pMinMax = pricesMinMax[
            keccak256(abi.encodePacked(symbol))
        ];
        return (pMinMax[0] * ethMin) / 1e6;
    }

    /**
     * @dev get the price of asset in USD, 8 decimal digits.
     * Not needed for now
     */
    function priceMax(string calldata symbol)
        external
        view
        override
        returns (uint256)
    {
        uint256[] storage pMinMax = pricesMinMax[
            keccak256(abi.encodePacked(symbol))
        ];
        return (pMinMax[1] * ethMax) / 1e6;
    }
}
