// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/chainlink/AggregatorV3Interface.sol";
import { OracleRouterBase } from "./OracleRouterBase.sol";
import { StableMath } from "../utils/StableMath.sol";

// @notice Oracle Router that denominates all prices in ETH
contract OETHOracleRouter is OracleRouterBase {
    using StableMath for uint256;

    address public immutable auraPriceFeed;

    constructor(address _auraPriceFeed) {
        auraPriceFeed = _auraPriceFeed;
    }

    /**
     * @notice Returns the total price in 18 digit units for a given asset.
     *         This implementation does not (!) do range checks as the
     *         parent OracleRouter does.
     * @param asset address of the asset
     * @return uint256 unit price for 1 asset unit, in 18 decimal fixed
     */
    function price(address asset)
        external
        view
        virtual
        override
        returns (uint256)
    {
        (address _feed, uint256 maxStaleness) = feedMetadata(asset);
        if (_feed == FIXED_PRICE) {
            return 1e18;
        }
        require(_feed != address(0), "Asset not available");

        // slither-disable-next-line unused-return
        (, int256 _iprice, , uint256 updatedAt, ) = AggregatorV3Interface(_feed)
            .latestRoundData();

        require(
            updatedAt + maxStaleness >= block.timestamp,
            "Oracle price too old"
        );

        uint8 decimals = getDecimals(_feed);
        uint256 _price = uint256(_iprice).scaleBy(18, decimals);
        return _price;
    }

    /**
     * @dev The price feed contract to use for a particular asset along with
     *      maximum data staleness
     * @param asset address of the asset
     * @return feedAddress address of the price feed for the asset
     * @return maxStaleness maximum acceptable data staleness duration
     */
    function feedMetadata(address asset)
        internal
        view
        virtual
        override
        returns (address feedAddress, uint256 maxStaleness)
    {
        if (asset == 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2) {
            // FIXED_PRICE: WETH/ETH
            feedAddress = FIXED_PRICE;
            maxStaleness = 0;
        } else if (asset == 0x5E8422345238F34275888049021821E8E08CAa1f) {
            // frxETH/ETH
            feedAddress = 0xC58F3385FBc1C8AD2c0C9a061D7c13b141D7A5Df;
            maxStaleness = 18 hours + STALENESS_BUFFER;
        } else if (asset == 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84) {
            // https://data.chain.link/ethereum/mainnet/crypto-eth/steth-eth
            // Chainlink: stETH/ETH
            feedAddress = 0x86392dC19c0b719886221c78AB11eb8Cf5c52812;
            maxStaleness = 1 days + STALENESS_BUFFER;
        } else if (asset == 0xae78736Cd615f374D3085123A210448E74Fc6393) {
            // https://data.chain.link/ethereum/mainnet/crypto-eth/reth-eth
            // Chainlink: rETH/ETH
            feedAddress = 0x536218f9E9Eb48863970252233c8F271f554C2d0;
            maxStaleness = 1 days + STALENESS_BUFFER;
        } else if (asset == 0xD533a949740bb3306d119CC777fa900bA034cd52) {
            // https://data.chain.link/ethereum/mainnet/crypto-eth/crv-eth
            // Chainlink: CRV/ETH
            feedAddress = 0x8a12Be339B0cD1829b91Adc01977caa5E9ac121e;
            maxStaleness = 1 days + STALENESS_BUFFER;
        } else if (asset == 0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B) {
            // https://data.chain.link/ethereum/mainnet/crypto-eth/cvx-eth
            // Chainlink: CVX/ETH
            feedAddress = 0xC9CbF687f43176B302F03f5e58470b77D07c61c6;
            maxStaleness = 1 days + STALENESS_BUFFER;
        } else if (asset == 0xBe9895146f7AF43049ca1c1AE358B0541Ea49704) {
            // https://data.chain.link/ethereum/mainnet/crypto-eth/cbeth-eth
            // Chainlink: cbETH/ETH
            feedAddress = 0xF017fcB346A1885194689bA23Eff2fE6fA5C483b;
            maxStaleness = 1 days + STALENESS_BUFFER;
        } else if (asset == 0xba100000625a3754423978a60c9317c58a424e3D) {
            // https://data.chain.link/ethereum/mainnet/crypto-eth/bal-eth
            // Chainlink: BAL/ETH
            feedAddress = 0xC1438AA3823A6Ba0C159CfA8D98dF5A994bA120b;
            maxStaleness = 1 days + STALENESS_BUFFER;
        } else if (asset == 0xC0c293ce456fF0ED870ADd98a0828Dd4d2903DBF) {
            // AURA/ETH
            feedAddress = auraPriceFeed;
            maxStaleness = 0;
        } else {
            revert("Asset not available");
        }
    }
}
