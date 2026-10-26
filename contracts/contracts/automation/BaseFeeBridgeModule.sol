// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractSafeModule } from "./AbstractSafeModule.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IRouterClient } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

import { IVault } from "../interfaces/IVault.sol";

/**
 * @title BaseFeeBridgeModule
 * @notice Gnosis Safe module that redeems the Super OETH (OETHb) protocol fees held by the
 *         Base fee Safe for WETH through the vault's withdrawal queue and bridges that WETH
 *         over CCIP to the Ethereum FeeSplitter, where it joins the OUSD/OETH fees on their
 *         way to xOGN.
 *
 * @dev The Safe hosting this module is the vault's `trusteeAddress`, so fees are minted to it
 *      as OETHb on every rebase.
 *
 *      The redeem is the vault's async withdrawal: `requestWithdrawal` burns OETHb 1:1, and
 *      `claimAndBridge` claims the WETH once `withdrawalClaimDelay` has passed and the queue
 *      has the liquidity. It is 1:1, so there is no price exposure and no slippage bound.
 *
 *      Safety properties:
 *
 *      1. The destination is fixed at construction. An operator can only move OETHb fees to
 *         the FeeSplitter, never to an address of its choosing.
 *      2. Only the WETH the claim paid out is bridged, so any other WETH the Safe holds stays.
 *      3. At most one request is open at a time, so the module never has to track a list and
 *         the operator cannot fragment the fees across requests.
 *      4. Each request is at least `MIN_WITHDRAWAL_AMOUNT`, which bounds both the CCIP fee share
 *         of a bridge and how fast a compromised operator can spend the Safe's ETH on fees.
 *
 *      If a Safe owner claims the pending request directly on the vault, every later claim
 *      through the module would revert with "Already claimed"; the Safe then calls
 *      `clearPendingRequest` to reset the module.
 *
 *      The CCIP fee is paid in native ETH from the Safe, so the Safe must hold some ETH. The
 *      message is token-only (empty data, zero gas limit), so CCIP releases the WETH to the
 *      FeeSplitter without calling it, and the FeeSplitter needs no CCIP receiver interface.
 *
 *      The Safe must call `enableModule(address(this))` before this module can do anything.
 */
contract BaseFeeBridgeModule is AbstractSafeModule {
    /// @notice Smallest OETHb amount a request may redeem. The CCIP fee is roughly flat per
    ///         message (~0.019 ETH), so without a floor an operator key could bridge dust every
    ///         claim delay and drain the Safe's ETH; at 1 OETHb a bridge pays at most ~2% in fees.
    uint256 public constant MIN_WITHDRAWAL_AMOUNT = 1 ether;

    IVault public immutable vault;
    /// @notice The vault's asset, paid out by the withdrawal queue and bridged.
    IERC20 public immutable weth;

    IRouterClient public immutable ccipRouter;
    uint64 public immutable destinationChainSelector;
    /// @notice FeeSplitter on the destination chain that receives the bridged WETH.
    address public immutable feeSplitter;

    /// @notice Vault withdrawal request opened by this module and not yet claimed.
    uint256 public pendingRequestId;
    bool public hasPendingRequest;
    /// @notice Time of the last request, so the operator can space requests out.
    uint256 public lastRequestAt;

    event WithdrawalRequested(uint256 indexed requestId, uint256 oethbAmount);
    event FeesBridged(
        uint256 indexed requestId,
        uint256 wethAmount,
        uint256 ccipFee
    );
    event PendingRequestCleared(uint256 indexed requestId);

    constructor(
        address _safeContract,
        address _operator,
        address _vault,
        address _ccipRouter,
        uint64 _destinationChainSelector,
        address _feeSplitter
    ) AbstractSafeModule(_safeContract) {
        require(_operator != address(0), "Invalid operator");
        require(_feeSplitter != address(0), "Invalid fee splitter");

        vault = IVault(_vault);
        weth = IERC20(vault.asset());
        ccipRouter = IRouterClient(_ccipRouter);
        destinationChainSelector = _destinationChainSelector;
        feeSplitter = _feeSplitter;

        _grantRole(OPERATOR_ROLE, _operator);
    }

    /**
     * @notice Open a vault withdrawal request for OETHb held by the Safe.
     * @param oethbAmount Amount of OETHb to burn; the claim pays the same amount of WETH.
     */
    // Events follow the Safe call because they report what it did. The only external calls go
    // to the Safe, which calls the fixed vault and router.
    // slither-disable-next-line reentrancy-events
    function requestWithdrawal(uint256 oethbAmount) external onlyOperator {
        require(!hasPendingRequest, "Request pending");
        require(oethbAmount >= MIN_WITHDRAWAL_AMOUNT, "Amount below minimum");

        // The vault assigns ids sequentially, and nothing can interleave between this read
        // and the request below, so this is the id the request will get.
        uint256 requestId = vault.withdrawalQueueMetadata().nextWithdrawalIndex;
        pendingRequestId = requestId;
        hasPendingRequest = true;
        lastRequestAt = block.timestamp;

        _exec(
            address(vault),
            0,
            abi.encodeWithSelector(
                vault.requestWithdrawal.selector,
                oethbAmount
            ),
            "Withdrawal request failed"
        );
        // A Safe module call to a codeless or misbehaving target can report success without
        // doing anything, so confirm the request exists rather than trusting the call.
        require(
            vault.withdrawalRequests(requestId).withdrawer ==
                address(safeContract),
            "Request not recorded"
        );

        emit WithdrawalRequested(requestId, oethbAmount);
    }

    /**
     * @notice Claim the pending withdrawal and bridge the WETH to the FeeSplitter on the
     *         destination chain.
     */
    // The before/after WETH read is the point: it measures what the claim paid the Safe. The
    // only external calls go to the Safe, which calls the fixed vault and router.
    // slither-disable-start reentrancy-balance,reentrancy-events
    function claimAndBridge() external onlyOperator {
        require(hasPendingRequest, "No pending request");
        uint256 requestId = pendingRequestId;
        hasPendingRequest = false;

        uint256 wethBefore = weth.balanceOf(address(safeContract));
        _exec(
            address(vault),
            0,
            abi.encodeWithSelector(vault.claimWithdrawal.selector, requestId),
            "Withdrawal claim failed"
        );
        uint256 wethAmount = weth.balanceOf(address(safeContract)) - wethBefore;
        require(wethAmount > 0, "Nothing claimed");

        uint256 ccipFee = _bridgeWETH(wethAmount);

        emit FeesBridged(requestId, wethAmount, ccipFee);
    }

    // slither-disable-end reentrancy-balance,reentrancy-events

    /**
     * @notice Forget the pending request, e.g. after a Safe owner claimed it on the vault.
     */
    function clearPendingRequest() external onlySafe {
        require(hasPendingRequest, "No pending request");
        hasPendingRequest = false;
        emit PendingRequestCleared(pendingRequestId);
    }

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
