pragma solidity 0.5.11;

interface IEthUsdOracle {
    /**
     * @notice Returns ETH price in USD.
     * @return Price in USD with 6 decimal digits
     */
    function ethUsdPrice() external view returns (uint256);

    function tokUsdPrice(string calldata symbol)
        external
        view
        returns (uint256);

    /**
     * @notice Returns the asset price in ETH.
     * @param symbol. Asset symbol. For ex. "DAI".
     * @return Price in ETH with 8 decimal digits.
     */
    function tokEthPrice(string calldata symbol)
        external
        view
        returns (uint256);
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
