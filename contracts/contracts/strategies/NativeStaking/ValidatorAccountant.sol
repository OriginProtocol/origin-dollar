// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { ValidatorRegistrator } from "./ValidatorRegistrator.sol";
import { IVault } from "../../interfaces/IVault.sol";
import { IWETH9 } from "../../interfaces/IWETH9.sol";

/// @title Accountant of the rewards Beacon Chain ETH
/// @notice This contract contains the logic to attribute the Beacon Chain swept ETH either to full
/// or partial withdrawals
/// @author Origin Protocol Inc
abstract contract ValidatorAccountant is ValidatorRegistrator {
    /// @notice The maximum amount of ETH that can be staked by a validator
    /// @dev this can change in the future with EIP-7251, Increase the MAX_EFFECTIVE_BALANCE
    uint256 public constant MAX_STAKE = 32 ether;
    /// @notice Address of the OETH Vault proxy contract
    address public immutable VAULT_ADDRESS;

    /// @dev The WETH present on this contract will come from 2 sources:
    ///  - as a result of deposits from the VaultAdmin
    ///  - accounting function converting beaconChain rewards from ETH to WETH
    ///
    /// We need to be able to keep a separate accounting of the WETH so we understand how much we can pass oh to
    /// the harvester as a consequence of rewards harvesting and how much registrator can pick up as a result of WETH
    /// deposit into the strategy contract.
    /// To achieve this the beacon chain rewards are accounted for using below variable, all other WETH is assumed to be
    /// present as a result of a deposit.
    uint256 public beaconChainRewardWETH = 0;

    /// @notice start of fuse interval
    uint256 public fuseIntervalStart = 0;
    /// @notice end of fuse interval
    uint256 public fuseIntervalEnd = 0;
    /// @notice Governor that can manually correct the accounting
    address public accountingGovernor;

    uint256[50] private __gap;

    event FuseIntervalUpdated(
        uint256 oldStart,
        uint256 oldEnd,
        uint256 start,
        uint256 end
    );
    event AccountingFullyWithdrawnValidator(
        uint256 noOfValidators,
        uint256 remainingValidators,
        uint256 wethSentToVault
    );
    event AccountingValidatorSlashed(
        uint256 remainingValidators,
        uint256 wethSentToVault
    );
    event AccountingGovernorAddressChanged(
        address oldAddress,
        address newAddress
    );
    event AccountingBeaconChainRewards(uint256 amount);

    event AccountingManuallyFixed(
        uint256 oldActiveDepositedValidators,
        uint256 activeDepositedValidators,
        uint256 oldBeaconChainRewardWETH,
        uint256 beaconChainRewardWETH,
        uint256 ethToWeth,
        uint256 wethToBeSentToVault
    );

    error UnexpectedEthAccountingInterval(uint256 errorneousEthAmount);
    error ManualFixAccountingThresholdReached();
    error FuseIntervalValuesIncorrect();
    error NotPaused();
    error InsuffiscientETHbalance();

    /// @dev Throws if called by any account other than the Accounting Governor
    modifier onlyAccountingGovernor() {
        require(
            msg.sender == accountingGovernor,
            "Caller is not the Accounting Governor"
        );
        _;
    }

    /// @dev Throws if called by any account other than the Strategist
    modifier onlyStrategist() {
        require(
            msg.sender == IVault(VAULT_ADDRESS).strategistAddr(),
            "Caller is not the Strategist"
        );
        _;
    }

    /// @param _wethAddress Address of the Erc20 WETH Token contract
    /// @param _vaultAddress Address of the Vault
    /// @param _beaconChainDepositContract Address of the beacon chain deposit contract
    /// @param _ssvNetwork Address of the SSV Network contract
    constructor(
        address _wethAddress,
        address _vaultAddress,
        address _beaconChainDepositContract,
        address _ssvNetwork
    )
        ValidatorRegistrator(
            _wethAddress,
            _beaconChainDepositContract,
            _ssvNetwork
        )
    {
        VAULT_ADDRESS = _vaultAddress;
    }

    function setAccountingGovernor(address _address) external onlyGovernor {
        emit AccountingGovernorAddressChanged(accountingGovernor, _address);
        accountingGovernor = _address;
    }

    /// @notice set fuse interval values
    function setFuseInterval(
        uint256 _fuseIntervalStart,
        uint256 _fuseIntervalEnd
    ) external onlyGovernor {
        if (
            _fuseIntervalStart > _fuseIntervalEnd ||
            _fuseIntervalStart >= 32 ether ||
            _fuseIntervalEnd >= 32 ether ||
            _fuseIntervalEnd - _fuseIntervalStart < 4 ether
        ) {
            revert FuseIntervalValuesIncorrect();
        }

        emit FuseIntervalUpdated(
            fuseIntervalStart,
            fuseIntervalEnd,
            _fuseIntervalStart,
            _fuseIntervalEnd
        );

        fuseIntervalStart = _fuseIntervalStart;
        fuseIntervalEnd = _fuseIntervalEnd;
    }

    /* solhint-disable max-line-length */
    /// This notion page offers a good explanation of how the accounting functions
    /// https://www.notion.so/originprotocol/Limited-simplified-native-staking-accounting-67a217c8420d40678eb943b9da0ee77d
    /// In short, after dividing by 32 if the ETH remaining on the contract falls between 0 and fuseIntervalStart the accounting
    /// function will treat that ETH as a Beacon Chain Reward ETH.
    /// On the contrary if after dividing by 32 the ETH remaining on the contract falls between fuseIntervalEnd and 32 the
    /// accounting function will treat that as a validator slashing.
    /// @notice Perform the accounting attributing beacon chain ETH to either full or partial withdrawals. Returns true when
    /// accounting is valid and fuse isn't "blown". Returns false when fuse is blown.
    /// @dev This function could in theory be permission-less but lets allow only the Registrator (Defender Action) to call it
    /// for now.
    /* solhint-enable max-line-length */
    function doAccounting()
        external
        onlyRegistrator
        returns (bool accountingValid)
    {
        uint256 ethBalance = address(this).balance;
        accountingValid = true;

        // send the WETH that is from fully withdrawn validators to the Vault
        if (ethBalance >= MAX_STAKE) {
            uint256 fullyWithdrawnValidators = ethBalance / MAX_STAKE;
            activeDepositedValidators -= fullyWithdrawnValidators;

            uint256 wethToVault = MAX_STAKE * fullyWithdrawnValidators;
            IWETH9(WETH_TOKEN_ADDRESS).deposit{ value: wethToVault }();
            IWETH9(WETH_TOKEN_ADDRESS).transfer(VAULT_ADDRESS, wethToVault);

            emit AccountingFullyWithdrawnValidator(
                fullyWithdrawnValidators,
                activeDepositedValidators,
                wethToVault
            );
        }

        uint256 ethRemaining = address(this).balance;
        // should never happen
        if (ethRemaining > 32 ether) {
            revert UnexpectedEthAccountingInterval(ethRemaining);
        }

        // Beacon chain rewards swept (partial validator withdrawals)
        if (ethRemaining <= fuseIntervalStart) {
            IWETH9(WETH_TOKEN_ADDRESS).deposit{ value: ethRemaining }();
            // solhint-disable-next-line reentrancy
            beaconChainRewardWETH += ethRemaining;
            emit AccountingBeaconChainRewards(ethRemaining);
        }
        // Beacon chain rewards swept but also a slashed validator fully exited
        else if (ethRemaining >= fuseIntervalEnd) {
            IWETH9(WETH_TOKEN_ADDRESS).deposit{ value: ethRemaining }();
            IWETH9(WETH_TOKEN_ADDRESS).transfer(VAULT_ADDRESS, ethRemaining);
            activeDepositedValidators -= 1;

            emit AccountingValidatorSlashed(
                activeDepositedValidators,
                ethRemaining
            );
        }
        // Oh no... Fuse is blown. The governor (Multisig not OGV Governor) needs to set the
        // record straight by manually set the accounting values.
        else {
            // will emit a paused event
            _pause();
            accountingValid = false;
        }
    }

    /// @dev allow the accounting governor to fix the accounting of this strategy and unpause
    /// @param _activeDepositedValidators the override value of activeDepositedValidators
    /// @param _ethToWeth the amount of ETH to be converted to WETH
    /// @param _wethToBeSentToVault the amount of WETH to be sent to the Vault
    /// @param _beaconChainRewardWETH the override value for beaconChainRewardWETH
    /// @param _ethThresholdCheck maximum allowed ETH balance on the contract for the function to run
    /// @param _wethThresholdCheck maximum allowed WETH balance on the contract for the function to run
    ///        the above 2 checks are done so transaction doesn't get front run and cause
    ///        unexpected behaviour
    function manuallyFixAccounting(
        uint256 _activeDepositedValidators,
        uint256 _ethToWeth,
        uint256 _wethToBeSentToVault,
        uint256 _beaconChainRewardWETH,
        uint256 _ethThresholdCheck,
        uint256 _wethThresholdCheck
    ) external onlyAccountingGovernor {
        if (!paused()) {
            revert NotPaused();
        }

        uint256 ethBalance = address(this).balance;
        uint256 wethBalance = IWETH9(WETH_TOKEN_ADDRESS).balanceOf(
            address(this)
        );

        if (
            ethBalance > _ethThresholdCheck || wethBalance > _wethThresholdCheck
        ) {
            revert ManualFixAccountingThresholdReached();
        }

        emit AccountingManuallyFixed(
            activeDepositedValidators,
            _activeDepositedValidators,
            beaconChainRewardWETH,
            _beaconChainRewardWETH,
            _ethToWeth,
            _wethToBeSentToVault
        );

        activeDepositedValidators = _activeDepositedValidators;
        beaconChainRewardWETH = _beaconChainRewardWETH;
        if (_ethToWeth > 0) {
            if (ethBalance < _ethToWeth) {
                revert InsuffiscientETHbalance();
            }
            IWETH9(WETH_TOKEN_ADDRESS).deposit{ value: _ethToWeth }();
        }
        if (_wethToBeSentToVault > 0) {
            IWETH9(WETH_TOKEN_ADDRESS).transfer(
                VAULT_ADDRESS,
                _wethToBeSentToVault
            );
        }

        _unpause();
    }
}
