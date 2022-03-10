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
