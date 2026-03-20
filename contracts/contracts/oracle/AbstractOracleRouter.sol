// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../interfaces/chainlink/AggregatorV3Interface.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { Helpers } from "../utils/Helpers.sol";
import { StableMath } from "../utils/StableMath.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

// @notice Abstract functionality that is shared between various Oracle Routers
abstract contract AbstractOracleRouter is IOracle {
    using StableMath for uint256;
    using SafeCast for int256;

    uint256 internal constant MIN_DRIFT = 0.7e18;
    uint256 internal constant MAX_DRIFT = 1.3e18;
    address internal constant FIXED_PRICE =
        0x0000000000000000000000000000000000000001;
    // Maximum allowed staleness buffer above normal Oracle maximum staleness
    uint256 internal constant STALENESS_BUFFER = 1 days;
    mapping(address => uint8) internal decimalsCache;

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
        returns (address feedAddress, uint256 maxStaleness);

    /**
     * @notice Returns the total price in 18 digit unit for a given asset.
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
        require(_feed != address(0), "Asset not available");
        require(_feed != FIXED_PRICE, "Fixed price feeds not supported");

        // slither-disable-next-line unused-return
        (, int256 _iprice, , uint256 updatedAt, ) = AggregatorV3Interface(_feed)
            .latestRoundData();

        require(
            updatedAt + maxStaleness >= block.timestamp,
            "Oracle price too old"
        );

        uint8 decimals = getDecimals(_feed);

        uint256 _price = _iprice.toUint256().scaleBy(18, decimals);
        if (shouldBePegged(asset)) {
            require(_price <= MAX_DRIFT, "Oracle: Price exceeds max");
            require(_price >= MIN_DRIFT, "Oracle: Price under min");
        }
        return _price;
    }

    function getDecimals(address _feed) internal view virtual returns (uint8) {
        uint8 decimals = decimalsCache[_feed];
        require(decimals > 0, "Oracle: Decimals not cached");
        return decimals;
    }

    /**
     * @notice Before an asset/feed price is fetches for the first time the
     *         decimals need to be cached. This is a gas optimization
     * @param asset address of the asset
     * @return uint8 corresponding asset decimals
     */
    function cacheDecimals(address asset) external returns (uint8) {
        (address _feed, ) = feedMetadata(asset);
        require(_feed != address(0), "Asset not available");
        require(_feed != FIXED_PRICE, "Fixed price feeds not supported");

        uint8 decimals = AggregatorV3Interface(_feed).decimals();
        decimalsCache[_feed] = decimals;
        return decimals;
    }

    function shouldBePegged(address _asset) internal view returns (bool) {
        string memory symbol = Helpers.getSymbol(_asset);
        bytes32 symbolHash = keccak256(abi.encodePacked(symbol));
        return
            symbolHash == keccak256(abi.encodePacked("DAI")) ||
            symbolHash == keccak256(abi.encodePacked("USDC")) ||
            symbolHash == keccak256(abi.encodePacked("USDT"));
    }
}
