pragma solidity 0.5.11;
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IVault } from "./interfaces/IVault.sol";

/**
 * @title Flash loan simulator
 * @author Origin Protocol Inc
 */
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

contract FlashThief {
    address public ousd;
    address public vault;

    constructor(address oAddr, address vAddr) public {
      ousd = oAddr;
      vault = vAddr; 
    }


    /**
     * @dev Execute mint and transfer in the same transaction
     * @param _to the address to transfer the OUSD to.
     * @param _stableCoinToUse what stablecoin to use for minting OUSD
     * @param _amountToMint amount to mint.
     */
    function mintAndTransfer(address _to, address _stableCoinToUse, uint256 _amountToMint, uint256 _amountToTransfer) public returns (bool) {
      IERC20(_stableCoinToUse).approve(vault, _amountToMint);
      IVault(vault).mint(
        _stableCoinToUse,
        _amountToMint,
        0
      );
      IERC20(ousd).transfer(_to, _amountToTransfer);
      return true;
    }
}
