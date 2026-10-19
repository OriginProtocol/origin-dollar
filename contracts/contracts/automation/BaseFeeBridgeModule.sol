// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractSafeModule } from "./AbstractSafeModule.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IRouterClient } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

import { ICurveStableSwapNG } from "../interfaces/ICurveStableSwapNG.sol";

/**
 * @title BaseFeeBridgeModule
 * @notice Gnosis Safe module that sells the Super OETH (OETHb) protocol fees held by the
 *         Base fee Safe for WETH on the Curve AMO pool and bridges that WETH over CCIP to the
 *         Ethereum FeeSplitter, where it joins the OUSD/OETH fees on their way to xOGN.
 *
 * @dev The Safe hosting this module is the vault's `trusteeAddress`, so fees are minted to it
 *      as OETHb on every rebase.
 *
 *      Safety properties:
 *
 *      1. The destination is fixed at construction. An operator can only move OETHb fees to
 *         the FeeSplitter, never to an address of its choosing.
 *      2. The route is fixed at construction: one Curve pool, OETHb in, WETH out.
 *      3. The swap has an on-chain slippage floor against par. OETHb is redeemable 1:1 for WETH
 *         at the vault, so par is a valid reference that needs no oracle, and the floor caps
 *         what a compromised operator key can lose to a sandwich.
 *      4. Only the WETH the swap produced is bridged, so any other WETH the Safe holds stays put.
 *
 *      A swap is used instead of a vault redeem because a redeem is two-step (request, then a
 *      claim after `withdrawalClaimDelay` once the queue has liquidity). The pool costs a few
 *      basis points on amounts this small.
 *
 *      The CCIP fee is paid in native ETH from the Safe, so the Safe must hold some ETH. The
 *      message is token-only (empty data, zero gas limit), so CCIP releases the WETH to the
 *      FeeSplitter without calling it, and the FeeSplitter needs no CCIP receiver interface.
 *
 *      The Safe must call `enableModule(address(this))` before this module can do anything.
 */
