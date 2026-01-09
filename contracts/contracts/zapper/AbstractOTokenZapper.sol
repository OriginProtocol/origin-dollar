// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IWETH9 } from "../interfaces/IWETH9.sol";
import { IERC4626 } from "../../lib/openzeppelin/interfaces/IERC4626.sol";

abstract contract AbstractOTokenZapper {
    IERC20 public immutable oToken;
    IERC4626 public immutable wOToken;
    IVault public immutable vault;

    IWETH9 public immutable weth;

    address private constant ETH_MARKER =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    event Zap(address indexed minter, address indexed asset, uint256 amount);

    constructor(
        address _oToken,
        address _wOToken,
        address _vault,
        address _weth
    ) {
        oToken = IERC20(_oToken);
        wOToken = IERC4626(_wOToken);
        vault = IVault(_vault);
        weth = IWETH9(_weth);

        IWETH9(_weth).approve(address(_vault), type(uint256).max);
        IERC20(_oToken).approve(_wOToken, type(uint256).max);
    }

    /**
     * @dev Deposit ETH and receive OToken in return.
     * Will verify that the user is sent 1:1 for ETH.
     */
    receive() external payable {
        deposit();
    }

    /**
     * @dev Deposit ETH and receive OToken in return
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
        uint256 mintedOToken = _mint(balance, address(this));

        // Wrap OToken into wOToken
        uint256 mintedWOToken = wOToken.deposit(mintedOToken, msg.sender);

        require(mintedWOToken >= minReceived, "Zapper: not enough minted");

        return mintedWOToken;
    }

    /**
     * @dev Deposit WETH and receive OToken in return
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
        uint256 mintedOToken = _mint(wethAmount, address(this));

        // Wrap OToken into wOToken
        uint256 mintedWOToken = wOToken.deposit(mintedOToken, msg.sender);

        require(mintedWOToken >= minReceived, "Zapper: not enough minted");

        return mintedWOToken;
    }

    /**
     * @dev Internal function to mint superOETHb with WETH
     * @param minOToken Minimum amount of OToken to for user to receive
     * @param recipient Address that receives the tokens
     * @return Amount of OToken sent to user
     */
    function _mint(uint256 minOToken, address recipient)
        internal
        returns (uint256)
    {
        uint256 toMint = weth.balanceOf(address(this));
        vault.mint(address(weth), toMint, minOToken);
        uint256 mintedAmount = oToken.balanceOf(address(this));
        require(mintedAmount >= minOToken, "Zapper: not enough minted");

        if (recipient != address(this)) {
            require(oToken.transfer(recipient, mintedAmount));
        }

        return mintedAmount;
    }
}
