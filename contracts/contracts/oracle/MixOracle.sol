pragma solidity 0.5.11;

/**
 * @title OUSD MixOracle Contract
 * @notice The MixOracle pulls exchange rate from multiple oracles and returns
 *         min and max values.
 * @author Origin Protocol Inc
 */
import { IPriceOracle } from "../interfaces/IPriceOracle.sol";
import { IEthUsdOracle } from "../interfaces/IEthUsdOracle.sol";
import { IMinMaxOracle } from "../interfaces/IMinMaxOracle.sol";
import { Governable } from "../governance/Governable.sol";

contract MixOracle is IMinMaxOracle, Governable {
    event DriftsUpdated(uint256 _minDrift, uint256 _maxDrift);
    event EthUsdOracleRegistered(address _oracle);
    event EthUsdOracleDeregistered(address _oracle);
    event TokenOracleRegistered(
        string symbol,
        address[] ethOracles,
        address[] usdOracles
    );

    address[] public ethUsdOracles;

    struct MixConfig {
        address[] usdOracles;
        address[] ethOracles;
    }

    mapping(bytes32 => MixConfig) configs;

    uint256 constant MAX_INT = 2**256 - 1;
    uint256 public maxDrift;
    uint256 public minDrift;

    constructor(uint256 _maxDrift, uint256 _minDrift) public {
        maxDrift = _maxDrift;
        minDrift = _minDrift;
        emit DriftsUpdated(_minDrift, _maxDrift);
    }

    function setMinMaxDrift(uint256 _minDrift, uint256 _maxDrift)
        public
        onlyGovernor
    {
        minDrift = _minDrift;
        maxDrift = _maxDrift;
        emit DriftsUpdated(_minDrift, _maxDrift);
    }

    /**
     * @notice Adds an oracle to the list of oracles to pull data from.
     * @param oracle Address of an oracle that implements the IEthUsdOracle interface.
     **/
    function registerEthUsdOracle(address oracle) public onlyGovernor {
        for (uint256 i = 0; i < ethUsdOracles.length; i++) {
            require(ethUsdOracles[i] != oracle, "Oracle already registered.");
        }
        ethUsdOracles.push(oracle);
        emit EthUsdOracleRegistered(oracle);
    }

    /**
     * @notice Removes an oracle to the list of oracles to pull data from.
     * @param oracle Address of an oracle that implements the IEthUsdOracle interface.
     **/
    function unregisterEthUsdOracle(address oracle) public onlyGovernor {
        for (uint256 i = 0; i < ethUsdOracles.length; i++) {
            if (ethUsdOracles[i] == oracle) {
                // swap with the last element of the array, and then delete last element (could be itself)
                ethUsdOracles[i] = ethUsdOracles[ethUsdOracles.length - 1];
                delete ethUsdOracles[ethUsdOracles.length - 1];
                emit EthUsdOracleDeregistered(oracle);
                ethUsdOracles.pop();
                return;
            }
        }
        revert("Oracle not found");
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
    ) external onlyGovernor {
        MixConfig storage config = configs[keccak256(abi.encodePacked(symbol))];
        config.ethOracles = ethOracles;
        config.usdOracles = usdOracles;
        emit TokenOracleRegistered(symbol, ethOracles, usdOracles);
    }

    /**
     * @notice Returns the min price of an asset in USD.
     * @return symbol Asset symbol. Example: "DAI"
     * @return price Min price from all the oracles, in USD with 8 decimal digits.
     **/
    function priceMin(string calldata symbol)
        external
        view
        returns (uint256 price)
    {
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
        require(price <= maxDrift, "Price exceeds maxDrift");
        require(price >= minDrift, "Price below minDrift");
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
    function priceMax(string calldata symbol)
        external
        view
        returns (uint256 price)
    {
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

        require(price <= maxDrift, "Price exceeds maxDrift");
        require(price >= minDrift, "Price below minDrift");
        require(price != 0, "None of our oracles returned a valid max price!");
    }

    /**
     * @notice Returns the length of the usdOracles array for a given token
     * @param symbol Asset symbol. Example: "DAI"
     * @return length of the USD oracles array
     **/
    function getTokenUSDOraclesLength(string calldata symbol)
        external
        view
        returns (uint256)
    {
        MixConfig storage config = configs[keccak256(abi.encodePacked(symbol))];
        return config.usdOracles.length;
    }

    /**
     * @notice Returns the address of a specific USD oracle
     * @param symbol Asset symbol. Example: "DAI"
     * @param idx Index of the array value to return
     * @return address of the oracle
     **/
    function getTokenUSDOracle(string calldata symbol, uint256 idx)
        external
        view
        returns (address)
    {
        MixConfig storage config = configs[keccak256(abi.encodePacked(symbol))];
        return config.usdOracles[idx];
    }

    /**
     * @notice Returns the length of the ethOracles array for a given token
     * @param symbol Asset symbol. Example: "DAI"
     * @return length of the ETH oracles array
     **/
    function getTokenETHOraclesLength(string calldata symbol)
        external
        view
        returns (uint256)
    {
        MixConfig storage config = configs[keccak256(abi.encodePacked(symbol))];
        return config.ethOracles.length;
    }

    /**
     * @notice Returns the address of a specific ETH oracle
     * @param symbol Asset symbol. Example: "DAI"
     * @param idx Index of the array value to return
     * @return address of the oracle
     **/
    function getTokenETHOracle(string calldata symbol, uint256 idx)
        external
        view
        returns (address)
    {
        MixConfig storage config = configs[keccak256(abi.encodePacked(symbol))];
        return config.ethOracles[idx];
    }
}
