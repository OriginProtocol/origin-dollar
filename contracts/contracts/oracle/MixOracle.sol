pragma solidity 0.5.11;

/*
    The MixOracle pulls exchange rate data from multiple oracles
    and returns the min and max values.
*/

import { IPriceOracle } from "../interfaces/IPriceOracle.sol";
import { IEthUsdOracle } from "../interfaces/IEthUsdOracle.sol";
import { IMinMaxOracle } from "../interfaces/IMinMaxOracle.sol";

contract MixOracle is IMinMaxOracle {
    // For now we assume that all oracles do Token->Eth and then Eth->Usd.
    // We will have to special case when this is no longer the case and switch oracles via a config.
    address[] public oracles;
    address admin;
    uint256 constant MAX_INT = 2**256 - 1;

    constructor() public {
        admin = msg.sender;
    }

    /**
     * @notice Adds an oracle to the list of oracles to pull data from.
     * @param oracle Address of an oracle that implements the IEthUsdOracle interface.
     **/
    function registerOracle(address oracle) public {
        require(admin == msg.sender, "Only the admin can register a new pair");
        for (uint256 i = 0; i < oracles.length; i++) {
            require(oracles[i] != oracle, "Oracle already registered.");
        }
        oracles.push(oracle);
    }

    /**
     * @notice Returns the min and max price of ETH in USD.
     * @return min Min price from all the oracles, in USD with 6 digits precision.
     * @return max Max price from all the oracles, in USD with 6 digits precision.
     **/
    function priceEthMinMax() external view returns (uint256, uint256) {
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

    /**
     * @notice Returns the min and max price of an asset in ETH.
     * @return symbol Asset symbol. Example: "DAI"
     * @return min Min price from all the oracles, in ETH with 8 decimal digits.
     * @return max Max price from all the oracles, in ETH with 8 decimal digits.
     **/
    function priceTokEthMinMax(string calldata symbol)
        external
        view
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

    /**
     * @notice Returns the min and max price of an asset in USD.
     * @return symbol Asset symbol. Example: "DAI"
     * @return min Min price from all the oracles, in USD with 6 decimal digits.
     * @return max Max price from all the oracles, in USD with 6 decimal digits.
     **/
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
