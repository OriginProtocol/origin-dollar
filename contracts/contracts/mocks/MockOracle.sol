pragma solidity 0.5.17;

import "../interfaces/IPriceOracle.sol";

/**
 * All prices in six digit USD.
 */
contract MockOracle is IPriceOracle {
    mapping(bytes32 => uint256) prices;

    /**
     * @dev returns the asset price in USD, 6 decimal digits.
     * Compatible with the Open Price Feed.
     */
    function price(string calldata symbol) external view returns (uint256) {
        return prices[keccak256(abi.encodePacked(symbol))];
    }

    /**
     * @dev sets the price of the asset in USD, 6 decimal digits.
     */
    function setPrice(string calldata symbol, uint256 _price) external {
        prices[keccak256(abi.encodePacked(symbol))] = _price;
    }
}
