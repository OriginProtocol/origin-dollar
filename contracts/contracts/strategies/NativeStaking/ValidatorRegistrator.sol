// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Governable } from "../../governance/Governable.sol";

/**
 * @title Registrator of the validators
 * @notice This contract implements all the required functionality to register validators
 * @author Origin Protocol Inc
 */
abstract contract ValidatorRegistrator is Governable {
    /// @notice Address of the registrator - allowed to register, exit and remove validators
    address public validatorRegistrator;
    /// @notice The number of validators that have 32 (!) ETH actively deposited. When a new deposit
    /// to a validator happens this number increases, when a validator exit is detected this number
    /// decreases. 
    uint256 activeDepositedValidators;
    // For future use
    uint256[50] private __gap;

    event RegistratorAddressChanged(address oldAddress, address newAddress);

    /// @dev Throws if called by any account other than the Registrator
    modifier onlyRegistrator() {
        require(msg.sender == validatorRegistrator, "Caller is not the Registrator");
        _;
    }

    /// @notice Set the address of the registrator
    function setRegistratorAddress(address _address) external onlyGovernor {
        emit RegistratorAddressChanged(validatorRegistrator, _address);
        validatorRegistrator = _address;
    }

    /// @notice return the WETH balance on the contract that can be used to for beacon chain
    /// staking - staking on the validators
    function getWETHBalanceEligibleForStaking() public virtual view returns(uint256 _amount);

    // /// @notice Stakes WETH to the NDC to the Node validators
    // /// @param validators A list of validator data needed to stake.
    // /// The ValidatorStakeData struct contains the pubkey, signature and depositDataRoot.
    // /// @dev Only accounts with the Operator role can call this function.
    // function stakeEth(ValidatorStakeData[] calldata validators) external {
    //     // Yield from the validators will come as native ETH.
    //     uint256 ethBalance = address(this).balance;
    //     uint256 requiredETH = validators.length * 32 ether;
    //     if (ethBalance < requiredETH) {
    //         // If not enough native ETH, convert WETH to native ETH
    //         uint256 wethBalance = getWETHBalanceEligibleForStaking();
    //         if (wethBalance + ethBalance < requiredETH) {
    //             revert InsufficientWETH(wethBalance + ethBalance);
    //         }
    //         // Convert WETH asset to native ETH
    //         IWETH(WETH_TOKEN_ADDRESS).withdraw(requiredETH - ethBalance);
    //     }

    //     // For each validator
    //     for (uint256 i = 0; i < validators.length;) {
    //         bytes32 pubkeyHash = keccak256(validators[i].pubkey);

    //         if (validatorsStaked[pubkeyHash]) {
    //             revert ValidatorAlreadyStaked(validators[i].pubkey);
    //         }

    //         _stakeEth(validators[i].pubkey, validators[i].signature, validators[i].depositDataRoot);
    //         validatorsStaked[pubkeyHash] = true;

    //         unchecked {
    //             ++i;
    //         }
    //     }
    // }

    // /// @dev Stake WETH and ETH in NDC in EigenLayer. It calls the `stake` function on the EigenPodManager
    // /// which calls `stake` on the EigenPod contract which calls `stake` on the Beacon DepositContract.
    // /// @dev The public functions that call this internal function are responsible for access control.
    // function _stakeEth(bytes calldata pubkey, bytes calldata signature, bytes32 depositDataRoot) internal {
    //     // Call the stake function in the EigenPodManager
    //     IEigenPodManager eigenPodManager = IEigenPodManager(lrtConfig.getContract(LRTConstants.EIGEN_POD_MANAGER));
    //     eigenPodManager.stake{ value: 32 ether }(pubkey, signature, depositDataRoot);

    //     // Increment the staked but not verified ETH
    //     stakedButNotVerifiedEth += 32 ether;
    //     activeDepositedValidators += 1;

    //     emit ETHStaked(pubkey, 32 ether);
    // }
}
