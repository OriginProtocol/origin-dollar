// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { CurvePoolBooster } from "./CurvePoolBooster.sol";

/// @title CurvePoolBoosterPlain
/// @author Origin Protocol
/// @notice Contract to manage interactions with VotemarketV2 for a dedicated Curve pool/gauge. It differs from the
///         CurvePoolBooster in that it is not proxied.
/// @dev    Governor is not set in the constructor so that the same contract can be deployed on the same address on
///         multiple chains. Governor is set in the initialize function.
contract CurvePoolBoosterPlain is CurvePoolBooster {
    constructor(address _rewardToken, address _gauge)
        CurvePoolBooster(_rewardToken, _gauge)
    {
        rewardToken = _rewardToken;
        gauge = _gauge;
    }

    /// @notice initialize function, to set up initial internal state
    /// @param _strategist Address of the strategist
    /// @param _fee Fee in FEE_BASE unit payed when managing campaign
    /// @param _feeCollector Address of the fee collector
    /// @dev   Since this function is initialized in the same transaction as it is created the initialize function
    ///        doesn't need role protection.
    ///        Because the governor is only set in the initialisation function the base class initialize can not be
    ///        called as it is not the governor who is issueing this call.
    function initialize(
        address _govenor,
        address _strategist,
        uint16 _fee,
        address _feeCollector,
        address _campaignRemoteManager,
        address _votemarket
    ) external initializer {
        _setStrategistAddr(_strategist);
        _setFee(_fee);
        _setFeeCollector(_feeCollector);
        _setCampaignRemoteManager(_campaignRemoteManager);
        _setVotemarket(_votemarket);

        // Set the governor to the provided governor
        _setGovernor(_govenor);
    }
}
