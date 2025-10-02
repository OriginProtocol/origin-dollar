// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Library to request full or partial withdrawals from validators on the beacon chain.
 * @author Origin Protocol Inc
 */
library PartialWithdrawal {
    /// @notice The address where the withdrawal request is sent to
    /// See https://eips.ethereum.org/EIPS/eip-7002
    address internal constant WITHDRAWAL_REQUEST_ADDRESS =
        0x00000961Ef480Eb55e80D19ad83579A64c007002;

    /// @notice Requests a partial withdrawal for a given validator public key and amount.
    /// @param validatorPubKey The public key of the validator to withdraw from
    /// @param amount The amount of ETH to withdraw
    function request(bytes calldata validatorPubKey, uint64 amount)
        internal
        returns (uint256 fee_)
    {
        require(validatorPubKey.length == 48, "Invalid validator byte length");
        fee_ = fee();

        // Call the Withdrawal Request contract with the validator public key
        // and amount to be withdrawn packed together

        // This is a general purpose EL to CL request:
        // https://eips.ethereum.org/EIPS/eip-7685
        (bool success, ) = WITHDRAWAL_REQUEST_ADDRESS.call{ value: fee_ }(
            abi.encodePacked(validatorPubKey, amount)
        );

        require(success, "Withdrawal request failed");
    }

    /// @notice Gets fee for withdrawal requests contract on Beacon chain
    function fee() internal view returns (uint256) {
        // Get fee from the withdrawal request contract
        (bool success, bytes memory result) = WITHDRAWAL_REQUEST_ADDRESS
            .staticcall("");

        require(success && result.length > 0, "Failed to get fee");
        return abi.decode(result, (uint256));
    }
}
