// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IDepositContract } from "./../interfaces/IDepositContract.sol";

contract MockDepositContract is IDepositContract {
    uint256 deposit_count;

    function deposit(
        bytes calldata pubkey,
        bytes calldata withdrawal_credentials,
        bytes calldata signature,
        bytes32 deposit_data_root
    ) external payable override {
        require(pubkey.length == 48, "DepositContract: invalid pubkey length");
        require(
            withdrawal_credentials.length == 32,
            "DepositContract: invalid withdrawal_credentials length"
        );
        require(
            signature.length == 96,
            "DepositContract: invalid signature length"
        );

        // Check deposit amount
        require(msg.value >= 1 ether, "DepositContract: deposit value too low");
        require(
            msg.value % 1 gwei == 0,
            "DepositContract: deposit value not multiple of gwei"
        );
        uint256 deposit_amount = msg.value / 1 gwei;
        require(
            deposit_amount <= type(uint64).max,
            "DepositContract: deposit value too high"
        );

        // Emit `DepositEvent` log
        bytes memory amount = to_little_endian_64(uint64(deposit_amount));
        emit DepositEvent(
            pubkey,
            withdrawal_credentials,
            amount,
            signature,
            to_little_endian_64(uint64(deposit_count))
        );
        require(
            deposit_data_root != 0,
            "DepositContract: invalid deposit_data_root"
        );
    }

    function get_deposit_root() external view override returns (bytes32) {
        // just return some bytes32
        return sha256(abi.encodePacked(deposit_count, bytes16(0)));
    }

    /// @notice Query the current deposit count.
    /// @return The deposit count encoded as a little endian 64-bit number.
    function get_deposit_count() external view override returns (bytes memory) {
        return to_little_endian_64(uint64(deposit_count));
    }

    function to_little_endian_64(uint64 value)
        internal
        pure
        returns (bytes memory ret)
    {
        ret = new bytes(8);
        bytes8 bytesValue = bytes8(value);
        // Byteswapping during copying to bytes.
        ret[0] = bytesValue[7];
        ret[1] = bytesValue[6];
        ret[2] = bytesValue[5];
        ret[3] = bytesValue[4];
        ret[4] = bytesValue[3];
        ret[5] = bytesValue[2];
        ret[6] = bytesValue[1];
        ret[7] = bytesValue[0];
    }
}
