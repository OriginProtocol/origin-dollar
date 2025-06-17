// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractLZBridgeHelperModule } from "./AbstractLZBridgeHelperModule.sol";

import { AccessControlEnumerable } from "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import { ISafe } from "../interfaces/ISafe.sol";

import { SendParam } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { OptionsBuilder } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import { IOFT } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { MessagingReceipt, MessagingFee } from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC4626 } from "../../lib/openzeppelin/interfaces/IERC4626.sol";
import { IWETH9 } from "../interfaces/IWETH9.sol";
import { IVault } from "../interfaces/IVault.sol";

import { BridgedWOETHStrategy } from "../strategies/BridgedWOETHStrategy.sol";

contract PlumeBridgeHelperModule is
    AccessControlEnumerable,
    AbstractLZBridgeHelperModule
{
    IVault public constant vault =
        IVault(0xc8c8F8bEA5631A8AF26440AF32a55002138cB76a);
    IWETH9 public constant weth =
        IWETH9(0xca59cA09E5602fAe8B629DeE83FfA819741f14be);
    IERC20 public constant oethp =
        IERC20(0xFCbe50DbE43bF7E5C88C6F6Fb9ef432D4165406E);
    IERC4626 public constant bridgedWOETH =
        IERC4626(0xD8724322f44E5c58D7A815F542036fb17DbbF839);

    uint32 public constant LZ_ETHEREUM_ENDPOINT_ID = 30101;
    IOFT public constant LZ_WOETH_OMNICHAIN_ADAPTER =
        IOFT(0x592CB6A596E7919930bF49a27AdAeCA7C055e4DB);
    IOFT public constant LZ_ETH_OMNICHAIN_ADAPTER =
        IOFT(0x4683CE822272CD66CEa73F5F1f9f5cBcaEF4F066);

    BridgedWOETHStrategy public constant bridgedWOETHStrategy =
        BridgedWOETHStrategy(0x1E3EdD5e019207D6355Ea77F724b1F1BF639B569);

    constructor(address _safeContract)
        AbstractLZBridgeHelperModule(_safeContract)
    {}

    /**
     * @dev Bridges wOETH to Ethereum.
     * @param woethAmount Amount of wOETH to bridge.
     * @param slippageBps Slippage in 10^4 basis points.
     */
    function bridgeWOETHToEthereum(uint256 woethAmount, uint256 slippageBps)
        external
        payable
        onlyOperator
    {
        _bridgeTokenWithLz(
            LZ_ETHEREUM_ENDPOINT_ID,
            IERC20(address(bridgedWOETH)),
            LZ_WOETH_OMNICHAIN_ADAPTER,
            woethAmount,
            slippageBps,
            false
        );
    }

    /**
     * @dev Bridges wETH to Ethereum.
     * @param wethAmount Amount of wETH to bridge.
     * @param slippageBps Slippage in 10^4 basis points.
     */
    function bridgeWETHToEthereum(uint256 wethAmount, uint256 slippageBps)
        external
        payable
        onlyOperator
    {
        _bridgeTokenWithLz(
            LZ_ETHEREUM_ENDPOINT_ID,
            IERC20(address(weth)),
            LZ_ETH_OMNICHAIN_ADAPTER,
            wethAmount,
            slippageBps,
            false
        );
    }

    /**
     * @dev Deposits wOETH into the bridgedWOETH strategy.
     * @param woethAmount Amount of wOETH to deposit.
     * @param redeemWithVault Whether to redeem with Vault.
     * @return Amount of OETHp received.
     */
    function depositWOETH(uint256 woethAmount, bool redeemWithVault)
        external
        onlyOperator
        returns (uint256)
    {
        return _depositWOETH(woethAmount, redeemWithVault);
    }

    /**
     * @dev Deposits wOETH into the bridgedWOETH strategy and bridges it to Ethereum.
     * @param woethAmount Amount of wOETH to deposit.
     * @param slippageBps Slippage in 10^4 basis points.
     * @return Amount of WETH received.
     */
    function depositWOETHAndBridgeWETH(uint256 woethAmount, uint256 slippageBps)
        external
        onlyOperator
        returns (uint256)
    {
        uint256 wethAmount = _depositWOETH(woethAmount, true);
        _bridgeTokenWithLz(
            LZ_ETHEREUM_ENDPOINT_ID,
            IERC20(address(weth)),
            LZ_WOETH_OMNICHAIN_ADAPTER,
            wethAmount,
            slippageBps,
            false
        );
    }

    /**
     * @dev Deposits wOETH into the bridgedWOETH strategy.
     * @param woethAmount Amount of wOETH to deposit.
     * @param redeemWithVault Whether to redeem with Vault.
     * @return Amount of OETHp received.
     */
    function _depositWOETH(uint256 woethAmount, bool redeemWithVault)
        internal
        returns (uint256)
    {
        // Update oracle price
        bridgedWOETHStrategy.updateWOETHOraclePrice();

        // Rebase to account for any yields from price update
        vault.rebase();

        uint256 oethpAmount = oethp.balanceOf(address(this));

        // Approve bridgedWOETH strategy to move wOETH
        bool success = safeContract.execTransactionFromModule(
            address(bridgedWOETH),
            0, // Value
            abi.encodeWithSelector(
                bridgedWOETH.approve.selector,
                address(bridgedWOETHStrategy),
                woethAmount
            ),
            0 // Call
        );

        // Deposit to bridgedWOETH strategy
        success = safeContract.execTransactionFromModule(
            address(bridgedWOETHStrategy),
            0, // Value
            abi.encodeWithSelector(
                bridgedWOETHStrategy.depositBridgedWOETH.selector,
                woethAmount
            ),
            0 // Call
        );
        require(success, "Failed to deposit bridged WOETH");

        oethpAmount = oethp.balanceOf(address(this)) - oethpAmount;

        // Rebase to account for any yields from price update
        // and backing asset change from deposit
        vault.rebase();

        if (!redeemWithVault) {
            return oethpAmount;
        }

        // Redeem for WETH using Vault
        success = safeContract.execTransactionFromModule(
            address(vault),
            0, // Value
            abi.encodeWithSelector(
                vault.redeem.selector,
                oethpAmount,
                oethpAmount
            ),
            0 // Call
        );
        require(success, "Failed to redeem OETHp");

        return oethpAmount;
    }

    /**
     * @dev Deposits wETH into the vault.
     * @param wethAmount Amount of wETH to deposit.
     * @return Amount of OETHp received.
     */
    function depositWETHAndRedeemWOETH(uint256 wethAmount)
        external
        onlyOperator
        returns (uint256)
    {
        return _withdrawWOETH(wethAmount);
    }

    /**
     * @dev Deposits wETH into the vault and bridges it to Ethereum.
     * @param wethAmount Amount of wETH to deposit.
     * @param slippageBps Slippage in 10^4 basis points.
     * @return Amount of WOETH received.
     */
    function depositWETHAndBridgeWOETH(uint256 wethAmount, uint256 slippageBps)
        external
        onlyOperator
        returns (uint256)
    {
        uint256 woethAmount = _withdrawWOETH(wethAmount);
        _bridgeTokenWithLz(
            LZ_ETHEREUM_ENDPOINT_ID,
            IERC20(address(bridgedWOETH)),
            LZ_WOETH_OMNICHAIN_ADAPTER,
            woethAmount,
            slippageBps,
            false
        );
        return woethAmount;
    }

    /**
     * @dev Withdraws wOETH from the bridgedWOETH strategy.
     * @param wethAmount Amount of WETH to use to withdraw.
     * @return Amount of wOETH received.
     */
    function _withdrawWOETH(uint256 wethAmount) internal returns (uint256) {
        // Approve Vault to move WETH
        bool success = safeContract.execTransactionFromModule(
            address(weth),
            0, // Value
            abi.encodeWithSelector(
                weth.approve.selector,
                address(vault),
                wethAmount
            ),
            0 // Call
        );
        require(success, "Failed to approve WETH");

        // Mint OETHp with WETH
        success = safeContract.execTransactionFromModule(
            address(vault),
            0, // Value
            abi.encodeWithSelector(
                vault.mint.selector,
                address(weth),
                wethAmount,
                wethAmount
            ),
            0 // Call
        );
        require(success, "Failed to mint OETHp");

        // Approve bridgedWOETH strategy to move OETHp
        success = safeContract.execTransactionFromModule(
            address(oethp),
            0, // Value
            abi.encodeWithSelector(
                oethp.approve.selector,
                address(bridgedWOETHStrategy),
                wethAmount
            ),
            0 // Call
        );
        require(success, "Failed to approve OETHp");

        uint256 woethAmount = bridgedWOETH.balanceOf(address(this));

        // Withdraw from bridgedWOETH strategy
        success = safeContract.execTransactionFromModule(
            address(bridgedWOETHStrategy),
            0, // Value
            abi.encodeWithSelector(
                bridgedWOETHStrategy.withdrawBridgedWOETH.selector,
                wethAmount
            ),
            0 // Call
        );
        require(success, "Failed to withdraw bridged WOETH");

        woethAmount = bridgedWOETH.balanceOf(address(this)) - woethAmount;

        return woethAmount;
    }
}
