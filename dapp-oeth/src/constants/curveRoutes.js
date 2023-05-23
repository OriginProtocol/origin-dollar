const { BigNumber } = require('ethers')

/*
- Mainnet Curve registry contract: https://etherscan.io/address/0x99a58482BD75cbab83b27EC03CA68fF489b5788f#code
- Vyper implementation for multiple amount exchanges

```
  def get_exchange_multiple_amount

  @notice Get the current number the final output tokens received in an exchange
  @dev Routing and swap params must be determined off-chain. This
       functionality is designed for gas efficiency over ease-of-use.
  @param _route Array of [initial token, pool, token, pool, token, ...]
                The array is iterated until a pool address of 0x00, then the last
                given token is transferred to `_receiver`
  @param _swap_params Multidimensional array of [i, j, swap type] where i and j are the correct
                      values for the n'th pool in `_route`. The swap type should be
                      1 for a stableswap `exchange`,
                      2 for stableswap `exchange_underlying`,
                      3 for a cryptoswap `exchange`,
                      4 for a cryptoswap `exchange_underlying`,
                      5 for factory metapools with lending base pool `exchange_underlying`,
                      6 for factory crypto-meta pools underlying exchange (`exchange` method in zap),
                      7-11 for wrapped coin (underlying for lending pool) -> LP token "exchange" (actually `add_liquidity`),
                      12-14 for LP token -> wrapped coin (underlying for lending or fake pool) "exchange" (actually `remove_liquidity_one_coin`)
                      15 for WETH -> ETH "exchange" (actually deposit/withdraw)
  @param _amount The amount of `_route[0]` token to be sent.
  @param _pools Array of pools for swaps via zap contracts. This parameter is only needed for
                Polygon meta-factories underlying swaps.
  @return Expected amount of the final output token
```
*/

