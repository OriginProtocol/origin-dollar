// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// Foundry
import { Test } from "forge-std/Test.sol";
import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { stdJson } from "forge-std/StdJson.sol";

// Helpers
import { Mainnet, Base, Sonic } from "./Addresses.sol";

/// @title Broadcast Convertor
/// @author Origin Protocol
/// @notice This contract is responsible for converting foundry broadcast messages into a format suitable for the Safe.
contract BroadcastConvertor is Script, Test {
  using stdJson for string;

  // ⚠️ Never change the structure of these JSONs, alphabetical order matters!!
  struct Json {
    uint256 chain;
    string commit; // git commit hash
    string libraries; // empty
    string pending; // empty
    string receipts; // empty
    uint256 timestamp;
    Transactions[] transactions;
    Returns returnData; // empty
  }

  struct Transactions {
    string additionalContracts; // empty
    uint256 arguments; // null
    address contractAddress;
    string contractName;
    uint256 functions; // null
    uint256 hash; // null
    bool isFixedGasLimit;
    Transaction transaction;
    string transactionType;
  }

  struct Transaction {
    bytes chainId;
    address from;
    bytes gas;
    bytes input;
    bytes nonce;
    address to;
    bytes value;
  }

  struct Returns {
    uint256 empty;
  }

  /// @notice Main function to run the conversion from foundry broadcast messages to Safe format
  /// @param path The path where the run-latest.json file is located
  function run(string memory path) external {
    // Fetch JSON
    string memory inputJson = vm.readFile(string.concat(path, "run-latest.json"));

    // Convert Json into Json-Struct
    Json memory json = abi.decode(vm.parseJson(inputJson), (Json));

    // Is timelock targeted?
    uint256 delay = timelockDelay(json);

    if (delay > 0) {
      // Prepare schedule for Timelock
      string memory scheduleJson = prepareForSafe(json, Timelock.scheduleBatch.selector);
      console.log("\nUse this JSON to schedule on Timelock:\n%s", scheduleJson);

      // Prepare execute for Timelock
      string memory executeJson = prepareForSafe(json, Timelock.executeBatch.selector);
      console.log("\nUse this JSON to execute on Timelock:\n%s", executeJson);

      // Write both JSONs
      vm.writeJson(scheduleJson, string.concat(path, "run-latest-schedule.json"));
      vm.writeJson(executeJson, string.concat(path, "run-latest-execute.json"));
    } else {
      // Prepare for Safe
      string memory safeJson = prepareForSafe(json, bytes4(0));
      console.log("Use this JSON is Safe:\n%s", safeJson);

      // Write Safe JSON
      vm.writeJson(safeJson, string.concat(path, "run-latest-safe.json"));
    }
  }

  /// @notice Prepares the JSON for Safe format
  /// @param json The original JSON in Json-Struct format
  function prepareForSafe(Json memory json, bytes4 selector) public pure returns (string memory) {
    // Header
    string memory header = string.concat(
      '{ "version": "1.0", "chainId": "',
      vm.toString(json.chain),
      '", "createdAt": ',
      vm.toString(json.timestamp / 1000), // to convert milliseconds to seconds
      ", "
    );

    // Meta
    string memory meta =
      '"meta": { "name": "Transaction Batch", "description": "", "txBuilderVersion": "1.16.1", "createdFromSafeAddress": "", "createdFromOwnerAddress": ""},';

    // Fetch if the transaction is targeting a timelock or not
    uint256 delay = timelockDelay(json);

    // Transactions
    string memory transactions = string.concat(
      '"transactions": [ ',
      delay == 0 ? rawTransactions(json) : transactionForTimelock(json, delay, selector),
      " ],"
    );

    // Is it targeting a timelock
    string memory isTargetingTimelock =
      string.concat('"targetingTimelock": ', delay == 0 ? "false" : "true");

    // Building final JSON
    string memory jsonObj = string.concat(header, meta, transactions, isTargetingTimelock, " }");

    return jsonObj;
  }

  /// @notice Prepares transactions for Safe format
  /// @param json The original JSON in Json-Struct format
  function rawTransactions(Json memory json) public pure returns (string memory transactions) {
    uint256 transactionsCount = json.transactions.length;
    for (uint256 i; i < transactionsCount; i++) {
      // Beginning of dictionnary
      transactions = string.concat(transactions, "{ ");
      // to
      transactions = string.concat(transactions, '"to":');
      transactions =
        string.concat(transactions, '"', vm.toString(json.transactions[i].transaction.to), '",');
      // value
      transactions = string.concat(transactions, '"value":');
      transactions =
        string.concat(transactions, '"', vm.toString(json.transactions[i].transaction.value), '",');
      // data
      transactions = string.concat(transactions, '"data": ');
      transactions =
        string.concat(transactions, '"', vm.toString(json.transactions[i].transaction.input), '",');
      // contractMethod & contractInputsValues
      transactions =
        string.concat(transactions, '"contractMethod": null, "contractInputsValues": null');
      // End of dictionary
      transactions = string.concat(transactions, "}");

      // Add comma separator if needed
      if (i < transactionsCount - 1) {
        transactions = string.concat(transactions, ", ");
      }
    }
  }

  /// @notice Prepares a transaction for Safe format, when a Timelock is targeted
  /// @dev This function will batch all the tx in a single one, and call the timelock pranked on the runlog
  /// @param json The original JSON in Json-Struct format
  /// @param delay The delay for the timelock
  function transactionForTimelock(Json memory json, uint256 delay, bytes4 selector)
    public
    pure
    returns (string memory transaction)
  {
    uint256 len = json.transactions.length;
    address[] memory targets = new address[](len);
    uint256[] memory values = new uint256[](len);
    bytes[] memory payloads = new bytes[](len);

    for (uint256 i = 0; i < len; i++) {
      targets[i] = json.transactions[i].transaction.to;
      values[i] = uint256(bytes32(json.transactions[i].transaction.value));
      payloads[i] = json.transactions[i].transaction.input;
    }

    // to
    transaction =
      string.concat(' { "to": "', vm.toString(json.transactions[0].transaction.from), '" ');

    // value
    transaction = string.concat(transaction, ' , "value": "0" ');

    // data
    transaction = string.concat(
      transaction,
      ' , "data": "',
      selector == (Timelock.scheduleBatch.selector)
        ? vm.toString(abi.encodeWithSelector(selector, targets, values, payloads, 0, 0, delay))
        : vm.toString(abi.encodeWithSelector(selector, targets, values, payloads, 0, 0)),
      '",'
    );

    // contractMethod & contractInputsValues
    transaction =
      string.concat(transaction, ' "contractMethod": null, "contractInputsValues": null }');
  }

  /// @notice Determine if the transaction is targeting a Timelock, if so return timelock delay
  /// @dev This is hardcoded instead of dynamic fetching, this allow not forking blockchain and faster runtime
  /// @param json The original JSON in Json-Struct format
  /// @return delay The delay for the timelock, 0 if not found
  function timelockDelay(Json memory json) public pure returns (uint256 delay) {
    if (json.chain == 1 && json.transactions[0].transaction.from == Mainnet.TIMELOCK) {
      delay = 2 days;
    } else if (json.chain == 5483 && json.transactions[0].transaction.from == Base.TIMELOCK) {
      delay = 2 days;
    } else if (json.chain == 146 && json.transactions[0].transaction.from == Sonic.TIMELOCK) {
      delay = 2 days;
    }
  }
}

interface Timelock {
  function scheduleBatch(
    address[] calldata targets,
    uint256[] calldata values,
    bytes[] calldata dataElements,
    bytes32 predecessor,
    bytes32 salt,
    uint256 delay
  ) external;

  function executeBatch(
    address[] calldata targets,
    uint256[] calldata values,
    bytes[] calldata dataElements,
    bytes32 predecessor,
    bytes32 salt
  ) external payable;
}
