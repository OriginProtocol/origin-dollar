// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StableMath } from "../utils/StableMath.sol";
import { VaultCore } from "./VaultCore.sol";

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { IDripper } from "../interfaces/IDripper.sol";

/**
 * @title OETH VaultCore Contract
 * @author Origin Protocol Inc
 */
contract OETHVaultCore is VaultCore {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    uint256 constant CLAIM_DELAY = 30 minutes;
    address public immutable weth;
    uint256 public wethAssetIndex;

    constructor(address _weth) {
        weth = _weth;
    }

    /**
     * @dev Caches WETH's index in `allAssets` variable.
     *      Reduces gas usage by redeem by caching that.
     */
    function cacheWETHAssetIndex() external onlyGovernor {
        uint256 assetCount = allAssets.length;
        for (uint256 i = 0; i < assetCount; ++i) {
            if (allAssets[i] == weth) {
                wethAssetIndex = i;
                break;
            }
        }

        require(allAssets[wethAssetIndex] == weth, "Invalid WETH Asset Index");
    }

    // @inheritdoc VaultCore
    // slither-disable-start reentrancy-no-eth
    function _mint(
        address _asset,
        uint256 _amount,
        uint256 _minimumOusdAmount
    ) internal virtual override {
        require(_asset == weth, "Unsupported asset for minting");
        require(_amount > 0, "Amount must be greater than 0");
        require(
            _amount >= _minimumOusdAmount,
            "Mint amount lower than minimum"
        );

        emit Mint(msg.sender, _amount);

        // Rebase must happen before any transfers occur.
        if (!rebasePaused && _amount >= rebaseThreshold) {
            // Stream any harvested rewards (WETH) that are available to the Vault
            IDripper(dripper).collect();

            _rebase();
        }

        // Mint oTokens
        oUSD.mint(msg.sender, _amount);

        // Transfer the deposited coins to the vault
        IERC20(_asset).safeTransferFrom(msg.sender, address(this), _amount);

        // Give priority to the withdrawal queue for the new WETH liquidity
        _addWithdrawalQueueLiquidity();

        // Auto-allocate if necessary
        if (_amount >= autoAllocateThreshold) {
            _allocate();
        }
    }

    // slither-disable-end reentrancy-no-eth

    // @inheritdoc VaultCore
    function _calculateRedeemOutputs(uint256 _amount)
        internal
        view
        virtual
        override
        returns (uint256[] memory outputs)
    {
        // Overrides `VaultCore._calculateRedeemOutputs` to redeem with only
        // WETH instead of LST-mix. Doesn't change the function signature
        // for backward compatibility

        // Calculate redeem fee
        if (redeemFeeBps > 0) {
            uint256 redeemFee = _amount.mulTruncateScale(redeemFeeBps, 1e4);
            _amount = _amount - redeemFee;
        }

        // Ensure that the WETH index is cached
        uint256 _wethAssetIndex = wethAssetIndex;
        require(
            allAssets[_wethAssetIndex] == weth,
            "WETH Asset index not cached"
        );

        outputs = new uint256[](allAssets.length);
        outputs[_wethAssetIndex] = _amount;
    }

    // @inheritdoc VaultCore
    function _redeem(uint256 _amount, uint256 _minimumUnitAmount)
        internal
        virtual
        override
    {
        // Override `VaultCore._redeem` to simplify it. Gets rid of oracle
        // usage and looping through all assets for LST-mix redeem. Instead
        // does a simple WETH-only redeem.
        emit Redeem(msg.sender, _amount);

        if (_amount == 0) {
            return;
        }

        // Amount excluding fees
        uint256 amountMinusFee = _calculateRedeemOutputs(_amount)[
            wethAssetIndex
        ];

        require(
            amountMinusFee >= _minimumUnitAmount,
            "Redeem amount lower than minimum"
        );

        // If there is any WETH in the Vault available after accounting for the withdrawal queue
        if (_wethAvailable() >= amountMinusFee) {
            // Use Vault funds first if sufficient
            IERC20(weth).safeTransfer(msg.sender, amountMinusFee);
        } else {
            address strategyAddr = assetDefaultStrategies[weth];
            if (strategyAddr != address(0)) {
                // Nothing in Vault, but something in Strategy, send from there
                IStrategy strategy = IStrategy(strategyAddr);
                strategy.withdraw(msg.sender, weth, amountMinusFee);
            } else {
                // Cant find funds anywhere
                revert("Liquidity error");
            }
        }

        // Burn OETH from user (including fees)
        oUSD.burn(msg.sender, _amount);

        _postRedeem(_amount);
    }

    /**
     * @notice Request an asynchronous withdrawal of WETH in exchange for OETH.
     * The OETH is burned on request and the WETH is transferred to the withdrawer on claim.
     * This request can be claimed once the withdrawal queue's `claimable` amount
     * is greater than or equal this request's `queued` amount.
     * There is no minimum time or block number before a request can be claimed. It just needs
     * enough WETH liquidity in the Vault to satisfy all the outstanding requests to that point in the queue.
     * OETH is converted to WETH at 1:1.
     * @param _amount Amount of OETH to burn.
     * @param requestId Unique ID for the withdrawal request
     * @param queued Cumulative total of all WETH queued including already claimed requests.
     */
    function requestWithdrawal(uint256 _amount)
        external
        whenNotCapitalPaused
        nonReentrant
        returns (uint256 requestId, uint256 queued)
    {
        // Burn the user's OETH
        // This also checks the requester has enough OETH to burn
        oUSD.burn(msg.sender, _amount);

        requestId = withdrawalQueueMetadata.nextWithdrawalIndex;
        queued = withdrawalQueueMetadata.queued + _amount;

        // store the next withdrawal request
        withdrawalQueueMetadata.nextWithdrawalIndex = uint128(requestId + 1);
        withdrawalQueueMetadata.queued = uint128(queued);

        emit WithdrawalRequested(msg.sender, requestId, _amount, queued);

        withdrawalRequests[requestId] = WithdrawalRequest({
            withdrawer: msg.sender,
            claimed: false,
            timestamp: uint40(block.timestamp),
            amount: uint128(_amount),
            queued: uint128(queued)
        });
    }

    /**
     * @notice Claim a previously requested withdrawal once it is claimable.
     * This request can be claimed once the withdrawal queue's `claimable` amount
     * is greater than or equal this request's `queued` amount.
     * There is no minimum time or block number before a request can be claimed. It just needs
     * enough WETH liquidity in the Vault to satisfy all the outstanding requests to that point in the queue.
     * OETH is converted to WETH at 1:1.
     * @param _requestId Unique ID for the withdrawal request
     * @return amount Amount of WETH transferred to the withdrawer
     */
    function claimWithdrawal(uint256 _requestId)
        external
        whenNotCapitalPaused
        nonReentrant
        returns (uint256 amount)
    {
        amount = _claimWithdrawal(_requestId);

        // transfer WETH from the vault to the withdrawer
        IERC20(weth).safeTransfer(msg.sender, amount);
    }

    /**
     * @notice Claim a previously requested withdrawals once they are claimable.
     * This requests can be claimed once the withdrawal queue's `claimable` amount
     * is greater than or equal each request's `queued` amount.
     * If one of the requests is not claimable, the whole transaction will revert with `queue pending liquidity`.
     * @param _requestIds Unique ID of each withdrawal request
     * @return amounts Amount of WETH received for each request
     * @return totalAmount Total amount of WETH transferred to the withdrawer
     */
    function claimWithdrawals(uint256[] memory _requestIds)
        external
        whenNotCapitalPaused
        nonReentrant
        returns (uint256[] memory amounts, uint256 totalAmount)
    {
        amounts = new uint256[](_requestIds.length);
        for (uint256 i = 0; i < _requestIds.length; ++i) {
            amounts[i] = _claimWithdrawal(_requestIds[i]);
            totalAmount += amounts[i];
        }

        // transfer all the claimed WETH from the vault to the withdrawer
        IERC20(weth).safeTransfer(msg.sender, totalAmount);
    }

    // slither-disable-start reentrancy-no-eth

    function _claimWithdrawal(uint256 requestId)
        internal
        returns (uint256 amount)
    {
        // Check if there's enough liquidity to cover the withdrawal request
        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;
        WithdrawalRequest memory request = withdrawalRequests[requestId];

        require(request.claimed == false, "already claimed");
        require(request.withdrawer == msg.sender, "not requester");
        require(
            request.timestamp + CLAIM_DELAY <= block.timestamp,
            "claim delay not met"
        );

        // Try and get more liquidity in the withdrawal queue if there is not enough
        if (request.queued > queue.claimable) {
            // Stream any harvested rewards (WETH) that are available to the Vault
            IDripper(dripper).collect();

            // Add any WETH from the Dripper to the withdrawal queue
            uint256 addedClaimable = _addWithdrawalQueueLiquidity();

            // If there still isn't enough liquidity in the queue to claim, revert
            require(
                request.queued <= queue.claimable + addedClaimable,
                "queue pending liquidity"
            );
        }

        // Store the updated claimed amount
        withdrawalQueueMetadata.claimed = queue.claimed + request.amount;
        // Store the request as claimed
        withdrawalRequests[requestId].claimed = true;

        emit WithdrawalClaimed(msg.sender, requestId, request.amount);

        return request.amount;
    }

    // slither-disable-end reentrancy-no-eth

    /// @notice Collects harvested rewards from the Dripper as WETH then
    /// adds WETH to the withdrawal queue if there is a funding shortfall.
    /// @dev is called from the Native Staking strategy when validator withdrawals are processed.
    /// It also called before any WETH is allocated to a strategy.
    function addWithdrawalQueueLiquidity() external {
        // Stream any harvested rewards (WETH) that are available to the Vault
        IDripper(dripper).collect();

        _addWithdrawalQueueLiquidity();
    }

    /// @dev Adds WETH to the withdrawal queue if there is a funding shortfall.
    /// This assumes 1 WETH equal 1 OETH.
    function _addWithdrawalQueueLiquidity()
        internal
        returns (uint256 addedClaimable)
    {
        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;

        // Check if the claimable WETH is less than the queued amount
        uint256 queueShortfall = queue.queued - queue.claimable;

        // No need to get WETH balance if all the withdrawal requests are claimable
        if (queueShortfall > 0) {
            uint256 wethBalance = IERC20(weth).balanceOf(address(this));

            // Of the claimable withdrawal requests, how much is unclaimed?
            uint256 unclaimed = queue.claimable - queue.claimed;
            if (wethBalance > unclaimed) {
                uint256 unallocatedWeth = wethBalance - unclaimed;

                // the new claimable amount is the smaller of the queue shortfall or unallocated weth
                addedClaimable = queueShortfall < unallocatedWeth
                    ? queueShortfall
                    : unallocatedWeth;
                uint256 newClaimable = queue.claimable + addedClaimable;

                // Store the new claimable amount back to storage
                withdrawalQueueMetadata.claimable = uint128(newClaimable);

                // emit a WithdrawalClaimable event
                emit WithdrawalClaimable(newClaimable, addedClaimable);
            }
        }
    }

    /***************************************
                View Functions
    ****************************************/

    function _wethAvailable() internal view returns (uint256 wethAvailable) {
        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;

        // Check if the claimable WETH is less than the queued amount
        uint256 queueShortfall = queue.queued - queue.claimable;
        uint256 wethBalance = IERC20(weth).balanceOf(address(this));
        // Of the claimable withdrawal requests, how much is unclaimed?
        uint256 unclaimed = queue.claimable - queue.claimed;

        if (wethBalance > queueShortfall + unclaimed) {
            wethAvailable = wethBalance - queueShortfall - unclaimed;
        }
    }

    function _checkBalance(address _asset)
        internal
        view
        override
        returns (uint256 balance)
    {
        balance = super._checkBalance(_asset);

        if (_asset == weth) {
            WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;
            // Need to remove WETH that is reserved for the withdrawal queue
            return balance + queue.claimed - queue.queued;
        }
    }

    function _allocate() internal override {
        // Add any unallocated WETH to the withdrawal queue first
        _addWithdrawalQueueLiquidity();

        super._allocate();
    }

    function _totalValue() internal view override returns (uint256 value) {
        value = super._totalValue();

        // Need to remove WETH that is reserved for the withdrawal queue.
        // reserved for the withdrawal queue = cumulative queued total - total claimed
        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;
        value = value + queue.claimed - queue.queued;
    }
}
