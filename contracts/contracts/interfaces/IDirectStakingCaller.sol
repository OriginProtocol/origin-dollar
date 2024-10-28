// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDirectStakingCaller {
    /**
     * @dev Callback function invoked by DirectStaking contract to
     *      notify the completion of a stake request.
     * @param messageId CCIP message ID
     * @param amountOut Amount of wOETH sent
     */
    function onDirectStakingRequestCompletion(
        bytes32 messageId,
        uint256 amountOut
    ) external;
}
