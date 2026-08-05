# Test Artifacts

This folder centralizes the Foundry artifact paths used by tests with `vm.deployCode(...)`.

## Why this exists

Inlining artifact strings such as:

```solidity
vm.deployCode("contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol:InitializeGovernedUpgradeabilityProxy");
```

creates a few problems:

- the same long path gets duplicated across many test files
- renaming or moving a contract requires touching many unrelated tests
- inline strings make test setup noisier and harder to scan
- typos in artifact paths are easier to introduce and harder to catch during review

Centralizing paths behind named constants keeps test files shorter and makes path updates a single-location change.

## Why one library per file

The original centralized version grouped multiple libraries into one `Artifacts.sol` file. Splitting them into one file per category keeps imports more explicit and avoids a growing catch-all file.

Benefits:

- test files import only the categories they use
- each artifact category stays small and easier to maintain
- diffs are narrower when adding or updating artifact constants
- file layout mirrors the logical namespaces already used in tests

## Current categories

- `Tokens.sol`
- `Vaults.sol`
- `Proxies.sol`
- `Strategies.sol`
- `PoolBoosters.sol`
- `Automation.sol`
- `Zappers.sol`
- `Mocks.sol`

## Usage

Import the specific libraries needed by the test:

```solidity
import {Proxies} from "tests/utils/artifacts/Proxies.sol";
import {Tokens} from "tests/utils/artifacts/Tokens.sol";
import {Vaults} from "tests/utils/artifacts/Vaults.sol";
```

Then use the constants directly:

```solidity
vm.deployCode(Proxies.IG_PROXY);
vm.deployCode(Tokens.OUSD);
vm.deployCode(Vaults.OUSD);
```

## Naming rules

- Use `SCREAMING_SNAKE_CASE` for constant names
- Do not add an `_ARTIFACT` suffix
- Prefer the existing category namespaces over longer suffixes
- Use short, well-known abbreviations only when the full contract name is unwieldy
- Keep constants alphabetized within each library

## Adding a new artifact

1. Pick the existing category that best matches the contract.
2. Add a new constant to that library file.
3. Keep the name aligned with the test naming conventions already used here.
4. Update the test to import that specific category file instead of inlining the path.
