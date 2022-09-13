# Brownie project to to help running / validating various contract states

## Install brownie

https://eth-brownie.readthedocs.io/en/stable/index.html

pip install eth-brownie

## Usage

Set etherscan env variable token
export ETHERSCAN_TOKEN={TOKEN_VALUE}
export WEB3_INFURA_PROJECT_ID={API_KEY}

Start console and connect to forked hardhat:
`brownie console --network hardhat`

Or connect to a direct forked of mainnet: 

`brownie console --network mainnet-fork`

Or run brownie scripts:
`brownie run spell_apy --network hardhat`

### (OUSD/Generalized) Metastrategy usage

#### Configuration

OUSD & Generalized metastrategy both have their corresponding deploy scripts that need to be
have `forceDeploy` set to `true`. Node will emit addresses of the deployed OUSD & FRAX strategy
in console. Copy those and set them in the `brownie/metastrategy.py` configuration section under
`OUSD_META_STRATEGY` & `FRAX_STRATEGY` variables. Also set which one of those you want to act as a
default USDT asset strategy under `USDT_DEFAULT_META_STRATEGY`. This way minting (using USDT asset) will
directly fund configured strategy.

(Note most of the configuration section shall be deleted once these strategies are deployed to mainnet.) 

#### Notes

Once brownie console is started run `from metastrategy import *` to import helper functions
and funds for easier testing of metastrategy

Inspect available functions under `brownie/metastrategy.py` and also `brownie/world.py`.

For some ideas how to create test cases check out `brownie/scripts/metapool/*`
