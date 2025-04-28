// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IWETH9 } from "../interfaces/IWETH9.sol";
import { ISfrxETH } from "../interfaces/ISfrxETH.sol";

contract OETHZapper {
    IERC20 public immutable oeth;
    IVault public immutable vault;

    IWETH9 public constant weth =
        IWETH9(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IERC20 public constant frxeth =
        IERC20(0x5E8422345238F34275888049021821E8E08CAa1f);
    ISfrxETH public constant sfrxeth =
        ISfrxETH(0xac3E018457B222d93114458476f3E3416Abbe38F);
    address private constant ETH_MARKER =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    event Zap(address indexed minter, address indexed asset, uint256 amount);

    constructor(address _oeth, address _vault) {
        oeth = IERC20(_oeth);
        vault = IVault(_vault);

        weth.approve(address(_vault), type(uint256).max);
        frxeth.approve(address(_vault), type(uint256).max);
    }

    /**
     * @dev Deposit ETH and receive OETH in return.
     * Will verify that the user is sent 1:1 for ETH.
     */
    receive() external payable {
        deposit();
    }

    /**
     * @dev Deposit ETH and receive OETH in return
     * Will verify that the user is sent 1:1 for ETH.
     * @return Amount of OETH sent to user
     */
    function deposit() public payable returns (uint256) {
        uint256 balance = address(this).balance;
        weth.deposit{ value: balance }();
        emit Zap(msg.sender, ETH_MARKER, balance);
        return _mint(address(weth), balance);
    }

    /**
     * @dev Deposit SFRXETH to the vault and receive OETH in return
     * @param amount Amount of SFRXETH to deposit
     * @param minOETH Minimum amount of OETH to receive
     * @return Amount of OETH sent to user
     */
    function depositSFRXETH(uint256 amount, uint256 minOETH)
        external
        returns (uint256)
    {
        sfrxeth.redeem(amount, address(this), msg.sender);
        emit Zap(msg.sender, address(sfrxeth), amount);
        return _mint(address(frxeth), minOETH);
    }

    /**
     * @dev Internal function to mint OETH from an asset
     * @param asset Address of asset for the vault to mint from
     * @param minOETH Minimum amount of OETH to for user to receive
     * @return Amount of OETH sent to user
     */
    function _mint(address asset, uint256 minOETH) internal returns (uint256) {
        uint256 toMint = IERC20(asset).balanceOf(address(this));
        vault.mint(asset, toMint, minOETH);
        uint256 mintedAmount = oeth.balanceOf(address(this));
        require(mintedAmount >= minOETH, "Zapper: not enough minted");
        require(oeth.transfer(msg.sender, mintedAmount));
        return mintedAmount;
    }
}