contract BaseFeeBridgeModule is AbstractSafeModule {
    /// @notice Upper bound for `maxSlippageBps`, so a misconfiguration cannot open the floor.
    uint256 public constant MAX_SLIPPAGE_BPS = 100;

    IERC20 public immutable oethb;
    IERC20 public immutable weth;
    ICurveStableSwapNG public immutable curvePool;
    int128 public immutable oethbIndex;
    int128 public immutable wethIndex;

    IRouterClient public immutable ccipRouter;
    uint64 public immutable destinationChainSelector;
    /// @notice FeeSplitter on the destination chain that receives the bridged WETH.
    address public immutable feeSplitter;

    /// @notice Maximum discount to par accepted on the OETHb -> WETH swap, in basis points.
    uint256 public maxSlippageBps;

    event MaxSlippageBpsUpdated(uint256 maxSlippageBps);
    event FeesBridged(uint256 oethbAmount, uint256 wethAmount, uint256 ccipFee);

    constructor(
        address _safeContract,
        address _operator,
        address _oethb,
        address _weth,
        address _curvePool,
        address _ccipRouter,
        uint64 _destinationChainSelector,
        address _feeSplitter,
        uint256 _maxSlippageBps
    ) AbstractSafeModule(_safeContract) {
        require(_operator != address(0), "Invalid operator");
        require(_feeSplitter != address(0), "Invalid fee splitter");

        oethb = IERC20(_oethb);
        weth = IERC20(_weth);
        curvePool = ICurveStableSwapNG(_curvePool);

        address coin0 = curvePool.coins(0);
        address coin1 = curvePool.coins(1);
        if (coin0 == _oethb && coin1 == _weth) {
            oethbIndex = 0;
            wethIndex = 1;
        } else {
            require(coin0 == _weth && coin1 == _oethb, "Pool coins mismatch");
            oethbIndex = 1;
            wethIndex = 0;
        }

        ccipRouter = IRouterClient(_ccipRouter);
        destinationChainSelector = _destinationChainSelector;
        feeSplitter = _feeSplitter;

        _setMaxSlippageBps(_maxSlippageBps);
        _grantRole(OPERATOR_ROLE, _operator);
    }

    /**
     * @notice Sell OETHb from the Safe for WETH on the Curve pool and bridge the WETH to the
     *         FeeSplitter on the destination chain.
     * @param oethbAmount Amount of OETHb to sell.
     * @param minWethOut  Minimum WETH out. Must be at or above the par floor set by
     *                    `maxSlippageBps`; the operator passes a tighter value from a quote.
     */
    // The before/after WETH read is the point: it measures what the swap paid the Safe. The only
    // external calls go to the Safe, which calls the fixed pool and router set at construction.
    // slither-disable-start reentrancy-balance,reentrancy-events
    function swapAndBridge(uint256 oethbAmount, uint256 minWethOut)
        external
        onlyOperator
    {
        require(oethbAmount > 0, "Invalid amount");
        require(
            minWethOut >= (oethbAmount * (1e4 - maxSlippageBps)) / 1e4,
            "Min out below floor"
        );

        uint256 wethBefore = weth.balanceOf(address(safeContract));

        _exec(
            address(oethb),
            0,
            abi.encodeWithSelector(
                oethb.approve.selector,
                address(curvePool),
                oethbAmount
            ),
            "Failed to approve OETHb"
        );
        _exec(
            address(curvePool),
            0,
            // `exchange` is overloaded on StableSwap-NG; pick the receiver-less variant.
            abi.encodeWithSignature(
                "exchange(int128,int128,uint256,uint256)",
                oethbIndex,
                wethIndex,
                oethbAmount,
                minWethOut
            ),
            "Swap failed"
        );

        uint256 wethAmount = weth.balanceOf(address(safeContract)) - wethBefore;
        // A Safe module call to a codeless or misbehaving pool can report success without
        // paying out, so check the delivered amount rather than trusting the call.
        require(wethAmount >= minWethOut, "Insufficient WETH out");

        uint256 ccipFee = _bridgeWETH(wethAmount);

        emit FeesBridged(oethbAmount, wethAmount, ccipFee);
    }

    // slither-disable-end reentrancy-balance,reentrancy-events

    /**
     * @notice Native CCIP fee the Safe would pay to bridge `wethAmount` to the FeeSplitter.
     * @dev The fee is roughly flat per message, so the operator uses this to batch fees until
     *      the bridge cost is a small share of the amount.
     */
    function bridgeFee(uint256 wethAmount) external view returns (uint256) {
        return
            ccipRouter.getFee(
                destinationChainSelector,
                _ccipMessage(wethAmount)
            );
    }

    /**
     * @notice Set the maximum discount to par accepted on the swap.
     * @param _maxSlippageBps New bound in basis points, at most `MAX_SLIPPAGE_BPS`.
     */
    function setMaxSlippageBps(uint256 _maxSlippageBps) external onlySafe {
        _setMaxSlippageBps(_maxSlippageBps);
    }

    function _setMaxSlippageBps(uint256 _maxSlippageBps) internal {
        require(_maxSlippageBps <= MAX_SLIPPAGE_BPS, "Slippage too high");
        maxSlippageBps = _maxSlippageBps;
        emit MaxSlippageBpsUpdated(_maxSlippageBps);
    }

    function _bridgeWETH(uint256 amount) internal returns (uint256 ccipFee) {
        _exec(
            address(weth),
            0,
            abi.encodeWithSelector(
                weth.approve.selector,
                address(ccipRouter),
                amount
            ),
            "Failed to approve WETH"
        );

        Client.EVM2AnyMessage memory ccipMessage = _ccipMessage(amount);
        ccipFee = ccipRouter.getFee(destinationChainSelector, ccipMessage);

        _exec(
            address(ccipRouter),
            ccipFee,
            abi.encodeWithSelector(
                ccipRouter.ccipSend.selector,
                destinationChainSelector,
                ccipMessage
            ),
            "Failed to send CCIP message"
        );
    }

    function _ccipMessage(uint256 amount)
        internal
        view
        returns (Client.EVM2AnyMessage memory)
    {
        Client.EVMTokenAmount[]
            memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({
            token: address(weth),
            amount: amount
        });

        return
            Client.EVM2AnyMessage({
                receiver: abi.encode(feeSplitter),
                data: "",
                tokenAmounts: tokenAmounts,
                extraArgs: Client._argsToBytes(
                    Client.EVMExtraArgsV1({ gasLimit: 0 })
                ),
                feeToken: address(0) // pay in native from the Safe
            });
    }

    function _exec(
        address to,
        uint256 value,
        bytes memory data,
        string memory error
    ) internal {
        bool success = safeContract.execTransactionFromModule(
            to,
            value,
            data,
            0 // Call
        );
        require(success, error);
    }
}
