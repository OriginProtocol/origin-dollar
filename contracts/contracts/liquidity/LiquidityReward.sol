pragma solidity 0.5.11;

import {
    Initializable
} from "@openzeppelin/upgrades/contracts/Initializable.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { StableMath } from "../utils/StableMath.sol";
import { Governable } from "../governance/Governable.sol";

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
        uint256 rewardDebt; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of SUSHIs
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
        uint256 lastRewardBlock;  // Last block number that SUSHIs distribution occurs.
        uint256 accRewardPerShare; // Accumulated Reward per share in reward precision. See below.
    }

    // The Reward token
    IERC20 public reward;

    // Reward tokens created per block in 1e18 precision.
    uint256 public rewardPerBlock;
    
    // Info on the LP.
    PoolInfo public pool;
    // total Reward debt, useful to calculate if we have enough to pay out all rewards
    uint256 public totalRewardDebt;
    // Info of each user that stakes LP tokens.
    mapping (address => UserInfo) public userInfo;
    // The block number when Liquidity rewards starts.
    uint256 public startBlock;

    // for now assume it's OGN precision which is standard 1e18
    uint256 public constant REWARD_PRECISION  = 1e18;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 amount);

    function initialize(
        IERC20 _reward,
        IERC20 _lpToken,
        uint256 _rewardPerBlock,
        uint256 _startBlock
    ) external onlyGovernor initializer {
        reward = _reward;
        rewardPerBlock = _rewardPerBlock;
        startBlock = _startBlock;
        pool.lpToken = _lpToken;
        pool.lastRewardBlock = block.number > startBlock ? block.number : startBlock;
    }

    function setRewardPerBlock(uint256 _rewardPerBlock) external onlyGovernor {
      // pay up to the current block at the current rate for everyone
      updatePool();
      // new block at the new reward rate
      rewardPerBlock = _rewardPerBlock;
      // the update will fail if we do not have enough rewards for the current rewards
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) internal pure returns (uint256) {
        return _to.sub(_from);
    }

    // View function to see pending Rewards on frontend.
    function pendingRewards(address _user) external view returns (uint256) {
        UserInfo storage user = userInfo[_user];
        uint256 accRewardPerShare = pool.accRewardPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 incReward = multiplier.mul(rewardPerBlock);
            accRewardPerShare = accRewardPerShare.add(incReward.divPrecisely(lpSupply));
        }
        return user.amount.mul(accRewardPerShare).div(REWARD_PRECISION).sub(user.rewardDebt);
    }

    function totalOutstandingRewards() external view returns (uint256) {
      uint256 lpSupply = pool.lpToken.balanceOf(address(this));
      if (block.number > pool.lastRewardBlock && lpSupply != 0) {
          uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
          uint256 reward = multiplier.mul(rewardPerBlock);
          uint256 accRewardPerShare = pool.accRewardPerShare;
          accRewardPerShare = accRewardPerShare.add(reward.mul(REWARD_PRECISION).div(lpSupply));
          return accRewardPerShare.mulTruncate(lpSupply).sub(totalRewardDebt);
      }
      // no supply or not even started
      return 0;
    }

    function doUpdatePool() external {
      // should be no harm allowing anyone to call this function
      // it just update the latest accRwardPerShare for the pool
      updatePool();
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool() internal {
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 incReward = multiplier.mul(rewardPerBlock);

        // we are of course assuming lpTokens are in 1e18 precision
        uint256 accRewardPerShare = pool.accRewardPerShare.add(incReward.divPrecisely(lpSupply));

        pool.accRewardPerShare = accRewardPerShare;
        pool.lastRewardBlock = block.number;

        // let's make sure we have enough for everyone before we update the pool and rewardPerShare
        require(accRewardPerShare.mulTruncate(lpSupply).sub(totalRewardDebt)  
                <= reward.balanceOf(address(this)), "Insuffcient reward balance");
    }

    function deposit(uint256 _amount) public {
        UserInfo storage user = userInfo[msg.sender];
        updatePool();
        if (user.amount > 0) {
            uint256 pending = user.amount.mulTruncate(pool.accRewardPerShare).sub(user.rewardDebt);
            if(pending > 0) {
                reward.safeTransfer(msg.sender, pending);
            }
            // remove the old rewardDebt
            if (user.rewardDebt > 0) {
              totalRewardDebt -= user.rewardDebt;
            }
        }
        if(_amount > 0) {
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount.add(_amount);
        }
        
        user.rewardDebt = user.amount.mulTruncate(pool.accRewardPerShare);
        totalRewardDebt += user.rewardDebt;
        emit Deposit(msg.sender, _amount);
    }

    function withdraw(uint256 _amount) public {
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount >= _amount, "withdraw: overflow");
        updatePool();
        uint256 pending = user.amount.mulTruncate(pool.accRewardPerShare).sub(user.rewardDebt);
        if(pending > 0) {
            reward.safeTransfer(msg.sender, pending);
        }
        // remove the old rewardDebt
        if (user.rewardDebt > 0) {
          totalRewardDebt -= user.rewardDebt;
        }
        if(_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount.mulTruncate(pool.accRewardPerShare);
        if (user.rewardDebt > 0 ) {
          totalRewardDebt += user.rewardDebt;
        }
        emit Withdraw(msg.sender, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw() public {
        UserInfo storage user = userInfo[msg.sender];
        uint256 amount = user.amount;
        user.amount = 0;
        user.rewardDebt = 0;
        pool.lpToken.safeTransfer(address(msg.sender), amount);
        emit EmergencyWithdraw(msg.sender, amount);
    }

}
