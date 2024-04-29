const hre = require("hardhat");
const { utils, BigNumber } = require("ethers");
const { withConfirmation } = require("../../utils/deploy");

const mainExport = async () => {
  console.log("Running 003 deployment on Holesky...");
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const { getAssetAddresses } = require("../../test/helpers.js");

  const strategyProxy = await ethers.getContract(
    "NativeStakingSSVStrategyProxy"
  );
  const strategy = await ethers.getContractAt(
    "NativeStakingSSVStrategy",
    strategyProxy.address
  );
  const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
  const cOETHVault = await ethers.getContractAt(
    "OETHVault",
    cOETHVaultProxy.address
  );
  const assetAddresses = await getAssetAddresses();

  await withConfirmation(
    cOETHVault.connect(sGovernor).depositToStrategy(
      strategyProxy.address, // strategy address
      [assetAddresses.WETH], // assets
      [utils.parseEther("32")] // amounts
    )
  );

  await withConfirmation(
    strategy.registerSsvValidator(
      "0xa023587296851ae359280e2bff7ac8ec840b9192dddc9a8b817fd55d23b0034b4a4856d897d3aec58d99c6f6a9ba6032", //pubkey
      [119, 139, 230, 252], // operatorIds
      // sharesData
      "0x8a19414d6eaaadb19f3e5362de068bac9bf1cd1561a0c592772d3dcbf29a3dd515e1ab1cbddca45262d5c8bc89cac22307a561f00246e251c40bcfc7152cb6b848d1d4399bdf22005214aba83c8ac507a1003922d84f110d75565fb498802b568c3c4f626206855906e32335d22cddec651fe14fb9db68470ce2ed90b7272b75aef523cd2e0ee350f5f2ebbc737edd45a9afe797cd1a3836ea968f1b428868b238aa6d0784d9042b7065f401986131ac66d574c16a359438e9b9fb8230422f98a3cfd2b89ac20cda7f7b324b26829f27304c5f03e3dd36028a804e8d2241406e6f8d8b3de92749d2b30bf99bb3f26cad97f655d0aac104c0b412f18357350393b9bbeb5f14bbf57464207e38c7e9721823ec459b0a6584a5eabe110a9bdeacff1fafd25981f0b1443e8327323ff34b78f4d04eb4158c3ffe2efe289a83cf23388af467aa782dd5b81994935b2925c1c61a9bd3b3dd4781c03a4473b035f019d72eaa28feceef3b564d5d3659c78f54edf8274d997f5f505f32ec17a72a6b53903f5cbd0e17824cfd94c7fb957fbd19f448e20c4fc81e6708ebb49f666c844199253de6d8d4776b0d9645a95b4ea1bd12a80be5b14532749c5c4d9d6c8cdbbef05fdab373ddff1ed59642152661c4d3e47af55ed7bec280d8a3782ad94682b47d7135cf56681716380aa3d95e8915f692db482caddf70ccb48273681e0516d54ac0d85cd19e9db98a89b94683181fcfea87df3b30377b5f37acb3c386de9db2b571675036d420259ea0496acd2821541b72c8d1636b86c79acfaa46fe3021414e8291916778f6a37c86f02b43ccd4b8a5e9a02dea5552413629b2e835320d7c84fad8be64971f3ee24ea94ae95cbde50706e9b5149473fdfe2fc425d553a4219810cda5eb10263fe42bf2cc83060e26e9bf56b1da4b6d70e471a9705cf77f91f98282b10697e3a028d42fca9d4b494b36481443c247dece2a3bda8e5bbaef6524a9527b3f51f26cbf46e5310fc03d29d6cf6cd6685ec3367ca210f1f39d9c050fb7581f1de234959817383566d528afe44c3ff45f43c115679f2b4d93687a8c7a653b1478126b5eb933fa52a52b37bee47ee88d378fe553899f7e7ea7dd4af67b188d43934ab004709b9715753301bcb9c20c1a3d933d793dc73ba6736c164d9c8fbba393763145bd3250256acf17b0706aade1356084ef18a91807449fb56a3a11f85a804d8e20e6d3486e5e30da4a8f83fb15d3651ddcd58d7c7a0569ccaab38c978f5357d44529bfb88bf778dcc9222c3c6b6f03f72727eec267420264edefd8d68451424e5e077eb8cc5718365911f9b23ed7f87bbc84b4b38037eec25615b0bddbaa2047f6a84ccea6dad0b3c222d4e618603c02f0d63733b76113d97c682f16147da0de37f9021b9a55163eeca2668ec1332146b7adf58639505bd186d8876c4b6a95658bbc3a65b61aa9671c9c9bc75c3bc9b809680f51864dd4eeb43ab99564719f782c3d595c03b64af22b62b115efe1eb93e09cf67c0b4162429ab074cee64e072581d6b9d6120d9b01ad0bcfe5f6d9fed8a79fdc03d33104049202e8cc11bef16e4825352988496522e92ca870121c5b02b6148e40477ef48a80e5edd257e6264a5c7b849d060d06a5be079fb7a546859d1cc90c8688d8e7d5b4b1b5fa742870745abf908962ce81dda9ba97060d1925117143f64aec125c0fef93ad33af0be63e4c0617d1afe4f148e218a4b312aa33c193e92931bac3ad55e967bd847a2a23eea22d1e8ca25c86385b079dd18a7984ede1e24c435fd066fe5f890027fc37006348b570ece5eb67dcb6b3656c64f9dfa8d36ab5c17ce5ea00e459",
      BigNumber.from("1801362952000000000"),
      [0, 0, 0, true, 0] // cluster
    )
  );

  console.log("Validator registered");

  await withConfirmation(
    strategy.stakeEth([
      [
        "0xa023587296851ae359280e2bff7ac8ec840b9192dddc9a8b817fd55d23b0034b4a4856d897d3aec58d99c6f6a9ba6032", //pubkey
        // signature
        "0xb59d5d21392a1d03d6bd40558ab3eb9fad1e8ced748b4e9fcf379c304317d9e2189c0b8f321ecc3a927c8cfef9f92046017f92456ae0a16e564d6db15541e468ab696cb0409d4e5b30cefaf835a739533f4810c677837e9d9ecbfb5bbb534944",
        // deposit data root
        "0xfc3f49c04eaf3437df6f6af7e66eb777858c60eddafec63b3a530e32d33724be",
      ],
    ])
  );
  console.log("Validator registered");

  console.log("Running 003 deployment done");
  return true;
};

mainExport.id = "003_deposit_to_native_strategy";
mainExport.tags = [];
mainExport.dependencies = [];
mainExport.skip = () => false;

module.exports = mainExport;
