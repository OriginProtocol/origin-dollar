// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IVault } from "../interfaces/IVault.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// solhint-disable-next-line no-console
import "hardhat/console.sol";

contract Sanctum {
    address public asset;
    address public vault;
    address public reborner;
    bool public shouldAttack = false;
    // should selfdestruct in the constructor
    bool public shouldDestruct = false;
    uint256 public targetMethod;
    address public ousdContract;

    constructor(address _asset, address _vault) {
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
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                bytecodeHashHash
            )
        );
        return address(bytes20(_data << 96));
    }

    function setShouldAttack(bool _shouldAttack) public {
        shouldAttack = _shouldAttack;
    }

    // should call selfdestruct in the constructor
    function setShouldDesctruct(bool _shouldDestruct) public {
        shouldDestruct = _shouldDestruct;
    }

    function setTargetMethod(uint256 target) public {
        targetMethod = target;
    }

    function setOUSDAddress(address _ousdContract) public {
        ousdContract = _ousdContract;
    }
}

contract Reborner {
    Sanctum sanctum;
    bool logging = false;

    constructor(address _sanctum) {
        log("We are created...");
        sanctum = Sanctum(_sanctum);
        if (sanctum.shouldAttack()) {
            log("We are attacking now...");

            uint256 target = sanctum.targetMethod();

            if (target == 1) {
                redeem();
            } else if (target == 2) {
                transfer();
            } else {
                mint();
            }
        }

        if (sanctum.shouldDestruct()) {
            bye();
        }
    }

    function mint() public {
        log("We are attempting to mint..");
        address asset = sanctum.asset();
        address vault = sanctum.vault();
        IERC20(asset).approve(vault, 1e18);
        IVault(vault).mint(asset, 1e18, 0);
        log("We are now minting..");
    }

    function redeem() public {
        log("We are attempting to redeem..");
        address vault = sanctum.vault();
        IVault(vault).redeem(1e18, 1e18);
        log("We are now redeeming..");
    }

    function transfer() public {
        log("We are attempting to transfer..");
        address ousd = sanctum.ousdContract();
        require(IERC20(ousd).transfer(address(1), 1e18), "transfer failed");
        log("We are now transfering..");
    }

    function bye() public {
        log("We are now destructing..");
        selfdestruct(payable(msg.sender));
    }

    function log(string memory message) internal view {
        if (logging) {
            // solhint-disable-next-line no-console
            console.log(message);
        }
    }
}
