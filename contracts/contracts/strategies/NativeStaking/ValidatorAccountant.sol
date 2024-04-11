// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ValidatorRegistrator } from "./ValidatorRegistrator.sol";

/// @title Accountant of the rewards Beacon Chain ETH
/// @notice This contract contains the logic to attribute the Beacon Chain swept ETH either to full
/// or partial withdrawals
/// @author Origin Protocol Inc
abstract contract ValidatorAccountant is ValidatorRegistrator {
    /// @dev The WETH present on this contract will come from 2 sources:
    ///  - as a result of deposits from the VaultAdmin
    ///  - accounting function converting beaconChain rewards from ETH to WETH
    /// 
    /// We need to be able to keep a separate accounting of the WETH so we understand how much we can pass oh to 
    /// the harvester as a consequence of rewards harvesting and how much registrator can pick up as a result of WETH 
    /// deposit into the strategy contract.
    /// To achieve this the beacon chain rewards are accounted for using below variable, all other WETH is assumed to be
    /// present as a result of a deposit.
    uint256 beaconChainRewardWETH = 0;

    /// @dev start of fuse interval
    uint256 fuseIntervalStart = 0;
    /// @dev end of fuse interval
    uint256 fuseIntervalEnd = 0;

    uint256[50] private __gap;

    event FuseIntervalUpdated(uint256 oldStart, uint256 oldEnd, uint256 start, uint256 end);

    error FuseIntervalValuesIncorrect();

    /// @notice set fuse interval values
    function setFuseInterval(uint256 _fuseIntervalStart, uint256 _fuseIntervalEnd) external onlyGovernor {
        if (
            _fuseIntervalStart > _fuseIntervalEnd ||
            _fuseIntervalStart >= 32 ether || 
            _fuseIntervalEnd >= 32 ether || 
            _fuseIntervalEnd - _fuseIntervalStart < 4 ether

        ) {
            revert FuseIntervalValuesIncorrect();
        }

        emit FuseIntervalUpdated(fuseIntervalStart, fuseIntervalEnd, _fuseIntervalStart, _fuseIntervalEnd);

        fuseIntervalStart = _fuseIntervalStart;
        fuseIntervalEnd = _fuseIntervalEnd;
    }

    /// This notion page offers a good explanation of how the accounting functions
    /// https://www.notion.so/originprotocol/Limited-simplified-native-staking-accounting-67a217c8420d40678eb943b9da0ee77d
    /// In short after dividing by 32 if the ETH remaining on the contract falls between 0 and fuseIntervalStart the accounting
    /// function will treat that ETH as a Beacon Chain Reward ETH.
    /// On the contrary if after dividing by 32 the ETH remaining on the contract falls between fuseIntervalEnd and 32 the 
    /// accounting function will treat that as a validator slashing.
    /// @notice Perform the accounting attributing beacon chain ETH to either full or partial withdrawals. Returns true when 
    /// accounting is valid and fuse isn't "blown". Returns false when fuse is blown
    function doAccounting() external returns (bool){

    }
}
