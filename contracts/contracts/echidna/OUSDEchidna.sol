// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../token/OUSD.sol";

contract OUSDEchidna is OUSD {
    constructor() OUSD() {}

    function _isNonRebasingAccountEchidna(address _account)
        public
        returns (bool)
    {
        _autoMigrate(_account);
        return alternativeCreditsPerToken[_account] > 0;
    }
}
