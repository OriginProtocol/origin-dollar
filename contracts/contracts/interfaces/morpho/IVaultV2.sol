// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC4626 } from "../../../lib/openzeppelin/interfaces/IERC4626.sol";

interface IVaultV2 is IERC4626 {
    function liquidityAdapter() external view returns (address);
}
