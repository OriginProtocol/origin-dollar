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

import { IVault } from "../interfaces/IVault.sol";
import { StableMath } from "../utils/StableMath.sol";

import "./VaultInitializer.sol";

abstract contract VaultCore is VaultInitializer {
    using SafeERC20 for IERC20;
    using StableMath for uint256;
    using SafeCast for uint256;

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║                              MODIFIERS                               ║
    // ╚══════════════════════════════════════════════════════════════════════╝

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
     * @dev Verifies that the caller is the Governor or Strategist.
     */
    modifier onlyGovernorOrStrategist() {
        require(
            msg.sender == strategistAddr || isGovernor(),
            "Caller is not the Strategist or Governor"
        );
        _;
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║                             CONSTRUCTOR                              ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    constructor(address _asset) VaultInitializer(_asset) {}

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║                           MINT/BURN/REBASE                           ║
    // ╚══════════════════════════════════════════════════════════════════════╝

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

        // Scale amount to 18 decimals
        uint256 scaledAmount = _amount.scaleBy(18, assetDecimals);

        emit Mint(msg.sender, scaledAmount);

        // Rebase must happen before any transfers occur.
        if (!rebasePaused && scaledAmount >= rebaseThreshold) {
            _rebase();
        }

        // Mint oTokens
        oUSD.mint(msg.sender, scaledAmount);

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
        oUSD.mint(msg.sender, _amount);
    }

    /**
     * @notice Burn OTokens for an allowed Strategy
     * @param _amount Amount of OToken to burn
     *
     * Todo: Maybe this is a comment that we can remove now?
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
        oUSD.burn(msg.sender, _amount);
    }

    /**
     * @notice Calculate the total value of asset held by the Vault and all
     *      strategies and update the supply of OTokens.
     */

    function rebase() external virtual nonReentrant {
        _rebase();
    }

    /**
     * @dev Calculate the total value of asset held by the Vault and all
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

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║                       STRATEGIES & ALLOCATION                        ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    /**
     * @notice Add a strategy to the Vault.
     * @param _addr Address of the strategy to add
     */
    function approveStrategy(address _addr) external onlyGovernor {
        require(!strategies[_addr].isSupported, "Strategy already approved");
        strategies[_addr] = Strategy({ isSupported: true, _deprecated: 0 });
        allStrategies.push(_addr);
        emit StrategyApproved(_addr);
    }

    /**
     * @notice Remove a strategy from the Vault.
     * @param _addr Address of the strategy to remove
     */

    function removeStrategy(address _addr) external onlyGovernor {
        require(strategies[_addr].isSupported, "Strategy not approved");
        require(defaultStrategy != _addr, "Strategy is default for asset");

        // Initialize strategyIndex with out of bounds result so function will
        // revert if no valid index found
        uint256 stratCount = allStrategies.length;
        uint256 strategyIndex = stratCount;
        for (uint256 i = 0; i < stratCount; ++i) {
            if (allStrategies[i] == _addr) {
                strategyIndex = i;
                break;
            }
        }

        if (strategyIndex < stratCount) {
            allStrategies[strategyIndex] = allStrategies[stratCount - 1];
            allStrategies.pop();

            // Mark the strategy as not supported
            strategies[_addr].isSupported = false;

            // Withdraw all asset
            IStrategy strategy = IStrategy(_addr);
            strategy.withdrawAll();

            emit StrategyRemoved(_addr);
        }
    }

    /**
     * @notice Adds a strategy to the mint whitelist.
     *          Reverts if strategy isn't approved on Vault.
     * @param strategyAddr Strategy address
     */
    function addStrategyToMintWhitelist(address strategyAddr)
        external
        onlyGovernor
    {
        require(strategies[strategyAddr].isSupported, "Strategy not approved");

        require(
            !isMintWhitelistedStrategy[strategyAddr],
            "Already whitelisted"
        );

        isMintWhitelistedStrategy[strategyAddr] = true;

        emit StrategyAddedToMintWhitelist(strategyAddr);
    }

    /**
     * @notice Removes a strategy from the mint whitelist.
     * @param strategyAddr Strategy address
     */
    function removeStrategyFromMintWhitelist(address strategyAddr)
        external
        onlyGovernor
    {
        // Intentionally skipping `strategies.isSupported` check since
        // we may wanna remove an address even after removing the strategy

        require(isMintWhitelistedStrategy[strategyAddr], "Not whitelisted");

        isMintWhitelistedStrategy[strategyAddr] = false;

        emit StrategyRemovedFromMintWhitelist(strategyAddr);
    }

    /**
     * @notice Deposit multiple asset from the vault into the strategy.
     * @param _strategyToAddress Address of the Strategy to deposit asset into.
     * @param _assets Array of asset address that will be deposited into the strategy.
     * @param _amounts Array of amounts of each corresponding asset to deposit.
     */
    function depositToStrategy(
        address _strategyToAddress,
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) external onlyGovernorOrStrategist nonReentrant {
        _depositToStrategy(_strategyToAddress, _assets, _amounts);
    }

    function _depositToStrategy(
        address _strategyToAddress,
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) internal virtual {
        require(
            strategies[_strategyToAddress].isSupported,
            "Invalid to Strategy"
        );
        require(
            _assets.length == 1 && _amounts.length == 1 && _assets[0] == asset,
            "Only asset is supported"
        );

        // Check the there is enough asset to transfer once the backing
        // asset reserved for the withdrawal queue is accounted for
        require(
            _amounts[0] <= _assetAvailable(),
            "Not enough assets available"
        );

        // Send required amount of funds to the strategy
        IERC20(asset).safeTransfer(_strategyToAddress, _amounts[0]);

        // Deposit all the funds that have been sent to the strategy
        IStrategy(_strategyToAddress).depositAll();
    }

    /**
     * @notice Withdraw multiple asset from the strategy to the vault.
     * @param _strategyFromAddress Address of the Strategy to withdraw asset from.
     * @param _assets Array of asset address that will be withdrawn from the strategy.
     * @param _amounts Array of amounts of each corresponding asset to withdraw.
     */
    function withdrawFromStrategy(
        address _strategyFromAddress,
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) external onlyGovernorOrStrategist nonReentrant {
        _withdrawFromStrategy(
            address(this),
            _strategyFromAddress,
            _assets,
            _amounts
        );
    }

    /**
     * @param _recipient can either be a strategy or the Vault
     */
    function _withdrawFromStrategy(
        address _recipient,
        address _strategyFromAddress,
        address[] calldata _assets,
        uint256[] calldata _amounts
    ) internal virtual {
        require(
            strategies[_strategyFromAddress].isSupported,
            "Invalid from Strategy"
        );
        require(_assets.length == _amounts.length, "Parameter length mismatch");

        uint256 assetCount = _assets.length;
        for (uint256 i = 0; i < assetCount; ++i) {
            // Withdraw from Strategy to the recipient
            IStrategy(_strategyFromAddress).withdraw(
                _recipient,
                _assets[i],
                _amounts[i]
            );
        }

        IVault(address(this)).addWithdrawalQueueLiquidity();
    }

    /**
     * @notice Withdraws all asset from the strategy and sends asset to the Vault.
     * @param _strategyAddr Strategy address.
     */
    function withdrawAllFromStrategy(address _strategyAddr)
        external
        onlyGovernorOrStrategist
    {
        _withdrawAllFromStrategy(_strategyAddr);
    }

    function _withdrawAllFromStrategy(address _strategyAddr) internal virtual {
        require(
            strategies[_strategyAddr].isSupported,
            "Strategy is not supported"
        );
        IStrategy strategy = IStrategy(_strategyAddr);
        strategy.withdrawAll();
        IVault(address(this)).addWithdrawalQueueLiquidity();
    }

    /**
     * @notice Withdraws all asset from all the strategies and sends asset to the Vault.
     */
    function withdrawAllFromStrategies() external onlyGovernorOrStrategist {
        _withdrawAllFromStrategies();
    }

    function _withdrawAllFromStrategies() internal virtual {
        uint256 stratCount = allStrategies.length;
        for (uint256 i = 0; i < stratCount; ++i) {
            IStrategy(allStrategies[i]).withdrawAll();
        }
        IVault(address(this)).addWithdrawalQueueLiquidity();
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
        uint256 totalSupply = oUSD.totalSupply();
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

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║                       ASYNCHRONOUS WITHDRAWALS                       ║
    // ╚══════════════════════════════════════════════════════════════════════╝
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
            _addWithdrawalQueueLiquidity();
        }

        // Scale amount to asset decimals
        amount = _claimWithdrawal(_requestId).scaleBy(assetDecimals, 18);

        // transfer asset from the vault to the withdrawer
        IERC20(asset).safeTransfer(msg.sender, amount);

        // Prevent insolvency
        _postRedeem(amount.scaleBy(18, assetDecimals));
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
        // Add any asset to the withdrawal queue
        // this needs to remain here as:
        //  - Vault can be funded and `addWithdrawalQueueLiquidity` is not externally called
        //  - funds can be withdrawn from a strategy
        //
        // Those funds need to be added to withdrawal queue liquidity
        _addWithdrawalQueueLiquidity();

        amounts = new uint256[](_requestIds.length);
        for (uint256 i; i < _requestIds.length; ++i) {
            // Scale all amounts to asset decimals, thus totalAmount is also in asset decimals
            amounts[i] = _claimWithdrawal(_requestIds[i]).scaleBy(
                assetDecimals,
                18
            );
            totalAmount += amounts[i];
        }

        // transfer all the claimed asset from the vault to the withdrawer
        IERC20(asset).safeTransfer(msg.sender, totalAmount);

        // Prevent insolvency
        _postRedeem(totalAmount.scaleBy(18, assetDecimals));

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
                StableMath.scaleBy(request.amount, assetDecimals, 18)
            );

        emit WithdrawalClaimed(msg.sender, requestId, request.amount);

        return request.amount;
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
    function _addWithdrawalQueueLiquidity()
        internal
        returns (uint256 addedClaimable)
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
        // That is, the amount of asset that is currently allocated for the withdrawal queue
        uint256 allocatedBaseAsset = queue.claimable - queue.claimed;

        // If there is no unallocated asset then there is nothing to add to the queue
        if (assetBalance <= allocatedBaseAsset) {
            return 0;
        }

        uint256 unallocatedBaseAsset = assetBalance - allocatedBaseAsset;
        // the new claimable amount is the smaller of the queue shortfall or unallocated asset
        addedClaimable = queueShortfall < unallocatedBaseAsset
            ? queueShortfall
            : unallocatedBaseAsset;
        uint256 newClaimable = queue.claimable + addedClaimable;

        // Store the new claimable amount back to storage
        withdrawalQueueMetadata.claimable = SafeCast.toUint128(newClaimable);

        // emit a WithdrawalClaimable event
        emit WithdrawalClaimable(newClaimable, addedClaimable);
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║                                ADMIN                                 ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    /**
     * @notice Set a buffer of asset to keep in the Vault to handle most
     * redemptions without needing to spend gas unwinding asset from a Strategy.
     * @param _vaultBuffer Percentage using 18 decimals. 100% = 1e18.
     */
    function setVaultBuffer(uint256 _vaultBuffer)
        external
        onlyGovernorOrStrategist
    {
        require(_vaultBuffer <= 1e18, "Invalid value");
        vaultBuffer = _vaultBuffer;
        emit VaultBufferUpdated(_vaultBuffer);
    }

    /**
     * @notice Sets the minimum amount of OTokens in a mint to trigger an
     * automatic allocation of funds afterwords.
     * @param _threshold OToken amount with 18 fixed decimals.
     */
    function setAutoAllocateThreshold(uint256 _threshold)
        external
        onlyGovernor
    {
        autoAllocateThreshold = _threshold;
        emit AllocateThresholdUpdated(_threshold);
    }

    /**
     * @notice Set a minimum amount of OTokens in a mint or redeem that triggers a
     * rebase
     * @param _threshold OToken amount with 18 fixed decimals.
     */
    function setRebaseThreshold(uint256 _threshold) external onlyGovernor {
        rebaseThreshold = _threshold;
        emit RebaseThresholdUpdated(_threshold);
    }

    /**
     * @notice Set address of Strategist
     * @param _address Address of Strategist
     */
    function setStrategistAddr(address _address) external onlyGovernor {
        strategistAddr = _address;
        emit StrategistUpdated(_address);
    }

    /**
     * @notice Set the default Strategy for asset, i.e. the one which
     * the asset will be automatically allocated to and withdrawn from
     * @param _strategy Address of the Strategy
     */
    function setDefaultStrategy(address _strategy)
        external
        onlyGovernorOrStrategist
    {
        emit DefaultStrategyUpdated(_strategy);
        // If its a zero address being passed for the strategy we are removing
        // the default strategy
        if (_strategy != address(0)) {
            // Make sure the strategy meets some criteria
            require(strategies[_strategy].isSupported, "Strategy not approved");
            require(
                IStrategy(_strategy).supportsAsset(asset),
                "Asset not supported by Strategy"
            );
        }
        defaultStrategy = _strategy;
    }

    /**
     * @notice Changes the async withdrawal claim period for OETH & superOETHb
     * @param _delay Delay period (should be between 10 mins to 7 days).
     *          Set to 0 to disable async withdrawals
     */
    function setWithdrawalClaimDelay(uint256 _delay) external onlyGovernor {
        require(
            _delay == 0 || (_delay >= 10 minutes && _delay <= 15 days),
            "Invalid claim delay period"
        );
        withdrawalClaimDelay = _delay;
        emit WithdrawalClaimDelayUpdated(_delay);
    }

    /**
     * @notice Set a yield streaming max rate. This spreads yield over
     * time if it is above the max rate.
     * @param yearlyApr in 1e18 notation. 3 * 1e18 = 3% APR
     */
    function setRebaseRateMax(uint256 yearlyApr)
        external
        onlyGovernorOrStrategist
    {
        // The old yield will be at the old rate
        IVault(address(this)).rebase();
        // Change the rate
        uint256 newPerSecond = yearlyApr / 100 / 365 days;
        require(newPerSecond <= MAX_REBASE_PER_SECOND, "Rate too high");
        rebasePerSecondMax = newPerSecond.toUint64();
        emit RebasePerSecondMaxChanged(newPerSecond);
    }

    /**
     * @notice Set the drip duration period
     * @param _dripDuration Time in seconds to target a constant yield rate
     */
    function setDripDuration(uint256 _dripDuration)
        external
        onlyGovernorOrStrategist
    {
        // The old yield will be at the old rate
        IVault(address(this)).rebase();
        dripDuration = _dripDuration.toUint64();
        emit DripDurationChanged(_dripDuration);
    }

    /**
     * @notice Sets the maximum allowable difference between
     * total supply and asset' value.
     */
    function setMaxSupplyDiff(uint256 _maxSupplyDiff) external onlyGovernor {
        maxSupplyDiff = _maxSupplyDiff;
        emit MaxSupplyDiffChanged(_maxSupplyDiff);
    }

    /**
     * @notice Sets the trusteeAddress that can receive a portion of yield.
     *      Setting to the zero address disables this feature.
     */
    function setTrusteeAddress(address _address) external onlyGovernor {
        trusteeAddress = _address;
        emit TrusteeAddressChanged(_address);
    }

    /**
     * @notice Sets the TrusteeFeeBps to the percentage of yield that should be
     *      received in basis points.
     */
    function setTrusteeFeeBps(uint256 _basis) external onlyGovernor {
        require(_basis <= 5000, "basis cannot exceed 50%");
        trusteeFeeBps = _basis;
        emit TrusteeFeeBpsChanged(_basis);
    }

    /**
     * @notice Set the deposit paused flag to true to prevent rebasing.
     */
    function pauseRebase() external onlyGovernorOrStrategist {
        rebasePaused = true;
        emit RebasePaused();
    }

    /**
     * @notice Set the deposit paused flag to true to allow rebasing.
     */
    function unpauseRebase() external onlyGovernorOrStrategist {
        rebasePaused = false;
        emit RebaseUnpaused();
    }

    /**
     * @notice Set the deposit paused flag to true to prevent capital movement.
     */
    function pauseCapital() external onlyGovernorOrStrategist {
        capitalPaused = true;
        emit CapitalPaused();
    }

    /**
     * @notice Set the deposit paused flag to false to enable capital movement.
     */
    function unpauseCapital() external onlyGovernorOrStrategist {
        capitalPaused = false;
        emit CapitalUnpaused();
    }

    /**
     * @notice Transfer token to governor. Intended for recovering tokens stuck in
     *      contract, i.e. mistaken sends.
     * @param _asset Address for the asset
     * @param _amount Amount of the asset to transfer
     */
    function transferToken(address _asset, uint256 _amount)
        external
        onlyGovernor
    {
        require(asset != _asset, "Only unsupported asset");
        IERC20(_asset).safeTransfer(governor(), _amount);
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║                            INTERNAL LOGIC                            ║
    // ╚══════════════════════════════════════════════════════════════════════╝

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

    function _postRedeem(uint256 _amount) internal {
        // Until we can prove that we won't affect the prices of our asset
        // by withdrawing them, this should be here.
        // It's possible that a strategy was off on its asset total, perhaps
        // a reward token sold for more or for less than anticipated.
        uint256 totalUnits = 0;
        if (_amount >= rebaseThreshold && !rebasePaused) {
            totalUnits = _rebase();
        } else {
            totalUnits = _totalValue();
        }

        // Check that the OTokens are backed by enough asset
        if (maxSupplyDiff > 0) {
            // If there are more outstanding withdrawal requests than asset in the vault and strategies
            // then the available asset will be negative and totalUnits will be rounded up to zero.
            // As we don't know the exact shortfall amount, we will reject all redeem and withdrawals
            require(totalUnits > 0, "Too many outstanding requests");

            // Allow a max difference of maxSupplyDiff% between
            // asset value and OUSD total supply
            uint256 diff = oUSD.totalSupply().divPrecisely(totalUnits);
            require(
                (diff > 1e18 ? diff - 1e18 : 1e18 - diff) <= maxSupplyDiff,
                "Backing supply liquidity error"
            );
        }
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

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║                                VIEWS                                 ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    /**
     * @notice Calculates the amount that would rebase at next rebase.
     * This is before any fees.
     * @return yield amount of expected yield
     */
    function previewYield() external view returns (uint256 yield) {
        (yield, ) = _nextYield(oUSD.totalSupply(), _totalValue());
        return yield;
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
     * @dev Internal Calculate the total value of the asset held by the
     *          vault and its strategies.
     * @dev The total value of all WETH held by the vault and all its strategies
     *          less any WETH that is reserved for the withdrawal queue.
     *          If there is not enough WETH in the vault and all strategies to cover
     *          all outstanding withdrawal requests then return a total value of 0.
     * @return value Total value in USD/ETH (1e18)
     */
    function _totalValue() internal view virtual returns (uint256 value) {
        // As asset is the only asset, just return the asset balance
        value = _checkBalance(asset).scaleBy(18, assetDecimals);
    }

    /**
     * @dev Internal to calculate total value of all asset held in Vault.
     * @dev Only asset is supported in the OETH Vault so return the asset balance only
     *          Any ETH balances in the Vault will be ignored.
     *          Amounts from previously supported vault asset will also be ignored.
     *          For example, there is 1 wei left of stETH in the OETH Vault but is will be ignored.
     * @return value Total value in USD/ETH (1e18)
     */
    function _totalValueInVault()
        internal
        view
        virtual
        returns (uint256 value)
    {
        value = IERC20(asset).balanceOf(address(this));
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

        // Need to remove asset that is reserved for the withdrawal queue
        return balance + queue.claimed - queue.queued;
    }

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
}
