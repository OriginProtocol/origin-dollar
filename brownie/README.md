# Brownie project to help running / validating various contract states

## Install brownie

https://eth-brownie.readthedocs.io/en/stable/index.html

Brownie does not work with Python 3.11 so make sure you have Python 3.9 installed as that is what the other developers are using.

```
python3.9 -m pip install eth-brownie
```

You also need to install Ganache globally:

```
npm install ganache --global
```

## Create a Virtual Environment

```
cd brownie
python3.9 -m venv env-brownie
```

This will create a `env-brownie` folder with all the dependencies installed.


## (Optional) Install brownie supporting returndata debug tx info

The current release of brownie 1.19.3 has a bug where it doesn't include returndata transaction trace information. I've created a PR but there is no activity in the brownie repo and doesn't look like it will get reviewed: https://github.com/eth-brownie/brownie/pull/1715. 

To install an alternate version with a fix: 

```
// checkout fixed brownie and switch to the branch with a fix
git clone git@github.com:sparrowDom/brownie.git brownie
cd brownie
git checkout sparrowDom/fixReturnData

// activate virtual environment if using one
source ./env-brownie/bin/activate

// install a local version of the brownie with a fix
pip install -e /path/to/github/repo/brownie

```


## Usage

Set [Etherscan](https://docs.etherscan.io/) and [Infura](https://docs.infura.io/getting-started) env variables

```
export ETHERSCAN_TOKEN={TOKEN_VALUE}
export WEB3_INFURA_PROJECT_ID={API_KEY}
export ONEINCH_SUBDOMAIN={JUST_THE_SUBDOMAIN_PART_OF_THE_SWAP_API}
```

Activate the virtual environment:

```
source ./env-brownie/bin/activate
```

Start console and connect to a forked hardhat:

```
brownie console --network hardhat
```

Or connect to a direct fork of mainnet:

```
brownie console --network mainnet-fork
```

Or run brownie scripts:

```
brownie run spell_apy --network hardhat
```

### For strategist runs (IMPORTANT!)
Do not use brownie's mainnet fork (`brownie console --network mainnet-fork`) for running strategist scripts. Brownie internally uses a node engine that will produce faulty results. Rather run a hardhat node with null or latest (latest -30 blocks) BLOCK_NUMBER in `contracts/.env` file and attach a brownie console to it (brownie console --network hardhat).

### (OUSD/Generalized) Metastrategy usage

#### Configuration

OUSD & Generalized metastrategy both have their corresponding deploy scripts that need to
have `forceDeploy` set to `true`. The node will emit addresses of the deployed OUSD & FRAX strategy
in the console. Copy those and set them in the `brownie/metastrategy.py` configuration section under
`OUSD_META_STRATEGY` & `FRAX_STRATEGY` variables. Also, set which one of those you want to act as a
default USDT asset strategy under `USDT_DEFAULT_META_STRATEGY`. This way minting (using USDT asset) will
directly fund configured strategy.

(Note most of the configuration section shall be deleted once these strategies are deployed to mainnet.)

#### Notes

Once Brownie console is started run `from metastrategy import *` to import helper functions
and funds for easier testing of metastrategy

Inspect available functions under `brownie/metastrategy.py` and also `brownie/world.py`.

For some ideas on how to create test cases check out `brownie/scripts/metapool/*`

### Miscellaneous

If using Brownie console calls to your node timeout a lot you can reconnect to the provider with a higher timeout. E.g. connecting to localhost with 120 seconds timeout:

```
web3.connect('http://127.0.0.1:8545', 120)
```

### Perform Vault Collateral Swaps

Set the [CoinMarketCap](https://coinmarketcap.com/api/documentation/v1/) API key:

```
export CMC_API_KEY={API_KEY}
```

Start a brownie console

```
brownie console --network hardhat
```

Build a swap transaction:

```
# import collateral Swap script
from collateralSwap import *

# from_token, to_token, from_token_amount, slippage, allow_partial_fill
build_swap_tx(WETH, FRXETH, 300 * 10**18, 1, False)
```
