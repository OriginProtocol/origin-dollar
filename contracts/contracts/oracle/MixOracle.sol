pragma solidity 0.5.11;

import { IPriceOracle } from "../interfaces/IPriceOracle.sol";
import { IEthUsdOracle } from "../interfaces/IEthUsdOracle.sol";
import { IMinMaxOracle } from "../interfaces/IMinMaxOracle.sol";

contract MixOracle is IMinMaxOracle {
    //For now we assume that all oracles do Token->Eth and then Eth->Usd
    //will have to special case when this is nolonger the case and switch oracles via a config
    address[] public oracles;
    address admin;
    uint256 constant MAX_INT = 2**256 - 1;

    constructor() public {
        admin = msg.sender;
    }

    function registerOracle(address oracle) public {
        require(admin == msg.sender, "Only the admin can register a new pair");
        for (uint256 i = 0; i < oracles.length; i++) {
            require(oracles[i] != oracle, "Oracle already registered.");
        }
        oracles.push(oracle);
    }

    function priceEthMinMax() external returns (uint256, uint256) {
        require(oracles.length > 0, "Must have at least one oracle");
        uint256 max = 0;
        uint256 min = MAX_INT;
        uint256 price;

        for (uint256 i = 0; i < oracles.length; i++) {
            price = IEthUsdOracle(oracles[i]).ethUsdPrice();
            if (price > max) {
                max = price;
            }
            if (min > price) {
                min = price;
            }
        }
        return (min, max);
    }

    function priceTokEthMinMax(string calldata symbol)
        external
        returns (uint256, uint256)
    {
        require(oracles.length > 0, "Must have at least one oracle");
        uint256 max = 0;
        uint256 min = MAX_INT;
        uint256 price;

        for (uint256 i = 0; i < oracles.length; i++) {
            price = IEthUsdOracle(oracles[i]).tokEthPrice(symbol);
            if (price > max) {
                max = price;
            }
            if (min > price) {
                min = price;
            }
        }
        return (min, max);
    }

    function priceMinMax(string calldata symbol)
        external
        view
        returns (uint256, uint256)
    {
        require(oracles.length > 0, "Must have at least one oracle");
        uint256 max = 0;
        uint256 min = MAX_INT;
        uint256 price;

        for (uint256 i = 0; i < oracles.length; i++) {
            price = IPriceOracle(oracles[i]).price(symbol);
            if (price > max) {
                max = price;
            }
            if (min > price) {
                min = price;
            }
        }
        return (min, max);
    }
}
