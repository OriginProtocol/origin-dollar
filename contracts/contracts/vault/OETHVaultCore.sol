// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StableMath } from "../utils/StableMath.sol";
import { VaultCore } from "./VaultCore.sol";

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";

/**
 * @title OETH VaultCore Contract
 * @author Origin Protocol Inc
 */
contract OETHVaultCore is VaultCore {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

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
     * @notice Request an asynchronous withdrawal of the underlying asset. eg WETH
     * @param _amount Amount of oTokens to burn. eg OETH
     * @param requestId Unique ID for the withdrawal request
     * @param queued Cumulative total of all WETH queued including already claimed requests.
     * This request can be claimed once the withdrawal queue's claimable amount
     * is greater than or equal this request's queued amount.
     */
    function requestWithdrawal(uint256 _amount)
        external
        whenNotCapitalPaused
        nonReentrant
        returns (uint256 requestId, uint256 queued)
    {
        // Check the user has enough OETH to burn
        require(oUSD.balanceOf(msg.sender) >= _amount, "Insufficient OETH");

        // burn the user's oTokens
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
            amount: uint128(_amount),
            queued: uint128(queued)
        });
    }

    /**
     * @notice Claim a previously requested withdrawal once it is claimable.
     * @param requestId Unique ID for the withdrawal request
     * @return amount Amount of WETH transferred to the withdrawer
     */
    function claimWithdrawal(uint256 requestId)
        external
        whenNotCapitalPaused
        nonReentrant
        returns (uint256 amount)
    {
        // Check if there's enough liquidity to cover the withdrawal request
        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;
        WithdrawalRequest memory request = withdrawalRequests[requestId];

        require(request.queued <= queue.claimable, "pending liquidity");
        require(request.claimed == false, "already claimed");
        require(request.withdrawer == msg.sender, "not requester");

        // Store the updated claimed amount
        withdrawalQueueMetadata.claimed = queue.claimed + request.amount;
        // Store the request as claimed
        withdrawalRequests[requestId].claimed = true;

        emit WithdrawalClaimed(msg.sender, requestId, request.amount);

        // transfer WETH from the vault to the withdrawer
        IERC20(weth).safeTransfer(msg.sender, request.amount);

        return request.amount;
    }

    /// @notice Adds any unallocated WETH to the withdrawal queue if there is a funding shortfall.
    /// @dev is called from the Native Staking strategy when validator withdrawals are processed.
    function addWithdrawalQueueLiquidity() external {
        _addWithdrawalQueueLiquidity();
    }

    /// @dev Adds WETH to the withdrawal queue if there is a funding shortfall.
    function _addWithdrawalQueueLiquidity() internal {
        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;

        // Check if the claimable WETH is less than the queued amount
        uint256 queueShortfall = queue.queued - queue.claimable;

        // No need to get WETH balance if all the withdrawal requests are claimable
        if (queueShortfall > 0) {
            uint256 wethBalance = IERC20(weth).balanceOf(address(this));

            // TODO do we also need to look for WETH in the default strategy?

            // Of the claimable withdrawal requests, how much is unclaimed?
            uint256 unclaimed = queue.claimable - queue.claimed;
            if (wethBalance > unclaimed) {
                uint256 unallocatedWeth = wethBalance - unclaimed;

                // the new claimable amount is the smaller of the queue shortfall or unallocated weth
                uint256 addedClaimable = queueShortfall < unallocatedWeth
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

    function _totalValueInVault()
        internal
        view
        override
        returns (uint256 value)
    {
        value = super._totalValueInVault();

        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;
        // Need to remove WETH that is reserved for the withdrawal queue
        // reserver for the withdrawal queue = cumulative queued total - total claimed
        value = value + queue.claimed - queue.queued;
    }
}