const curveRoutes = {
  // stETH -> OETH Mint
  '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84': {
    '0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3': {
      routes: [
        '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        '0x21E27a5E5513D6e65C4f830167390997aA84843a',
        '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        '0x94B17476A93b3262d87B9a326965D1E91f9c13E7',
        '0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
      ],
      swapParams: [
        // 1 for a stableswap `exchange`,
        [BigNumber.from(1), BigNumber.from(0), BigNumber.from(1)],
        // 1 for a stableswap `exchange`,
        [BigNumber.from(0), BigNumber.from(1), BigNumber.from(1)],
        [BigNumber.from(0), BigNumber.from(0), BigNumber.from(0)],
        [BigNumber.from(0), BigNumber.from(0), BigNumber.from(0)],
      ],
    },
  },
  // WETH -> OETH Mint
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': {
    '0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3': {
      routes: [
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        '0x94B17476A93b3262d87B9a326965D1E91f9c13E7',
        '0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
      ],
      swapParams: [
        // 15 for WETH -> ETH "exchange" (actually deposit/withdraw)
        [BigNumber.from(0), BigNumber.from(0), BigNumber.from(15)],
        // 1 for a stableswap `exchange`,
        [BigNumber.from(0), BigNumber.from(1), BigNumber.from(1)],
        [BigNumber.from(0), BigNumber.from(0), BigNumber.from(0)],
        [BigNumber.from(0), BigNumber.from(0), BigNumber.from(0)],
      ],
    },
  },
  // rETH -> OETH Mint
  '0xae78736Cd615f374D3085123A210448E74Fc6393': {
    '0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3': {
      routes: [
        '0xae78736Cd615f374D3085123A210448E74Fc6393',
        '0x0f3159811670c117c372428D4E69AC32325e4D0F',
        '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        '0x94B17476A93b3262d87B9a326965D1E91f9c13E7',
        '0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
      ],
      swapParams: [
        // 3 for a cryptoswap `exchange`,
        [BigNumber.from(1), BigNumber.from(0), BigNumber.from(3)],
        // 1 for a stableswap `exchange`,
        [BigNumber.from(0), BigNumber.from(1), BigNumber.from(1)],
        [BigNumber.from(0), BigNumber.from(0), BigNumber.from(0)],
        [BigNumber.from(0), BigNumber.from(0), BigNumber.from(0)],
      ],
    },
  },
  // frxETH -> OETH Mint
  '0x5e8422345238f34275888049021821e8e08caa1f': {
    '0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3': {
      routes: [
        '0x5E8422345238F34275888049021821E8E08CAa1f',
        '0xa1F8A6807c402E4A15ef4EBa36528A3FED24E577',
        '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        '0x94B17476A93b3262d87B9a326965D1E91f9c13E7',
        '0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
      ],
      swapParams: [
        // 1 for a stableswap `exchange`,
        [BigNumber.from(1), BigNumber.from(0), BigNumber.from(1)],
        // 1 for a stableswap `exchange`,
        [BigNumber.from(0), BigNumber.from(1), BigNumber.from(1)],
        [BigNumber.from(0), BigNumber.from(0), BigNumber.from(0)],
        [BigNumber.from(0), BigNumber.from(0), BigNumber.from(0)],
      ],
    },
  },
  // OETH Redeem
  '0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3': {
    // OETH -> frxETH
    '0x5e8422345238f34275888049021821e8e08caa1f': {
      routes: [
        '0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3',
        '0x94B17476A93b3262d87B9a326965D1E91f9c13E7',
        '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        '0xa1F8A6807c402E4A15ef4EBa36528A3FED24E577',
        '0x5E8422345238F34275888049021821E8E08CAa1f',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
      ],
      swapParams: [
        // 1 for a stableswap `exchange`,
        [BigNumber.from(1), BigNumber.from(0), BigNumber.from(1)],
        // 1 for a stableswap `exchange`,
        [BigNumber.from(0), BigNumber.from(1), BigNumber.from(1)],
        [BigNumber.from(0), BigNumber.from(0), BigNumber.from(0)],
        [BigNumber.from(0), BigNumber.from(0), BigNumber.from(0)],
      ],
    },
    // OETH -> WETH
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': {
      routes: [
        '0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3',
        '0x94B17476A93b3262d87B9a326965D1E91f9c13E7',
        '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
      ],
      swapParams: [
        // 1 for a stableswap `exchange`,
        [BigNumber.from(1), BigNumber.from(0), BigNumber.from(1)],
        // 15 for WETH -> ETH "exchange" (actually deposit/withdraw)
        [BigNumber.from(0), BigNumber.from(0), BigNumber.from(15)],
        [BigNumber.from(0), BigNumber.from(0), BigNumber.from(0)],
        [BigNumber.from(0), BigNumber.from(0), BigNumber.from(0)],
      ],
    },
    // OETH -> rETH
    '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84': {
      routes: [
        '0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3',
        '0x94B17476A93b3262d87B9a326965D1E91f9c13E7',
        '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        '0x0f3159811670c117c372428D4E69AC32325e4D0F',
        '0xae78736Cd615f374D3085123A210448E74Fc6393',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
      ],
      swapParams: [
        // 1 for a stableswap `exchange`,
        [BigNumber.from(1), BigNumber.from(0), BigNumber.from(1)],
        // 3 for a cryptoswap `exchange`,
        [BigNumber.from(0), BigNumber.from(1), BigNumber.from(3)],
        [BigNumber.from(0), BigNumber.from(0), BigNumber.from(0)],
        [BigNumber.from(0), BigNumber.from(0), BigNumber.from(0)],
      ],
    },
    // OETH -> stETH
    '0xae78736Cd615f374D3085123A210448E74Fc6393': {
      routes: [
        '0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3',
        '0x94B17476A93b3262d87B9a326965D1E91f9c13E7',
        '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        '0x21E27a5E5513D6e65C4f830167390997aA84843a',
        '0xae78736Cd615f374D3085123A210448E74Fc6393',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
      ],
      swapParams: [
        // 1 for a stableswap `exchange`,
        [BigNumber.from(1), BigNumber.from(0), BigNumber.from(1)],
        // 1 for a stableswap `exchange`,
        [BigNumber.from(0), BigNumber.from(1), BigNumber.from(1)],
        [BigNumber.from(0), BigNumber.from(0), BigNumber.from(0)],
        [BigNumber.from(0), BigNumber.from(0), BigNumber.from(0)],
      ],
    },
  },
}

module.exports = curveRoutes
