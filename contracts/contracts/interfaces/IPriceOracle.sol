pragma solidity 0.5.11;

interface IPriceOracle {
    /**
     * @dev returns the asset price in USD, 6 decimal digits.
     * Compatible with the Open Price Feed.
     */
    function price(string calldata symbol) external view returns (uint256);
}
