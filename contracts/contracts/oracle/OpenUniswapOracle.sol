pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "./UniswapLib.sol";
import { IPriceOracle } from "../interfaces/IPriceOracle.sol";



contract OpenUniswapOracle {
    using FixedPoint for *;
    uint public constant PERIOD = 24 hours;

    struct SwapConfig {
      bool ethOnFirst; // whether the weth is the first in pair
      address swap;    // address of the uniswap pair
      uint   blockTimestampLast;
      uint   latestBlockTimestampLast;
      uint   priceCumulativeLast;
      uint   latestPriceCumulativeLast;
    }

    mapping (bytes32 => SwapConfig) swaps;

    IPriceOracle public ethPriceOracle; //price oracle for getting the Eth->USD price OPEN oracle..
    address ethToken;
    string constant ethSymbol = "ETH";
    bytes32 constant ethHash = keccak256(abi.encodePacked(ethSymbol));
    uint constant baseUnit = 1e6;

    address public admin;

    constructor(address ethPriceOracle_, address ethToken_) public {
      ethPriceOracle = IPriceOracle(ethPriceOracle_);
      ethToken = ethToken_;
      admin = msg.sender;
    }

    function registerPair(address pair_) public {
        require(admin == msg.sender, "Only the admin can register a new pair");
        IUniswapV2Pair pair = IUniswapV2Pair(pair_);
        address token;
        bool ethOnFirst = true;
        if (pair.token0() == ethToken) {
          token = pair.token1();
        } else {
          token = pair.token0();
          ethOnFirst = false;
        }
        string memory symbol = SymboledERC20(token).symbol();
        SwapConfig storage config = swaps[keccak256(abi.encodePacked(symbol))];

        // is the first token the eth Token
        config.ethOnFirst = ethOnFirst;
        config.swap = pair_;

        // we want everything relative to first
        if (config.ethOnFirst) {
          config.priceCumulativeLast = pair.price1CumulativeLast();
        } else {
          config.priceCumulativeLast = pair.price0CumulativeLast();
        }

        uint112 reserve0;
        uint112 reserve1;
        (reserve0, reserve1, config.blockTimestampLast) = pair.getReserves();
        require(reserve0 != 0 && reserve1 != 0, 'ExampleOracleSimple: NO_RESERVES'); // ensure that there's liquidity in the pair
    }

    function currentCumulativePrice(SwapConfig storage config) internal view returns (uint) {
        (uint cumulativePrice0, uint cumulativePrice1,) = UniswapV2OracleLibrary.currentCumulativePrices(config.swap);
        if (config.ethOnFirst) {
            return cumulativePrice1;
        } else {
            return cumulativePrice0;
        }
    }

    // This needs to be called everyday to update the pricing window
    function updatePriceWindow(bytes32 symbolHash) internal {
        SwapConfig storage config = swaps[symbolHash];

        uint priceCumulative = currentCumulativePrice(config);

        uint timeElapsed = block.timestamp - config.latestBlockTimestampLast;

        if (timeElapsed  >= PERIOD) {
          config.blockTimestampLast = config.latestBlockTimestampLast;
          config.priceCumulativeLast = config.latestPriceCumulativeLast;

          config.latestBlockTimestampLast = block.timestamp;
          config.latestPriceCumulativeLast = priceCumulative;
        }
    }


    // update to the latest window
    function updatePriceWindows(bytes32[] calldata symbolHashes) external {
      for(uint i = 0; i < symbolHashes.length; i++) {
        updatePriceWindow(symbolHashes[i]);
      }
    }

    // This actually calculate the latest price from outside oracles
    // It's a view but substantially more costly in terms of calculation
    function price(string calldata symbol) external view returns (uint256) {
      bytes32 tokenSymbolHash = keccak256(abi.encodePacked(symbol));
      uint ethPrice = ethPriceOracle.price(ethSymbol); // grab the eth price from the open oracle

      if (ethHash == tokenSymbolHash) {
        return ethPrice;
      } else {
        SwapConfig storage config = swaps[tokenSymbolHash];
        uint priceCumulative = currentCumulativePrice(config);

        // This should be impossible, but better safe than sorry
        require(block.timestamp > config.blockTimestampLast, "now must come after before");
        uint timeElapsed = block.timestamp - config.blockTimestampLast;

        // overflow is desired, casting never truncates
        // cumulative price is in (uq112x112 price * seconds) units so we simply wrap it after division by time elapsed
        FixedPoint.uq112x112 memory priceAverage = FixedPoint.uq112x112(uint224((priceCumulative - config.priceCumulativeLast) / timeElapsed));
        uint rawUniswapPriceMantissa = priceAverage.decode112with18();

        //uint unscaledPriceMantissa = rawUniswapPriceMantissa;
        uint unscaledPriceMantissa = mul(rawUniswapPriceMantissa, ethPrice);

        return mul(unscaledPriceMantissa, baseUnit) / 1e18 / 1e18;
      }
    }

    function openPrice(string calldata symbol) external view returns (uint256) {
      return ethPriceOracle.price(symbol);
    }

    function getSwapConfig(string calldata symbol) external view returns (SwapConfig memory) {
      bytes32 tokenSymbolHash = keccak256(abi.encodePacked(symbol));
      return swaps[tokenSymbolHash];
    }

    /// @dev Overflow proof multiplication
    function mul(uint a, uint b) internal pure returns (uint) {
        if (a == 0) return 0;
        uint c = a * b;
        require(c / a == b, "multiplication overflow");
        return c;
    }
}

contract SymboledERC20 {
  function symbol() public view returns (string memory);
}

