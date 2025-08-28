// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import { stdJson } from "forge-std/StdJson.sol";

// Helpers
import { Script } from "forge-std/Script.sol";
import { Test } from "forge-std/Test.sol";
import { console } from "forge-std/console.sol";

/// @title Broadcast Convertor
/// @author Origin Protocol
/// @notice This contract is responsible for converting foundry broadcast messages into a format suitable for the Safe.
contract BroadcastConvertor is Script, Test {
  using stdJson for string;

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

  function run(string memory path) external {
    // Fetch JSON
    string memory inputJson = vm.readFile(string.concat(path, "run-latest.json"));

    // Convert Json into Struct
    Json memory json = abi.decode(vm.parseJson(inputJson), (Json));

    // Prepare for Safe
    string memory safeJson = _prepareForSafe(json);

    console.log("Use this JSON is Safe:\n%s", safeJson);

    // Write JSON
    vm.writeJson(safeJson, string.concat(path, "run-latest-safe.json"));
  }

  function _prepareForSafe(Json memory json) internal pure returns (string memory) {
    // Header
    string memory header = string.concat(
      '{ "version": "1.0", "chainId": "',
      vm.toString(json.chain),
      '", "createdAt": ',
      vm.toString(json.timestamp / 1000), // to convert milliseconds to seconds
      ", "
    );

    // Meta
    string memory meta = string.concat(
      '"meta": { "name": "Transaction Batch", "description": "", "txBuilderVersion": "1.16.1", "createdFromSafeAddress":  "',
      vm.toString(json.transactions[0].transaction.from),
      '", "createdFromOwnerAddress": ""},'
    );

    // Transactions
    string memory transactions = '"transactions": [ ';
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
    transactions = string.concat(transactions, " ]");

    // Building final JSON
    string memory jsonObj = string.concat(header, meta, transactions, " }");

    return jsonObj;
  }
}
