// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { StableMath } from "../utils/StableMath.sol";
import { VaultCore } from "./VaultCore.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { IDripper } from "../interfaces/IDripper.sol";

/**
 * @title Origin S VaultCore contract on Sonic
 * @author Origin Protocol Inc
 */
contract OSonicVaultCore is VaultCore {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    /// @notice Sonic's Wrapped S token
    address public immutable wS;
    uint256 public constant wSAssetIndex = 0;

    constructor(address _wS) {
        wS = _wS;
    }

    // @inheritdoc VaultCore
    // slither-disable-start reentrancy-no-eth
    function _mint(
        address _asset,
        uint256 _amount,
        uint256 _minimumOusdAmount
    ) internal virtual override {
        require(_asset == wS, "Unsupported asset for minting");
        require(_amount > 0, "Amount must be greater than 0");
        require(
            _amount >= _minimumOusdAmount,
            "Mint amount lower than minimum"
        );

        emit Mint(msg.sender, _amount);

        // Rebase must happen before any transfers occur.
        if (!rebasePaused && _amount >= rebaseThreshold) {
            // Stream any harvested rewards (wS) that are available to the Vault
            IDripper(dripper).collect();

            _rebase();
        }

        // Mint oTokens
        oUSD.mint(msg.sender, _amount);

        // Transfer the deposited coins to the vault
        IERC20(_asset).safeTransferFrom(msg.sender, address(this), _amount);

        // Give priority to the withdrawal queue for the new wS liquidity
        _addWithdrawalQueueLiquidity();

        // Auto-allocate if necessary
        if (_amount >= autoAllocateThreshold) {
            _allocate();
        }
    }

    // slither-disable-end reentrancy-no-eth

    // @inheritdoc VaultCore
    function _calculateRedeemOutputs(
        uint256 _amount
    ) internal view virtual override returns (uint256[] memory outputs) {
        // Overrides `VaultCore._calculateRedeemOutputs` to redeem with only
        // wS instead of LST-mix. Doesn't change the function signature
        // for backward compatibility

        // Calculate redeem fee
        if (redeemFeeBps > 0) {
            uint256 redeemFee = _amount.mulTruncateScale(redeemFeeBps, 1e4);
            _amount = _amount - redeemFee;
        }

        // Ensure the Vault's assets line up
        require(allAssets[wSAssetIndex] == wS, "wS asset invalid");

        outputs = new uint256[](allAssets.length);
        outputs[wSAssetIndex] = _amount;
    }

    // @inheritdoc VaultCore
    function _redeem(
        uint256 _amount,
        uint256 _minimumUnitAmount
    ) internal virtual override {
        // Override `VaultCore._redeem` to simplify it. Gets rid of oracle
        // usage and looping through all assets for LST-mix redeem. Instead
        // does a simple wS-only redeem.
        emit Redeem(msg.sender, _amount);

        if (_amount == 0) {
            return;
        }

        // Amount excluding fees
        uint256 amountMinusFee = _calculateRedeemOutputs(_amount)[wSAssetIndex];

        require(
            amountMinusFee >= _minimumUnitAmount,
            "Redeem amount lower than minimum"
        );

        // Is there enough wS in the Vault available after accounting for the withdrawal queue
        require(_wSAvailable() >= amountMinusFee, "Liquidity error");

        // Transfer wS minus the fee to the redeemer
        IERC20(wS).safeTransfer(msg.sender, amountMinusFee);

        // Burn OSonic from user (including fees)
        oUSD.burn(msg.sender, _amount);

        // Prevent insolvency
        _postRedeem(_amount);
    }

    /**
     * @notice Request an asynchronous withdrawal of wS in exchange for Origin S tokens (OS).
     * The OS tokens are burned on request and the wS is transferred to the withdrawer on claim.
     * This request can be claimed once the withdrawal queue's `claimable` amount
     * is greater than or equal this request's `queued` amount.
     * There is a minimum of 10 minutes before a request can be claimed. After that, the request just needs
     * enough wS liquidity in the Vault to satisfy all the outstanding requests to that point in the queue.
     * OS is converted to wS at 1:1.
     * @param _amount Amount of OETH to burn.
     * @param requestId Unique ID for the withdrawal request
     * @param queued Cumulative total of all wS queued including already claimed requests.
     */
    function requestWithdrawal(
        uint256 _amount
    )
        external
        virtual
        whenNotCapitalPaused
        nonReentrant
        returns (uint256 requestId, uint256 queued)
    {
        require(withdrawalClaimDelay > 0, "Async withdrawals not enabled");

        // The check that the requester has enough OETH is done in to later burn call

        requestId = withdrawalQueueMetadata.nextWithdrawalIndex;
        queued = withdrawalQueueMetadata.queued + _amount;

        // Store the next withdrawal request
        withdrawalQueueMetadata.nextWithdrawalIndex = SafeCast.toUint128(
            requestId + 1
        );
        // Store the updated queued amount which reserves wS in the withdrawal queue
        // and reduces the vault's total assets
        withdrawalQueueMetadata.queued = SafeCast.toUint128(queued);
        // Store the user's withdrawal request
        withdrawalRequests[requestId] = WithdrawalRequest({
            withdrawer: msg.sender,
            claimed: false,
            timestamp: uint40(block.timestamp),
            amount: SafeCast.toUint128(_amount),
            queued: SafeCast.toUint128(queued)
        });

        // Burn the user's OETH
        oUSD.burn(msg.sender, _amount);

        // Prevent withdrawal if the vault is solvent by more than the the allowed percentage
        _postRedeem(_amount);

        emit WithdrawalRequested(msg.sender, requestId, _amount, queued);
    }

    // slither-disable-start reentrancy-no-eth
    /**
     * @notice Claim a previously requested withdrawal once it is claimable.
     * This request can be claimed once the withdrawal queue's `claimable` amount
     * is greater than or equal this request's `queued` amount and 10 minutes has passed.
     * If the requests is not claimable, the transaction will revert with `Queue pending liquidity`.
     * If the request is not older than 10 minutes, the transaction will revert with `Claim delay not met`.
     * OS is converted to wS at 1:1.
     * @param _requestId Unique ID for the withdrawal request
     * @return amount Amount of wS transferred to the withdrawer
     */
    function claimWithdrawal(
        uint256 _requestId
    )
        external
        virtual
        whenNotCapitalPaused
        nonReentrant
        returns (uint256 amount)
    {
        // Try and get more liquidity if there is not enough available
        if (
            withdrawalRequests[_requestId].queued >
            withdrawalQueueMetadata.claimable
        ) {
            // Stream any harvested rewards (wS) that are available to the Vault
            IDripper(dripper).collect();

            // Add any wS from the Dripper to the withdrawal queue
            _addWithdrawalQueueLiquidity();
        }

        amount = _claimWithdrawal(_requestId);

        // transfer wS from the vault to the withdrawer
        IERC20(wS).safeTransfer(msg.sender, amount);

        // Prevent insolvency
        _postRedeem(amount);
    }

    // slither-disable-end reentrancy-no-eth

    /**
     * @notice Claim a previously requested withdrawals once they are claimable.
     * This requests can be claimed once the withdrawal queue's `claimable` amount
     * is greater than or equal each request's `queued` amount and 10 minutes has passed.
     * If one of the requests is not claimable, the whole transaction will revert with `Queue pending liquidity`.
     * If one of the requests is not older than 10 minutes,
     * the whole transaction will revert with `Claim delay not met`.
     * @param _requestIds Unique ID of each withdrawal request
     * @return amounts Amount of wS received for each request
     * @return totalAmount Total amount of wS transferred to the withdrawer
     */
    function claimWithdrawals(
        uint256[] calldata _requestIds
    )
        external
        virtual
        whenNotCapitalPaused
        nonReentrant
        returns (uint256[] memory amounts, uint256 totalAmount)
    {
        // Just call the Dripper instead of looping through _requestIds to find the highest id
        // and checking it's queued amount is > the queue's claimable amount.

        // Stream any harvested rewards (wS) that are available to the Vault
        IDripper(dripper).collect();

        // Add any wS from the Dripper to the withdrawal queue
        _addWithdrawalQueueLiquidity();

        amounts = new uint256[](_requestIds.length);
        for (uint256 i; i < _requestIds.length; ++i) {
            amounts[i] = _claimWithdrawal(_requestIds[i]);
            totalAmount += amounts[i];
        }

        // transfer all the claimed wS from the vault to the withdrawer
        IERC20(wS).safeTransfer(msg.sender, totalAmount);

        // Prevent insolvency
        _postRedeem(totalAmount);
    }

    function _claimWithdrawal(
        uint256 requestId
    ) internal returns (uint256 amount) {
        require(withdrawalClaimDelay > 0, "Async withdrawals not enabled");

        // Load the structs from storage into memory
        WithdrawalRequest memory request = withdrawalRequests[requestId];
        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;

        require(
            request.timestamp + withdrawalClaimDelay <= block.timestamp,
            "Claim delay not met"
        );
        // If there isn't enough reserved liquidity in the queue to claim
        require(request.queued <= queue.claimable, "Queue pending liquidity");
        require(request.withdrawer == msg.sender, "Not requester");
        require(request.claimed == false, "Already claimed");

        // Store the request as claimed
        withdrawalRequests[requestId].claimed = true;
        // Store the updated claimed amount
        withdrawalQueueMetadata.claimed = queue.claimed + request.amount;

        emit WithdrawalClaimed(msg.sender, requestId, request.amount);

        return request.amount;
    }

    /// @notice Collects harvested rewards from the Dripper as wS then
    /// adds wS to the withdrawal queue if there is a funding shortfall.
    /// @dev is called from the Sonic Staking Strategy when validator withdrawals are processed.
    /// It also called before any wS is allocated to a strategy.
    function addWithdrawalQueueLiquidity() external {
        // Stream any harvested rewards (wS) that are available to the Vault
        IDripper(dripper).collect();

        _addWithdrawalQueueLiquidity();
    }

    /// @dev Adds wS to the withdrawal queue if there is a funding shortfall.
    /// This assumes 1 wS equals 1 OSonic.
    function _addWithdrawalQueueLiquidity()
        internal
        returns (uint256 addedClaimable)
    {
        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;

        // Check if the claimable wS is less than the queued amount
        uint256 queueShortfall = queue.queued - queue.claimable;

        // No need to do anything is the withdrawal queue is full funded
        if (queueShortfall == 0) {
            return 0;
        }

        uint256 wSBalance = IERC20(wS).balanceOf(address(this));

        // Of the claimable withdrawal requests, how much is unclaimed?
        // That is, the amount of wS that is currently allocated for the withdrawal queue
        uint256 allocatedWS = queue.claimable - queue.claimed;

        // If there is no unallocated wS then there is nothing to add to the queue
        if (wSBalance <= allocatedWS) {
            return 0;
        }

        uint256 unallocatedWS = wSBalance - allocatedWS;

        // the new claimable amount is the smaller of the queue shortfall or unallocated wS
        addedClaimable = queueShortfall < unallocatedWS
            ? queueShortfall
            : unallocatedWS;
        uint256 newClaimable = queue.claimable + addedClaimable;

        // Store the new claimable amount back to storage
        withdrawalQueueMetadata.claimable = SafeCast.toUint128(newClaimable);

        // emit a WithdrawalClaimable event
        emit WithdrawalClaimable(newClaimable, addedClaimable);
    }

    /***************************************
                View Functions
    ****************************************/

    /// @dev Calculate how much Wrapped S tokens in the vault is not reserved for the withdrawal queue.
    // That is, it is available to be redeemed or deposited into a strategy.
    function _wSAvailable() internal view returns (uint256 wSAvailable) {
        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;

        // The amount that is still to be claimed in the withdrawal queue
        uint256 outstandingWithdrawals = queue.queued - queue.claimed;

        // The amount of sitting in wS in the vault
        uint256 wSBalance = IERC20(sW).balanceOf(address(this));

        // If there is not enough wS in the vault to cover the outstanding withdrawals
        if (wSBalance <= outstandingWithdrawals) {
            return 0;
        }

        return wSBalance - outstandingWithdrawals;
    }

    /// @dev Get the balance of an asset held in Vault and all strategies
    /// less any wS that is reserved for the withdrawal queue.
    /// wS is the only asset that can return a non-zero balance.
    ///
    /// If there is not enough wS in the vault and all strategies to cover all outstanding
    /// withdrawal requests then return a wS balance of 0
    function _checkBalance(
        address _asset
    ) internal view override returns (uint256 balance) {
        if (_asset != wS) {
            return 0;
        }

        // Get the wS in the vault and the strategies
        balance = super._checkBalance(_asset);

        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;

        // If the vault becomes insolvent enough that the total value in the vault and all strategies
        // is less than the outstanding withdrawals.
        // For example, there was a mass slashing event and most users request a withdrawal.
        if (balance + queue.claimed < queue.queued) {
            return 0;
        }

        // Need to remove wS that is reserved for the withdrawal queue
        return balance + queue.claimed - queue.queued;
    }

    /**
     * @notice Allocate unallocated funds on Vault to strategies.
     **/
    function allocate() external override whenNotCapitalPaused nonReentrant {
        // Add any unallocated wS to the withdrawal queue first
        _addWithdrawalQueueLiquidity();

        _allocate();
    }

    /// @dev Allocate wS to the default wS strategy if there is excess to the Vault buffer.
    /// This is called from either `mint` or `allocate` and assumes `_addWithdrawalQueueLiquidity`
    /// has been called before this function.
    function _allocate() internal override {
        // No need to do anything if no default strategy for wS
        address depositStrategyAddr = assetDefaultStrategies[wS];
        if (depositStrategyAddr == address(0)) return;

        uint256 wSAvailableInVault = _wSAvailable();
        // No need to do anything if there isn't any wS in the vault to allocate
        if (wSAvailableInVault == 0) return;

        // Calculate the target buffer for the vault using the total supply
        uint256 totalSupply = oUSD.totalSupply();
        uint256 targetBuffer = totalSupply.mulTruncate(vaultBuffer);

        // If available wS in the Vault is below or equal the target buffer then there's nothing to allocate
        if (wSAvailableInVault <= targetBuffer) return;

        // The amount of assets to allocate to the default strategy
        uint256 allocateAmount = wSAvailableInVault - targetBuffer;

        IStrategy strategy = IStrategy(depositStrategyAddr);
        // Transfer wS to the strategy and call the strategy's deposit function
        IERC20(wS).safeTransfer(address(strategy), allocateAmount);
        strategy.deposit(wS, allocateAmount);

        emit AssetAllocated(wS, depositStrategyAddr, allocateAmount);
    }

    /// @dev The total value of all wS held by the vault and all its strategies
    /// less any wS that is reserved for the withdrawal queue.
    ///
    // If there is not enough wS in the vault and all strategies to cover all outstanding
    // withdrawal requests then return a total value of 0.
    function _totalValue() internal view override returns (uint256 value) {
        // As wS is the only asset, just return the wS balance
        return _checkBalance(wS);
    }

    /// @dev Only wS is supported in the OETH Vault so return the wS balance only
    /// Any ETH balances in the Vault will be ignored.
    /// Amounts from previously supported vault assets will also be ignored.
    /// For example, there is 1 wei left of stETH in the OETH Vault but is will be ignored.
    function _totalValueInVault()
        internal
        view
        override
        returns (uint256 value)
    {
        value = IERC20(wS).balanceOf(address(this));
    }
}
