// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Fork_CompoundingStakingStrategy_Shared_Test } from "tests/fork/mainnet/strategies/CompoundingStakingStrategy/shared/Shared.t.sol";
import { Mainnet } from "tests/utils/Addresses.sol";
import { ICompoundingStakingStrategy } from "contracts/interfaces/strategies/ICompoundingStakingStrategy.sol";
import { CompoundingValidatorState } from "contracts/interfaces/strategies/CompoundingStakingTypes.sol";

contract Fork_Concrete_CompoundingStakingStrategy_ValidatorWithdrawal_Test is
    Fork_CompoundingStakingStrategy_Shared_Test
{
    /// @dev Live validator with the strategy's 0x02 withdrawal credentials.
    ///      Validator index: 2,329,587.
    bytes internal constant ACTIVE_VALIDATOR_PUBKEY =
        hex"941ce33a569fe60ab1b6e6c22047edf6704c9bba0f16f396a657d30066a5bcfb63a1ff3ec360dbbd26d086e08a91cb2d";
    uint64 internal constant PARTIAL_WITHDRAWAL_AMOUNT_GWEI =
        uint64(1 ether / 1 gwei);

    function test_validatorWithdrawal_partialCallsLiveWithdrawalRequestContract()
        public
    {
        bytes32 pubKeyHash = sha256(
            abi.encodePacked(ACTIVE_VALIDATOR_PUBKEY, bytes16(0))
        );
        _assertValidatorState(pubKeyHash, CompoundingValidatorState.ACTIVE);

        uint256 fee = _withdrawalRequestFee();
        uint256 requestContractBalanceBefore = Mainnet
            .beaconChainWithdrawRequest
            .balance;

        vm.deal(validatorRegistratorAddr, fee);
        vm.prank(validatorRegistratorAddr);
        vm.expectEmit(true, false, false, true, address(strategy));
        emit ICompoundingStakingStrategy.ValidatorWithdraw(pubKeyHash, 1 ether);
        strategy.validatorWithdrawal{ value: fee }(
            ACTIVE_VALIDATOR_PUBKEY,
            PARTIAL_WITHDRAWAL_AMOUNT_GWEI
        );

        _assertValidatorState(pubKeyHash, CompoundingValidatorState.ACTIVE);
        assertEq(
            Mainnet.beaconChainWithdrawRequest.balance,
            requestContractBalanceBefore + fee,
            "withdrawal request fee not paid"
        );
    }

    function test_validatorWithdrawal_fullCallsLiveWithdrawalRequestContract()
        public
    {
        bytes32 pubKeyHash = sha256(
            abi.encodePacked(ACTIVE_VALIDATOR_PUBKEY, bytes16(0))
        );
        _assertValidatorState(pubKeyHash, CompoundingValidatorState.ACTIVE);

        uint256 fee = _withdrawalRequestFee();
        uint256 requestContractBalanceBefore = Mainnet
            .beaconChainWithdrawRequest
            .balance;

        vm.deal(validatorRegistratorAddr, fee);
        vm.prank(validatorRegistratorAddr);
        vm.expectEmit(true, false, false, true, address(strategy));
        emit ICompoundingStakingStrategy.ValidatorWithdraw(pubKeyHash, 0);
        strategy.validatorWithdrawal{ value: fee }(ACTIVE_VALIDATOR_PUBKEY, 0);

        _assertValidatorState(pubKeyHash, CompoundingValidatorState.EXITING);
        assertEq(
            Mainnet.beaconChainWithdrawRequest.balance,
            requestContractBalanceBefore + fee,
            "withdrawal request fee not paid"
        );
    }

    function _assertValidatorState(
        bytes32 pubKeyHash,
        CompoundingValidatorState expectedState
    ) internal view {
        (CompoundingValidatorState state, ) = strategy.validator(pubKeyHash);
        assertEq(
            uint256(state),
            uint256(expectedState),
            "unexpected validator state"
        );
    }

    function _withdrawalRequestFee() internal view returns (uint256 fee) {
        (bool success, bytes memory result) = Mainnet
            .beaconChainWithdrawRequest
            .staticcall("");
        require(
            success && result.length > 0,
            "failed to get withdrawal request fee"
        );
        fee = abi.decode(result, (uint256));
    }
}
