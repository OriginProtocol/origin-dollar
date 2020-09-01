pragma solidity 0.5.11;

import { IPriceOracle } from "../interfaces/IPriceOracle.sol";

contract MixOracle {
  address [] public oracles;
  address admin;
  uint constant MAX_INT = 2**256 - 1;

  constructor() public {
    admin = msg.sender;
  }

  function registerOracle(address oracle) public {
    require(admin == msg.sender, "Only the admin can register a new pair");
    for (uint i = 0; i < oracles.length; i++) {
      require(oracles[i] != oracle, "Oracle already registered.");
    }
    oracles.push(oracle);
  }

  function priceMinMax(string calldata symbol) external view returns (uint256, uint256) {
    require(oracles.length > 0, "Must have at least one oracle");
    uint max = 0;
    uint min = MAX_INT;
    uint price;

    for (uint i = 0; i < oracles.length; i++) {
      price = IPriceOracle(oracles[i]).price(symbol);
      if (price > max) {
        max = price;
      }
      if (min > price) {
        min = price;
      }
    }
    return (min, max);
  }
}
