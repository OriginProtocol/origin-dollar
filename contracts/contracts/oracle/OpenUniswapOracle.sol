pragma solidity 0.5.11;

import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import '@uniswap/lib/contracts/libraries/FixedPoint.sol';

import '@uniswap/v2-periphery/contracts/libraries/UniswapV2OracleLibrary.sol';
import '@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol';
import { IPriceOracle } from "../interfaces/IPriceOracle.sol";


contract OpenUniswapOracle {
    using FixedPoint for *;
    uint public constant PERIOD = 24 hours;

    struct SwapConfig {
      bool ethOnFirst; // whether the weth is the first in pair
      address swap;    // address of the uniswap pair
      uint32  blockTimestampLast;
      uint32  latestBlockTimestampLast;
      uint    priceCumulativeLast;
      uint    latestPriceCumulativeLast;
    }

    mapping (bytes32 => SwapConfig) swaps;

    IPriceOracle public ethPriceOracle; //price oracle for getting the Eth->USD price OPEN oracle..
    address ethTokenAddress;
    bytes32 constant ethHash = keccak256(abi.encodePacked("ETH"));
    uint constant baseUnit = 1e6;

    constructor(address ethPriceOracle_, address ethToken_) {
      ethPriceOracle = IPriceOracle(ethPriceOracle_);
      ethToken = ethToken;

    }

    function register(address factory, address token) public {
        IUniswapV2Pair pair = IUniswapV2Pair(UniswapV2Library.pairFor(factory, token, ethToken));
        string memory symbol = SymboledErc20(token).symbol();
        require(symbol, "The added ERC20 token must have a name");

        SwapConfig storage config = swaps[keccak256(abi.encodePacked(symbol))];

        // is the first token the eth Token
        config.ethOnFirst = pair.token0() == ethToken;
        config.swap = pair;

        // we want everything relative to first
        if (config.ethOnFirst) {
          config.priceCumulativeLast = pair.price1CumulativeLast()
        } else {
          config.priceCumulativeLast = pair.price0CumulativeLast()
        }

        uint112 reserve0;
        uint112 reserve1;
        (reserve0, reserve1, config.blockTimestampLast) = _pair.getReserves();
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
    function updatePriceWindow(bytes32 symbolHash) external {
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
    function updatePriceWindows(bytes32[] memory symbolHashes) external {
      for(uint i = 0; i < symbolHashes.length; i++) {
        updatePriceWindo(symbolHashes[i]);
      }
    }

    // This actually calculate the latest price from outside oracles
    // It's a view but substantially more costly in terms of calculation
    function price(string calldata symbol) external view returns (uint256) {
      bytes32 memory tokenSymbolHash = keccak256(abi.encodePacked(symbol));
      uint ethPrice = ethPriceOracle.price(ethSymbol); // grab the eth price from the open oracle

      if (ethSymbolHash == tokenSymbolHash) {
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
        uint rawUniswapPriceMantissa = priceAverage.decode112with18()

        uint unscaledPriceMantissa = mul(rawUniswapPriceMantissa, ethPrice);

        return unscaledPriceMantissa / baseUnit;
      }
    }
}

contract SymboledERC20 {
  function symbol() public view returns (string memory);
}

