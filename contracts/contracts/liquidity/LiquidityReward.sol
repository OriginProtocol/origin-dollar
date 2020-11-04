pragma solidity 0.5.11;

import {
    Initializable
} from "@openzeppelin/upgrades/contracts/Initializable.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { StableMath } from "../utils/StableMath.sol";
import { Governable } from "../governance/Governable.sol";
import "@nomiclabs/buidler/console.sol";

//
// LiquidityReward contract doles out reward for liquidity
//   base off of Sushiswap's MasterChef: https://github.com/sushiswap/sushiswap/blob/master/contracts/MasterChef.sol
//
contract LiquidityReward is Initializable, Governable {
    using SafeMath for uint256;
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    // Info of each user.
    struct UserInfo {
        uint256 amount;     // How many LP tokens the user has provided.
        int256 rewardDebt; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of Reward Tokens
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accRewardPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accRewardPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;           // Address of LP token contract.
        uint256 lastRewardBlock;  // Last block number that Reward calculation occurs.
        uint256 accRewardPerShare; // Accumulated Reward per share in reward precision. See below.
    }

    // The Reward token
    IERC20 public reward;

    // Reward tokens created per block in 1e18 precision.
    uint256 public rewardPerBlock;
    
    // Info on the LP.
    PoolInfo public pool;
    // total Reward debt, useful to calculate if we have enough to pay out all rewards
    int256 public totalRewardDebt;
    // Info of each user that stakes LP tokens.
    mapping (address => UserInfo) public userInfo;
    // The block number when Liquidity rewards ends. 
    uint256 public endBlock;

    // for now assume it's OGN precision which is standard 1e18
    uint256 public constant REWARD_PRECISION  = 1e18;

    event CampaignStarted(uint256 rewardRate, uint256 startBlock, uint256 endBlock);
    event CampaignStopped(uint256 endBlock);
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Claim(address indexed user, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 amount);

    /**
     * Initializer for setting up Liquidity Reward internal state. 
     * @param _reward Address of the reward token(OGN)
     * @param _lpToken Address of the LP token(Uniswap Pair)
     */
    function initialize(
        IERC20 _reward,
        IERC20 _lpToken
    ) external onlyGovernor initializer {
        reward = _reward;
        pool.lpToken = _lpToken;
        pool.lastRewardBlock = block.number;
    }

    /**
     * @dev start a new reward campaign.
     *      This will calculate all rewards up to the current block at the old rate.
     *      This ensures that we pay everyone at the promised rate before update to the new rate.
     * @param _rewardPerBlock Amount rewarded per block
     * @param _startBlock Block number that we want to start the rewards at (0 for current block)
     * @param _numBlocks number of blocks that the campaign should last
     */
    function startCampaign(uint256 _rewardPerBlock, uint256 _startBlock, uint256 _numBlocks) external onlyGovernor {
      // Calculate up to the current block at the current rate for everyone.
      updatePool();

      // total Pending calculated at the current pool rate
      uint256 lpSupply = pool.lpToken.balanceOf(address(this));
      uint256 totalPending = subDebt(
        pool
        .accRewardPerShare
        .mulTruncate( 
                     pool.lpToken.balanceOf(address(this))
                    ), totalRewardDebt);

      require(reward.balanceOf(address(this)) >= _rewardPerBlock.mul(_numBlocks).add(totalPending),
              "startCampaign: insufficient rewards");
    
      uint256 startBlock = _startBlock;
      if (startBlock == 0 ) {
        // start block number isn't given so we start at the current
        startBlock = block.number;
      } 
      require(startBlock >= block.number, "startCampaign: _startBlock can't be in the past");
      endBlock = startBlock + _numBlocks;
      // we don't start accrue until the startBlock
      pool.lastRewardBlock = startBlock;
      // new blocks start at the new reward rate
      rewardPerBlock = _rewardPerBlock;
      emit CampaignStarted(rewardPerBlock, startBlock, endBlock);
    }

    function stopCampaign() external onlyGovernor {
      //calculate until current pool
      updatePool();
      //end the block here (the CampaignMultiplier will be zero)
      endBlock = block.number;
      emit CampaignStopped(endBlock);
    }

    function campaignActive() external view returns (bool) {
      return endBlock > block.number;
    }

    /**
     * @dev calculate the number of blocks since we last updated 
     *       within start and end as constraints
     * @param _to Block number of the ending point.
     * @return multiplier Multiplier over the given _from to _to block.
     */
    function getCampaignMultiplier(uint256 _to) internal view returns (uint256) {
      uint256 from = pool.lastRewardBlock;
      if (from > endBlock) {
        return 0;
      } else {
        return ( _to < endBlock ? _to : endBlock ).sub(from);
      }
    }

    /**
     * @dev View function to see pending rewards for each account on frontend.
     * @param _user Address of the account we're looking up.
     * @return reward Total rewards owed to this account.
     */
    function pendingRewards(address _user) external view returns (uint256) {
      UserInfo storage user = userInfo[_user];
      return _pendingRewards(user);
    }

    function _pendingRewards(UserInfo storage user) internal view returns (uint256) {
      uint256 accRewardPerShare = pool.accRewardPerShare;
      if (block.number > pool.lastRewardBlock) {
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply != 0 ) {
          uint256 multiplier = getCampaignMultiplier(block.number);
          uint256 incReward = multiplier.mul(rewardPerBlock);
          accRewardPerShare = accRewardPerShare.add(incReward.divPrecisely(lpSupply));
        }
      }
      return subDebt(user.amount.mulTruncate(accRewardPerShare), user.rewardDebt);
    }

    /**
     * @dev View function to see total outstanding rewards for the entire contract.
     *      This is how much is owed when everyone pulls out.
     * @return reward Total rewards owed to everyone.
     */
    function totalOutstandingRewards() external view returns (uint256) {
      uint256 lpSupply = pool.lpToken.balanceOf(address(this));
      if (block.number > pool.lastRewardBlock && lpSupply != 0) {
          uint256 multiplier = getCampaignMultiplier(block.number);
          uint256 incReward = multiplier.mul(rewardPerBlock);
          uint256 accRewardPerShare = pool.accRewardPerShare;
          accRewardPerShare = accRewardPerShare.add(incReward.divPrecisely(lpSupply));
          return subDebt(accRewardPerShare.mulTruncate(lpSupply), totalRewardDebt);
      }
      // no supply or not even started
      return 0;
    }

    /**
     * @dev External call for updating the pool.
     */
    function doUpdatePool() external {
      // should be no harm allowing anyone to call this function
      // it just update the latest accRwardPerShare for the pool
      updatePool();
    }

    /**
     * @dev Update the Liquidity Pool reward multiplier.
     *      This locks in the accRewardPerShare from the last update block number to now.
     *      Will fail if we do not have enough to pay everyone.
     *      Always call updatePool whenever the balance changes!
     */
    function updatePool() internal {
        if (block.number <= pool.lastRewardBlock || endBlock <= pool.lastRewardBlock) {
            return;
        }

        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
          pool.lastRewardBlock = block.number;
          return;
        }

        uint256 incReward = getCampaignMultiplier(block.number).mul(rewardPerBlock);
        // we are of course assuming lpTokens are in 1e18 precision
        uint256 accRewardPerShare = pool.accRewardPerShare.add(incReward.divPrecisely(lpSupply));

        pool.accRewardPerShare = accRewardPerShare;
        pool.lastRewardBlock = block.number;
    }

    /**
     * @dev Deposit LP tokens into contract, must be preapproved.
     * @param _amount Amount of LPToken to deposit.
     */
    function deposit(uint256 _amount) public {
        UserInfo storage user = userInfo[msg.sender];
        updatePool();
        if(_amount > 0) {
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount.add(_amount);
        }
        // newDebt is equal to the change in amount * accRewardPerShare (note accRewardPerShare is historic)
        int256 newDebt = int256(_amount.mulTruncate(pool.accRewardPerShare));
        user.rewardDebt += newDebt;
        totalRewardDebt += newDebt;
        emit Deposit(msg.sender, _amount);
    }

    /**
     * @dev Exit out of the contract completely, withdraw LP tokens and claim rewards
     */
    function exit() external {
      UserInfo storage user = userInfo[msg.sender];
      // withdraw everything
      _withdraw(user, user.amount, true);
    }

    /**
     * @dev Withdraw LP tokens from contract.
     * @param _amount Amount of LPToken to withdraw.
     * @param claim Boolean do we want to claim our rewards or not
     */
    function withdraw(uint256 _amount, bool claim) external {
        UserInfo storage user = userInfo[msg.sender];
        _withdraw(user, _amount, claim);
    }

    function _withdraw(UserInfo storage user, uint256 _amount, bool claim) internal {
        require(user.amount >= _amount, "withdraw: overflow");
        updatePool();
        
        // newDebt is equal to the change in amount * accRewardPerShare (note accRewardPerShare is historic)
        int256 newDebt = -int256(_amount.mulTruncate(pool.accRewardPerShare));
        if (claim) {
          //This is an optimization so we don't modify the storage variable twice
          uint256 pending = subDebt(user.amount.mulTruncate(pool.accRewardPerShare), user.rewardDebt);
          if (pending > 0){
            reward.safeTransfer(msg.sender, pending);
            emit Claim(msg.sender, pending);
          }
          newDebt += int256(pending);
        }

        // actually make the changes to the amount and debt
        if(_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt += newDebt;
        totalRewardDebt += newDebt;
        emit Withdraw(msg.sender, _amount);
    }

    /**
     * @dev Claim all pending rewards up to current block
     */
    function claim() external {
      UserInfo storage user = userInfo[msg.sender];
      uint256 pending = _pendingRewards(user);
      if(pending > 0) {
        reward.safeTransfer(msg.sender, pending);
        emit Claim(msg.sender, pending);
        int256 debtDelta = int256(pending);
        user.rewardDebt += debtDelta;
        totalRewardDebt += debtDelta;
      }
    }

    /**
     * @dev Withdraw without caring about rewards. EMERGENCY ONLY.
     *      No rewards will payed out!
     */
    function emergencyWithdraw() public {
        UserInfo storage user = userInfo[msg.sender];
        uint256 amount = user.amount;
        user.amount = 0;
        user.rewardDebt = 0;
        pool.lpToken.safeTransfer(address(msg.sender), amount);
        emit EmergencyWithdraw(msg.sender, amount);
    }

    function subDebt(uint256 amount, int256 debt) internal pure returns (uint256 result) {
      if (debt < 0) {
        result = amount + uint256(-debt);
      } else {
        result = amount - uint256(debt);
      }
    }
}
