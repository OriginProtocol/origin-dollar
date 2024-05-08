const { loadSimpleOETHFixture } = require("./../_fixture");
const { shouldBehaveLikeAnSsvStrategy } = require("../behaviour/ssvStrategy");
const addresses = require("../../utils/addresses");
const { impersonateAndFund } = require("../../utils/signers");

describe("Holesky ForkTest: Native SSV Staking Strategy", function () {
  this.timeout(0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadSimpleOETHFixture();
  });

  shouldBehaveLikeAnSsvStrategy(async () => {
    return {
      ...fixture,
      addresses: addresses.holesky,
      validatorRegistrator: await impersonateAndFund(
        addresses.holesky.validatorRegistrator
      ),
      ssvNetwork: await ethers.getContractAt(
        "ISSVNetwork",
        addresses.holesky.SSVNetwork
      ),
      nativeStakingFeeAccumulator: await ethers.getContractAt(
        "FeeAccumulator",
        await fixture.nativeStakingSSVStrategy.FEE_ACCUMULATOR_ADDRESS()
      ),
      testValidator: {
        publicKey:
          "0x8c463b743efcea2acd67357acce713519444f4d55ece45fba603d66f488e69a781ba9592f017cb3d47ce6e35f10bc5f7",
        operatorIds: [111, 119, 230, 252],
        sharesData:
          "0x8cc3e43193adde4dba3109918a1be4fbeaeb3c446d3859d689578342bc4a8cc14b02d06e7beba6aa68b71b4de3d9d337137a98dae8299e7ae06250357fd355d1380b0a2da2c35b821cfa39bb24cac3867cd6693ab3e9f85b49d936e54fbb87a180108acfe3f6f757875477614f83758ae09b8f6f8aa42b32c84933d8dcd2cb67f587fcbd0c23797758a4472495f86d9da1906636e26632ab876c9e8923ea9bc4a20ca1c37d019ee9763467964a2535210a2beeee39d93d164e0df34d1e382b4b8d3ea82e799e5d41b8edd17be893d646a27815750b08ef1ca1e136c3ce08cbed4980ccf72de6ecee53d53784c16228cd83dabc6f3db1872c323169f653d49b5214723c35117deb7f944a9dde9d0b11446673744f212f3797e748d8c9ad1e8737a58af47b050d99556254d347854cae6211826b668b92a878e676bee46d393e4701eb342a4667cbf4880614853e316b2e4b849eedd27a9243aac4cd0b8ca3c1186ae51fec04d9f95017d69b3a7b25d389d46b8f2571b4983fe42b7f718fd12f5197414ba73ce98a8a0df2bf5d8d7f71bde9b324535bd8c2f5cc89b24d985975707a79e0c59bf416a39b501963655276b97b9545988c479ccee25cefdd8786b1586b97cc922a3c46445e1e0495a36243abaa40bedf09a41fc90cf9d65eebbc50b931f5c598b0d12e0aaf38923ffb19ce6bebbd324692e5fdebee5716e3afa91c3b0a589afb04896c04d87abd4742ea2b03922922adc9badc1a92ded6d5c73b820d430c40ce9ce9c559caa400f6b880982b78c71db8d0b38c982a8b15776dc5f1290592ca5cc99ebe4d4677177243db86c0cfab9979e37f821bc6a1070fa0d9b7c1b5eeff393034b0b8d8cb8089960dcd9db47d4c7cd88e67ad40dc1857d7c655554d0771aa14810a18c3cd38f930adb8734992882b7942c001c971196ebc2ed74b5a7559127fa8f0561cb6ad5efccc2b8be858773b523ef6611430f05e878aa4e560e3bfbcab47777fc6763f1ab1957fa5cbf663f1cd3238022d0e1348b56726eaee420909acd2b8017ef9c2308baf58cc85d56270a6e85fca636a8b49eba6650d514edd95bebe464843f154559bc1019c6f303df43bebb2110e4f2f4df7e36e03869be204fd2b966f3c328ee3b642510da3ced59f82ff61702529a9ed80c8b3899eeb8865e9483b159e0e2f750181e60a5454cdfb3e15d3ba76b3f2cf38a281dbbe266dd4d210920a8bd6ac1eec1ab13faadb4372b323e23f804a9ea303f4806fdf470f5df08e8d6a9ee3fb0c93dff220087d6129943b5626756664e9d649f83085e439d964337134e0bccd15338a988f238a2ac03a5e29e20fe9477a32347ca45932992b433d7eda470052980d07018919d91613f3925d6bed5dea7cacf246c71321dc371809e3b8b94cb779c3811b5ff11f6c9dd19cb05cc6bc21c75b0366c9809472bd10e54f10acaec6f3266665dfa4a05676dad0d2e3958e74443631aa8c52ee02e0ae6a8019f19c0118e472a9b3aab1ca618413e22edb82ee976deb4d1c44c6609a14954957b389ff38ef08a6ad0cf067a70e485ad0d8aff075f16bc1f9374ec6b9fc5ebd76dbe118bcfe14fba8669687603edcbdfb845d79f2f9847476542a84045589bfb6ff80dce7757527b96af96c85e6109a21e64303d4ada08b1093ac6ef4354c233fa4bcddb86af7f2e0cc836d3076ac62a903f1b74026049046b8460717c101dd5e674eeded11d0fa3e61f2f17f296192a2385f8abd576893d72163d0707b0201c391b1d55a63deee508e9e982ffd623fdbf5ac171fdffa87dda6b8662504cf69fc6e91617dc9e846fdb1f4ca93de618ea763915a13426ee7b8",
        signature:
          "0x83284a7b54224056515bcd0ade22521881755a31d15410d911a9d680a7b7fbf34707118881a880aad04bff2ea58595660a057f6a9889b869246c10d2da0cf243f7b78ab705b71d37cfa282fbeaeeee3092848148b818fe5e764f5d1c09ee6fd9",
        depositDataRoot:
          "0xf867a406f19c798b5fef29e37a5e7a0eb9b75ffcbeb72b7f337628ccebd3d73a",
      },
    };
  });
});
