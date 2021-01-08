pragma solidity ^0.5.11;

import { IVault } from "../interfaces/IVault.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

contract Sanctum {
    address public asset;
    address public vault;
    address public reborner;
    bool public shouldAttack = false;

    constructor(address _asset, address _vault) public {
      asset = _asset;
      vault = _vault;
    }

    function deploy(uint256 salt, bytes memory bytecode)
        public
        returns (address addr)
    {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        require(addr != address(0), "Create2: Failed on deploy");
    }

    function computeAddress(uint256 salt, bytes memory bytecode)
        public
        view
        returns (address)
    {
        bytes32 bytecodeHashHash = keccak256(bytecode);
        bytes32 _data = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, bytecodeHashHash)
        );
        return address(bytes20(_data << 96));
    }

    function setShouldAttack(bool _shouldAttack) public {
        shouldAttack = _shouldAttack;
    }
}

contract Reborner {
    Sanctum sanctum;

    constructor(address _sanctum) public {
        console.log("We are created...");
        sanctum = Sanctum(_sanctum);
        if (sanctum.shouldAttack()) {
            console.log("We are attacking now...");
            attack();
        }
    }

    function mint() public {
      console.log("We are attempting to mint..");
      address asset = sanctum.asset();
      address vault = sanctum.vault();
      IERC20(asset).approve(vault, 1e18);
      IVault(vault).mint(asset, 1e18, 0);
      console.log("We are now minting..");
    }

    function attack() internal {
      mint();
    }

    function bye() public {
      console.log("We are now destructing..");
       selfdestruct(msg.sender);
    }
}
