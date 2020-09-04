pragma solidity 0.5.11;

interface IEthUsdOracle {
    /**
     * @dev returns the asset price in USD, 6 decimal digits.
     */
    function ethUsdPrice() external view returns (uint256);

    /**
     * @dev returns the asset price in ETH, 8 decimal digits.
     */
    function tokUsdPrice(string calldata symbol)
        external
        view
        returns (uint256);

    function tokEthPrice(string calldata symbol) external returns (uint256);
}

interface IViewEthUsdOracle {
    /**
     * @dev returns the asset price in USD, 6 decimal digits.
     */
    function ethUsdPrice() external view returns (uint256);

    /**
     * @dev returns the asset price in ETH, 8 decimal digits.
     */

    function tokUsdPrice(string calldata symbol)
        external
        view
        returns (uint256);

    function tokEthPrice(string calldata symbol)
        external
        view
        returns (uint256);
}
