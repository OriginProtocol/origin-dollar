// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {PoolKey} from "contracts/interfaces/uniswap/v4/IPoolManager.sol";

interface IMockPermit2 {
    function transferFrom(address from, address to, uint160 amount, address token) external;
}

/// @title MockV4PositionManager
/// @notice Just enough of the Uniswap v4 PositionManager for unit tests. Positions are set
///         directly; `modifyLiquidities` decodes the same action bytes and params the real
///         contract does (INCREASE_LIQUIDITY, DECREASE_LIQUIDITY, CLOSE_CURRENCY) and moves
///         preset amounts. The caller pays through Permit2, like the real one.
contract MockV4PositionManager {
    uint256 internal constant INCREASE_LIQUIDITY = 0x00;
    uint256 internal constant DECREASE_LIQUIDITY = 0x01;
    uint256 internal constant CLOSE_CURRENCY = 0x12;

    struct Position {
        address owner;
        PoolKey key;
        uint256 info;
        uint128 liquidity;
    }

    IMockPermit2 public immutable permit2;
    mapping(uint256 => Position) internal positions;
    mapping(address => int256) internal deltas;

    /// @dev Amounts paid out by the next decreases / pulled by the next increases.
    uint256 public decreaseAmount0;
    uint256 public decreaseAmount1;
    uint256 public increaseAmount0;
    uint256 public increaseAmount1;

    uint256 public modifyCount;

    constructor(address _permit2) {
        permit2 = IMockPermit2(_permit2);
    }

    function setPosition(
        uint256 tokenId,
        address owner,
        PoolKey memory key,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) external {
        positions[tokenId] = Position({owner: owner, key: key, info: _info(tickLower, tickUpper), liquidity: liquidity});
    }

    function _info(int24 tickLower, int24 tickUpper) internal pure returns (uint256) {
        return (uint256(uint24(tickUpper)) << 32) | (uint256(uint24(tickLower)) << 8);
    }

    function setLiquidity(uint256 tokenId, uint128 liquidity) external {
        positions[tokenId].liquidity = liquidity;
    }

    function setAmounts(uint256 _decrease0, uint256 _decrease1, uint256 _increase0, uint256 _increase1) external {
        decreaseAmount0 = _decrease0;
        decreaseAmount1 = _decrease1;
        increaseAmount0 = _increase0;
        increaseAmount1 = _increase1;
    }

    function ownerOf(uint256 tokenId) external view returns (address owner) {
        owner = positions[tokenId].owner;
        require(owner != address(0), "NOT_MINTED");
    }

    function getPoolAndPositionInfo(uint256 tokenId) external view returns (PoolKey memory, uint256) {
        return (positions[tokenId].key, positions[tokenId].info);
    }

    function getPositionLiquidity(uint256 tokenId) external view returns (uint128) {
        return positions[tokenId].liquidity;
    }

    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable {
        require(deadline >= block.timestamp, "DeadlinePassed");
        modifyCount++;
        (bytes memory actions, bytes[] memory params) = abi.decode(unlockData, (bytes, bytes[]));
        require(actions.length == params.length, "InputLengthMismatch");

        for (uint256 i = 0; i < actions.length; i++) {
            uint256 action = uint8(actions[i]);
            if (action == INCREASE_LIQUIDITY || action == DECREASE_LIQUIDITY) {
                (uint256 tokenId, uint256 liquidity, uint128 amount0Limit, uint128 amount1Limit,) =
                    abi.decode(params[i], (uint256, uint256, uint128, uint128, bytes));
                Position storage p = positions[tokenId];
                require(msg.sender == p.owner, "NotApproved");

                if (action == INCREASE_LIQUIDITY) {
                    require(increaseAmount0 <= amount0Limit, "MaximumAmountExceeded");
                    require(increaseAmount1 <= amount1Limit, "MaximumAmountExceeded");
                    p.liquidity += uint128(liquidity);
                    deltas[p.key.currency0] -= int256(increaseAmount0);
                    deltas[p.key.currency1] -= int256(increaseAmount1);
                } else {
                    require(decreaseAmount0 >= amount0Limit, "MinimumAmountInsufficient");
                    require(decreaseAmount1 >= amount1Limit, "MinimumAmountInsufficient");
                    p.liquidity -= uint128(liquidity);
                    deltas[p.key.currency0] += int256(decreaseAmount0);
                    deltas[p.key.currency1] += int256(decreaseAmount1);
                }
            } else if (action == CLOSE_CURRENCY) {
                address currency = abi.decode(params[i], (address));
                int256 delta = deltas[currency];
                delete deltas[currency];
                if (delta > 0) {
                    require(IERC20(currency).transfer(msg.sender, uint256(delta)), "Transfer failed");
                } else if (delta < 0) {
                    permit2.transferFrom(msg.sender, address(this), uint160(uint256(-delta)), currency);
                }
            } else {
                revert("UnsupportedAction");
            }
        }
    }
}
