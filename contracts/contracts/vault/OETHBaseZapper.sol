// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IWETH9 } from "../interfaces/IWETH9.sol";
import { IERC4626 } from "../../lib/openzeppelin/interfaces/IERC4626.sol";

contract OETHBaseZapper {
    IERC20 public immutable oethb;
    IERC4626 public immutable woethb;
    IVault public immutable vault;

    IWETH9 public constant weth =
        IWETH9(0x4200000000000000000000000000000000000006);
    address private constant ETH_MARKER =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    event Zap(address indexed minter, address indexed asset, uint256 amount);

    constructor(
        address _oethb,
        address _woethb,
        address _vault
    ) {
        oethb = IERC20(_oethb);
        woethb = IERC4626(_woethb);
        vault = IVault(_vault);

        weth.approve(address(_vault), type(uint256).max);
        IERC20(_oethb).approve(_woethb, type(uint256).max);
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

        // Mint with WETH
        return _mint(balance, msg.sender);
    }

    /**
     * @dev Deposit ETH and receive superOETHb in return
     * @param minReceived min amount of wsuperOETHb to receive
     * @return Amount of wsuperOETHb sent to user
     */
    function depositETHForWrappedTokens(uint256 minReceived)
        external
        payable
        returns (uint256)
    {
        uint256 balance = address(this).balance;

        emit Zap(msg.sender, ETH_MARKER, balance);

        // Wrap ETH
        weth.deposit{ value: balance }();

        // Mint with WETH
        uint256 mintedOethb = _mint(balance, address(this));

        // Wrap superOETHb into wsuperOETHb
        uint256 mintedWoethb = woethb.deposit(mintedOethb, msg.sender);

        require(mintedWoethb >= minReceived, "Zapper: not enough minted");

        return mintedWoethb;
    }

    /**
     * @dev Deposit WETH and receive superOETHb in return
     * @param wethAmount Amount of WETH to deposit
     * @param minReceived min amount of wsuperOETHb to receive
     * @return Amount of wsuperOETHb sent to user
     */
    function depositWETHForWrappedTokens(
        uint256 wethAmount,
        uint256 minReceived
    ) external returns (uint256) {
        // slither-disable-next-line unchecked-transfer unused-return
        weth.transferFrom(msg.sender, address(this), wethAmount);

        emit Zap(msg.sender, address(weth), wethAmount);

        // Mint with WETH
        uint256 mintedOethb = _mint(wethAmount, address(this));

        // Wrap superOETHb into wsuperOETHb
        uint256 mintedWoethb = woethb.deposit(mintedOethb, msg.sender);

        require(mintedWoethb >= minReceived, "Zapper: not enough minted");

        return mintedWoethb;
    }

    /**
     * @dev Internal function to mint superOETHb with WETH
     * @param minOETH Minimum amount of OETH to for user to receive
     * @param recipient Address that receives the tokens
     * @return Amount of OETH sent to user
     */
    function _mint(uint256 minOETH, address recipient)
        internal
        returns (uint256)
    {
        uint256 toMint = weth.balanceOf(address(this));
        vault.mint(address(weth), toMint, minOETH);
        uint256 mintedAmount = oethb.balanceOf(address(this));
        require(mintedAmount >= minOETH, "Zapper: not enough minted");

        if (recipient != address(this)) {
            require(oethb.transfer(recipient, mintedAmount));
        }

        return mintedAmount;
    }
}
