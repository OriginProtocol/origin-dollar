// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title OToken VaultCore contract
 * @notice The Vault contract stores asset. On a deposit, OTokens will be minted
           and sent to the depositor. On a withdrawal, OTokens will be burned and
           asset will be sent to the withdrawer. The Vault accepts deposits of
           interest from yield bearing strategies which will modify the supply
           of OTokens.
 * @author Origin Protocol Inc
 */

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { StableMath } from "../utils/StableMath.sol";

import "./VaultInitializer.sol";

abstract contract VaultCore is VaultInitializer {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

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

    constructor(address _asset) VaultInitializer(_asset) {}

    ////////////////////////////////////////////////////
    ///                 MINT / BURN                  ///
    ////////////////////////////////////////////////////
    /**
     * @notice Deposit a supported asset and mint OTokens.
     * @dev Deprecated: use `mint(uint256 _amount)` instead.
     * @dev Deprecated: param _asset Address of the asset being deposited
     * @param _amount Amount of the asset being deposited
     * @dev Deprecated: param _minimumOusdAmount Minimum OTokens to mint
     */
    function mint(
        address,
        uint256 _amount,
        uint256
    ) external whenNotCapitalPaused nonReentrant {
        _mint(_amount);
    }

    /**
     * @notice Deposit a supported asset and mint OTokens.
     * @param _amount Amount of the asset being deposited
     */
    function mint(uint256 _amount) external whenNotCapitalPaused nonReentrant {
        _mint(_amount);
    }

    // slither-disable-start reentrancy-no-eth
    /**
     * @dev Deposit a supported asset and mint OTokens.
     * @param _amount Amount of the asset being deposited
     */
    function _mint(uint256 _amount) internal virtual {
        require(_amount > 0, "Amount must be greater than 0");

        // Block mints when the vault is under-backed by more than mintTolerance.
        // Checked on the pre-mint state (the deposit is transferred in below).
        // Stops new minters from buying OTokens above their real value and from
        // subsidising the withdrawal queue at par during a depeg. mintForStrategy
        // is intentionally not gated here; that stays a strategist decision.
        require(_backingRatio() + mintTolerance >= 1e18, "Vault under-backed");

        // Scale amount to 18 decimals
        uint256 scaledAmount = _amount.scaleBy(18, assetDecimals);

        emit Mint(msg.sender, scaledAmount);

        // Mint oTokens
        oToken.mint(msg.sender, scaledAmount);

        IERC20(asset).safeTransferFrom(msg.sender, address(this), _amount);

        // Give priority to the withdrawal queue for the new asset liquidity
        _addWithdrawalQueueLiquidity();

        // Auto-allocate if necessary
        if (scaledAmount >= autoAllocateThreshold) {
            _allocate();
        }
    }

    // slither-disable-end reentrancy-no-eth

    /**
     * @notice Mint OTokens for an allowed Strategy
     * @param _amount Amount of OToken to mint
     *
     * Notice: can't use `nonReentrant` modifier since the `mint` function can
     * call `allocate`, and that can trigger an AMO strategy to call this function
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
    {
        require(
            strategies[msg.sender].isSupported == true,
            "Unsupported strategy"
        );
        require(
            isMintWhitelistedStrategy[msg.sender] == true,
            "Not whitelisted strategy"
        );

        emit Mint(msg.sender, _amount);
        // Mint matching amount of OTokens
        oToken.mint(msg.sender, _amount);
    }

    /**
     * @notice Burn OTokens for an allowed Strategy
     * @param _amount Amount of OToken to burn
     *
     * @dev Notice: can't use `nonReentrant` modifier since the `redeem` function could
     * require withdrawal on an AMO strategy and that one can call `burnForStrategy`
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
    {
        require(
            strategies[msg.sender].isSupported == true,
            "Unsupported strategy"
        );
        require(
            isMintWhitelistedStrategy[msg.sender] == true,
            "Not whitelisted strategy"
        );

        emit Redeem(msg.sender, _amount);

        // Burn OTokens
        oToken.burn(msg.sender, _amount);
    }

    ////////////////////////////////////////////////////
    ///               ASYNC WITHDRAWALS              ///
    ////////////////////////////////////////////////////
    /**
     * @notice Request an asynchronous withdrawal of asset in exchange for OToken.
     * The OToken is burned on request and the asset is transferred to the withdrawer on claim.
     * This request can be claimed once the withdrawal queue's `claimable` amount
     * is greater than or equal this request's `queued` amount.
     * There is a minimum of 10 minutes before a request can be claimed. After that, the request just needs
     * enough asset liquidity in the Vault to satisfy all the outstanding requests to that point in the queue.
     * OToken is converted to asset at 1:1.
     * @param _amount Amount of OToken to burn.
     * @return requestId Unique ID for the withdrawal request
     * @return queued Cumulative total of all asset queued including already claimed requests.
     */
    function requestWithdrawal(uint256 _amount)
        external
        virtual
        whenNotCapitalPaused
        nonReentrant
        returns (uint256 requestId, uint256 queued)
    {
        require(_amount > 0, "Amount must be greater than 0");
        require(withdrawalClaimDelay > 0, "Async withdrawals not enabled");

        // The check that the requester has enough OToken is done in to later burn call

        requestId = withdrawalQueueMetadata.nextWithdrawalIndex;
        queued =
            withdrawalQueueMetadata.queued +
            _amount.scaleBy(assetDecimals, 18);

        // Store the next withdrawal request
        withdrawalQueueMetadata.nextWithdrawalIndex = SafeCast.toUint128(
            requestId + 1
        );
        // Store the updated queued amount which reserves asset in the withdrawal queue
        // and reduces the vault's total asset
        withdrawalQueueMetadata.queued = SafeCast.toUint128(queued);
        // Store the user's withdrawal request
        // `queued` is in asset decimals, while `amount` is in OToken decimals (18)
        withdrawalRequests[requestId] = WithdrawalRequest({
            withdrawer: msg.sender,
            claimed: false,
            timestamp: uint40(block.timestamp),
            amount: SafeCast.toUint128(_amount),
            queued: SafeCast.toUint128(queued)
        });

        // Burn the user's OToken
        oToken.burn(msg.sender, _amount);

        // Prevent withdrawal if the vault is solvent by more than the allowed percentage
        _postRedeem();

        emit WithdrawalRequested(msg.sender, requestId, _amount, queued);
    }

    // slither-disable-start reentrancy-no-eth
    /**
     * @notice Claim a previously requested withdrawal once it is claimable.
     * This request can be claimed once the withdrawal queue's `claimable` amount
     * is greater than or equal this request's `queued` amount and 10 minutes has passed.
     * If the requests is not claimable, the transaction will revert with `Queue pending liquidity`.
     * If the request is not older than 10 minutes, the transaction will revert with `Claim delay not met`.
     * OToken is converted to asset at 1:1.
     * @param _requestId Unique ID for the withdrawal request
     * @return amount Amount of asset transferred to the withdrawer
     */
    function claimWithdrawal(uint256 _requestId)
        external
        virtual
        whenNotCapitalPaused
        nonReentrant
        returns (uint256 amount)
    {
        // Socialisation ratio, capped at 1:1. Computed once before any transfer
        // so it reflects current backing, and reused for both the queue top up
        // and the payout. Topping up liquidity does not change it: the ratio is
        // grossAssets / effectiveSupply, and neither input depends on `claimable`.
        uint256 ratio = _socialisationRatio();

        // Try and get more liquidity if there is not enough available
        if (
            withdrawalRequests[_requestId].queued >
            withdrawalQueueMetadata.claimable
        ) {
            // Add any asset to the withdrawal queue
            // this needs to remain here as:
            //  - Vault can be funded and `addWithdrawalQueueLiquidity` is not externally called
            //  - funds can be withdrawn from a strategy
            //
            // Those funds need to be added to withdrawal queue liquidity
            _addWithdrawalQueueLiquidity(ratio);
        }

        // Scale haircut amount to asset decimals
        amount = _claimWithdrawal(_requestId, ratio);

        // transfer asset from the vault to the withdrawer
        IERC20(asset).safeTransfer(msg.sender, amount);

        // Prevent insolvency
        _postRedeem();
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
     * @return amounts Amount of asset received for each request
     * @return totalAmount Total amount of asset transferred to the withdrawer
     */
    function claimWithdrawals(uint256[] calldata _requestIds)
        external
        virtual
        whenNotCapitalPaused
        nonReentrant
        returns (uint256[] memory amounts, uint256 totalAmount)
    {
        // Single socialisation ratio for the whole batch (capped at 1:1) so
        // every request in the batch is haircut identically. Reused for the
        // queue top up below; topping up does not change the ratio.
        uint256 ratio = _socialisationRatio();

        // Add any asset to the withdrawal queue
        // this needs to remain here as:
        //  - Vault can be funded and `addWithdrawalQueueLiquidity` is not externally called
        //  - funds can be withdrawn from a strategy
        //
        // Those funds need to be added to withdrawal queue liquidity
        _addWithdrawalQueueLiquidity(ratio);

        amounts = new uint256[](_requestIds.length);
        for (uint256 i; i < _requestIds.length; ++i) {
            // Scale all amounts to asset decimals, thus totalAmount is also in asset decimals
            amounts[i] = _claimWithdrawal(_requestIds[i], ratio);
            totalAmount += amounts[i];
        }

        // transfer all the claimed asset from the vault to the withdrawer
        IERC20(asset).safeTransfer(msg.sender, totalAmount);

        // Prevent insolvency
        _postRedeem();

        return (amounts, totalAmount);
    }

    /// @param requestId Unique ID of the withdrawal request to claim.
    /// @param ratio Socialisation ratio (1e18 scaled), already capped at 1:1.
    ///        The caller computes this once so a batch is treated identically.
    function _claimWithdrawal(uint256 requestId, uint256 ratio)
        internal
        returns (uint256)
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
        // Bump `claimed` by the FULL nominal amount even though only the haircut
        // is paid out. The retained difference stays in the vault as backing for
        // everyone else and frees queue liquidity on the next top-up - this is
        // what walks the fixed FIFO gate forward under impairment.
        withdrawalQueueMetadata.claimed =
            queue.claimed +
            SafeCast.toUint128(
                StableMath.scaleBy(request.amount, assetDecimals, 18)
            );

        // Haircut payout = nominal * min(1, ratio), rounded down (favours the
        // vault so the last claimer cannot over-drain). `ratio` is pre-capped.
        uint256 amount = StableMath.scaleBy(
            uint256(request.amount).mulTruncate(ratio),
            assetDecimals,
            18
        );

        // Emit both the nominal size of the settled request and the asset
        // actually paid out. They differ whenever a loss has been socialised.
        emit WithdrawalClaimed(msg.sender, requestId, request.amount, amount);

        return amount;
    }

    function _postRedeem() internal view {
        // With socialised losses the claim payout is haircut to the backing
        // ratio, so under-backing is expected and handled rather than blocked.
        // This is now purely an emergency circuit breaker: it trips when the
        // backing ratio strays outside maxSupplyDiff of 1.0 in EITHER direction
        //  - a loss larger than what we are willing to auto-socialise, at which
        //    point governance intervenes (loosens the band or acts manually), or
        //  - an implausibly high ratio, eg a strategy over-reporting its balance,
        //    which would otherwise over-pay claims.
        // Governance sets maxSupplyDiff wide enough that ordinary depegs stay
        // inside the band and claims keep flowing.
        if (maxSupplyDiff > 0) {
            uint256 ratio = _backingRatio();
            uint256 diff = ratio > 1e18 ? ratio - 1e18 : 1e18 - ratio;
            require(diff <= maxSupplyDiff, "Backing ratio out of range");
        }
    }

    /**
     * @notice Allocate unallocated funds on Vault to strategies.
     */
    function allocate() external virtual whenNotCapitalPaused nonReentrant {
        // Add any unallocated asset to the withdrawal queue first
        _addWithdrawalQueueLiquidity();

        _allocate();
    }

    /**
     * @dev Allocate asset (eg. WETH or USDC) to the default asset strategy
     *          if there is excess to the Vault buffer.
     * This is called from either `mint` or `allocate` and assumes `_addWithdrawalQueueLiquidity`
     * has been called before this function.
     */
    function _allocate() internal virtual {
        // No need to do anything if no default strategy for asset
        address depositStrategyAddr = defaultStrategy;
        if (depositStrategyAddr == address(0)) return;

        uint256 assetAvailableInVault = _assetAvailable();
        // No need to do anything if there isn't any asset in the vault to allocate
        if (assetAvailableInVault == 0) return;

        // Calculate the target buffer for the vault using the total supply
        uint256 totalSupply = oToken.totalSupply();
        // Scaled to asset decimals
        uint256 targetBuffer = totalSupply.mulTruncate(vaultBuffer).scaleBy(
            assetDecimals,
            18
        );

        // If available asset in the Vault is below or equal the target buffer then there's nothing to allocate
        if (assetAvailableInVault <= targetBuffer) return;

        // The amount of asset to allocate to the default strategy
        uint256 allocateAmount = assetAvailableInVault - targetBuffer;

        IStrategy strategy = IStrategy(depositStrategyAddr);
        // Transfer asset to the strategy and call the strategy's deposit function
        IERC20(asset).safeTransfer(address(strategy), allocateAmount);
        strategy.deposit(asset, allocateAmount);

        emit AssetAllocated(asset, depositStrategyAddr, allocateAmount);
    }

    /**
     * @notice Calculate the total value of asset held by the Vault and all
     *      strategies and update the supply of OTokens.
     * @dev Restricted to the Operator, Strategist or Governor.
     */
    function rebase() external virtual nonReentrant {
        require(
            msg.sender == operatorAddr ||
                msg.sender == strategistAddr ||
                isGovernor(),
            "Caller not authorized"
        );
        _rebase();
    }

    /**
     * @dev Calculate the total value of asset held by the Vault and all
     *      strategies and update the supply of OTokens, optionally sending a
     *      portion of the yield to the trustee.
     * @return totalUnits Total balance of Vault in units
     */
    function _rebase() internal whenNotRebasePaused returns (uint256) {
        uint256 supply = oToken.totalSupply();
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
                oToken.mint(_trusteeAddress, fee);
            }
        }
        emit YieldDistribution(_trusteeAddress, yield, fee);

        // Only ratchet OToken supply upwards
        // Final check uses latest totalSupply
        if (newSupply > oToken.totalSupply()) {
            oToken.changeSupply(newSupply);
        }
        return vaultValue;
    }

    /**
     * @notice Calculates the amount that would rebase at next rebase.
     * This is before any fees.
     * @return yield amount of expected yield
     */
    function previewYield() external view returns (uint256 yield) {
        (yield, ) = _nextYield(oToken.totalSupply(), _totalValue());
        return yield;
    }

    /**
     * @dev Calculates the amount that would rebase at next rebase.
     *      See this Readme for detailed explanation:
     *      contracts/contracts/vault/README - Yield Limits.md
     */
    function _nextYield(uint256 supply, uint256 vaultValue)
        internal
        view
        virtual
        returns (uint256 yield, uint256 targetRate)
    {
        uint256 nonRebasing = oToken.nonRebasingSupply();
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
     * @notice Determine the total value of asset held by the vault and its
     *         strategies.
     * @return value Total value in USD/ETH (1e18)
     */
    function totalValue() external view virtual returns (uint256 value) {
        value = _totalValue();
    }

    /**
     * @notice Gross value of all asset held by the vault and its strategies,
     * scaled to 18 decimals. NOT netted against the withdrawal queue.
     */
    function grossAssets() external view returns (uint256) {
        return _grossAssets();
    }

    /**
     * @notice OToken supply plus the outstanding (unclaimed) withdrawal queue,
     * 18 decimals. This is the denominator losses are socialised across.
     */
    function effectiveSupply() external view returns (uint256) {
        return _effectiveSupply();
    }

    /**
     * @notice Backing ratio = grossAssets / effectiveSupply, 1e18 scaled.
     * 1e18 means fully backed; below 1e18 the vault is impaired and withdrawal
     * claims are haircut pro-rata to this ratio.
     */
    function backingRatio() external view returns (uint256) {
        return _backingRatio();
    }

    /**
     * @dev Internal Calculate the total value of the asset held by the
     *          vault and its strategies.
     * @dev The total value of all WETH held by the vault and all its strategies
     *          less any WETH that is reserved for the withdrawal queue.
     *          If there is not enough WETH in the vault and all strategies to cover
     *          all outstanding withdrawal requests then return a total value of 0.
     * @return value Total value in USD/ETH (1e18)
     */
    function _totalValue() internal view virtual returns (uint256) {
        // Gross assets less the socialised (haircut) value of the outstanding
        // withdrawal queue. When healthy (ratio >= 1) the queue is subtracted at
        // par - identical to the legacy `balance + claimed - queued`. When
        // impaired the queue only counts at its haircut value, so the loss is
        // shared with live holders instead of being reserved for the queue.
        uint256 gross = _grossAssets();
        uint256 queueValue = _outstandingQueue18().mulTruncate(
            _socialisationRatio()
        );
        // queueValue <= gross always holds (see _backingRatio), so no underflow.
        return gross - queueValue;
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
     * less any asset that is reserved for the withdrawal queue.
     * BaseAsset is the only asset that can return a non-zero balance.
     * All other asset will return 0 even if there is some dust amounts left in the Vault.
     * For example, there is 1 wei left of stETH (or USDC) in the OETH (or OUSD) Vault but
     * will return 0 in this function.
     *
     * If there is not enough asset in the vault and all strategies to cover all outstanding
     * withdrawal requests then return a asset balance of 0
     * @param _asset Address of asset
     * @return balance Balance of asset in decimals of asset
     */
    function _checkBalance(address _asset)
        internal
        view
        virtual
        returns (uint256 balance)
    {
        if (_asset != asset) return 0;

        // Get the asset in the vault and the strategies
        balance = _rawAssetBalance();

        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;

        // If the vault becomes insolvent enough that the total value in the vault and all strategies
        // is less than the outstanding withdrawals.
        // For example, there was a mass slashing event and most users request a withdrawal.
        if (balance + queue.claimed < queue.queued) {
            return 0;
        }

        // Need to remove asset that is reserved for the withdrawal queue
        return balance + queue.claimed - queue.queued;
    }

    /**
     * @dev Sum of the vault asset held directly plus across all strategies, in
     * asset decimals. This is the GROSS balance: NOT netted against the
     * withdrawal queue and never clamped to zero. Shared by `_checkBalance`
     * (which nets the queue) and `_grossAssets` (which does not).
     */
    function _rawAssetBalance() internal view returns (uint256) {
        uint256 balance = IERC20(asset).balanceOf(address(this));
        uint256 stratCount = allStrategies.length;
        for (uint256 i = 0; i < stratCount; ++i) {
            IStrategy strategy = IStrategy(allStrategies[i]);
            if (strategy.supportsAsset(asset)) {
                balance = balance + strategy.checkBalance(asset);
            }
        }
        return balance;
    }

    /**
     * @dev Gross vault + strategy asset value, scaled to 18 decimals. Unlike
     * `_checkBalance` this ignores the withdrawal queue, and is never clamped,
     * so it is a faithful numerator for the backing ratio.
     */
    function _grossAssets() internal view virtual returns (uint256) {
        return _rawAssetBalance().scaleBy(18, assetDecimals);
    }

    /**
     * @dev Outstanding (queued but not yet claimed) withdrawals, scaled to 18
     * decimals. `queued >= claimed` always holds.
     */
    function _outstandingQueue18() internal view returns (uint256) {
        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;
        return uint256(queue.queued - queue.claimed).scaleBy(18, assetDecimals);
    }

    /**
     * @dev Live OToken supply plus the outstanding withdrawal queue, 18 decimals.
     * This is the denominator that shares losses across live holders AND
     * queued-but-unclaimed requests, instead of treating the queue as senior debt.
     */
    function _effectiveSupply() internal view returns (uint256) {
        return oToken.totalSupply() + _outstandingQueue18();
    }

    /**
     * @dev Backing ratio = grossAssets / effectiveSupply, 1e18 scaled.
     * 1e18 means fully backed; below means impaired. Returns 1e18 when there is
     * nothing to back (effectiveSupply == 0).
     */
    function _backingRatio() internal view returns (uint256) {
        uint256 effectiveSupply = _effectiveSupply();
        if (effectiveSupply == 0) {
            return 1e18;
        }
        return _grossAssets().divPrecisely(effectiveSupply);
    }

    /**
     * @dev The backing ratio capped at 1:1, which is the ratio withdrawal claims
     * are haircut by. Capped because an over-backed vault still only owes the
     * queue its nominal amount; the surplus stays with live holders and is
     * distributed by `rebase`.
     */
    function _socialisationRatio() internal view returns (uint256) {
        return _min(1e18, _backingRatio());
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
     * @dev Adds asset (eg. WETH or USDC) to the withdrawal queue if there is a funding shortfall.
     * This assumes 1 asset equal 1 corresponding OToken.
     */
    function _addWithdrawalQueueLiquidity() internal returns (uint256) {
        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;

        // Short circuit before computing the socialisation ratio, which walks every
        // strategy. There is nothing to fund when the queue is already fully
        // covered, which is the common case on mint/allocate and on every Native
        // Staking validator withdrawal.
        if (queue.queued == queue.claimable) {
            return 0;
        }

        return _addWithdrawalQueueLiquidity(_socialisationRatio());
    }

    /**
     * @dev Adds asset (eg. WETH or USDC) to the withdrawal queue if there is a funding shortfall.
     * @param ratio Socialisation ratio (1e18 scaled), already capped at 1:1.
     *        Callers that have already computed it pass it in to avoid a second
     *        pass over the strategies. The ratio does not depend on `claimable`,
     *        so it is unchanged by this function.
     */
    function _addWithdrawalQueueLiquidity(uint256 ratio)
        internal
        returns (uint256)
    {
        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;

        // Check if the claimable asset is less than the queued amount
        uint256 queueShortfall = queue.queued - queue.claimable;

        // No need to do anything is the withdrawal queue is full funded
        if (queueShortfall == 0) {
            return 0;
        }

        uint256 assetBalance = IERC20(asset).balanceOf(address(this));

        // Of the claimable withdrawal requests, how much is unclaimed?
        // That is, the amount of asset that is currently allocated for the withdrawal queue.
        // The frontier is counted in nominal units but funded out of real assets, so an
        // impaired request of nominal size x only settles for `ratio * x` and only needs
        // that much reserved. Reserving the full nominal x would over-reserve: the frontier
        // could then never reach `queued` (the vault only ever holds `ratio * nominal`),
        // permanently stranding the tail of the queue.
        uint256 allocatedBaseAsset = uint256(queue.claimable - queue.claimed)
            .mulTruncate(ratio);

        // If there is no unallocated asset then there is nothing to add to the queue
        if (assetBalance <= allocatedBaseAsset) {
            return 0;
        }

        // Convert the free real asset back into nominal frontier capacity
        uint256 unallocatedBaseAsset = (assetBalance - allocatedBaseAsset)
            .divPrecisely(ratio);
        // the new claimable amount is the smaller of the queue shortfall or unallocated asset
        uint256 addedClaimable = queueShortfall < unallocatedBaseAsset
            ? queueShortfall
            : unallocatedBaseAsset;
        uint256 newClaimable = queue.claimable + addedClaimable;

        // Store the new claimable amount back to storage
        withdrawalQueueMetadata.claimable = SafeCast.toUint128(newClaimable);

        // emit a WithdrawalClaimable event
        emit WithdrawalClaimable(newClaimable, addedClaimable);

        return addedClaimable;
    }

    /**
     * @dev Calculate how much asset (eg. WETH or USDC) in the vault is not reserved for the withdrawal queue.
     * That is, it is available to be redeemed or deposited into a strategy.
     */
    function _assetAvailable() internal view returns (uint256 assetAvailable) {
        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;

        // The amount of asset that is still to be claimed in the withdrawal queue
        uint256 outstandingWithdrawals = queue.queued - queue.claimed;

        // The amount of sitting in asset in the vault
        uint256 assetBalance = IERC20(asset).balanceOf(address(this));
        // If there is not enough asset in the vault to cover the outstanding withdrawals
        if (assetBalance <= outstandingWithdrawals) return 0;

        return assetBalance - outstandingWithdrawals;
    }

    /***************************************
                    Utils
    ****************************************/

    /**
     * @notice Return the number of asset supported by the Vault.
     */
    function getAssetCount() public view returns (uint256) {
        return 1;
    }

    /**
     * @notice Return all vault asset addresses in order
     */
    function getAllAssets() external view returns (address[] memory) {
        address[] memory a = new address[](1);
        a[0] = asset;
        return a;
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
        return asset == _asset;
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }
}
