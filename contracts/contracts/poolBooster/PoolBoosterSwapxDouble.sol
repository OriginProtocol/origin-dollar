// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IBribe } from "../interfaces/poolBooster/ISwapXAlgebraBribe.sol";
import { IPoolBooster } from "../interfaces/poolBooster/IPoolBooster.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { StableMath } from "../utils/StableMath.sol";

/**
 * @title Pool booster for SwapX concentrated liquidity where 2 gauges are created for
 *        every pool. Ichi vaults currently have such setup.
 * @author Origin Protocol Inc
 */
contract PoolBoosterSwapxDouble is IPoolBooster {
    using StableMath for uint256;

    // @notice address of the Bribes.sol(Bribe) contract for the OS token side
    IBribe public immutable bribeContractOS;
    // @notice address of the  Bribes.sol(Bribe) contract for the other token in the pool
    IBribe public immutable bribeContractOther;
    // @notice address of the OS token
    IERC20 public immutable osToken;
    // @notice 1e18 denominated split between OS and Other bribe. E.g. 0.4e17 means 40% to OS
    //         bribe contract and 60% to other bribe contract
    uint256 public immutable split;

    // @notice if balance under this amount the bribe action is skipped
    uint256 public constant MIN_BRIBE_AMOUNT = 1e10;

    constructor(
        address _bribeContractOS,
        address _bribeContractOther,
        address _osToken,
        uint256 _split
    ) {
        require(
            _bribeContractOS != address(0),
            "Invalid bribeContractOS address"
        );
        require(
            _bribeContractOther != address(0),
            "Invalid bribeContractOther address"
        );
        // expect it to be between 1% & 99%
        require(_split > 1e16 && _split < 99e16, "Unexpected split amount");

        bribeContractOS = IBribe(_bribeContractOS);
        bribeContractOther = IBribe(_bribeContractOther);
        // Abstract factory already validates this is not a zero address
        osToken = IERC20(_osToken);
        split = _split;
    }

    function bribe() external override {
        uint256 balance = osToken.balanceOf(address(this));
        // balance too small, do no bribes
        if (balance < MIN_BRIBE_AMOUNT) {
            return;
        }

        uint256 osBribeAmount = balance.mulTruncate(split);
        uint256 otherBribeAmount = balance - osBribeAmount;

        osToken.approve(address(bribeContractOS), osBribeAmount);
        osToken.approve(address(bribeContractOther), otherBribeAmount);

        bribeContractOS.notifyRewardAmount(address(osToken), osBribeAmount);
        bribeContractOther.notifyRewardAmount(
            address(osToken),
            otherBribeAmount
        );

        emit BribeExecuted(balance);
    }
}
