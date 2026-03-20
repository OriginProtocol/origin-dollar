// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../token/OUSD.sol";

// used to alter internal state of OUSD contract
contract TestUpgradedOUSD is OUSD {
    constructor() OUSD() {}

    function overwriteCreditBalances(address _account, uint256 _creditBalance)
        public
    {
        creditBalances[_account] = _creditBalance;
    }

    function overwriteAlternativeCPT(address _account, uint256 _acpt) public {
        alternativeCreditsPerToken[_account] = _acpt;
    }

    function overwriteRebaseState(address _account, RebaseOptions _rebaseOption)
        public
    {
        rebaseState[_account] = _rebaseOption;
    }
}
