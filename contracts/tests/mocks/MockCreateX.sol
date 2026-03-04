// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/// @title MockCreateX
/// @notice Minimal mock of the CreateX factory for testing contracts that use CreateX.
///         Implements `deployCreate2` with real CREATE2 deployment and guarded salt logic,
///         and `computeCreate2Address` for deterministic address computation.
/// @dev Deploy this contract, then `vm.etch` its bytecode at the real CreateX address
///      (0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed) so that contracts referencing the
///      constant address interact with this mock transparently.
contract MockCreateX {
    /// @notice Deploy a contract using CREATE2 with a guarded salt.
    /// @param salt The 32-byte salt (first 20 bytes = caller address for front-run protection).
    /// @param initCode The creation bytecode (constructor code + encoded constructor args).
    /// @return newContract The address of the deployed contract.
    function deployCreate2(bytes32 salt, bytes memory initCode)
        external
        payable
        returns (address newContract)
    {
        bytes32 guardedSalt = _guard(salt);
        assembly {
            newContract :=
                create2(callvalue(), add(initCode, 0x20), mload(initCode), guardedSalt)
        }
        require(newContract != address(0), "MockCreateX: CREATE2 deployment failed");
    }

    /// @notice Compute the deterministic CREATE2 address.
    /// @param salt The guarded salt (already processed by the caller).
    /// @param initCodeHash The keccak256 hash of the creation bytecode.
    /// @param deployer The deployer address (typically address(this), i.e. CreateX).
    /// @return computedAddress The deterministic address.
    function computeCreate2Address(
        bytes32 salt,
        bytes32 initCodeHash,
        address deployer
    ) external pure returns (address computedAddress) {
        computedAddress = address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash)
                    )
                )
            )
        );
    }

    /// @dev Replicate the CreateX guarded salt logic.
    ///      When the first 20 bytes of salt == msg.sender, the salt is re-hashed
    ///      to prevent front-running. Flag byte (position 20) == 0x00 means no
    ///      cross-chain redeploy protection.
    function _guard(bytes32 salt) internal view returns (bytes32) {
        address sender = address(bytes20(salt));
        if (sender == msg.sender) {
            return keccak256(abi.encode(msg.sender, salt));
        } else if (sender == address(0)) {
            return salt;
        } else {
            revert("MockCreateX: invalid salt");
        }
    }
}
