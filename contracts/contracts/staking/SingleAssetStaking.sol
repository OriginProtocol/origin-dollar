pragma solidity 0.5.11;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import {
    Initializable
} from "@openzeppelin/upgrades/contracts/Initializable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { Governable } from "../governance/Governable.sol";
import { StableMath } from "../utils/StableMath.sol";

contract SingleAssetStaking is Initializable, Governable {
    using SafeMath for uint256;
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IERC20 public stakingToken; // this is both the staking and rewards

    struct Stake {
      uint256 amount;   // amount to stake
      uint256 end;      // when does the staking period end
      uint256 duration; // the duration of the stake
      uint248 rate;     // rate to charge use 248 to reserve 8 bits for the bool
      bool paid;
    }

    uint256[] public durations; // allowed durations
    uint256[] public rates; // rates that corrospond with the allowed durations

    uint256 public totalOutstanding;
    bool public paused;

    mapping(address => Stake[]) public userStakes;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address _stakingToken,
        uint256[] calldata _durations,
        uint256[] calldata _rates
    ) external onlyGovernor initializer {
        stakingToken = IERC20(_stakingToken);
        _setDurationRates(_durations, _rates);
    }
    
    /* ========= Internal helper functions ======== */

    function _setDurationRates(uint256[] memory _durations, uint256[] memory _rates) internal {
        require(_rates.length == _durations.length, "Mismatch durations and rates");

        for (uint i=0; i<_rates.length; i++) {
          require(_rates[i] < uint248(-1), "Max rate exceeded");
        }

        rates = _rates;
        durations = _durations;

        emit NewRates(msg.sender, rates);
        emit NewDurations(msg.sender, durations);
    }

    function _totalExpectedRewards(Stake[] storage stakes) internal view returns (uint256 total) {
      for (uint i=0; i< stakes.length; i++) {
        Stake storage stake = stakes[i];
        if (!stake.paid) {
          total += stake.amount.mulTruncate(stake.rate);
        }
      }
    }

    function _totalExpected(Stake storage _stake) internal view returns (uint256) {
      return _stake.amount + _stake.amount.mulTruncate(_stake.rate);
    }

    function _findDurationRate(uint256 duration) internal view returns (uint248) {
      for (uint i =0; i < durations.length; i++) {
        if (duration == durations[i]) {
          return uint248(rates[i]);
        }
      }
      return 0;
    }

    /* ========== VIEWS ========== */

    function durationRewardRate(uint256 _duration) external view returns (uint256) {
      return _findDurationRate(_duration);
    }

    function totalStaked(address account) external view returns (uint256 total) {
      Stake[] storage stakes = userStakes[account];

      for (uint i=0; i< stakes.length; i++) {
        if (!stakes[i].paid)
        {
          total += stakes[i].amount;
        }
      }
    }

    function totalExpectedRewards(address account) external view returns (uint256) {
      return _totalExpectedRewards(userStakes[account]);
    }

    function totalCurrentHoldings(address account) external view returns (uint256 total) {
      Stake[] storage stakes = userStakes[account];

      for (uint i=0; i< stakes.length; i++) {
        Stake storage stake = stakes[i];
        if (stake.paid) {
          continue;
        } else if (stake.end < block.timestamp) {
          total += _totalExpected(stake);
        } else {
          //calcualte the precentage accrued in term of rewards
          total += stake.amount
          .add(
            stake.amount
            .mulTruncate(
              stake.rate
            ).mulTruncate( 
            stake.duration.sub(stake.end.sub(block.timestamp))
            .divPrecisely(stake.duration)
                         )
          );
        }
      }
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function stake(uint256 amount, uint256 duration) external {
        require(!paused, "Staking paused");
        require(amount > 0, "Cannot stake 0");

        uint248 rewardRate = _findDurationRate(duration);
        require(rewardRate > 0, "Invalid duration"); // we couldn't find the rate that corrospond to the passed duration

        Stake[] storage stakes = userStakes[msg.sender];
        
        uint256 end = block.timestamp + duration;

        uint i = stakes.length; // start counting at the end of the current array
        stakes.length += 1;     //grow the array;
        // find the spot where we can insert the current stake
        // this should make an increasing list sorted by end
        while (i != 0  && stakes[i-1].end > end) {
          // shift it back one
          stakes[i] = stakes[i-1];
          i -= 1;
        }

        // insert the stake
        Stake storage newStake = stakes[i];
        newStake.rate = rewardRate;
        newStake.end = end;
        newStake.duration = duration;
        newStake.amount = amount;

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        totalOutstanding = totalOutstanding.add(_totalExpected(newStake));
        //we need to have enough balance to cover the total outstanding after this.
        require(stakingToken.balanceOf(address(this)) >= totalOutstanding, "Insufficient rewards");
        emit Staked(msg.sender, amount);
    }

    function exit() external  {
        Stake[] storage stakes = userStakes[msg.sender];
        require(stakes.length > 0, "Nothing staked");

        uint totalWithdraw = 0;
        uint l = stakes.length;
        do {
          Stake storage exitStake = stakes[l-1];
          // stop on the first ended stake that's already been paid 
          if (exitStake.end < block.timestamp && exitStake.paid)
          {
            break;
          }
          //might not be ended
          if (exitStake.end < block.timestamp) {
            //we are paying out the stake
            exitStake.paid = true;
            totalWithdraw += _totalExpected(exitStake);
          }
          l--;
        } while (l > 0);
        require(totalWithdraw > 0, "All stakes in lock-up");

        stakingToken.safeTransfer(msg.sender, totalWithdraw);
        totalOutstanding = totalOutstanding.sub(totalWithdraw);
        emit Withdrawn(msg.sender, totalWithdraw);
    }


    /* ========== MODIFIERS ========== */

    function setPaused(bool _paused) external onlyGovernor {
      paused = _paused;
      emit Paused(msg.sender, paused);
    }

    function setDurationRates(uint256 [] calldata _durations, uint256 [] calldata _rates) external onlyGovernor {
      _setDurationRates(_durations, _rates);
    }

    /* ========== EVENTS ========== */

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Recovered(address token, uint256 amount);
    event Paused(address indexed user, bool yes);
    event NewDurations(address indexed user, uint256 [] durations);
    event NewRates(address indexed user, uint256 [] rates);
}
