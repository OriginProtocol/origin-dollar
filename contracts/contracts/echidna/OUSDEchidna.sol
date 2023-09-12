// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../token/OUSD.sol";

contract OUSDEchidna is OUSD {
    constructor() OUSD() {}

    function _isNonRebasingAccountEchidna(address _account)
        public
        returns (bool)
    {
        return _isNonRebasingAccount(_account);
    }
}
