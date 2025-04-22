// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

contract ForceEtherSender {
    // Constructor to optionally receive Ether upon deployment
    constructor() payable {}

    // Function to allow the contract to receive Ether
    receive() external payable {}

    // Function to self-destruct and force-send Ether to an address
    function forceSend(address payable recipient) external {
        // Requires that the contract has a balance greater than 0
        require(address(this).balance > 0, "No Ether to send");

        // selfdestruct sends all Ether held by the contract to the recipient
        selfdestruct(recipient);
    }
}
