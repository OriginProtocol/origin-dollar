// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { ICCTPMessageTransmitter } from "./ICCTP.sol";

interface ICCTPMessageTransmitterMock2 is ICCTPMessageTransmitter {
    function setCCTPTokenMessenger(address _cctpTokenMessenger) external;

    function setPeerDomainId(uint32 _peerDomainId) external;
}
