pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

/**
 * @title OUSD OpenUniswapOracle Contract
 * @author Origin Protocol Inc
 */
import "./UniswapLib.sol";
import { IPriceOracle } from "../interfaces/IPriceOracle.sol";
import { IEthUsdOracle } from "../interfaces/IEthUsdOracle.sol";
import {
    InitializableGovernable
} from "../governance/InitializableGovernable.sol";

contract OpenUniswapOracle is IEthUsdOracle, InitializableGovernable {
    using FixedPoint for *;
    uint256 public constant PERIOD = 2 minutes;

    struct SwapConfig {
        bool ethOnFirst; // whether the weth is the first in pair
        address swap; // address of the uniswap pair
        uint256 blockTimestampLast;
        uint256 latestBlockTimestampLast;
        uint256 priceCumulativeLast;
        uint256 latestPriceCumulativeLast;
        uint256 baseUnit;
    }

    mapping(bytes32 => SwapConfig) swaps;

    IPriceOracle public ethPriceOracle; //price oracle for getting the Eth->USD price OPEN oracle..
    address ethToken;
    string constant ethSymbol = "ETH";
    bytes32 constant ethHash = keccak256(abi.encodePacked(ethSymbol));

    constructor(address ethPriceOracle_, address ethToken_) public {
        ethPriceOracle = IPriceOracle(ethPriceOracle_);
        ethToken = ethToken_;
    }

    function registerEthPriceOracle(address ethPriceOracle_)
        public
        onlyGovernor
    {
        ethPriceOracle = IPriceOracle(ethPriceOracle_);
    }

    function registerPair(address pair_) public onlyGovernor {
        IUniswapV2Pair pair = IUniswapV2Pair(pair_);
        address token;
        bool ethOnFirst = true;
        if (pair.token0() == ethToken) {
            token = pair.token1();
        } else {
            token = pair.token0();
            ethOnFirst = false;
        }
        SymboledERC20 st = SymboledERC20(token);
        string memory symbol = st.symbol();
        SwapConfig storage config = swaps[keccak256(abi.encodePacked(symbol))];

        // is the first token the eth Token
        config.ethOnFirst = ethOnFirst;
        config.swap = pair_;
        config.baseUnit = uint256(10)**st.decimals();

        // we want everything relative to first
        config.priceCumulativeLast = currentCumulativePrice(config);
        config.blockTimestampLast = block.timestamp;
        config.latestBlockTimestampLast = config.blockTimestampLast;
        config.latestPriceCumulativeLast = config.priceCumulativeLast;
    }

    function currentCumulativePrice(SwapConfig storage config)
        internal
        view
        returns (uint256)
    {
        (
            uint256 cumulativePrice0,
            uint256 cumulativePrice1,

        ) = UniswapV2OracleLibrary.currentCumulativePrices(config.swap);
        if (config.ethOnFirst) {
            return cumulativePrice1;
        } else {
            return cumulativePrice0;
        }
    }

    // This needs to be called regularly to update the pricing window
    function pokePriceWindow(SwapConfig storage config)
        internal
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        uint256 priceCumulative = currentCumulativePrice(config);

        uint256 timeElapsed = block.timestamp - config.latestBlockTimestampLast;

        if (timeElapsed >= PERIOD) {
            config.blockTimestampLast = config.latestBlockTimestampLast;
            config.priceCumulativeLast = config.latestPriceCumulativeLast;

            config.latestBlockTimestampLast = block.timestamp;
            config.latestPriceCumulativeLast = priceCumulative;
        }

        return (
            priceCumulative,
            config.priceCumulativeLast,
            config.blockTimestampLast
        );
    }

    // update to the latest window
    function updatePriceWindows(bytes32[] calldata symbolHashes) external {
        for (uint256 i = 0; i < symbolHashes.length; i++) {
            SwapConfig storage config = swaps[symbolHashes[i]];
            pokePriceWindow(config);
        }
    }

    //eth to usd price
    //precision from open is 6
    function ethUsdPrice() external view returns (uint256) {
        return ethPriceOracle.price(ethSymbol); // grab the eth price from the open oracle
    }

    //tok to Usd price
    //Note: for USDC and USDT this is fixed to 1 on openoracle
    // precision here is 8
    function tokUsdPrice(string calldata symbol)
        external
        view
        returns (uint256)
    {
        return ethPriceOracle.price(symbol); // grab the eth price from the open oracle
    }

    //tok to Eth price
    function tokEthPrice(string calldata symbol) external returns (uint256) {
        bytes32 tokenSymbolHash = keccak256(abi.encodePacked(symbol));
        SwapConfig storage config = swaps[tokenSymbolHash];
        (
            uint256 priceCumulative,
            uint256 priceCumulativeLast,
            uint256 blockTimestampLast
        ) = pokePriceWindow(config);

        require(
            priceCumulative > priceCumulativeLast,
            "There has been no cumulative change"
        );
        // This should be impossible, but better safe than sorry
        require(
            block.timestamp > blockTimestampLast,
            "now must come after before"
        );
        uint256 timeElapsed = block.timestamp - blockTimestampLast;

        // overflow is desired, casting never truncates
        // cumulative price is in (uq112x112 price * seconds) units so we simply wrap it after division by time elapsed
        FixedPoint.uq112x112 memory priceAverage = FixedPoint.uq112x112(
            uint224(
                (priceCumulative - config.priceCumulativeLast) / timeElapsed
            )
        );
        uint256 rawUniswapPriceMantissa = priceAverage.decode112with18();

        // Divide by 1e28 because it's decoded to 18 and then we want 8 decimal places of precision out so 18+18-8
        return mul(rawUniswapPriceMantissa, config.baseUnit) / 1e28;
    }

    // This actually calculate the latest price from outside oracles
    // It's a view but substantially more costly in terms of calculation
    function price(string calldata symbol) external view returns (uint256) {
        bytes32 tokenSymbolHash = keccak256(abi.encodePacked(symbol));
        uint256 ethPrice = ethPriceOracle.price(ethSymbol); // grab the eth price from the open oracle

        if (ethHash == tokenSymbolHash) {
            return ethPrice;
        } else {
            SwapConfig storage config = swaps[tokenSymbolHash];
            uint256 priceCumulative = currentCumulativePrice(config);

            require(
                priceCumulative > config.priceCumulativeLast,
                "There has been no cumulative change"
            );
            // This should be impossible, but better safe than sorry
            require(
                block.timestamp > config.blockTimestampLast,
                "now must come after before"
            );
            uint256 timeElapsed = block.timestamp - config.blockTimestampLast;

            // overflow is desired, casting never truncates
            // cumulative price is in (uq112x112 price * seconds) units so we simply wrap it after division by time elapsed
            FixedPoint.uq112x112 memory priceAverage = FixedPoint.uq112x112(
                uint224(
                    (priceCumulative - config.priceCumulativeLast) / timeElapsed
                )
            );
            uint256 rawUniswapPriceMantissa = priceAverage.decode112with18();

            uint256 unscaledPriceMantissa = mul(
                rawUniswapPriceMantissa,
                ethPrice
            );

            return mul(unscaledPriceMantissa, config.baseUnit) / 1e36;
        }
    }

    function debugPrice(string calldata symbol)
        external
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        bytes32 tokenSymbolHash = keccak256(abi.encodePacked(symbol));
        uint256 ethPrice = ethPriceOracle.price(ethSymbol); // grab the eth price from the open oracle

        SwapConfig storage config = swaps[tokenSymbolHash];
        uint256 priceCumulative = currentCumulativePrice(config);

        require(
            priceCumulative > config.priceCumulativeLast,
            "There has been no cumulative change"
        );
        // This should be impossible, but better safe than sorry
        require(
            block.timestamp > config.blockTimestampLast,
            "now must come after before"
        );
        uint256 timeElapsed = block.timestamp - config.blockTimestampLast;
        FixedPoint.uq112x112 memory priceAverage = FixedPoint.uq112x112(
            uint224(
                (priceCumulative - config.priceCumulativeLast) / timeElapsed
            )
        );
        uint256 rawUniswapPriceMantissa = priceAverage.decode112with18();

        uint256 unscaledPriceMantissa = mul(rawUniswapPriceMantissa, ethPrice);

        // overflow is desired, casting never truncates
        // cumulative price is in (uq112x112 price * seconds) units so we simply wrap it after division by time elapsed

        return (
            priceCumulative - config.priceCumulativeLast,
            timeElapsed,
            rawUniswapPriceMantissa,
            unscaledPriceMantissa
        );
    }

    function openPrice(string calldata symbol) external view returns (uint256) {
        return ethPriceOracle.price(symbol);
    }

    function getSwapConfig(string calldata symbol)
        external
        view
        returns (SwapConfig memory)
    {
        bytes32 tokenSymbolHash = keccak256(abi.encodePacked(symbol));
        return swaps[tokenSymbolHash];
    }

    /// @dev Overflow proof multiplication
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) return 0;
        uint256 c = a * b;
        require(c / a == b, "multiplication overflow");
        return c;
    }
}

contract SymboledERC20 {
    function symbol() public view returns (string memory);

    function decimals() public view returns (uint8);
}
