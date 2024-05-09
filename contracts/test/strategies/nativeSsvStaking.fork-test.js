const {
  createFixtureLoader,
  nativeStakingSSVStrategyFixture,
} = require("./../_fixture");

const addresses = require("../../utils/addresses");
const loadFixture = createFixtureLoader(nativeStakingSSVStrategyFixture);
const { shouldBehaveLikeAnSsvStrategy } = require("../behaviour/ssvStrategy");

describe("ForkTest: Native SSV Staking Strategy", function () {
  this.timeout(0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  shouldBehaveLikeAnSsvStrategy(async () => {
    return {
      ...fixture,
      addresses: addresses.mainnet,
      testValidator: {
        publicKey:
          "0x93d60259213f491a910ee8f6504d51ba5fc28085981eccd6c20ca646525c626013c75b04f061fbf3de839ac602c64698",
        operatorIds: [348, 352, 361, 377],
        sharesData:
          "0x861fce88da51de578b2a3f9fa32b3c56499b1261d33f8adbb24932cc906edfd6383b63ac37bfd8b2e9f7087622c1f14b1651426316c741bd8470315d63393bbdc8a0a097f1ac728315fbf17b79b675e9c40605913fff64800a5c7c2057e30f44abed76d8ce797db6f03219e077a3d1fa3945f37d8eeb4c52aee99b4a5f606be50515d347405db37b37a063cd1cd315818521decd2e44878a1a53e84a4186ea3e896a29e0e34c68091a4575b5834e6bfa6c5987916ae49d77347ee7b2f7428f8489a07e54e9d05690f5f8acc2eeab46f44a0f39e5e0e41fde76d29e2660fb5349e00d264527f92d71cfa27a51d9285873908757f42f8f9e40a9c3ec5d9adc966a4dde82d0b87c48ffaebfe2bda73ff388197829d24eb2b18cc50dbae96473a95d819dc1dc99959811e832396eec4773701dbaf86d6449c8310f7fa9ed289675a0ba1be59881fe7b1e64d4485654bab3f9010e575773262ac65f7fa24663f090d413ca74572dac7df3cf06c1fdc226acfc1380441c2d9c4b31fbdd5ee12d83e2d36b9512f4e9c5f0b3607b51665479a9ce035ee952c9d743b5d7b3fa1acec222b447bf8e98397a6e79569a1487adff39f06bfa0a51b022d1798738b37a0801a1f97498c6c3633404f251c137b21e0eec92bcb7a4eb00cad9c826327f4712643035e4b79d14d3e5b0bcf791e6bbfa447f30d362570c26c29787d7c9360b3566b1e9c6eb3f785c96c6d3642a2332910fe3f0b78d4d18d7d4bbedd0b919c8a2853a0babd353c695960d4ec00727a3a91192b8b3a4d4e7cfd1620cdb4936afd91f5155c20bbe8a3dd96790d5e623f9cea53fa32ebe8f2f2572d5d99686ba735d824aaa74a56fd0fde9c219811cb79760410be3815ca95b75551608ee945b895a5c08b760b90aa4836128048b4fd19e0ed475c720d83a76af7e8c3e571f11b0fc540c788d7daea8bc923db44a6f8d208e0140a18d1c811029419d27b4ed994f0ec21c8f65df2f0c83cf5d0111694c18076e7441b0e0fa8e58da3a6c3b94e819550322765d70fbd4f053f2edcba3050cfe14d0efe7280c4a3990182a46cdf4a7f8cf20e0fc17d4fb5becb35908a04e19f5be2df7db81edf9cae016ac88769cb1a644189d84e35e18ff0d2fea6b02a406129487009311525199ffec581fd587521a239f6514e6e10aeef63e531cbe4c37f08592999ce3c3146e76e2793a974d49e0c7264c214133bd2049eacb8f09b3184130812b71fb0cd02d2f044f1d38ab34d1a9bed9940b5691f396c7e2ad25b6baf6ed14baa0f70ef3fd2d5cafd16c7775f6583971223eab2276b98e1998e87692e8474647bc135fab8d8ff7bbdd3d669856897cf7776b594f7cf49ac02870df621eca1919b39f9d28bddee92f3b5150e806b9fe9db01e6e1474d09239799c1265bdab86e8eda0f69cebf921af3ba852f5b64d2129bfa09155dc411165d66c0d750fa9fc07a6be3fdbce769bb494b84eff41319618c1611fe3f62b39066e81ee5ead615d7a576cc8fe68e8bb6ba1d4088810c701f0c1873df8cd02d5019589c095bb730a5625a3996c0b240aaf4484f2502d4aa377d462894557615a5d486339b4ad108ef6ffef0a26ba0136e3d969b4337954069aaeaa73e64757477f30d723ba38dc644f6e371088d9e2b1ff50ecbddad48198e525963fabda4e196c9ddf0d89abcdc3a3d395a96b22254242ce93804e4d6673265e7c4d56b1195aada97bbe9050e843bd56181a533fa03e01285ade0f715d0f9830b1f0ae7586d8485bf76ace561ea6c8c4c9497674d96182a9e289ddcc722814f14b8ce8a70bbb6dec40f84cde55e0d16d4ec043561d6a1d16790b5bc4f02ab9",
        signature:
          "0x8522f6464ddc5550f70ed8cd58ed26961d8755111d5e967ee815730bc2e9ad24e7ca718fcf56f1af785bc25dfac719a615a4c4e029a352840edca0d78c9a46ef35202f42311918f70d8ddde9de25fe091889283b9778ea15403fe87dc5f7527e",
        depositDataRoot:
          "0xcbcd1da8a9ba0e30b2dd8a955591ac4a759bf5ee6f5295d72f5b89b1b175193b",
      },
    };
  });
});
