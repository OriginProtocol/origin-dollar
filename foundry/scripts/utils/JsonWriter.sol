// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import { stdJson } from "forge-std/StdJson.sol";
import { Vm } from "forge-std/Vm.sol";
import { console } from "forge-std/console.sol";

abstract contract JsonWriter {
  using stdJson for string;

  Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

  function testTransformJson(string memory inputJson) public pure {
    string memory chainId = stdJson.readString(inputJson, ".chain");
    uint256 timestamp = stdJson.readUint(inputJson, ".timestamp");

    // Format métadonnées
    string memory meta = string.concat(
      "{",
      '"name":"Transactions Batch",',
      '"description":"",',
      '"txBuilderVersion":"1.16.1",',
      '"createdFromSafeAddress":"',
      stdJson.readString(inputJson, ".transactions[0].transaction.from"),
      '",',
      '"createdFromOwnerAddress":""',
      "}"
    );

    // Format des transactions
    // Todo: handle multiple transactions dynamically
    string memory tx0 = formatTx(inputJson, 0);
    string memory tx1 = formatTx(inputJson, 1);

    string memory allTxs = string.concat("[", tx0, ",", tx1, "]");

    // Final JSON
    string memory finalJson = string.concat(
      "{",
      '"version":"1.0",',
      '"chainId":"',
      chainId,
      '",',
      '"createdAt":',
      vm.toString(timestamp),
      ",",
      '"meta":',
      meta,
      ",",
      '"transactions":',
      allTxs,
      "}"
    );

    console.log(finalJson);
  }

  function formatTx(string memory json, uint256 index) internal pure returns (string memory) {
    string memory prefix = string.concat(".transactions[", vm.toString(index), "].transaction");
    string memory to = stdJson.readString(json, string.concat(prefix, ".to"));
    string memory input = stdJson.readString(json, string.concat(prefix, ".input"));

    return string.concat(
      "{",
      '"to":"',
      to,
      '",',
      '"value":"0",',
      '"data":"',
      input,
      '",',
      '"contractMethod":null,',
      '"contractInputsValues":null',
      "}"
    );
  }
}
