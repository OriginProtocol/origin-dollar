// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title OToken VaultCore contract
 * @notice The Vault contract stores backingAsset. On a deposit, OTokens will be minted
           and sent to the depositor. On a withdrawal, OTokens will be burned and
           backingAsset will be sent to the withdrawer. The Vault accepts deposits of
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
    /// @dev max signed int
    uint256 internal constant MAX_INT = uint256(type(int256).max);

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

    constructor(address _backingAsset) VaultInitializer(_backingAsset) {}

    ////////////////////////////////////////////////////
    ///             MINT / REDEEM / BURN             ///
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

    // slither-disable-start reentrancy-no-eth
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

        // Scale amount to 18 decimals
        uint256 scaledAmount = _amount.scaleBy(18, backingAssetDecimals);
        require(
            scaledAmount >= _minimumOusdAmount,
            "Mint amount lower than minimum"
        );

        emit Mint(msg.sender, scaledAmount);

        // Rebase must happen before any transfers occur.
        if (!rebasePaused && scaledAmount >= rebaseThreshold) {
            _rebase();
        }

        // Mint oTokens
        oUSD.mint(msg.sender, scaledAmount);

        IERC20(_asset).safeTransferFrom(msg.sender, address(this), _amount);

        // Give priority to the withdrawal queue for the new backingAsset liquidity
        _addWithdrawalQueueLiquidity();

        // Auto-allocate if necessary
        if (scaledAmount >= autoAllocateThreshold) {
            _allocate();
        }
    }

    // slither-disable-end reentrancy-no-eth

    /**
     * @notice Mint OTokens for an allowed Strategy
     * @param _amount Amount of the asset being deposited
     *
     * Todo: Maybe this is a comment that we can remove now?
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
            ? _amount.scaleBy(backingAssetDecimals, 18)
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
        // Until we can prove that we won't affect the prices of our backingAsset
        // by withdrawing them, this should be here.
        // It's possible that a strategy was off on its asset total, perhaps
        // a reward token sold for more or for less than anticipated.
        uint256 totalUnits = 0;
        if (_amount >= rebaseThreshold && !rebasePaused) {
            totalUnits = _rebase();
        } else {
            totalUnits = _totalValue();
        }

        // Check that the OTokens are backed by enough backingAsset
        if (maxSupplyDiff > 0) {
            // If there are more outstanding withdrawal requests than backingAsset in the vault and strategies
            // then the available backingAsset will be negative and totalUnits will be rounded up to zero.
            // As we don't know the exact shortfall amount, we will reject all redeem and withdrawals
            require(totalUnits > 0, "Too many outstanding requests");

            // Allow a max difference of maxSupplyDiff% between
            // backing backingAsset value and OUSD total supply
            uint256 diff = oUSD.totalSupply().divPrecisely(totalUnits);
            require(
                (diff > 1e18 ? diff - 1e18 : 1e18 - diff) <= maxSupplyDiff,
                "Backing supply liquidity error"
            );
        }
    }

    /**
     * @notice Burn OTokens for an allowed Strategy
     * @param _amount Amount of OToken to burn
     *
     * Todo: Maybe this is a comment that we can remove now?
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
        oUSD.burn(msg.sender, _amount);
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
        queued =
            withdrawalQueueMetadata.queued +
            _amount.scaleBy(backingAssetDecimals, 18);

        // Store the next withdrawal request
        withdrawalQueueMetadata.nextWithdrawalIndex = SafeCast.toUint128(
            requestId + 1
        );
        // Store the updated queued amount which reserves backingAsset in the withdrawal queue
        // and reduces the vault's total backingAsset
        withdrawalQueueMetadata.queued = SafeCast.toUint128(queued);
        // Store the user's withdrawal request
        // `queued` is in backingAsset decimals, while `amount` is in OToken decimals (18)
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

        // Scale amount to backingAsset decimals
        amount = _claimWithdrawal(_requestId).scaleBy(backingAssetDecimals, 18);

        // transfer backingAsset from the vault to the withdrawer
        IERC20(backingAsset).safeTransfer(msg.sender, amount);

        // Prevent insolvency
        _postRedeem(amount.scaleBy(18, backingAssetDecimals));
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
            // Scale all amounts to backingAsset decimals, thus totalAmount is also in backingAsset decimals
            amounts[i] = _claimWithdrawal(_requestIds[i]).scaleBy(
                backingAssetDecimals,
                18
            );
            totalAmount += amounts[i];
        }

        // transfer all the claimed backingAsset from the vault to the withdrawer
        IERC20(backingAsset).safeTransfer(msg.sender, totalAmount);

        // Prevent insolvency
        _postRedeem(totalAmount.scaleBy(18, backingAssetDecimals));

        return (amounts, totalAmount);
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
        withdrawalQueueMetadata.claimed =
            queue.claimed +
            SafeCast.toUint128(
                StableMath.scaleBy(request.amount, backingAssetDecimals, 18)
            );

        emit WithdrawalClaimed(msg.sender, requestId, request.amount);

        return request.amount;
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
        address depositStrategyAddr = defaultStrategy;
        if (depositStrategyAddr == address(0)) return;

        uint256 backingAssetAvailableInVault = _backingAssetAvailable();
        // No need to do anything if there isn't any backingAsset in the vault to allocate
        if (backingAssetAvailableInVault == 0) return;

        // Calculate the target buffer for the vault using the total supply
        uint256 totalSupply = oUSD.totalSupply();
        // Scaled to backingAsset decimals
        uint256 targetBuffer = totalSupply.mulTruncate(vaultBuffer).scaleBy(
            backingAssetDecimals,
            18
        );

        // If available backingAsset in the Vault is below or equal the target buffer then there's nothing to allocate
        if (backingAssetAvailableInVault <= targetBuffer) return;

        // The amount of backingAsset to allocate to the default strategy
        uint256 allocateAmount = backingAssetAvailableInVault - targetBuffer;

        IStrategy strategy = IStrategy(depositStrategyAddr);
        // Transfer backingAsset to the strategy and call the strategy's deposit function
        IERC20(backingAsset).safeTransfer(address(strategy), allocateAmount);
        strategy.deposit(backingAsset, allocateAmount);

        emit AssetAllocated(backingAsset, depositStrategyAddr, allocateAmount);
    }

    /**
     * @notice Calculate the total value of backingAsset held by the Vault and all
     *      strategies and update the supply of OTokens.
     */
    function rebase() external virtual nonReentrant {
        _rebase();
    }

    /**
     * @dev Calculate the total value of backingAsset held by the Vault and all
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
     * @notice Determine the total value of backingAsset held by the vault and its
     *         strategies.
     * @return value Total value in USD/ETH (1e18)
     */
    function totalValue() external view virtual returns (uint256 value) {
        value = _totalValue();
    }

    /**
     * @dev Internal Calculate the total value of the backingAsset held by the
     *          vault and its strategies.
     * @dev The total value of all WETH held by the vault and all its strategies
     *          less any WETH that is reserved for the withdrawal queue.
     *          If there is not enough WETH in the vault and all strategies to cover
     *          all outstanding withdrawal requests then return a total value of 0.
     * @return value Total value in USD/ETH (1e18)
     */
    function _totalValue() internal view virtual returns (uint256 value) {
        // As backingAsset is the only asset, just return the backingAsset balance
        value = _checkBalance(backingAsset).scaleBy(18, backingAssetDecimals);
    }

    /**
     * @dev Internal to calculate total value of all backingAsset held in Vault.
     * @dev Only backingAsset is supported in the OETH Vault so return the backingAsset balance only
     *          Any ETH balances in the Vault will be ignored.
     *          Amounts from previously supported vault backingAsset will also be ignored.
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
     * All other backingAsset will return 0 even if there is some dust amounts left in the Vault.
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
     * @return outputs Array of amounts respective to the supported backingAsset
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

        // Todo: Maybe we can change function signature and return a simple uint256
        outputs = new uint256[](1);
        outputs[0] = _amount.scaleBy(backingAssetDecimals, 18);
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

        uint256 backingAssetBalance = IERC20(backingAsset).balanceOf(
            address(this)
        );

        // Of the claimable withdrawal requests, how much is unclaimed?
        // That is, the amount of backingAsset that is currently allocated for the withdrawal queue
        uint256 allocatedBaseAsset = queue.claimable - queue.claimed;

        // If there is no unallocated backingAsset then there is nothing to add to the queue
        if (backingAssetBalance <= allocatedBaseAsset) {
            return 0;
        }

        uint256 unallocatedBaseAsset = backingAssetBalance - allocatedBaseAsset;
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
                    Utils
    ****************************************/

    /**
     * @notice Return the number of backingAsset supported by the Vault.
     */
    function getAssetCount() public view returns (uint256) {
        return 1;
    }

    /**
     * @notice Return all vault asset addresses in order
     */
    function getAllAssets() external view returns (address[] memory) {
        address[] memory a = new address[](1);
        a[0] = backingAsset;
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
        return backingAsset == _asset;
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
