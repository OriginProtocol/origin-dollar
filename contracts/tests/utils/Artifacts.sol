// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/// @title Artifacts
/// @notice Centralized registry of Foundry artifact paths used with `vm.deployCode(...)` in tests.
/// @dev Sub-libraries group artifacts by category (Tokens, Vaults, Proxies, ...). Use them at call
///      sites as `vm.deployCode(Tokens.OUSD, abi.encode(...))` instead of inline string literals,
///      so that path changes only require updating this file.
///
///      Naming conventions:
///      - SCREAMING_SNAKE_CASE for constants (Solidity convention).
///      - The category namespace acts as a prefix, so suffixes like `_ARTIFACT` are omitted.
///      - When a contract name is long and unwieldy, a short well-known abbreviation is acceptable
///        (e.g. `IG_PROXY` for `InitializeGovernedUpgradeabilityProxy`).
///
///      When adding a new artifact, place it in the relevant sub-library, or create a new
///      sub-library if no existing category fits.
library Tokens {
    string internal constant OUSD = "contracts/token/OUSD.sol:OUSD";
}

library Vaults {
    string internal constant OUSD = "contracts/vault/OUSDVault.sol:OUSDVault";
}

library Proxies {
    string internal constant IG_PROXY =
        "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol:InitializeGovernedUpgradeabilityProxy";
}
