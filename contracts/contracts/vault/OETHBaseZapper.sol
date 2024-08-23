// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IWETH9 } from "../interfaces/IWETH9.sol";

contract OETHBaseZapper {
    IERC20 public immutable oethb;
    IVault public immutable vault;

    IWETH9 public constant weth =
        IWETH9(0x4200000000000000000000000000000000000006);
    address private constant ETH_MARKER =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    event Zap(address indexed minter, address indexed asset, uint256 amount);

    constructor(address _oethb, address _vault) {
        oethb = IERC20(_oethb);
        vault = IVault(_vault);

        weth.approve(address(_vault), type(uint256).max);
    }

    /**
     * @dev Deposit ETH and receive OETH in return.
     * Will verify that the user is sent 1:1 for ETH.
     */
    receive() external payable {
        deposit();
    }

    /**
     * @dev Deposit ETH and receive superOETHb in return
     * Will verify that the user is sent 1:1 for ETH.
     * @return Amount of OETH sent to user
     */
    function deposit() public payable returns (uint256) {
        uint256 balance = address(this).balance;

        emit Zap(msg.sender, ETH_MARKER, balance);

        // Wrap ETH
        weth.deposit{ value: balance }();

        // Mint OETHb
        vault.mint(address(weth), weth.balanceOf(address(this)), balance);

        // State check
        uint256 mintedAmount = oethb.balanceOf(address(this));
        require(mintedAmount >= balance, "Zapper: not enough minted");
        require(oethb.transfer(msg.sender, mintedAmount));

        return mintedAmount;
    }
}
