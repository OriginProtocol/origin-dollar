// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { ValidatorRegistrator2 } from "./ValidatorRegistrator2.sol";
import { IWETH9 } from "../../interfaces/IWETH9.sol";

/// @title Validator Accountant
/// @notice Attributes the ETH swept from beacon chain validators to this strategy contract
/// as either full or partial withdrawals. Partial withdrawals being consensus rewards.
/// Full withdrawals are from exited validators.
/// @author Origin Protocol Inc
abstract contract ValidatorAccountant2 is ValidatorRegistrator2 {
    /// @notice The minimum amount of blocks that need to pass between two calls to manuallyFixAccounting
    uint256 public constant MIN_FIX_ACCOUNTING_CADENCE = 7200; // 1 day

    /// @notice Keeps track of the total consensus rewards swept from the beacon chain
    uint256 public consensusRewards;

    /// @notice start of fuse interval
    uint256 public fuseIntervalStart;
    /// @notice end of fuse interval
    uint256 public fuseIntervalEnd;
    /// @notice last block number manuallyFixAccounting has been called
    uint256 public lastFixAccountingBlockNumber;

    uint256[49] private __gap;

    event FuseIntervalUpdated(uint256 start, uint256 end);
    event AccountingFullyWithdrawnValidator(
        uint256 noOfValidators,
        uint256 remainingValidators,
        uint256 wethSentToVault
    );
    event AccountingValidatorSlashed(
        uint256 remainingValidators,
        uint256 wethSentToVault
    );
    event AccountingConsensusRewards(uint256 amount);

    event AccountingManuallyFixed(
        int256 validatorsDelta,
        int256 consensusRewardsDelta,
        uint256 wethToVault
    );

    /// @param _wethAddress Address of the Erc20 WETH Token contract
    /// @param _vaultAddress Address of the Vault
    /// @param _beaconChainDepositContract Address of the beacon chain deposit contract
    /// @param _ssvNetwork Address of the SSV Network contract
    /// @param _maxValidators Maximum number of validators that can be registered in the strategy
    /// @param _beaconOracle Address of the Beacon Oracle contract that maps block numbers to slots
    constructor(
        address _wethAddress,
        address _vaultAddress,
        address _beaconChainDepositContract,
        address _ssvNetwork,
        uint256 _maxValidators,
        address _beaconOracle
    )
        ValidatorRegistrator2(
            _wethAddress,
            _vaultAddress,
            _beaconChainDepositContract,
            _ssvNetwork,
            _maxValidators,
            _beaconOracle
        )
    {}

    /// @notice set fuse interval values
    function setFuseInterval(
        uint256 _fuseIntervalStart,
        uint256 _fuseIntervalEnd
    ) external onlyGovernor {
        require(
            _fuseIntervalStart < _fuseIntervalEnd &&
                _fuseIntervalEnd < 32 ether &&
                _fuseIntervalEnd - _fuseIntervalStart >= 4 ether,
            "Incorrect fuse interval"
        );

        fuseIntervalStart = _fuseIntervalStart;
        fuseIntervalEnd = _fuseIntervalEnd;

        emit FuseIntervalUpdated(_fuseIntervalStart, _fuseIntervalEnd);
    }

    /* solhint-disable max-line-length */
    /// This notion page offers a good explanation of how the accounting functions
    /// https://www.notion.so/originprotocol/Limited-simplified-native-staking-accounting-67a217c8420d40678eb943b9da0ee77d
    /// In short, after dividing by 32, if the ETH remaining on the contract falls between 0 and fuseIntervalStart,
    /// the accounting function will treat that ETH as Beacon chain consensus rewards.
    /// On the contrary, if after dividing by 32, the ETH remaining on the contract falls between fuseIntervalEnd and 32,
    /// the accounting function will treat that as a validator slashing.
    /// @notice Perform the accounting attributing beacon chain ETH to either full or partial withdrawals. Returns true when
    /// accounting is valid and fuse isn't "blown". Returns false when fuse is blown.
    /// @dev This function could in theory be permission-less but lets allow only the Registrator (Defender Action) to call it
    /// for now.
    /// @return accountingValid true if accounting was successful, false if fuse is blown
    /* solhint-enable max-line-length */
    function doAccounting()
        external
        onlyRegistrator
        whenNotPaused
        nonReentrant
        returns (bool accountingValid)
    {
        // pause the accounting on failure
        accountingValid = _doAccounting(true);
    }

    // slither-disable-start reentrancy-eth
    function _doAccounting(bool pauseOnFail)
        internal
        returns (bool accountingValid)
    {
        if (address(this).balance < consensusRewards) {
            return _failAccounting(pauseOnFail);
        }

        // Calculate all the new ETH that has been swept to the contract since the last accounting
        uint256 newSweptETH = address(this).balance - consensusRewards;
        accountingValid = true;

        // send the ETH that is from fully withdrawn validators to the Vault
        if (newSweptETH >= FULL_STAKE) {
            uint256 fullyWithdrawnValidators;
            // explicitly cast to uint256 as we want to round to a whole number of validators
            fullyWithdrawnValidators = uint256(newSweptETH / FULL_STAKE);
            activeDepositedValidators -= fullyWithdrawnValidators;

            uint256 wethToVault = FULL_STAKE * fullyWithdrawnValidators;
            IWETH9(WETH).deposit{ value: wethToVault }();
            // slither-disable-next-line unchecked-transfer
            IWETH9(WETH).transfer(VAULT_ADDRESS, wethToVault);
            _wethWithdrawnToVault(wethToVault);

            emit AccountingFullyWithdrawnValidator(
                fullyWithdrawnValidators,
                activeDepositedValidators,
                wethToVault
            );
        }

        uint256 ethRemaining = address(this).balance - consensusRewards;
        // should be less than a whole validator stake
        require(ethRemaining < FULL_STAKE, "Unexpected accounting");

        // If no Beacon chain consensus rewards swept
        if (ethRemaining == 0) {
            // do nothing
            return accountingValid;
        } else if (ethRemaining < fuseIntervalStart) {
            // Beacon chain consensus rewards swept (partial validator withdrawals)
            // solhint-disable-next-line reentrancy
            consensusRewards += ethRemaining;
            emit AccountingConsensusRewards(ethRemaining);
        } else if (ethRemaining > fuseIntervalEnd) {
            // Beacon chain consensus rewards swept but also a slashed validator fully exited
            IWETH9(WETH).deposit{ value: ethRemaining }();
            // slither-disable-next-line unchecked-transfer
            IWETH9(WETH).transfer(VAULT_ADDRESS, ethRemaining);
            activeDepositedValidators -= 1;

            _wethWithdrawnToVault(ethRemaining);

            emit AccountingValidatorSlashed(
                activeDepositedValidators,
                ethRemaining
            );
        }
        // Oh no... Fuse is blown. The Strategist needs to adjust the accounting values.
        else {
            return _failAccounting(pauseOnFail);
        }
    }

    // slither-disable-end reentrancy-eth

    /// @dev pause any further accounting if required and return false
    function _failAccounting(bool pauseOnFail)
        internal
        returns (bool accountingValid)
    {
        // pause if not already
        if (pauseOnFail) {
            _pause();
        }
        // fail the accounting
        accountingValid = false;
    }

    /// @notice Allow the Strategist to fix the accounting of this strategy and unpause.
    /// @param _validatorsDelta adjust the active validators by up to plus three or minus three
    /// @param _consensusRewardsDelta adjust the accounted for consensus rewards up or down
    /// @param _ethToVaultAmount the amount of ETH that gets wrapped into WETH and sent to the Vault
    /// @dev There is a case when a validator(s) gets slashed so much that the eth swept from
    /// the beacon chain enters the fuse area and there are no consensus rewards on the contract
    /// to "dip into"/use. To increase the amount of unaccounted ETH over the fuse end interval
    /// we need to reduce the amount of active deposited validators and immediately send WETH
    /// to the vault, so it doesn't interfere with further accounting.
    function manuallyFixAccounting(
        int256 _validatorsDelta,
        int256 _consensusRewardsDelta,
        uint256 _ethToVaultAmount
    ) external onlyStrategist whenPaused nonReentrant {
        require(
            lastFixAccountingBlockNumber + MIN_FIX_ACCOUNTING_CADENCE <
                block.number,
            "Fix accounting called too soon"
        );
        require(
            _validatorsDelta >= -3 &&
                _validatorsDelta <= 3 &&
                // new value must be positive
                int256(activeDepositedValidators) + _validatorsDelta >= 0,
            "Invalid validatorsDelta"
        );
        require(
            _consensusRewardsDelta >= -332 ether &&
                _consensusRewardsDelta <= 332 ether &&
                // new value must be positive
                int256(consensusRewards) + _consensusRewardsDelta >= 0,
            "Invalid consensusRewardsDelta"
        );
        require(_ethToVaultAmount <= 32 ether * 3, "Invalid wethToVaultAmount");

        activeDepositedValidators = uint256(
            int256(activeDepositedValidators) + _validatorsDelta
        );
        consensusRewards = uint256(
            int256(consensusRewards) + _consensusRewardsDelta
        );
        lastFixAccountingBlockNumber = block.number;
        if (_ethToVaultAmount > 0) {
            IWETH9(WETH).deposit{ value: _ethToVaultAmount }();
            // slither-disable-next-line unchecked-transfer
            IWETH9(WETH).transfer(VAULT_ADDRESS, _ethToVaultAmount);
            _wethWithdrawnToVault(_ethToVaultAmount);
        }

        emit AccountingManuallyFixed(
            _validatorsDelta,
            _consensusRewardsDelta,
            _ethToVaultAmount
        );

        // rerun the accounting to see if it has now been fixed.
        // Do not pause the accounting on failure as it is already paused
        require(_doAccounting(false), "Fuse still blown");

        // unpause since doAccounting was successful
        _unpause();
    }

    /***************************************
                 Abstract
    ****************************************/

    /// @dev allows for NativeStakingSSVStrategy contract to emit the Withdrawal event
    function _wethWithdrawnToVault(uint256 _amount) internal virtual;
}
