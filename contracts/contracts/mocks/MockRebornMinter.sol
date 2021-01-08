pragma solidity ^0.5.11;

import { IVault } from "../interfaces/IVault.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

contract Sanctum {
    address public asset;
    address public vault;
    address public reborner;
    bool public shouldAttack = false;
    uint256 public targetMethod;

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

    function setTargetMethod(uint256 target) public {
        targetMethod = target;
    }
}

contract Reborner {
    Sanctum sanctum;

    constructor(address _sanctum) public {
        console.log("We are created...");
        sanctum = Sanctum(_sanctum);
        if (sanctum.shouldAttack()) {
            console.log("We are attacking now...");

            uint target = sanctum.targetMethod();

            if (target == 1) {
                redeem();
            } else if (target == 2) {
                transfer();
            } else {
                mint();
            }
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

    function redeem() public {
      console.log("We are attempting to redeem..");
      address vault = sanctum.vault();
      IVault(vault).redeem(1e18, 1e18);
      console.log("We are now redeeming..");
    }
    

    function transfer() public {
      console.log("We are attempting to transfer..");
      address asset = sanctum.asset();
      require(IERC20(asset).transfer(address(1), 1e18), "transfer failed");
      console.log("We are now transfering..");
    }

    function bye() public {
      console.log("We are now destructing..");
       selfdestruct(msg.sender);
    }
}
