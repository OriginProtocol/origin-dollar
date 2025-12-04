# How to use foundry runlogs?

## 1. Ensure all dependencies are installed
At the root of the repo run:
```bash
forge soldeer install
cd contract
yarn install
```

## 2. Execute runlogs
In the `contracts` folder run:
```bash
forge script Runlogs_2025_08_Mainnet
```
> Note: adjust the year, month and chain accordingly.

This generates 2 files (that are `broadcast-ready` for execution) under `contracts/broadcast`:
- run-latest.json
- run-1755456667783.json (with the timestamp corresponding to the execution time)

## 3. Convert runlogs into Safe-compatible JSON
Since these transactions are meant to be executed from the Safe, it is not possible to use `cast`.

To convert a `broadcast-ready` into a Safe-compatible JSON file, use the forge script: `scripts/runlogs/utils/BroadcastConvertor.sol`. 

In the `contracts` folder run:
```bash
forge script BroadcastConvertor --sig "run(string)" contracts/broadcast/2025_09.sol/146/dry-run/
```
> Note adjust the input accordingly:
> first the path to the run file, but stop at the dry-run folder.

This creates, by default, a file named `run-latest-safe.json` in the same location as the input file, ready to be imported into the Safe UI.

### Timelock targeted ?
If on the script, the address used inside `startBroadcast()` is a `Timelock`:
- the Safe-compatible JSON will be adjusted to target the `scheduleBatch` and `executeBatch` functions on the `Timelock` contract. 
- two files will be generated: `run-latest-schedule` and `run-latest-execute`.


## 4. How generates Safe JSON in just one command?
In the `contracts` folder:
```makefile
make script
or
make script CHAIN=Mainnet
or
make script DATE=2025_08 CHAIN=Mainnet
```

By default it take the current year+month to fetch which runlogs to run. The default chain is Mainnet.
