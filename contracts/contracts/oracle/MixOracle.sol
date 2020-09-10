pragma solidity 0.5.11;

/*
    The MixOracle pulls exchange rate data from multiple oracles
    and returns the min and max values.
*/

import { IPriceOracle } from "../interfaces/IPriceOracle.sol";
import { IEthUsdOracle } from "../interfaces/IEthUsdOracle.sol";
import { IMinMaxOracle } from "../interfaces/IMinMaxOracle.sol";

contract MixOracle is IMinMaxOracle {
    address[] public ethUsdOracles;

    struct MixConfig {
        address[] usdOracles;
        address[] ethOracles;
    }

    mapping(bytes32 => MixConfig) configs;

    address admin;
    uint256 constant MAX_INT = 2**256 - 1;
    uint256 public maxDrift;
    uint256 public minDrift;

    constructor(uint256 _maxDrift, uint256 _minDrift) public {
        admin = msg.sender;
        maxDrift = _maxDrift;
        minDrift = _minDrift;
    }

    function setMinMaxDrift(uint256 _maxDrift, uint256 _minDrift) public {
        require(admin == msg.sender, "Only the admin can register a new pair");
        maxDrift = _maxDrift;
        minDrift = _minDrift;
    }

    /**
     * @notice Adds an oracle to the list of oracles to pull data from.
     * @param oracle Address of an oracle that implements the IEthUsdOracle interface.
     **/
    function registerEthUsdOracle(address oracle) public {
        require(admin == msg.sender, "Only the admin can register a new pair");
        for (uint256 i = 0; i < ethUsdOracles.length; i++) {
            require(ethUsdOracles[i] != oracle, "Oracle already registered.");
        }
        ethUsdOracles.push(oracle);
    }

    /**
     * @notice Adds an oracle to the list of oracles to pull data from.
     * @param ethOracles Addresses of oracles that implements the IEthUsdOracle interface and answers for this asset
     * @param usdOracles Addresses of oracles that implements the IPriceOracle interface and answers for this asset
     **/
    function registerTokenOracles(
        string calldata symbol,
        address[] calldata ethOracles,
        address[] calldata usdOracles
    ) external {
        MixConfig storage config = configs[keccak256(abi.encodePacked(symbol))];
        require(admin == msg.sender, "Only the admin can register a new pair");
        config.ethOracles = ethOracles;
        config.usdOracles = usdOracles;
    }

    /**
     * @notice Returns the min price of an asset in USD.
     * @return symbol Asset symbol. Example: "DAI"
     * @return price Min price from all the oracles, in USD with 8 decimal digits.
     **/
    function priceMin(string calldata symbol) external returns (uint256 price) {
        MixConfig storage config = configs[keccak256(abi.encodePacked(symbol))];
        uint256 ep;
        uint256 p; //holder variables
        price = MAX_INT;
        if (config.ethOracles.length > 0) {
            ep = MAX_INT;
            for (uint256 i = 0; i < config.ethOracles.length; i++) {
                p = IEthUsdOracle(config.ethOracles[i]).tokEthPrice(symbol);
                if (ep > p) {
                    ep = p;
                }
            }
            price = ep;
            ep = MAX_INT;
            for (uint256 i = 0; i < ethUsdOracles.length; i++) {
                p = IEthUsdOracle(ethUsdOracles[i]).ethUsdPrice();
                if (ep > p) {
                    ep = p;
                }
            }
            if (price != MAX_INT && ep != MAX_INT) {
                // tokEthPrice has precision of 8 which ethUsdPrice has precision of 6
                // we want precision of 8
                price = (price * ep) / 1e6;
            }
        }

        if (config.usdOracles.length > 0) {
            for (uint256 i = 0; i < config.usdOracles.length; i++) {
                // upscale by 2 since price oracles are precision 6
                p = IPriceOracle(config.usdOracles[i]).price(symbol) * 1e2;
                if (price > p) {
                    price = p;
                }
            }
        }
        require(price < maxDrift, "Price exceeds max vaule.");
        require(price > minDrift, "Price exceeds max vaule.");
        require(
            price != MAX_INT,
            "None of our oracles returned a valid min price!"
        );
    }

    /**
     * @notice Returns max price of an asset in USD.
     * @return symbol Asset symbol. Example: "DAI"
     * @return price Max price from all the oracles, in USD with 8 decimal digits.
     **/
    function priceMax(string calldata symbol) external returns (uint256 price) {
        MixConfig storage config = configs[keccak256(abi.encodePacked(symbol))];
        uint256 ep;
        uint256 p; //holder variables
        price = 0;
        if (config.ethOracles.length > 0) {
            ep = 0;
            for (uint256 i = 0; i < config.ethOracles.length; i++) {
                p = IEthUsdOracle(config.ethOracles[i]).tokEthPrice(symbol);
                if (ep < p) {
                    ep = p;
                }
            }
            price = ep;
            ep = 0;
            for (uint256 i = 0; i < ethUsdOracles.length; i++) {
                p = IEthUsdOracle(ethUsdOracles[i]).ethUsdPrice();
                if (ep < p) {
                    ep = p;
                }
            }
            if (price != 0 && ep != 0) {
                // tokEthPrice has precision of 8 which ethUsdPrice has precision of 6
                // we want precision of 8
                price = (price * ep) / 1e6;
            }
        }

        if (config.usdOracles.length > 0) {
            for (uint256 i = 0; i < config.usdOracles.length; i++) {
                // upscale by 2 since price oracles are precision 6
                p = IPriceOracle(config.usdOracles[i]).price(symbol) * 1e2;
                if (price < p) {
                    price = p;
                }
            }
        }
        require(price < maxDrift, "Price exceeds max vaule.");
        require(price > minDrift, "Price exceeds max vaule.");
        require(price != 0, "None of our oracles returned a valid max price!");
    }
}
