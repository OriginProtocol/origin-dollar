// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IPriceOracle {
    /**
     * @dev returns the asset price in USD, 6 decimal digits.
     * Compatible with the Open Price Feed.
     */
    function price(string calldata symbol) external view returns (uint256);
}
