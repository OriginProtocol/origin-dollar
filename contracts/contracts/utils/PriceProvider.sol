pragma solidity 0.5.17;

/**
 * Price provider to get price for assets. Uses Chainlink aggregators with a
 * fallback oracle.
 *
 * Based on code by Aave:
 * https://github.com/aave/aave-protocol/blob/master/contracts/misc/ChainlinkProxyPriceProvider.sol
 */

import "../governance/Governable.sol";
import "../interfaces/IChainlinkAggregator.sol";
import "../interfaces/IPriceOraclegetter.sol";

contract PriceProvider is Governable {

    event AssetSourceUpdated(address indexed asset, address indexed source);
    event FallbackOracleUpdated(address indexed fallbackOracle);

    mapping(address => IChainlinkAggregator) private assetsSources;
    IPriceOracleGetter private fallbackOracle;

    /** @param _assets The address of the assets
      * @param _sources The address of the source of each asset
      * @param _fallbackOracle The address of the oracle to use if the data of
      *        an aggregator is not consistent
      */
    constructor(address[] memory _assets, address[] memory _sources, address _fallbackOracle) public {
        _setFallbackOracle(_fallbackOracle);
        _setAssetSources(_assets, _sources);
    }

    /**
     * @notice Set the sources for each asset
     * @param _assets Addresses of the assets
     * @param _sources Address of the source of each asset
     * Can only be called by governor.
     */
    function setAssetSources(address[] calldata _assets, address[] calldata _sources) external onlyGovernor {
        _setAssetSources(_assets, _sources);
    }

    /**
     * @notice Internal function to set the sources for each asset
     * @param _assets Addresses of the assets
     * @param _sources Address of the source of each asset
     */
    function _setAssetSources(address[] memory _assets, address[] memory _sources) internal {
        require(_assets.length == _sources.length, "INCONSISTENT_PARAMS_LENGTH");
        for (uint256 i = 0; i < _assets.length; i++) {
            assetsSources[_assets[i]] = IChainlinkAggregator(_sources[i]);
            emit AssetSourceUpdated(_assets[i], _sources[i]);
        }
    }

    /**
     * @notice Set the fallback oracle address
     * @param _fallbackOracle Address of the fallback oracle
     * Can only be called by governor.
     */
    function setFallbackOracle(address _fallbackOracle) external onlyGovernor {
        _setFallbackOracle(_fallbackOracle);
    }

    /**
     * @notice Internal function set fallback oracle address
     * @param _fallbackOracle Address of the fallback oracle
     */
    function _setFallbackOracle(address _fallbackOracle) internal {
        fallbackOracle = IPriceOracleGetter(_fallbackOracle);
        emit FallbackOracleUpdated(_fallbackOracle);
    }

    /**
     * @notice Get an asset price by address
     * @param _asset Address of the asset
     */
    function getAssetPrice(address _asset) public view returns (uint256) {
        // TODO handle _asset = eth, one eth is one eth
         IChainlinkAggregator source = assetsSources[_asset];
        // If there is no registered source for the asset, call the fallbackOracle
        if (address(source) == address(0)) {
            return IPriceOracleGetter(fallbackOracle).getAssetPrice(_asset);
        } else {
            int256 _price = IChainlinkAggregator(source).latestAnswer();
            if (_price > 0) {
                return uint256(_price);
            } else {
                return IPriceOracleGetter(fallbackOracle).getAssetPrice(_asset);
            }
        }
    }

    /**
     * @notice Get a list of price from a list of asset addresses
     * @param _assets List asset addresses
     */
    function getAssetPrices(address[] calldata _assets) external view returns (uint256[] memory) {
        uint256[] memory prices = new uint256[](_assets.length);
        for (uint256 i = 0; i < _assets.length; i++) {
            prices[i] = getAssetPrice(_assets[i]);
        }
        return prices;
    }

    /**
     * @notice Get address for the source of an asset
     * @param _asset Address of the asset
     */
    function getSourceOfAsset(address _asset) external view returns (address) {
        return address(assetsSources[_asset]);
    }

    /**
     * @notice Get address of fallback oracle
     */
    function getFallbackOracle() external view returns (address) {
        return address(fallbackOracle);
    }
}
