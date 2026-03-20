// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Vm} from "forge-std/Vm.sol";
import {console2} from "forge-std/console2.sol";

/// @title Logger - Styled console logging for deployment scripts
/// @notice Provides colored and formatted logging using ANSI escape codes
/// @dev Use with `using Logger for bool` to enable `log.functionName()` syntax
library Logger {
    // ─────────────────────────────────────────────────────────────────────────────
    // ANSI Escape Codes
    // ─────────────────────────────────────────────────────────────────────────────

    string private constant RESET = "\x1b[0m";
    string private constant BOLD = "\x1b[1m";
    string private constant DIM = "\x1b[2m";

    string private constant RED = "\x1b[31m";
    string private constant GREEN = "\x1b[32m";
    string private constant YELLOW = "\x1b[33m";
    string private constant BLUE = "\x1b[34m";
    string private constant MAGENTA = "\x1b[35m";
    string private constant CYAN = "\x1b[36m";
    string private constant WHITE = "\x1b[37m";

    string private constant BRIGHT_GREEN = "\x1b[92m";
    string private constant BRIGHT_YELLOW = "\x1b[93m";
    string private constant BRIGHT_BLUE = "\x1b[94m";
    string private constant BRIGHT_CYAN = "\x1b[96m";
    string private constant BRIGHT_RED = "\x1b[91m";

    string private constant BG_BLUE = "\x1b[44m";

    // Symbols
    string private constant CHECK = "\xe2\x9c\x93";
    string private constant CROSS = "\xe2\x9c\x97";
    string private constant ARROW = "\xe2\x96\xb6";
    string private constant BULLET = "\xe2\x80\xa2";
    string private constant LINE =
        "\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80";

    // ─────────────────────────────────────────────────────────────────────────────
    // Header & Section Functions
    // ─────────────────────────────────────────────────────────────────────────────

    function header(bool log, string memory title) internal pure {
        if (!log) return;
        console2.log("");
        console2.log(string.concat(BOLD, BRIGHT_CYAN, LINE, RESET));
        console2.log(string.concat(BOLD, WHITE, "  ", title, RESET));
        console2.log(string.concat(BOLD, BRIGHT_CYAN, LINE, RESET));
    }

    function section(bool log, string memory title) internal pure {
        if (!log) return;
        console2.log("");
        console2.log(string.concat(BOLD, YELLOW, ARROW, " ", title, RESET));
        console2.log(string.concat(DIM, LINE, RESET));
    }

    function endSection(bool log) internal pure {
        if (!log) return;
        console2.log(string.concat(WHITE, DIM, LINE, RESET));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Status Functions
    // ─────────────────────────────────────────────────────────────────────────────

    function success(bool log, string memory message) internal pure {
        if (!log) return;
        console2.log(string.concat(BRIGHT_GREEN, CHECK, " ", message, RESET));
    }

    function error(bool log, string memory message) internal pure {
        if (!log) return;
        console2.log(string.concat(BRIGHT_RED, CROSS, " ", message, RESET));
    }

    function warn(bool log, string memory message) internal pure {
        if (!log) return;
        console2.log(string.concat(BRIGHT_YELLOW, "! ", message, RESET));
    }

    function info(bool log, string memory message) internal pure {
        if (!log) return;
        console2.log(string.concat(BRIGHT_BLUE, BULLET, " ", RESET, message));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Deployment Functions
    // ─────────────────────────────────────────────────────────────────────────────

    function logSetup(bool log, string memory chainName, uint256 chainId) internal pure {
        if (!log) return;
        header(true, string.concat("Deploy Manager - ", chainName));
        console2.log(string.concat("  ", DIM, "Chain ID: ", RESET, BOLD, vm.toString(chainId), RESET));
    }

    function logContractDeployed(bool log, string memory name, address addr) internal pure {
        if (!log) return;
        console2.log(string.concat("  ", BRIGHT_GREEN, CHECK, RESET, " ", BOLD, name, RESET));
        console2.log(string.concat("    ", DIM, "at ", RESET, CYAN, vm.toString(addr), RESET));
    }

    function logSkip(bool log, string memory name, string memory reason) internal pure {
        if (!log) return;
        console2.log(string.concat(DIM, "  ", BULLET, " Skipping ", name, ": ", reason, RESET));
    }

    function logDeployer(bool log, address deployer, bool isFork) internal pure {
        if (!log) return;
        string memory label = isFork ? "Fork Deployer" : "Deployer";
        console2.log(string.concat("  ", DIM, label, ": ", RESET, CYAN, vm.toString(deployer), RESET));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Governance Functions
    // ─────────────────────────────────────────────────────────────────────────────

    function logGovProposalHeader(bool log) internal pure {
        if (!log) return;
        section(true, "Governance Proposal");
    }

    function logProposalState(bool log, string memory state) internal pure {
        if (!log) return;
        console2.log(string.concat("  ", DIM, "State: ", RESET, BOLD, YELLOW, state, RESET));
    }

    function logCalldata(bool log, address to, bytes memory data) internal pure {
        if (!log) return;
        console2.log("");
        console2.log(string.concat(BOLD, YELLOW, "Create following tx on Governance:", RESET));
        console2.log(string.concat("  ", DIM, "To: ", RESET, CYAN, vm.toString(to), RESET));
        console2.log(string.concat("  ", DIM, "Data:", RESET));
        console2.logBytes(data);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Key-Value Logging
    // ─────────────────────────────────────────────────────────────────────────────

    function logKeyValue(bool log, string memory key, string memory value) internal pure {
        if (!log) return;
        console2.log(string.concat("  ", DIM, key, ": ", RESET, value));
    }

    function logKeyValue(bool log, string memory key, address value) internal pure {
        if (!log) return;
        console2.log(string.concat("  ", DIM, key, ": ", RESET, CYAN, vm.toString(value), RESET));
    }

    function logKeyValue(bool log, string memory key, uint256 value) internal pure {
        if (!log) return;
        console2.log(string.concat("  ", DIM, key, ": ", RESET, vm.toString(value)));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // VM Reference (for string conversion)
    // ─────────────────────────────────────────────────────────────────────────────

    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
}
