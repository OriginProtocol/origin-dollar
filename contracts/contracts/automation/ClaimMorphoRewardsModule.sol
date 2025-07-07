// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractSafeModule } from "./AbstractSafeModule.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMorphoWrapper {
    function depositFor(address recipient, uint256 amount) external;
}

contract ClaimMorphoRewardsModule is AbstractSafeModule {
    mapping(address => bool) public isStrategyWhitelisted;
    address[] public strategies;

    IERC20 public constant LEGACY_MORPHO =
        IERC20(0x9994E35Db50125E0DF82e4c2dde62496CE330999);
    IERC20 public constant MORPHO =
        IERC20(0x58D97B57BB95320F9a05dC918Aef65434969c2B2);
    IMorphoWrapper public constant MORPHO_WRAPPER =
        IMorphoWrapper(0x9D03bb2092270648d7480049d0E58d2FcF0E5123);

    constructor(
        address _safeContract,
        address operator,
        address[] memory _strategies
    ) AbstractSafeModule(_safeContract) {
        _grantRole(OPERATOR_ROLE, operator);
        for (uint256 i = 0; i < _strategies.length; i++) {
            _addStrategy(_strategies[i]);
        }
    }

    function claimRewards() external onlyOperator {
        for (uint256 i = 0; i < strategies.length; i++) {
            address strategy = strategies[i];

            uint256 morphoBalance = MORPHO.balanceOf(strategy);
            if (morphoBalance > 0) {
                // Transfer Morpho to the safe contract
                bool success = safeContract.execTransactionFromModule(
                    strategy,
                    0,
                    abi.encodeWithSelector(
                        IStrategy.transferToken.selector,
                        address(MORPHO),
                        morphoBalance
                    ),
                    0
                );
                require(success, "Failed to transfer Morpho");
            }

            uint256 legacyMorphoBalance = LEGACY_MORPHO.balanceOf(strategy);
            if (legacyMorphoBalance > 0) {
                // Transfer Legacy Morpho to the safe contract
                // slither-disable-next-line unused-return
                safeContract.execTransactionFromModule(
                    strategy,
                    0,
                    abi.encodeWithSelector(
                        IStrategy.transferToken.selector,
                        address(LEGACY_MORPHO),
                        legacyMorphoBalance
                    ),
                    0
                );

                // Wrap Legacy Morpho into Morpho
                _wrapLegacyMorpho();
            }
        }
    }

    function addStrategy(address strategy) external onlySafe {
        _addStrategy(strategy);
    }

    function _addStrategy(address strategy) internal {
        require(
            !isStrategyWhitelisted[strategy],
            "Strategy already whitelisted"
        );

        isStrategyWhitelisted[strategy] = true;
        strategies.push(strategy);
    }

    function removeStrategy(address strategy) external onlySafe {
        require(isStrategyWhitelisted[strategy], "Strategy not whitelisted");

        isStrategyWhitelisted[strategy] = false;
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i] == strategy) {
                strategies[i] = strategies[strategies.length - 1];
                strategies.pop();
                break;
            }
        }
    }

    function wrapLegacyMorpho() external onlyOperator {
        _wrapLegacyMorpho();
    }

    function _wrapLegacyMorpho() internal {
        uint256 legacyMorphoBalance = LEGACY_MORPHO.balanceOf(
            address(safeContract)
        );

        if (legacyMorphoBalance == 0) {
            // Nothing to wrap
            return;
        }

        // Approve Morpho Wrapper to move the tokens
        bool success = safeContract.execTransactionFromModule(
            address(LEGACY_MORPHO),
            0,
            abi.encodeWithSelector(
                LEGACY_MORPHO.approve.selector,
                address(MORPHO_WRAPPER),
                legacyMorphoBalance
            ),
            0
        );
        require(success, "Failed to approve Morpho Wrapper");

        // Wrap the tokens
        success = safeContract.execTransactionFromModule(
            address(MORPHO_WRAPPER),
            0,
            abi.encodeWithSelector(
                MORPHO_WRAPPER.depositFor.selector,
                address(safeContract),
                legacyMorphoBalance
            ),
            0
        );
        require(success, "Failed to wrap Morpho");
    }
}
