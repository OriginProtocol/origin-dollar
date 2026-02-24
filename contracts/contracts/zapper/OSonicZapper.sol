// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IWrappedSonic } from "../interfaces/sonic/IWrappedSonic.sol";
import { IERC4626 } from "../../lib/openzeppelin/interfaces/IERC4626.sol";

/**
 * @title Zapper for Origin Sonic (OS) tokens
 * @author Origin Protocol Inc
 */
contract OSonicZapper {
    IERC20 public immutable OS;
    IERC4626 public immutable wOS;
    IVault public immutable vault;

    IWrappedSonic public constant wS =
        IWrappedSonic(0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38);
    address private constant ETH_MARKER =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    event Zap(address indexed minter, address indexed asset, uint256 amount);

    constructor(
        address _OS,
        address _wOS,
        address _vault
    ) {
        OS = IERC20(_OS);
        wOS = IERC4626(_wOS);
        vault = IVault(_vault);

        wS.approve(address(_vault), type(uint256).max);
        IERC20(_OS).approve(_wOS, type(uint256).max);
    }

    /**
     * @dev Deposit native S currency and receive Origin Sonic (OS) tokens in return.
     * Will verify that the user is sent 1:1 for S.
     */
    receive() external payable {
        deposit();
    }

    /**
     * @dev Deposit native S currency and receive Origin Sonic (OS) tokens in return.
     * Will verify that the user is sent 1:1 for S.
     * @return Amount of Origin Sonic (OS) tokens sent to user
     */
    function deposit() public payable returns (uint256) {
        uint256 balance = address(this).balance;

        emit Zap(msg.sender, ETH_MARKER, balance);

        // Wrap native S
        wS.deposit{ value: balance }();

        // Mint Origin Sonic (OS) with Wrapped Sonic (wS)
        return _mint(balance, msg.sender);
    }

    /**
     * @dev Deposit S and receive Wrapped Origin Sonic (wOS) in return
     * @param minReceived min amount of Wrapped Origin Sonic (wOS) to receive
     * @return Amount of Wrapped Origin Sonic (wOS) tokens sent to user
     */
    function depositSForWrappedTokens(uint256 minReceived)
        external
        payable
        returns (uint256)
    {
        uint256 balance = address(this).balance;

        emit Zap(msg.sender, ETH_MARKER, balance);

        // Wrap S
        wS.deposit{ value: balance }();

        // Mint with Wrapped Sonic
        uint256 mintOS = _mint(balance, address(this));

        // Wrap Origin Sonic (OS) into Wrapped Origin Sonic (wOS)
        uint256 mintedWOS = wOS.deposit(mintOS, msg.sender);

        require(mintedWOS >= minReceived, "Zapper: not enough minted");

        return mintedWOS;
    }

    /**
     * @dev Deposit Wrapped Sonic (wS) tokens and receive Wrapped Origin Sonic (wOS) tokens in return
     * @param wSAmount Amount of Wrapped Sonic (wS) to deposit
     * @param minReceived min amount of Wrapped Origin Sonic (wOS) token to receive
     * @return Amount of Wrapped Origin Sonic (wOS) tokens sent to user
     */
    function depositWSForWrappedTokens(uint256 wSAmount, uint256 minReceived)
        external
        returns (uint256)
    {
        // slither-disable-next-line unchecked-transfer unused-return
        wS.transferFrom(msg.sender, address(this), wSAmount);

        emit Zap(msg.sender, address(wS), wSAmount);

        // Mint with Wrapped Sonic (wS)
        uint256 mintedOS = _mint(wSAmount, address(this));

        // Wrap Origin Sonic (OS) tokens into Wrapped Origin Sonic (wOS) tokens
        uint256 mintedWOS = wOS.deposit(mintedOS, msg.sender);

        require(mintedWOS >= minReceived, "Zapper: not enough minted");

        return mintedWOS;
    }

    /**
     * @dev Internal function to mint Origin Sonic (OS) with Wrapped S (wS)
     * @param minOS Minimum amount of Origin Sonic (OS) tokens the user can receive
     * @param recipient Address that receives the tokens
     * @return Amount of Origin Sonic (OS) tokens sent to the recipient
     */
    function _mint(uint256 minOS, address recipient)
        internal
        returns (uint256)
    {
        uint256 toMint = wS.balanceOf(address(this));
        vault.mint(toMint);
        uint256 mintedAmount = OS.balanceOf(address(this));
        require(mintedAmount >= minOS, "Zapper: not enough minted");

        if (recipient != address(this)) {
            require(OS.transfer(recipient, mintedAmount));
        }

        return mintedAmount;
    }
}
