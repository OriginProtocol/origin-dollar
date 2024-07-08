// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { IWETH9 } from "../interfaces/IWETH9.sol";
import { IVault } from "../interfaces/IVault.sol";

interface IStETHWithdrawal {
    event WithdrawalRequested(
        uint256 indexed requestId,
        address indexed requestor,
        address indexed owner,
        uint256 amountOfStETH,
        uint256 amountOfShares
    );
    event WithdrawalsFinalized(
        uint256 indexed from,
        uint256 indexed to,
        uint256 amountOfETHLocked,
        uint256 sharesToBurn,
        uint256 timestamp
    );
    event WithdrawalClaimed(
        uint256 indexed requestId,
        address indexed owner,
        address indexed receiver,
        uint256 amountOfETH
    );

    struct WithdrawalRequestStatus {
        /// @notice stETH token amount that was locked on withdrawal queue for this request
        uint256 amountOfStETH;
        /// @notice amount of stETH shares locked on withdrawal queue for this request
        uint256 amountOfShares;
        /// @notice address that can claim or transfer this request
        address owner;
        /// @notice timestamp of when the request was created, in seconds
        uint256 timestamp;
        /// @notice true, if request is finalized
        bool isFinalized;
        /// @notice true, if request is claimed. Request is claimable if (isFinalized && !isClaimed)
        bool isClaimed;
    }

    function requestWithdrawals(uint256[] calldata _amounts, address _owner)
        external
        returns (uint256[] memory requestIds);

    function getLastCheckpointIndex() external view returns (uint256);

    function findCheckpointHints(
        uint256[] calldata _requestIds,
        uint256 _firstIndex,
        uint256 _lastIndex
    ) external view returns (uint256[] memory hintIds);

    function claimWithdrawals(
        uint256[] calldata _requestIds,
        uint256[] calldata _hints
    ) external;

    function getWithdrawalStatus(uint256[] calldata _requestIds)
        external
        view
        returns (WithdrawalRequestStatus[] memory statuses);

    function getWithdrawalRequests(address _owner)
        external
        view
        returns (uint256[] memory requestsIds);

    function finalize(
        uint256 _lastRequestIdToBeFinalized,
        uint256 _maxShareRate
    ) external payable;
}

/**
 * @title Lido Withdrawal Strategy
 * @notice This strategy withdraws ETH from stETH via the Lido Withdrawal Queue contract
 * @author Origin Protocol Inc
 */
