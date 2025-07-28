// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

interface ICompoundingValidatorManager {
    enum VALIDATOR_STATE {
        NON_REGISTERED, // validator is not registered on the SSV network
        REGISTERED, // validator is registered on the SSV network
        STAKED, // validator has funds staked
        VERIFIED, // validator has been verified to exist on the beacon chain
        EXITED, // The validator has been verified to have a zero balance
        REMOVED // validator has funds withdrawn to the EigenPod and is removed from the SSV
    }
}
