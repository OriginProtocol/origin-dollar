// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.0;

interface IAMOCallback {
    function quoteCallback(uint256 _amount, bool _swapWETH) external;
}