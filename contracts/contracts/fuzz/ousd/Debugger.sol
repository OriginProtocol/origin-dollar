// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library Debugger {
    event Debug(string debugString);
    event Debug(string description, string data);
    event Debug(string prefix, string description, string data);
    event Debug(string description, bytes32 data);
    event Debug(string prefix, string description, bytes32 data);
    event Debug(string description, uint256 data);
    event Debug(string prefix, string description, uint256 data);
    event Debug(string description, int256 data);
    event Debug(string prefix, string description, int256 data);
    event Debug(string description, address data);
    event Debug(string prefix, string description, address data);
    event Debug(string description, bool data);
    event Debug(string prefix, string description, bool data);

    function log(string memory debugString) internal {
        emit Debug(debugString);
    }

    function log(string memory description, string memory data) internal {
        emit Debug(description, data);
    }

    function log(
        string memory prefix,
        string memory description,
        string memory data
    ) internal {
        emit Debug(prefix, description, data);
    }

    function log(string memory description, bytes32 data) internal {
        emit Debug(description, data);
    }

    function log(
        string memory prefix,
        string memory description,
        bytes32 data
    ) internal {
        emit Debug(prefix, description, data);
    }

    function log(string memory description, uint256 data) internal {
        emit Debug(description, data);
    }

    function log(
        string memory prefix,
        string memory description,
        uint256 data
    ) internal {
        emit Debug(prefix, description, data);
    }

    function log(string memory description, int256 data) internal {
        emit Debug(description, data);
    }

    function log(
        string memory prefix,
        string memory description,
        int256 data
    ) internal {
        emit Debug(prefix, description, data);
    }

    function log(string memory description, address data) internal {
        emit Debug(description, data);
    }

    function log(
        string memory prefix,
        string memory description,
        address data
    ) internal {
        emit Debug(prefix, description, data);
    }

    function log(string memory description, bool data) internal {
        emit Debug(description, data);
    }

    function log(
        string memory prefix,
        string memory description,
        bool data
    ) internal {
        emit Debug(prefix, description, data);
    }
}
