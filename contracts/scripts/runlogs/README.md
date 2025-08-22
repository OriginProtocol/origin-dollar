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

To convert a `broadcast-ready` into a Safe-compatible JSON file, use the script: `scripts/runlogs/broadcast_convertor.py`. 

In the `contracts` folder run:
```bash
python3 scripts/runlogs/broadcast_convertor.py -i broadcast/2025_08.s.sol/1/dry-run/run-latest.json
```
> Note adjust the input accordingly.

This creates, by default, a file named `run-latest-safe.json` in the same location as the input file, ready to be imported into the Safe UI.


## 4. Options for `broadcast_convertor.py`
```
  -h, --help            show this help message and exit
  --input, -i INPUT     Path to input JSON file (MANDATORY)
  --output, -o OUTPUT   Path to output JSON file (default: adds -safe to input filename)
  --suffix SUFFIX       Suffix to add to filename (default: safe)
  --display, -d DISPLAY Display the output JSON in the console
```

## 5. How generates Safe JSON in just one command?
In the `contracts` folder:
```makefile
make script
or
make script CHAIN=Mainnet
or
make script DATE=2025_08 CHAIN=Mainnet
```

By default it take the current year+month to fetch which runlogs to run. The default chain is Mainnet.
