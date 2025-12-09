// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { StableMath } from "../utils/StableMath.sol";
import { VaultCore } from "./VaultCore.sol";

/**
 * @title OETH VaultCore Contract
 * @author Origin Protocol Inc
 */
contract OETHVaultCore is VaultCore {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    // For future use (because OETHBaseVaultCore inherits from this)
    uint256[50] private __gap;

    constructor(address _backingAsset) VaultCore(_backingAsset) {}

    // @inheritdoc VaultCore
    function mintForStrategy(uint256 amount)
        external
        override
        whenNotCapitalPaused
    {
        require(
            strategies[msg.sender].isSupported == true,
            "Unsupported strategy"
        );
        require(
            isMintWhitelistedStrategy[msg.sender] == true,
            "Not whitelisted strategy"
        );

        emit Mint(msg.sender, amount);

        // Mint matching amount of OTokens
        oUSD.mint(msg.sender, amount);
    }

    // @inheritdoc VaultCore
    function burnForStrategy(uint256 amount)
        external
        override
        whenNotCapitalPaused
    {
        require(
            strategies[msg.sender].isSupported == true,
            "Unsupported strategy"
        );
        require(
            isMintWhitelistedStrategy[msg.sender] == true,
            "Not whitelisted strategy"
        );

        emit Redeem(msg.sender, amount);

        // Burn OTokens
        oUSD.burn(msg.sender, amount);
    }

    /**
     * @notice Request an asynchronous withdrawal of WETH in exchange for OETH.
     * The OETH is burned on request and the WETH is transferred to the withdrawer on claim.
     * This request can be claimed once the withdrawal queue's `claimable` amount
     * is greater than or equal this request's `queued` amount.
     * There is a minimum of 10 minutes before a request can be claimed. After that, the request just needs
     * enough WETH liquidity in the Vault to satisfy all the outstanding requests to that point in the queue.
     * OETH is converted to WETH at 1:1.
     * @param _amount Amount of OETH to burn.
     * @return requestId Unique ID for the withdrawal request
     * @return queued Cumulative total of all WETH queued including already claimed requests.
     */
    function requestWithdrawal(uint256 _amount)
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
        // Store the updated queued amount which reserves WETH in the withdrawal queue
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

        // Prevent withdrawal if the vault is solvent by more than the allowed percentage
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
     * OETH is converted to WETH at 1:1.
     * @param _requestId Unique ID for the withdrawal request
     * @return amount Amount of WETH transferred to the withdrawer
     */
    function claimWithdrawal(uint256 _requestId)
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
            // Add any WETH to the withdrawal queue
            // this needs to remain here as:
            //  - Vault can be funded and `addWithdrawalQueueLiquidity` is not externally called
            //  - funds can be withdrawn from a strategy
            //
            // Those funds need to be added to withdrawal queue liquidity
            _addWithdrawalQueueLiquidity();
        }

        amount = _claimWithdrawal(_requestId);

        // transfer WETH from the vault to the withdrawer
        IERC20(backingAsset).safeTransfer(msg.sender, amount);

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
     * @return amounts Amount of WETH received for each request
     * @return totalAmount Total amount of WETH transferred to the withdrawer
     */
    function claimWithdrawals(uint256[] calldata _requestIds)
        external
        virtual
        whenNotCapitalPaused
        nonReentrant
        returns (uint256[] memory amounts, uint256 totalAmount)
    {
        // Add any WETH to the withdrawal queue
        // this needs to remain here as:
        //  - Vault can be funded and `addWithdrawalQueueLiquidity` is not externally called
        //  - funds can be withdrawn from a strategy
        //
        // Those funds need to be added to withdrawal queue liquidity
        _addWithdrawalQueueLiquidity();

        amounts = new uint256[](_requestIds.length);
        for (uint256 i; i < _requestIds.length; ++i) {
            amounts[i] = _claimWithdrawal(_requestIds[i]);
            totalAmount += amounts[i];
        }

        // transfer all the claimed WETH from the vault to the withdrawer
        IERC20(backingAsset).safeTransfer(msg.sender, totalAmount);

        // Prevent insolvency
        _postRedeem(totalAmount);
    }

    function _claimWithdrawal(uint256 requestId)
        internal
        returns (uint256 amount)
    {
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

    /// @notice Adds WETH to the withdrawal queue if there is a funding shortfall.
    /// @dev is called from the Native Staking strategy when validator withdrawals are processed.
    /// It also called before any WETH is allocated to a strategy.
    function addWithdrawalQueueLiquidity() external {
        _addWithdrawalQueueLiquidity();
    }

    /***************************************
                View Functions
    ****************************************/

    /// @dev The total value of all WETH held by the vault and all its strategies
    /// less any WETH that is reserved for the withdrawal queue.
    ///
    // If there is not enough WETH in the vault and all strategies to cover all outstanding
    // withdrawal requests then return a total value of 0.
    function _totalValue() internal view override returns (uint256 value) {
        // As WETH is the only asset, just return the WETH balance
        return _checkBalance(backingAsset);
    }

    /// @dev Only WETH is supported in the OETH Vault so return the WETH balance only
    /// Any ETH balances in the Vault will be ignored.
    /// Amounts from previously supported vault assets will also be ignored.
    /// For example, there is 1 wei left of stETH in the OETH Vault but is will be ignored.
    function _totalValueInVault()
        internal
        view
        override
        returns (uint256 value)
    {
        value = IERC20(backingAsset).balanceOf(address(this));
    }
}
