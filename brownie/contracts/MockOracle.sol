pragma solidity ^0.8.0;

// For testing OUSD's repsonse to oracle price changes
contract MockOracle {
    mapping(address => uint256) public price;

    function setPrice(address asset, uint256 price_) external {
        price[asset] = price_;
    }
}
