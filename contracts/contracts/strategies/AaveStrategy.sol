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
     */
    function _deposit(address _asset, uint256 _amount) internal {
        require(_amount > 0, "Must deposit something");
        // Following line also doubles as a check that we are depositing
        // an asset that we support.
        emit Deposit(_asset, _getATokenFor(_asset), _amount);
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
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external onlyVault nonReentrant {
        require(_amount > 0, "Must withdraw something");
        require(_recipient != address(0), "Must specify recipient");

        emit Withdrawal(_asset, _getATokenFor(_asset), _amount);
        uint256 actual = _getLendingPool().withdraw(
            _asset,
            _amount,
            address(this)
        );
        require(actual == _amount, "Did not withdraw enough");
        IERC20(_asset).safeTransfer(_recipient, _amount);
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external onlyVaultOrGovernor nonReentrant {
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            // Redeem entire balance of aToken
            IERC20 asset = IERC20(assetsMapped[i]);
            address aToken = _getATokenFor(assetsMapped[i]);
            uint256 balance = IERC20(aToken).balanceOf(address(this));
            if (balance > 0) {
                uint256 actual = _getLendingPool().withdraw(
                    address(asset),
                    balance,
                    address(this)
                );
                require(actual == balance, "Did not withdraw enough");
                // Transfer entire balance to Vault
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
        address aToken = _getATokenFor(_asset);
        balance = IERC20(aToken).balanceOf(address(this));
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
        address lendingPool = address(_getLendingPool());
        // approve the pool to spend the Asset
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            address asset = assetsMapped[i];
            // Safe approval
            IERC20(asset).safeApprove(lendingPool, 0);
            IERC20(asset).safeApprove(lendingPool, uint256(-1));
        }
    }

    /**
     * @dev Internal method to respond to the addition of new asset / aTokens
            We need to give the AAVE lending pool approval to transfer the
            asset.
     * @param _asset Address of the asset to approve
     * @param _aToken Address of the aToken
     */
    function _abstractSetPToken(address _asset, address _aToken) internal {
        address lendingPool = address(_getLendingPool());
        IERC20(_asset).safeApprove(lendingPool, 0);
        IERC20(_asset).safeApprove(lendingPool, uint256(-1));
    }

    /**
     * @dev Get the aToken wrapped in the IERC20 interface for this asset.
     *      Fails if the pToken doesn't exist in our mappings.
     * @param _asset Address of the asset
     * @return Corresponding aToken to this asset
     */
    function _getATokenFor(address _asset) internal view returns (address) {
        address aToken = assetToPToken[_asset];
        require(aToken != address(0), "aToken does not exist");
        return aToken;
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
        uint256 windowStart = cooldown.add(stkAave.COOLDOWN_SECONDS());
        uint256 windowEnd = windowStart.add(stkAave.UNSTAKE_WINDOW());

        // If inside the unlock window, then we can redeem stkAave
        // for AAVE and send it to the vault.
        if (now > windowStart && now <= windowEnd) {
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

        // Collect avaiable rewards and restart the cooldown timer, if either of
        // those should be run.
        if (now > windowStart || cooldown == 0) {
            // aToken addresses for incentives controller
            address[] memory aTokens = new address[](assetsMapped.length);
            for (uint256 i = 0; i < assetsMapped.length; i++) {
                aTokens[i] = _getATokenFor(assetsMapped[i]);
            }

            // 1. If we have rewards availabile, collect them
            uint256 pendingRewards = incentivesController.getRewardsBalance(
                aTokens,
                address(this)
            );
            if (pendingRewards > 0) {
                // Because getting more stkAAVE from the incentives controller
                // with claimRewards() may push the stkAAVE cooldown time
                // forward, it is called after stakedAAVE has been turned into
                // AAVE.
                uint256 collected = incentivesController.claimRewards(
                    aTokens,
                    pendingRewards,
                    address(this)
                );
                require(collected == pendingRewards, "AAVE reward difference");
            }

            // 2. Start cooldown counting down.
            if (stkAave.balanceOf(address(this)) > 0) {
                // Protected with if since cooldown call would revert
                // if no stkAave balance.
                stkAave.cooldown();
            }
        }
    }
}
