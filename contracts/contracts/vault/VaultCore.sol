// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title OToken VaultCore contract
 * @notice The Vault contract stores assets. On a deposit, OTokens will be minted
           and sent to the depositor. On a withdrawal, OTokens will be burned and
           assets will be sent to the withdrawer. The Vault accepts deposits of
           interest from yield bearing strategies which will modify the supply
           of OTokens.
 * @author Origin Protocol Inc
 */

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { StableMath } from "../utils/StableMath.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IGetExchangeRateToken } from "../interfaces/IGetExchangeRateToken.sol";

import "./VaultInitializer.sol";

contract VaultCore is VaultInitializer {
    using SafeERC20 for IERC20;
    using StableMath for uint256;
    /// @dev max signed int
    uint256 internal constant MAX_INT = uint256(type(int256).max);

    /// @dev Address of the backing asset (eg. WETH or USDC)
    address public immutable backingAsset;

    /**
     * @dev Verifies that the rebasing is not paused.
     */
    modifier whenNotRebasePaused() {
        require(!rebasePaused, "Rebasing paused");
        _;
    }

    /**
     * @dev Verifies that the deposits are not paused.
     */
    modifier whenNotCapitalPaused() {
        require(!capitalPaused, "Capital paused");
        _;
    }

    /**
     * @dev Verifies that the caller is the AMO strategy.
     */
    modifier onlyOusdMetaStrategy() {
        require(
            msg.sender == ousdMetaStrategy,
            "Caller is not the OUSD meta strategy"
        );
        _;
    }

    constructor(address _backingAsset) {
        backingAsset = _backingAsset;
    }

    ////////////////////////////////////////////////////
    ///                 MINT / REDEEM                ///
    ////////////////////////////////////////////////////
    /**
     * @notice Deposit a supported asset and mint OTokens.
     * @param _asset Address of the asset being deposited
     * @param _amount Amount of the asset being deposited
     * @param _minimumOusdAmount Minimum OTokens to mint
     */
    function mint(
        address _asset,
        uint256 _amount,
        uint256 _minimumOusdAmount
    ) external whenNotCapitalPaused nonReentrant {
        _mint(_asset, _amount, _minimumOusdAmount);
    }

    /**
     * @dev Deposit a supported asset and mint OTokens.
     * @param _asset Address of the asset being deposited
     * @param _amount Amount of the asset being deposited
     * @param _minimumOusdAmount Minimum OTokens to mint
     */
    function _mint(
        address _asset,
        uint256 _amount,
        uint256 _minimumOusdAmount
    ) internal virtual {
        require(_asset == backingAsset, "Unsupported asset for minting");
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

        // Give priority to the withdrawal queue for the new backingAsset liquidity
        _addWithdrawalQueueLiquidity();

        // Auto-allocate if necessary
        if (_amount >= autoAllocateThreshold) {
            _allocate();
        }
    }

    /**
     * @notice Mint OTokens for a Metapool Strategy
     * @param _amount Amount of the asset being deposited
     *
     * Notice: can't use `nonReentrant` modifier since the `mint` function can
     * call `allocate`, and that can trigger `ConvexOUSDMetaStrategy` to call this function
     * while the execution of the `mint` has not yet completed -> causing a `nonReentrant` collision.
     *
     * Also important to understand is that this is a limitation imposed by the test suite.
     * Production / mainnet contracts should never be configured in a way where mint/redeem functions
     * that are moving funds between the Vault and end user wallets can influence strategies
     * utilizing this function.
     */
    function mintForStrategy(uint256 _amount)
        external
        virtual
        whenNotCapitalPaused
        onlyOusdMetaStrategy
    {
        require(_amount < MAX_INT, "Amount too high");

        emit Mint(msg.sender, _amount);

        // safe to cast because of the require check at the beginning of the function
        netOusdMintedForStrategy += int256(_amount);

        require(
            abs(netOusdMintedForStrategy) < netOusdMintForStrategyThreshold,
            "Minted ousd surpassed netOusdMintForStrategyThreshold."
        );

        // Mint matching amount of OTokens
        oUSD.mint(msg.sender, _amount);
    }

    /**
     * @notice Withdraw a supported asset and burn OTokens.
     * @param _amount Amount of OTokens to burn
     * @param _minimumUnitAmount Minimum stablecoin units to receive in return
     */
    function redeem(uint256 _amount, uint256 _minimumUnitAmount)
        external
        whenNotCapitalPaused
        nonReentrant
    {
        _redeem(_amount, _minimumUnitAmount);
    }

    /**
     * @notice Withdraw a supported asset and burn OTokens.
     * @param _amount Amount of OTokens to burn
     * @param _minimumUnitAmount Minimum stablecoin units to receive in return
     */
    function _redeem(uint256 _amount, uint256 _minimumUnitAmount)
        internal
        virtual
    {
        emit Redeem(msg.sender, _amount);

        if (_amount == 0) return;

        // Amount excluding fees
        // No fee for the strategist or the governor, makes it easier to do operations
        uint256 amountMinusFee = (msg.sender == strategistAddr || isGovernor())
            ? _amount
            : _calculateRedeemOutputs(_amount)[0];

        require(
            amountMinusFee >= _minimumUnitAmount,
            "Redeem amount lower than minimum"
        );

        // Is there enough backingAsset in the Vault available after accounting for the withdrawal queue
        require(_backingAssetAvailable() >= amountMinusFee, "Liquidity error");

        // Transfer backingAsset minus the fee to the redeemer
        IERC20(backingAsset).safeTransfer(msg.sender, amountMinusFee);

        // Burn OToken from user (including fees)
        oUSD.burn(msg.sender, _amount);

        // Prevent insolvency
        _postRedeem(_amount);
    }

    function _postRedeem(uint256 _amount) internal {
        // Until we can prove that we won't affect the prices of our assets
        // by withdrawing them, this should be here.
        // It's possible that a strategy was off on its asset total, perhaps
        // a reward token sold for more or for less than anticipated.
        uint256 totalUnits = 0;
        if (_amount >= rebaseThreshold && !rebasePaused) {
            totalUnits = _rebase();
        } else {
            totalUnits = _totalValue();
        }

        // Check that the OTokens are backed by enough assets
        if (maxSupplyDiff > 0) {
            // If there are more outstanding withdrawal requests than assets in the vault and strategies
            // then the available assets will be negative and totalUnits will be rounded up to zero.
            // As we don't know the exact shortfall amount, we will reject all redeem and withdrawals
            require(totalUnits > 0, "Too many outstanding requests");

            // Allow a max difference of maxSupplyDiff% between
            // backing assets value and OUSD total supply
            uint256 diff = oUSD.totalSupply().divPrecisely(totalUnits);
            require(
                (diff > 1e18 ? diff - 1e18 : 1e18 - diff) <= maxSupplyDiff,
                "Backing supply liquidity error"
            );
        }
    }

    ////////////////////////////////////////////////////
    ///               ASYNC WITHDRAWALS              ///
    ////////////////////////////////////////////////////
    /**
     * @notice Request an asynchronous withdrawal of backingAsset in exchange for OToken.
     * The OToken is burned on request and the backingAsset is transferred to the withdrawer on claim.
     * This request can be claimed once the withdrawal queue's `claimable` amount
     * is greater than or equal this request's `queued` amount.
     * There is a minimum of 10 minutes before a request can be claimed. After that, the request just needs
     * enough backingAsset liquidity in the Vault to satisfy all the outstanding requests to that point in the queue.
     * OToken is converted to backingAsset at 1:1.
     * @param _amount Amount of OToken to burn.
     * @return requestId Unique ID for the withdrawal request
     * @return queued Cumulative total of all backingAsset queued including already claimed requests.
     */
    function requestWithdrawal(uint256 _amount)
        external
        virtual
        whenNotCapitalPaused
        nonReentrant
        returns (uint256 requestId, uint256 queued)
    {
        require(withdrawalClaimDelay > 0, "Async withdrawals not enabled");

        // The check that the requester has enough OToken is done in to later burn call

        requestId = withdrawalQueueMetadata.nextWithdrawalIndex;
        queued = withdrawalQueueMetadata.queued + _amount;

        // Store the next withdrawal request
        withdrawalQueueMetadata.nextWithdrawalIndex = SafeCast.toUint128(
            requestId + 1
        );
        // Store the updated queued amount which reserves backingAsset in the withdrawal queue
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

        // Burn the user's OToken
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
     * OToken is converted to backingAsset at 1:1.
     * @param _requestId Unique ID for the withdrawal request
     * @return amount Amount of backingAsset transferred to the withdrawer
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
            // Add any backingAsset to the withdrawal queue
            // this needs to remain here as:
            //  - Vault can be funded and `addWithdrawalQueueLiquidity` is not externally called
            //  - funds can be withdrawn from a strategy
            //
            // Those funds need to be added to withdrawal queue liquidity
            _addWithdrawalQueueLiquidity();
        }

        amount = _claimWithdrawal(_requestId);

        // transfer backingAsset from the vault to the withdrawer
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
     * @return amounts Amount of backingAsset received for each request
     * @return totalAmount Total amount of backingAsset transferred to the withdrawer
     */
    function claimWithdrawals(uint256[] calldata _requestIds)
        external
        virtual
        whenNotCapitalPaused
        nonReentrant
        returns (uint256[] memory amounts, uint256 totalAmount)
    {
        // Add any backingAsset to the withdrawal queue
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

        // transfer all the claimed backingAsset from the vault to the withdrawer
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

    /**
     * @notice Burn OTokens for Metapool Strategy
     * @param _amount Amount of OUSD to burn
     *
     * @dev Notice: can't use `nonReentrant` modifier since the `redeem` function could
     * require withdrawal on `ConvexOUSDMetaStrategy` and that one can call `burnForStrategy`
     * while the execution of the `redeem` has not yet completed -> causing a `nonReentrant` collision.
     *
     * Also important to understand is that this is a limitation imposed by the test suite.
     * Production / mainnet contracts should never be configured in a way where mint/redeem functions
     * that are moving funds between the Vault and end user wallets can influence strategies
     * utilizing this function.
     */
    function burnForStrategy(uint256 _amount)
        external
        virtual
        whenNotCapitalPaused
        onlyOusdMetaStrategy
    {
        require(_amount < MAX_INT, "Amount too high");

        emit Redeem(msg.sender, _amount);

        // safe to cast because of the require check at the beginning of the function
        netOusdMintedForStrategy -= int256(_amount);

        require(
            abs(netOusdMintedForStrategy) < netOusdMintForStrategyThreshold,
            "Attempting to burn too much OUSD."
        );

        // Burn OTokens
        oUSD.burn(msg.sender, _amount);
    }

    /**
     * @notice Allocate unallocated funds on Vault to strategies.
     */
    function allocate() external virtual whenNotCapitalPaused nonReentrant {
        // Add any unallocated backingAsset to the withdrawal queue first
        _addWithdrawalQueueLiquidity();

        _allocate();
    }

    /**
     * @dev Allocate backingAsset (eg. WETH or USDC) to the default backingAsset strategy
     *          if there is excess to the Vault buffer.
     * This is called from either `mint` or `allocate` and assumes `_addWithdrawalQueueLiquidity`
     * has been called before this function.
     */
    function _allocate() internal virtual {
        // No need to do anything if no default strategy for backingAsset
        address depositStrategyAddr = assetDefaultStrategies[backingAsset];
        if (depositStrategyAddr == address(0)) return;

        uint256 backingAssetAvailableInVault = _backingAssetAvailable();
        // No need to do anything if there isn't any backingAsset in the vault to allocate
        if (backingAssetAvailableInVault == 0) return;

        // Calculate the target buffer for the vault using the total supply
        uint256 totalSupply = oUSD.totalSupply();
        uint256 targetBuffer = totalSupply.mulTruncate(vaultBuffer);

        // If available backingAsset in the Vault is below or equal the target buffer then there's nothing to allocate
        if (backingAssetAvailableInVault <= targetBuffer) return;

        // The amount of assets to allocate to the default strategy
        uint256 allocateAmount = backingAssetAvailableInVault - targetBuffer;

        IStrategy strategy = IStrategy(depositStrategyAddr);
        // Transfer backingAsset to the strategy and call the strategy's deposit function
        IERC20(backingAsset).safeTransfer(address(strategy), allocateAmount);
        strategy.deposit(backingAsset, allocateAmount);

        emit AssetAllocated(backingAsset, depositStrategyAddr, allocateAmount);
    }

    /**
     * @notice Calculate the total value of assets held by the Vault and all
     *      strategies and update the supply of OTokens.
     */
    function rebase() external virtual nonReentrant {
        _rebase();
    }

    /**
     * @dev Calculate the total value of assets held by the Vault and all
     *      strategies and update the supply of OTokens, optionally sending a
     *      portion of the yield to the trustee.
     * @return totalUnits Total balance of Vault in units
     */
    function _rebase() internal whenNotRebasePaused returns (uint256) {
        uint256 supply = oUSD.totalSupply();
        uint256 vaultValue = _totalValue();
        // If no supply yet, do not rebase
        if (supply == 0) {
            return vaultValue;
        }

        // Calculate yield and new supply
        (uint256 yield, uint256 targetRate) = _nextYield(supply, vaultValue);
        uint256 newSupply = supply + yield;
        // Only rebase upwards and if we have enough backing funds
        if (newSupply <= supply || newSupply > vaultValue) {
            return vaultValue;
        }

        rebasePerSecondTarget = uint64(_min(targetRate, type(uint64).max));
        lastRebase = uint64(block.timestamp); // Intentional cast

        // Fee collection on yield
        address _trusteeAddress = trusteeAddress; // gas savings
        uint256 fee = 0;
        if (_trusteeAddress != address(0)) {
            fee = (yield * trusteeFeeBps) / 1e4;
            if (fee > 0) {
                require(fee < yield, "Fee must not be greater than yield");
                oUSD.mint(_trusteeAddress, fee);
            }
        }
        emit YieldDistribution(_trusteeAddress, yield, fee);

        // Only ratchet OToken supply upwards
        // Final check uses latest totalSupply
        if (newSupply > oUSD.totalSupply()) {
            oUSD.changeSupply(newSupply);
        }
        return vaultValue;
    }

    /**
     * @notice Calculates the amount that would rebase at next rebase.
     * This is before any fees.
     * @return yield amount of expected yield
     */
    function previewYield() external view returns (uint256 yield) {
        (yield, ) = _nextYield(oUSD.totalSupply(), _totalValue());
        return yield;
    }

    function _nextYield(uint256 supply, uint256 vaultValue)
        internal
        view
        virtual
        returns (uint256 yield, uint256 targetRate)
    {
        uint256 nonRebasing = oUSD.nonRebasingSupply();
        uint256 rebasing = supply - nonRebasing;
        uint256 elapsed = block.timestamp - lastRebase;
        targetRate = rebasePerSecondTarget;

        if (
            elapsed == 0 || // Yield only once per block.
            rebasing == 0 || // No yield if there are no rebasing tokens to give it to.
            supply > vaultValue || // No yield if we do not have yield to give.
            block.timestamp >= type(uint64).max // No yield if we are too far in the future to calculate it correctly.
        ) {
            return (0, targetRate);
        }

        // Start with the full difference available
        yield = vaultValue - supply;

        // Cap via optional automatic duration smoothing
        uint256 _dripDuration = dripDuration;
        if (_dripDuration > 1) {
            // If we are able to sustain an increased drip rate for
            // double the duration, then increase the target drip rate
            targetRate = _max(targetRate, yield / (_dripDuration * 2));
            // If we cannot sustain the target rate any more,
            // then rebase what we can, and reduce the target
            targetRate = _min(targetRate, yield / _dripDuration);
            // drip at the new target rate
            yield = _min(yield, targetRate * elapsed);
        }

        // Cap per second. elapsed is not 1e18 denominated
        yield = _min(yield, (rebasing * elapsed * rebasePerSecondMax) / 1e18);

        // Cap at a hard max per rebase, to avoid long durations resulting in huge rebases
        yield = _min(yield, (rebasing * MAX_REBASE) / 1e18);

        return (yield, targetRate);
    }

    /**
     * @notice Determine the total value of assets held by the vault and its
     *         strategies.
     * @return value Total value in USD/ETH (1e18)
     */
    function totalValue() external view virtual returns (uint256 value) {
        value = _totalValue();
    }

    /**
     * @dev Internal Calculate the total value of the assets held by the
     *          vault and its strategies.
     * @dev The total value of all WETH held by the vault and all its strategies
     *          less any WETH that is reserved for the withdrawal queue.
     *          If there is not enough WETH in the vault and all strategies to cover
     *          all outstanding withdrawal requests then return a total value of 0.
     * @return value Total value in USD/ETH (1e18)
     */
    function _totalValue() internal view virtual returns (uint256 value) {
        // As backingAsset is the only asset, just return the backingAsset balance
        value = _checkBalance(backingAsset);
    }

    /**
     * @dev Internal to calculate total value of all assets held in Vault.
     * @dev Only backingAsset is supported in the OETH Vault so return the backingAsset balance only
     *          Any ETH balances in the Vault will be ignored.
     *          Amounts from previously supported vault assets will also be ignored.
     *          For example, there is 1 wei left of stETH in the OETH Vault but is will be ignored.
     * @return value Total value in USD/ETH (1e18)
     */
    function _totalValueInVault()
        internal
        view
        virtual
        returns (uint256 value)
    {
        value = IERC20(backingAsset).balanceOf(address(this));
    }

    /**
     * @notice Get the balance of an asset held in Vault and all strategies.
     * @param _asset Address of asset
     * @return uint256 Balance of asset in decimals of asset
     */
    function checkBalance(address _asset) external view returns (uint256) {
        return _checkBalance(_asset);
    }

    /**
     * @notice Get the balance of an asset held in Vault and all strategies.
     * @dev Get the balance of an asset held in Vault and all strategies
     * less any backingAsset that is reserved for the withdrawal queue.
     * BaseAsset is the only asset that can return a non-zero balance.
     * All other assets will return 0 even if there is some dust amounts left in the Vault.
     * For example, there is 1 wei left of stETH (or USDC) in the OETH (or OUSD) Vault but
     * will return 0 in this function.
     *
     * If there is not enough backingAsset in the vault and all strategies to cover all outstanding
     * withdrawal requests then return a backingAsset balance of 0
     * @param _asset Address of asset
     * @return balance Balance of asset in decimals of asset
     */
    function _checkBalance(address _asset)
        internal
        view
        virtual
        returns (uint256 balance)
    {
        if (_asset != backingAsset) return 0;

        // Get the backingAsset in the vault and the strategies
        IERC20 asset = IERC20(_asset);
        balance = asset.balanceOf(address(this));
        uint256 stratCount = allStrategies.length;
        for (uint256 i = 0; i < stratCount; ++i) {
            IStrategy strategy = IStrategy(allStrategies[i]);
            if (strategy.supportsAsset(_asset)) {
                balance = balance + strategy.checkBalance(_asset);
            }
        }

        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;

        // If the vault becomes insolvent enough that the total value in the vault and all strategies
        // is less than the outstanding withdrawals.
        // For example, there was a mass slashing event and most users request a withdrawal.
        if (balance + queue.claimed < queue.queued) {
            return 0;
        }

        // Need to remove backingAsset that is reserved for the withdrawal queue
        return balance + queue.claimed - queue.queued;
    }

    /**
     * @notice Calculate the outputs for a redeem function, i.e. the mix of
     * coins that will be returned
     */
    function calculateRedeemOutputs(uint256 _amount)
        external
        view
        returns (uint256[] memory)
    {
        return _calculateRedeemOutputs(_amount);
    }

    /**
     * @dev Calculate the outputs for a redeem function, i.e. the mix of
     * coins that will be returned.
     * @return outputs Array of amounts respective to the supported assets
     */
    function _calculateRedeemOutputs(uint256 _amount)
        internal
        view
        virtual
        returns (uint256[] memory outputs)
    {
        // Calculate redeem fee
        if (redeemFeeBps > 0) {
            uint256 redeemFee = _amount.mulTruncateScale(redeemFeeBps, 1e4);
            _amount = _amount - redeemFee;
        }

        require(allAssets[0] == backingAsset, "Base asset must be first");

        // Todo: Maybe we can change function signature and return a simple uint256
        outputs = new uint256[](1);
        outputs[0] = _amount;
    }

    /**
     * @notice Adds WETH to the withdrawal queue if there is a funding shortfall.
     * @dev is called from the Native Staking strategy when validator withdrawals are processed.
     * It also called before any WETH is allocated to a strategy.
     */
    function addWithdrawalQueueLiquidity() external {
        _addWithdrawalQueueLiquidity();
    }

    /**
     * @dev Adds backingAsset (eg. WETH or USDC) to the withdrawal queue if there is a funding shortfall.
     * This assumes 1 backingAsset equal 1 corresponding OToken.
     */
    function _addWithdrawalQueueLiquidity()
        internal
        returns (uint256 addedClaimable)
    {
        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;

        // Check if the claimable backingAsset is less than the queued amount
        uint256 queueShortfall = queue.queued - queue.claimable;

        // No need to do anything is the withdrawal queue is full funded
        if (queueShortfall == 0) {
            return 0;
        }

        uint256 wethBalance = IERC20(backingAsset).balanceOf(address(this));

        // Of the claimable withdrawal requests, how much is unclaimed?
        // That is, the amount of backingAsset that is currently allocated for the withdrawal queue
        uint256 allocatedBaseAsset = queue.claimable - queue.claimed;

        // If there is no unallocated backingAsset then there is nothing to add to the queue
        if (wethBalance <= allocatedBaseAsset) {
            return 0;
        }

        uint256 unallocatedBaseAsset = wethBalance - allocatedBaseAsset;
        // the new claimable amount is the smaller of the queue shortfall or unallocated backingAsset
        addedClaimable = queueShortfall < unallocatedBaseAsset
            ? queueShortfall
            : unallocatedBaseAsset;
        uint256 newClaimable = queue.claimable + addedClaimable;

        // Store the new claimable amount back to storage
        withdrawalQueueMetadata.claimable = SafeCast.toUint128(newClaimable);

        // emit a WithdrawalClaimable event
        emit WithdrawalClaimable(newClaimable, addedClaimable);
    }

    /**
     * @dev Calculate how much backingAsset (eg. WETH or USDC) in the vault is not reserved for the withdrawal queue.
     * That is, it is available to be redeemed or deposited into a strategy.
     */
    function _backingAssetAvailable()
        internal
        view
        returns (uint256 backingAssetAvailable)
    {
        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;

        // The amount of backingAsset that is still to be claimed in the withdrawal queue
        uint256 outstandingWithdrawals = queue.queued - queue.claimed;

        // The amount of sitting in backingAsset in the vault
        uint256 backingAssetBalance = IERC20(backingAsset).balanceOf(
            address(this)
        );
        // If there is not enough backingAsset in the vault to cover the outstanding withdrawals
        if (backingAssetBalance <= outstandingWithdrawals) return 0;

        return backingAssetBalance - outstandingWithdrawals;
    }

    /***************************************
                    Pricing
    ****************************************/

    /**
     * @notice Returns the total price in 18 digit units for a given asset.
     *      Never goes above 1, since that is how we price mints.
     * @param asset address of the asset
     * @return price uint256: unit (USD / ETH) price for 1 unit of the asset, in 18 decimal fixed
     */
    function priceUnitMint(address asset)
        external
        view
        returns (uint256 price)
    {
        /* need to supply 1 asset unit in asset's decimals and can not just hard-code
         * to 1e18 and ignore calling `_toUnits` since we need to consider assets
         * with the exchange rate
         */
        uint256 units = _toUnits(
            uint256(1e18).scaleBy(_getDecimals(asset), 18),
            asset
        );
        price = (_toUnitPrice(asset, true) * units) / 1e18;
    }

    /**
     * @notice Returns the total price in 18 digit unit for a given asset.
     *      Never goes below 1, since that is how we price redeems
     * @param asset Address of the asset
     * @return price uint256: unit (USD / ETH) price for 1 unit of the asset, in 18 decimal fixed
     */
    function priceUnitRedeem(address asset)
        external
        view
        returns (uint256 price)
    {
        /* need to supply 1 asset unit in asset's decimals and can not just hard-code
         * to 1e18 and ignore calling `_toUnits` since we need to consider assets
         * with the exchange rate
         */
        uint256 units = _toUnits(
            uint256(1e18).scaleBy(_getDecimals(asset), 18),
            asset
        );
        price = (_toUnitPrice(asset, false) * units) / 1e18;
    }

    /***************************************
                    Utils
    ****************************************/

    /**
     * @dev Convert a quantity of a token into 1e18 fixed decimal "units"
     * in the underlying base (USD/ETH) used by the vault.
     * Price is not taken into account, only quantity.
     *
     * Examples of this conversion:
     *
     * - 1e18 DAI becomes 1e18 units (same decimals)
     * - 1e6 USDC becomes 1e18 units (decimal conversion)
     * - 1e18 rETH becomes 1.2e18 units (exchange rate conversion)
     *
     * @param _raw Quantity of asset
     * @param _asset Core Asset address
     * @return value 1e18 normalized quantity of units
     */
    function _toUnits(uint256 _raw, address _asset)
        internal
        view
        returns (uint256)
    {
        UnitConversion conversion = assets[_asset].unitConversion;
        if (conversion == UnitConversion.DECIMALS) {
            return _raw.scaleBy(18, _getDecimals(_asset));
        } else if (conversion == UnitConversion.GETEXCHANGERATE) {
            uint256 exchangeRate = IGetExchangeRateToken(_asset)
                .getExchangeRate();
            return (_raw * exchangeRate) / 1e18;
        } else {
            revert("Unsupported conversion type");
        }
    }

    /**
     * @dev Returns asset's unit price accounting for different asset types
     *      and takes into account the context in which that price exists -
     *      - mint or redeem.
     *
     * Note: since we are returning the price of the unit and not the one of the
     * asset (see comment above how 1 rETH exchanges for 1.2 units) we need
     * to make the Oracle price adjustment as well since we are pricing the
     * units and not the assets.
     *
     * The price also snaps to a "full unit price" in case a mint or redeem
     * action would be unfavourable to the protocol.
     *
     */
    function _toUnitPrice(address _asset, bool isMint)
        internal
        view
        returns (uint256 price)
    {
        UnitConversion conversion = assets[_asset].unitConversion;
        price = IOracle(priceProvider).price(_asset);

        if (conversion == UnitConversion.GETEXCHANGERATE) {
            uint256 exchangeRate = IGetExchangeRateToken(_asset)
                .getExchangeRate();
            price = (price * 1e18) / exchangeRate;
        } else if (conversion != UnitConversion.DECIMALS) {
            revert("Unsupported conversion type");
        }

        /* At this stage the price is already adjusted to the unit
         * so the price checks are agnostic to underlying asset being
         * pegged to a USD or to an ETH or having a custom exchange rate.
         */
        require(price <= MAX_UNIT_PRICE_DRIFT, "Vault: Price exceeds max");
        require(price >= MIN_UNIT_PRICE_DRIFT, "Vault: Price under min");

        if (isMint) {
            /* Never price a normalized unit price for more than one
             * unit of OETH/OUSD when minting.
             */
            if (price > 1e18) {
                price = 1e18;
            }
            require(price >= MINT_MINIMUM_UNIT_PRICE, "Asset price below peg");
        } else {
            /* Never give out more than 1 normalized unit amount of assets
             * for one unit of OETH/OUSD when redeeming.
             */
            if (price < 1e18) {
                price = 1e18;
            }
        }
    }

    /**
     * @dev Get the number of decimals of a token asset
     * @param _asset Address of the asset
     * @return decimals number of decimals
     */
    function _getDecimals(address _asset)
        internal
        view
        returns (uint256 decimals)
    {
        decimals = assets[_asset].decimals;
        require(decimals > 0, "Decimals not cached");
    }

    /**
     * @notice Return the number of assets supported by the Vault.
     */
    function getAssetCount() public view returns (uint256) {
        return allAssets.length;
    }

    /**
     * @notice Gets the vault configuration of a supported asset.
     * @param _asset Address of the token asset
     */
    function getAssetConfig(address _asset)
        public
        view
        returns (Asset memory config)
    {
        config = assets[_asset];
    }

    /**
     * @notice Return all vault asset addresses in order
     */
    function getAllAssets() external view returns (address[] memory) {
        return allAssets;
    }

    /**
     * @notice Return the number of strategies active on the Vault.
     */
    function getStrategyCount() external view returns (uint256) {
        return allStrategies.length;
    }

    /**
     * @notice Return the array of all strategies
     */
    function getAllStrategies() external view returns (address[] memory) {
        return allStrategies;
    }

    /**
     * @notice Returns whether the vault supports the asset
     * @param _asset address of the asset
     * @return true if supported
     */
    function isSupportedAsset(address _asset) external view returns (bool) {
        return assets[_asset].isSupported;
    }

    function ADMIN_IMPLEMENTATION() external view returns (address adminImpl) {
        bytes32 slot = adminImplPosition;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            adminImpl := sload(slot)
        }
    }

    /**
     * @dev Falldown to the admin implementation
     * @notice This is a catch all for all functions not declared in core
     */
    // solhint-disable-next-line no-complex-fallback
    fallback() external {
        bytes32 slot = adminImplPosition;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(
                gas(),
                sload(slot),
                0,
                calldatasize(),
                0,
                0
            )

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    function abs(int256 x) private pure returns (uint256) {
        require(x < int256(MAX_INT), "Amount too high");
        return x >= 0 ? uint256(x) : uint256(-x);
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }
}
