// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IWETH9 } from "../interfaces/IWETH9.sol";
import { ISfrxETH } from "../interfaces/ISfrxETH.sol";

contract OETHZapper {
    IERC20 immutable oeth;
    IVault immutable vault;
    
    IWETH9 constant weth = IWETH9(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IERC20 constant frxeth = IERC20(0x5E8422345238F34275888049021821E8E08CAa1f);
    ISfrxETH constant sfrxeth =
        ISfrxETH(0xac3E018457B222d93114458476f3E3416Abbe38F);
    address constant ETH_MARKER = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    event MintFrom(
        address indexed minter,
        address indexed asset,
        uint256 amount
    );

    constructor(address _oeth, address _vault) {
        oeth = IERC20(_oeth);
        vault = IVault(_vault);

        // slither-disable-next-line unused-return
        weth.approve(address(_vault), type(uint256).max);
        // slither-disable-next-line unused-return
        frxeth.approve(address(_vault), type(uint256).max);
    }

    receive() external payable {
        deposit();
    }

    function deposit() public payable returns (uint256) {
        weth.deposit{ value: msg.value }();
        emit MintFrom(msg.sender, ETH_MARKER, msg.value);
        return _mint(address(weth), msg.value);
    }

    function depositSFRXETH(uint256 amount, uint256 minOETH)
        external
        returns (uint256)
    {
        // slither-disable-next-line unused-return
        sfrxeth.redeem(amount, address(this), msg.sender);
        emit MintFrom(msg.sender, address(sfrxeth), amount);
        return _mint(address(frxeth), minOETH);
    }

    function _mint(address asset, uint256 minOETH) internal returns (uint256) {
        uint256 toMint = IERC20(asset).balanceOf(address(this));
        vault.mint(asset, toMint, minOETH);
        uint256 mintedAmount = oeth.balanceOf(address(this));
        require(mintedAmount >= minOETH, "Zapper: not enough minted");
        // slither-disable-next-line unchecked-transfer
        oeth.transfer(msg.sender, mintedAmount);
        return mintedAmount;
    }
}