contract LidoWithdrawalStrategy is InitializableAbstractStrategy {
    /// @notice Address of the WETH token
    IWETH9 private constant weth =
        IWETH9(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    /// @notice Address of the stETH token
    IERC20 private constant stETH =
        IERC20(0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84);
    /// @notice Address of the Lido Withdrawal Queue contract
    IStETHWithdrawal private constant withdrawalQueue =
        IStETHWithdrawal(0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1);
    /// @notice Maximum amount of stETH that can be withdrawn in a single request
    uint256 public constant MaxWithdrawalAmount = 1000 ether;
    /// @notice Total amount of stETH that has been requested to be withdrawn for ETH
    uint256 public outstandingWithdrawals;

    event WithdrawalRequests(uint256[] requestIds, uint256[] amounts);
    event WithdrawalClaims(uint256[] requestIds, uint256 amount);

    constructor(BaseStrategyConfig memory _stratConfig)
        InitializableAbstractStrategy(_stratConfig)
    {}

    /**
     * @notice initialize function, to set up initial internal state
     * @param _rewardTokenAddresses Address of reward token for platform
     * @param _assets Addresses of initial supported assets
     * @param _pTokens Platform Token corresponding addresses
     */
    function initialize(
        address[] memory _rewardTokenAddresses,
        address[] memory _assets,
        address[] memory _pTokens
    ) external onlyGovernor initializer {
        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
        safeApproveAllTokens();
    }

    /**
     * @notice deposit() function not used for this strategy. Use depositAll() instead.
     */
    function deposit(address, uint256) public override onlyVault nonReentrant {
        // This method no longer used by the VaultAdmin, and we don't want it
        // to be used by VaultCore.
        require(false, "use depositAll() instead");
    }

    /**
     * @notice Takes all given stETH and creates Lido withdrawal request
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256 stETHStart = stETH.balanceOf(address(this));
        require(stETHStart > 0, "No stETH to withdraw");

        uint256 withdrawalLength = (stETHStart / MaxWithdrawalAmount) + 1;
        uint256[] memory amounts = new uint256[](withdrawalLength);

        uint256 stETHRemaining = stETHStart;
        uint256 i = 0;
        while (stETHRemaining > MaxWithdrawalAmount) {
            amounts[i++] = MaxWithdrawalAmount;
            stETHRemaining -= MaxWithdrawalAmount;
        }
        amounts[i] = stETHRemaining;

        uint256[] memory requestIds = withdrawalQueue.requestWithdrawals(
            amounts,
            address(this)
        );

        emit WithdrawalRequests(requestIds, amounts);

        // Is there any stETH left except 1 wei from each request?
        // This is because stETH does not transfer all the transfer amount.
        uint256 stEthDust = stETH.balanceOf(address(this));
        require(
            stEthDust <= withdrawalLength,
            "Not all stEth in withdraw queue"
        );
        outstandingWithdrawals += stETHStart;

        // This strategy claims to support WETH, so it is possible for
        // the vault to transfer WETH to it. This returns any deposited WETH
        // to the vault so that it is not lost for balance tracking purposes.
        uint256 wethBalance = weth.balanceOf(address(this));
        if (wethBalance > 0) {
            // slither-disable-next-line unchecked-transfer
            weth.transfer(vaultAddress, wethBalance);
        }

        emit Deposit(address(stETH), address(withdrawalQueue), stETHStart);
    }

    /**
     * @notice Withdraw an asset from the underlying platform
     * @param _recipient Address to receive withdrawn assets
     * @param _asset Address of the asset to withdraw
     * @param _amount Amount of assets to withdraw
     */
    function withdraw(
        // solhint-disable-next-line no-unused-vars
        address _recipient,
        // solhint-disable-next-line no-unused-vars
        address _asset,
        // solhint-disable-next-line no-unused-vars
        uint256 _amount
    ) external override onlyVault nonReentrant {
        // Does nothing - all withdrawals need to be called manually using the
        // Strategist calling claimWithdrawals
        revert("use claimWithdrawals()");
    }

    /**
     * @notice Claim previously requested withdrawals that have now finalized.
     * Called by the Strategist.
     * @param _requestIds Array of withdrawal request identifiers
     * @param _expectedAmount Total amount of ETH expect to be withdrawn
     */
    function claimWithdrawals(
        uint256[] memory _requestIds,
        uint256 _expectedAmount
    ) external nonReentrant {
        require(
            msg.sender == IVault(vaultAddress).strategistAddr(),
            "Caller is not the Strategist"
        );
        uint256 startingBalance = payable(address(this)).balance;
        uint256 lastIndex = withdrawalQueue.getLastCheckpointIndex();
        uint256[] memory hintIds = withdrawalQueue.findCheckpointHints(
            _requestIds,
            1,
            lastIndex
        );
        withdrawalQueue.claimWithdrawals(_requestIds, hintIds);

        uint256 currentBalance = payable(address(this)).balance;
        uint256 withdrawalAmount = currentBalance - startingBalance;
        // Withdrawal amount should be within 2 wei of expected amount
        require(
            withdrawalAmount + 2 >= _expectedAmount &&
                withdrawalAmount <= _expectedAmount,
            "Withdrawal amount not expected"
        );

        emit WithdrawalClaims(_requestIds, withdrawalAmount);

        outstandingWithdrawals -= withdrawalAmount;
        weth.deposit{ value: currentBalance }();
        // slither-disable-next-line unchecked-transfer
        weth.transfer(vaultAddress, currentBalance);
        emit Withdrawal(
            address(weth),
            address(withdrawalQueue),
            currentBalance
        );
    }

    /**
     * @notice Withdraw all assets from this strategy, and transfer to the Vault.
     * In correct operation, this strategy should never hold any assets.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        if (payable(address(this)).balance > 0) {
            weth.deposit{ value: payable(address(this)).balance }();
        }
        uint256 wethBalance = weth.balanceOf(address(this));
        if (wethBalance > 0) {
            // slither-disable-next-line unchecked-transfer
            weth.transfer(vaultAddress, wethBalance);
            emit Withdrawal(address(weth), address(0), wethBalance);
        }
        uint256 stEthBalance = stETH.balanceOf(address(this));
        if (stEthBalance > 0) {
            // slither-disable-next-line unchecked-transfer
            stETH.transfer(vaultAddress, stEthBalance);
            emit Withdrawal(address(stETH), address(0), stEthBalance);
        }
    }

    /**
     * @notice Returns the amount of queued stETH that will be returned as WETH.
     * We return this as a WETH asset, since that is what it will eventually be returned as.
     * We only return the outstandingWithdrawals, because the contract itself should never hold any funds.
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256 balance)
    {
        if (_asset == address(weth)) {
            return outstandingWithdrawals;
        } else if (_asset == address(stETH)) {
            return 0;
        } else {
            revert("Unexpected asset address");
        }
    }

    /**
     * @notice Approve the spending of all assets by their corresponding cToken,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens() public override {
        // slither-disable-next-line unused-return
        stETH.approve(address(withdrawalQueue), type(uint256).max);
    }

    /**
     * @notice Check if an asset is supported.
     * @param _asset    Address of the asset
     * @return bool     Whether asset is supported
     */
    function supportsAsset(address _asset) public pure override returns (bool) {
        // stETH can be deposited by the vault and balances are reported in WETH
        return _asset == address(stETH) || _asset == address(weth);
    }

    /// @notice Needed to receive ETH when withdrawal requests are claimed
    receive() external payable {}

    function _abstractSetPToken(address, address) internal pure override {
        revert("No pTokens are used");
    }
}
