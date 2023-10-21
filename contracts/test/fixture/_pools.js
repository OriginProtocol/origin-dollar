// used by the pool_tilt
const { ethers } = hre;
const { BigNumber } = ethers;
const { oethUnits } = require("../helpers");
const { expect } = require("chai");

class Pool {
  async verifyTiltAmounts(targetAmount) {
    const postTiltTvl = await this.getTvl();
    /* when tilting hard the bonding curve dictates the prices of assets to BPT token.
     * are no longer 1:1. For that reason we are picking a more generous tolerance of
     * 15% when verifying the pool amounts.
     */
    expect(postTiltTvl).to.approxEqualTolerance(targetAmount, 15);
  }
}

class BalancerPool extends Pool {
  constructor(poolId, poolType, assetAddressArray, bptToken, balancerVault) {
    super();
    this.poolId = poolId;
    // these must be in correct order
    this.assetAddressArray = assetAddressArray;
    this.bptToken = bptToken;
    this.balancerVault = balancerVault;
    this.poolType = poolType;
  }

  async tiltPool(amount, asset, sAttacker) {
    // for composableStable pools do not encode the BPT token in the user data request
    const assetIndexAdjustement = this.poolType == "composableStable" ? -1 : 0;
    const amountsIn = Array(
      this.assetAddressArray.length + assetIndexAdjustement
    ).fill(BigNumber.from("0"));
    const attackerAddress = sAttacker.address || sAttacker._address

    amountsIn[(await this.getAssetIndex(asset)) + assetIndexAdjustement] =
      amount;

    const userData = ethers.utils.defaultAbiCoder.encode(
      ["uint256", "uint256[]", "uint256"],
      // EXACT_TOKENS_IN_FOR_BPT_OUT
      [1, amountsIn, BigNumber.from("0")]
    );

    await asset
      .connect(sAttacker)
      .approve(this.balancerVault.address, oethUnits("1").mul(oethUnits("1"))); // 1e36

    this.preTiltTVL = await this.getTvl();

    const maxAmountsIn = Array(this.assetAddressArray.length).fill(
      BigNumber.from("0")
    );
    maxAmountsIn[await this.getAssetIndex(asset)] = amount;

    await this.balancerVault.connect(sAttacker).joinPool(
      this.poolId,
      attackerAddress, // sender
      attackerAddress, // recipient
      [
        //JoinPoolRequest
        this.assetAddressArray, // assets
        maxAmountsIn, // maxAmountsIn
        userData, // userData
        false, // fromInternalBalance
      ]
    );

    const expectedAmount = this.preTiltTVL.add(amount);
    await this.verifyTiltAmounts(expectedAmount);
  }

  async untiltPool(sAttacker, attackingAsset) {
    // for composableStable pools do not encode the BPT token in the user data request
    const assetIndexAdjustement = this.poolType == "composableStable" ? -1 : 0;
    const attackerAddress = sAttacker.address || sAttacker._address

    /* encode user data for pool joining
     *
     * EXACT_BPT_IN_FOR_ONE_TOKEN_OUT:
     * User sends a precise quantity of BPT, and receives an estimated
     * but unknown (computed at run time) quantity of a single token
     *
     * ['uint256', 'uint256', 'uint256']
     * [EXACT_BPT_IN_FOR_ONE_TOKEN_OUT, bptAmountIn, exitTokenIndex]
     */
    const userData = ethers.utils.defaultAbiCoder.encode(
      ["uint256", "uint256", "uint256"],
      [
        0,
        await this.bptToken.balanceOf(attackerAddress),
        BigNumber.from(
          (
            (await this.getAssetIndex(attackingAsset)) + assetIndexAdjustement
          ).toString()
        ),
      ]
    );

    await this.bptToken
      .connect(sAttacker)
      .approve(this.balancerVault.address, oethUnits("1").mul(oethUnits("1"))); // 1e36

    await this.balancerVault.connect(sAttacker).exitPool(
      this.poolId,
      attackerAddress, // sender
      attackerAddress, // recipient
      [
        //ExitPoolRequest
        this.assetAddressArray, // assets
        Array(this.assetAddressArray.length).fill(BigNumber.from("0")), // minAmountsOut
        userData, // userData
        false, // fromInternalBalance
      ]
    );

    if (this.preTiltTVL) {
      await this.verifyTiltAmounts(this.preTiltTVL);
    }
  }

  async getAssetIndex(asset) {
    const tokens = (await this.balancerVault.getPoolTokens(this.poolId)).tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].toLowerCase() === asset.address.toLowerCase()) {
        return i;
      }
    }

    throw new Error(
      `Can not find the asset with address ${asset.address} in the pool id: ${this.poolId}`
    );
  }

  async getTvl() {
    if (this.poolType == "composableStable") {
      return await this.bptToken.getActualSupply();
    } else {
      return await this.bptToken.totalSupply();
    }
  }
}

async function factoryCreatePool(config) {
  if (config.platform === "balancer") {
    return new BalancerPool(
      config.poolId,
      config.poolType,
      config.assetAddressArray,
      config.bptToken,
      config.balancerVault
    );
  } else {
    throw new Error(`Unsupported platform: ${config.platform}`);
  }
}

module.exports = {
  factoryCreatePool,
};
