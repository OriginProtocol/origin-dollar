// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IOracle {
    /**
     * @dev returns the asset price in USD, in 8 decimal digits.
     *
     * The version of priceProvider deployed for OETH has 18 decimal digits
     */
    function price(address asset) external view returns (uint256);

    /**
     * @dev returns the asset price for asset pair in 18 decimal format.
     */
    function price(address asset_one, address asset_two)
        external
        view
        returns (uint256);
}
