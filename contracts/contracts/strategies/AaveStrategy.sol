pragma solidity 0.5.11;

/**
 * @title OUSD Aave Strategy
 * @notice Investment strategy for investing stablecoins via Aave
 * @author Origin Protocol Inc
 */
import "./IAave.sol";
import {
    IERC20,
    InitializableAbstractStrategy
} from "../utils/InitializableAbstractStrategy.sol";

import { IAaveStakedToken } from "./IAaveStakeToken.sol";
import { IAaveIncentivesController } from "./IAaveIncentivesController.sol";

contract AaveStrategy is InitializableAbstractStrategy {
    uint16 constant referralCode = 92;

    IAaveIncentivesController public incentivesController;
    IAaveStakedToken public stkAave;

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as AAVE needs several extra
     * addresses for the rewards program.
     * @param _platformAddress Address of the AAVE pool
     * @param _vaultAddress Address of the vault
     * @param _rewardTokenAddress Address of the AAVE token
     * @param _assets Addresses of supported assets
     * @param _pTokens Platform Token corresponding addresses
     * @param _incentivesAddress Address of the AAVE incentives controller
     * @param _stkAaveAddress Address of the stkAave contract
     */
    function initialize(
        address _platformAddress, // AAVE pool
        address _vaultAddress,
        address _rewardTokenAddress, // AAVE
        address[] calldata _assets,
        address[] calldata _pTokens,
        address _incentivesAddress,
        address _stkAaveAddress
    ) external onlyGovernor initializer {
        incentivesController = IAaveIncentivesController(_incentivesAddress);
        stkAave = IAaveStakedToken(_stkAaveAddress);
        InitializableAbstractStrategy._initialize(
            _platformAddress,
            _vaultAddress,
            _rewardTokenAddress,
            _assets,
            _pTokens
        );
    }

    /**
     * @dev Deposit asset into Aave
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     * @return amountDeposited Amount of asset that was deposited
     */
    function deposit(address _asset, uint256 _amount)
        external
        onlyVault
        nonReentrant
    {
        _deposit(_asset, _amount);
    }

    /**
     * @dev Deposit asset into Aave
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     * @return amountDeposited Amount of asset that was deposited
     */
    function _deposit(address _asset, uint256 _amount) internal {
        require(_amount > 0, "Must deposit something");
        IAaveAToken aToken = _getATokenFor(_asset);
        emit Deposit(_asset, address(aToken), _amount);
        _getLendingPool().deposit(_asset, _amount, address(this), referralCode);
    }

    /**
     * @dev Deposit the entire balance of any supported asset into Aave
     */
    function depositAll() external onlyVault nonReentrant {
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            uint256 balance = IERC20(assetsMapped[i]).balanceOf(address(this));
            if (balance > 0) {
                _deposit(assetsMapped[i], balance);
            }
        }
    }

    /**
     * @dev Withdraw asset from Aave
     * @param _recipient Address to receive withdrawn asset
     * @param _asset Address of asset to withdraw
     * @param _amount Amount of asset to withdraw
     * @return amountWithdrawn Amount of asset that was withdrawn
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external onlyVault nonReentrant {
        require(_amount > 0, "Must withdraw something");
        require(_recipient != address(0), "Must specify recipient");

        IAaveAToken aToken = _getATokenFor(_asset);
        emit Withdrawal(_asset, address(aToken), _amount);
        uint256 actual = _getLendingPool().withdraw(
            _asset,
            _amount,
            address(this)
        );
        require(actual >= _amount, "Did not withdraw enough");
        IERC20(_asset).safeTransfer(_recipient, _amount);
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external onlyVaultOrGovernor nonReentrant {
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            // Redeem entire balance of aToken
            IAaveAToken aToken = _getATokenFor(assetsMapped[i]);
            uint256 balance = aToken.balanceOf(address(this));
            if (balance > 0) {
                aToken.redeem(balance);
                // Transfer entire balance to Vault
                IERC20 asset = IERC20(assetsMapped[i]);
                asset.safeTransfer(
                    vaultAddress,
                    asset.balanceOf(address(this))
                );
            }
        }
    }

    /**
     * @dev Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
        view
        returns (uint256 balance)
    {
        // Balance is always with token aToken decimals
        IAaveAToken aToken = _getATokenFor(_asset);
        balance = aToken.balanceOf(address(this));
    }

    /**
     * @dev Retuns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) external view returns (bool) {
        return assetToPToken[_asset] != address(0);
    }

    /**
     * @dev Approve the spending of all assets by their corresponding aToken,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens() external onlyGovernor nonReentrant {
        uint256 assetCount = assetsMapped.length;
        address lendingPool = address(_getLendingPool());
        // approve the pool to spend the bAsset
        for (uint256 i = 0; i < assetCount; i++) {
            address asset = assetsMapped[i];
            // Safe approval
            IERC20(asset).safeApprove(lendingPool, 0);
            IERC20(asset).safeApprove(lendingPool, uint256(-1));
        }
    }

    /**
     * @dev Internal method to respond to the addition of new asset / aTokens
     *      We need to approve the aToken and give it permission to spend the asset
     * @param _asset Address of the asset to approve
     * @param _aToken This aToken has the approval approval
     */
    function _abstractSetPToken(address _asset, address _aToken) internal {
        address lendingPool = address(_getLendingPool());
        IERC20(_asset).safeApprove(lendingPool, 0);
        IERC20(_asset).safeApprove(lendingPool, uint256(-1));
    }

    /**
     * @dev Get the aToken wrapped in the ICERC20 interface for this asset.
     *      Fails if the pToken doesn't exist in our mappings.
     * @param _asset Address of the asset
     * @return Corresponding aToken to this asset
     */
    function _getATokenFor(address _asset) internal view returns (IAaveAToken) {
        address aToken = assetToPToken[_asset];
        require(aToken != address(0), "aToken does not exist");
        return IAaveAToken(aToken);
    }

    /**
     * @dev Get the current address of the Aave lending pool, which is the gateway to
     *      depositing.
     * @return Current lending pool implementation
     */
    function _getLendingPool() internal view returns (IAaveLendingPool) {
        address lendingPool = ILendingPoolAddressesProvider(platformAddress)
            .getLendingPool();
        require(lendingPool != address(0), "Lending pool does not exist");
        return IAaveLendingPool(lendingPool);
    }

    /**
     * @dev Collect stkAave, convert it to AAVE send to Vault.
     */
    function collectRewardToken() external onlyVault nonReentrant {
        if (address(stkAave) == address(0)) {
            return;
        }

        // Check staked AAVE cooldown timer
        uint256 cooldown = stkAave.stakersCooldowns(address(this));
        uint256 windowStart = cooldown + stkAave.COOLDOWN_SECONDS();
        uint256 windowEnd = windowStart + stkAave.UNSTAKE_WINDOW();
        uint256 currentTimestamp = now;

        // If inside the unlock window, then we can redeem stkAave
        // for AAVE and send it to the vault.
        if (currentTimestamp > windowStart && currentTimestamp < windowEnd) {
            // Redeem to AAVE
            uint256 stkAaveBalance = stkAave.balanceOf(address(this));
            if (stkAaveBalance > rewardLiquidationThreshold) {
                stkAave.redeem(address(this), stkAaveBalance);
            }
            // Transfer AAVE to vaultAddress
            uint256 aaveBalance = IERC20(rewardTokenAddress).balanceOf(
                address(this)
            );
            if (aaveBalance > 0) {
                IERC20(rewardTokenAddress).safeTransfer(
                    vaultAddress,
                    aaveBalance
                );
            }
        }

        // If we were past the start of the window,
        // or if the cooldown counter is not running,
        // then start the unlock cooldown.
        if (currentTimestamp > windowStart || cooldown == 0) {
            uint256 pendingRewards = incentivesController.getRewardsBalance(
                assetsMapped,
                address(this)
            );
            if (pendingRewards > 0) {
                // claimRewards() may pause or push the cooldown time
                // into the future. It needs to be run after any rewards would be
                // collected, but before the cooldown is restarted.
                uint256 collected = incentivesController.claimRewards(
                    assetsMapped,
                    pendingRewards,
                    address(this)
                );
                require(collected == pendingRewards, "AAVE reward difference");
            }
            // Cooldown call reverts if no stkAave balance
            if (stkAave.balanceOf(address(this)) > 0) {
                stkAave.cooldown();
            }
        }
    }
}
