// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

contract MockRepegToken {
    uint256 public totalSupply = 10_000e18;

    function setTotalSupply(uint256 supply) external {
        totalSupply = supply;
    }
}

contract MockRepegVault {
    address public strategistAddr;
    address public oToken;
    address public amo;
    uint256 public totalValue = 10_000e18;
    uint256 public rebaseCount;
    bool public rebasePaused;

    constructor(address safe, address token) {
        strategistAddr = safe;
        oToken = token;
    }

    function setAmo(address value) external {
        amo = value;
    }

    function setRebasePaused(bool value) external {
        rebasePaused = value;
    }

    function rebase() external {
        require(msg.sender == strategistAddr, "Not Safe");
        require(!rebasePaused, "Rebasing paused");
        rebaseCount++;
        totalValue += 100e18;
        MockRepegToken(oToken).setTotalSupply(MockRepegToken(oToken).totalSupply() + 100e18);
    }

    function burn(uint256 supplyReduction, uint256 valueReduction) external {
        require(msg.sender == amo, "Not AMO");
        totalValue -= valueReduction;
        MockRepegToken(oToken).setTotalSupply(MockRepegToken(oToken).totalSupply() - supplyReduction);
    }
}

contract MockRepegAmo {
    address public vaultAddress;
    uint256 public valueReduction = 90e18;
    uint256 public lpRemoved;

    constructor(address vault) {
        vaultAddress = vault;
    }

    function setValueReduction(uint256 value) external {
        valueReduction = value;
    }

    function removeAndBurnOTokens(uint256 amount) external {
        require(msg.sender == MockRepegVault(vaultAddress).strategistAddr(), "Not Safe");
        lpRemoved += amount;
        MockRepegVault(vaultAddress).burn(amount, valueReduction);
    }
}

contract MockRepegSafe {
    uint256 public calls;
    uint256 public failAt;
    mapping(uint256 => address) public targets;
    mapping(uint256 => bytes) public inputs;
    address public reentryTarget;
    bytes public reentryData;
    bytes public reentryRevert;

    function setFailAt(uint256 value) external {
        failAt = value;
    }

    function setReentry(address target, bytes calldata data) external {
        reentryTarget = target;
        reentryData = data;
    }

    function execTransactionFromModule(address target, uint256 value, bytes calldata data, uint8 operation)
        external
        returns (bool)
    {
        require(value == 0 && operation == 0, "Only CALL with zero value");
        calls++;
        if (calls == failAt) return false;
        targets[calls] = target;
        inputs[calls] = data;
        if (calls == 1 && reentryTarget != address(0)) {
            (bool success, bytes memory result) = reentryTarget.call(reentryData);
            require(!success, "Reentry succeeded");
            reentryRevert = result;
        }
        (bool success,) = target.call(data);
        return success;
    }
}
