// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Addresses
import {CrossChain} from "tests/utils/Addresses.sol";

/// @title CreateXHelper
/// @notice Deterministic CREATE2 deployment through the canonical CreateX factory.
/// @dev Used where a contract must land on the SAME address on two chains — the crosschainV3
///      strategy and adapter proxies, whose peer-parity checks compare an inbound
///      `transportSender` against `address(this)`.
///
///      Two independent inputs decide the address, and both must match across chains:
///        1. the guarded salt, derived from a human-readable string (below);
///        2. the init code — creation bytecode plus constructor args. That is why the
///           `contracts/proxies/create2/*` sources carry a "DO NOT CHANGE ANYTHING IN THIS
///           FILE" banner, and why `deployer` must be the same EOA on both chains.
library CreateXHelper {
    /// @notice Canonical CreateX factory, same address on every supported chain.
    address internal constant CREATE_X = CrossChain.createX;

    /// @notice Fixed 20-byte prefix of the raw salt: ASCII "originprotocol", right-aligned.
    /// @dev CreateX reads the first 20 bytes as a sender for its deploy-protection modes. A
    ///      constant that is neither `msg.sender` nor `address(0)` selects the unprotected
    ///      mode, which is what makes the resulting address independent of who deploys and of
    ///      the chain id — both required for cross-chain parity. Keeping it fixed (rather than
    ///      using the deployer) also makes addresses reproducible in CI and on local forks.
    address internal constant SALT_SENDER = 0x0000000000006f726967696E70726F746f636F6c;

    /// @notice Build the raw 32-byte CreateX salt from a human-readable string.
    /// @dev Layout, matching `encodeSaltForCreateX` in `utils/deploy.js`:
    ///        bytes[0..19]  `SALT_SENDER`
    ///        byte [20]     0x00 — cross-chain redeploy protection OFF (parity needs it off)
    ///        bytes[21..31] first 11 bytes of `keccak256(salt)`
    function encodeSalt(string memory salt) internal pure returns (bytes32) {
        bytes11 tail = bytes11(keccak256(bytes(salt)));
        return bytes32((uint256(uint160(SALT_SENDER)) << 96) | uint256(uint88(tail)));
    }

    /// @notice The salt CreateX actually passes to CREATE2, after applying `_guard`.
    /// @dev With a `SALT_SENDER` that is neither the caller nor the zero address, and the
    ///      21st byte at 0x00, CreateX falls through to its catch-all branch and hashes the
    ///      raw salt — no `msg.sender` and no `block.chainid` mixed in.
    function guardedSalt(string memory salt) internal pure returns (bytes32) {
        return keccak256(abi.encode(encodeSalt(salt)));
    }

    /// @notice Address `deploy` will produce, computable before the transaction is sent.
    /// @dev CreateX runs CREATE2 from its own address for `deployCreate2`, so the standard
    ///      derivation applies with `CREATE_X` as the deployer.
    function computeAddress(string memory salt, bytes memory initCode) internal pure returns (address) {
        bytes32 hash = keccak256(abi.encodePacked(hex"ff", CREATE_X, guardedSalt(salt), keccak256(initCode)));
        return address(uint160(uint256(hash)));
    }

    /// @notice Deploy `initCode` through CreateX at the address `computeAddress` predicts.
    /// @dev The equality check is not defensive padding: it is the assertion that the salt
    ///      encoding and CreateX's guard logic reimplemented above still agree with the live
    ///      factory. If they ever diverge, this reverts during `make simulate` — before a real
    ///      deployment can put a proxy at an address its cross-chain peer will not match.
    function deploy(string memory salt, bytes memory initCode) internal returns (address deployed) {
        address predicted = computeAddress(salt, initCode);
        deployed = ICreateX(CREATE_X).deployCreate2(encodeSalt(salt), initCode);
        require(deployed == predicted, "CreateX: address mismatch");
    }

    /// @notice Init code for a proxy whose only constructor argument is its initial governor.
    /// @dev Every `contracts/proxies/create2/*` proxy has this shape.
    function proxyInitCode(bytes memory creationCode, address governor) internal pure returns (bytes memory) {
        return abi.encodePacked(creationCode, abi.encode(governor));
    }
}

/// @notice The slice of CreateX this library uses.
interface ICreateX {
    function deployCreate2(bytes32 salt, bytes memory initCode) external payable returns (address newContract);
}
