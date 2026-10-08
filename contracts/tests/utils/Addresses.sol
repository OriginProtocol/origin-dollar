// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

library CrossChain {
    address internal constant zero = 0x0000000000000000000000000000000000000000;
    address internal constant dead = 0x0000000000000000000000000000000000000001;
    address internal constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address internal constant createX = 0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed;
    address internal constant multichainStrategist = 0x4FF1b9D9ba8558F5EAfCec096318eA0d8b541971;
    address internal constant multichainBuybackOperator = 0xBB077E716A5f1F1B63ed5244eBFf5214E50fec8c;
    /// @dev Talos signer. Set as the vaults' `operatorAddr` (the permissioned rebase caller)
    ///      on every chain by deploys mainnet/196 and base/051 (and sonic/030, since removed).
    address internal constant talosRelayer = 0x739212d5bAfE6AAC8Be49a60B7d003bD41DBf38b;
    address internal constant votemarket = 0x8c2c5A295450DDFf4CB360cA73FCCC12243D14D9;
    address internal constant CCTPTokenMessengerV2 = 0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d;
    address internal constant CCTPMessageTransmitterV2 = 0x81D40F21F12A8F0E3252Bccb954D722d4c464B64;
}

library Mainnet {
    address internal constant ORIGINTEAM = 0x449E0B5564e0d141b3bc3829E74fFA0Ea8C08ad5;
    address internal constant Binance = 0xF977814e90dA44bFA03b6295A0616a897441aceC;

    // Native stablecoins
    address internal constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address internal constant TUSD = 0x0000000000085d4780B73119b644AE5ecd22b376;
    address internal constant USDS = 0xdC035D45d973E3EC169d2276DDab16f1e407384F;

    // AAVE
    address internal constant AAVE_ADDRESS_PROVIDER = 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5;
    address internal constant Aave = 0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9;
    address internal constant aUSDT = 0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811;
    address internal constant aDAI = 0x028171bCA77440897B824Ca71D1c56caC55b68A3;
    address internal constant aUSDC = 0xBcca60bB61934080951369a648Fb03DF4F96263C;
    address internal constant aWETH = 0x030bA81f1c18d280636F32af80b9AAd02Cf0854e;
    address internal constant STKAAVE = 0x4da27a545c0c5B758a6BA100e3a049001de870f5;
    address internal constant AAVE_INCENTIVES_CONTROLLER = 0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5;

    // Compound
    address internal constant COMP = 0xc00e94Cb662C3520282E6f5717214004A7f26888;
    address internal constant cDAI = 0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643;
    address internal constant cUSDC = 0x39AA39c021dfbaE8faC545936693aC917d5E7563;
    address internal constant cUSDT = 0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9;

    // Curve
    address internal constant CRV = 0xD533a949740bb3306d119CC777fa900bA034cd52;
    address internal constant CRVMinter = 0xd061D61a4d941c39E5453435B6345Dc261C2fcE0;

    // CVX
    address internal constant CVX = 0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B;
    address internal constant CVXBooster = 0xF403C135812408BFbE8713b5A23a04b3D48AAE31;
    address internal constant CVXRewardsPool = 0x7D536a737C13561e0D2Decf1152a653B4e615158;
    address internal constant CVXLocker = 0x72a19342e8F1838460eBFCCEf09F6585e32db86E;

    // Maker
    address internal constant sDAI = 0x83F20F44975D03b1b09e64809B757c47f942BEeA;
    address internal constant sUSDS = 0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD;

    address internal constant openOracle = 0x922018674c12a7F0D394ebEEf9B58F186CdE13c1;
    address internal constant OGN = 0x8207c1FfC5B6804F6024322CcF34F29c3541Ae26;
    address internal constant LUSD = 0x5f98805A4E8be255a32880FDeC7F6728C6568bA0;
    address internal constant OGV = 0x9c354503C38481a7A7a51629142963F98eCC12D0;
    address internal constant veOGV = 0x0C4576Ca1c365868E162554AF8e385dc3e7C66D9;
    address internal constant RewardsSource = 0x7d82E86CF1496f9485a8ea04012afeb3C7489397;
    address internal constant OGNRewardsSource = 0x7609c88E5880e934dd3A75bCFef44E31b1Badb8b;
    /// @dev CoW harvester for the OGN buyback: sells fee OTokens for OGN and pays
    ///      OGNRewardsSource. Not to be confused with the strategy-reward CoW
    ///      harvester at 0xD400341a..., which sells CRV/MORPHO for USDC.
    address internal constant OGNCoWHarvester = 0x637C509383Ec7Da55C19a3Dbf3227C1Bb8A89151;
    address internal constant xOGN = 0x63898b3b6Ef3d39332082178656E9862bee45C57;

    // Uniswap
    address internal constant uniswapRouter = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    address internal constant uniswapV3Router = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address internal constant sushiswapRouter = 0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F;
    address internal constant uniswapV3Quoter = 0x61fFE014bA17989E743c5F6cB21bF9697530B21e;
    address internal constant uniswapUniversalRouter = 0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B;

    // Chainlink feeds
    address internal constant chainlinkETH_USD = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    address internal constant chainlinkDAI_USD = 0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9;
    address internal constant chainlinkUSDC_USD = 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6;
    address internal constant chainlinkUSDT_USD = 0x3E7d1eAB13ad0104d2750B8863b489D65364e32D;
    address internal constant chainlinkCOMP_USD = 0xdbd020CAeF83eFd542f4De03e3cF0C28A4428bd5;
    address internal constant chainlinkAAVE_USD = 0x547a514d5e3769680Ce22B2361c10Ea13619e8a9;
    address internal constant chainlinkCRV_USD = 0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f;
    address internal constant chainlinkCVX_USD = 0xd962fC30A72A84cE50161031391756Bf2876Af5D;
    address internal constant chainlinkOGN_ETH = 0x2c881B6f3f6B5ff6C975813F87A4dad0b241C15b;
    address internal constant chainlinkDAI_ETH = 0x773616E4d11A78F511299002da57A0a94577F1f4;
    address internal constant chainlinkUSDC_ETH = 0x986b5E1e1755e3C2440e960477f25201B0a8bbD4;
    address internal constant chainlinkUSDT_ETH = 0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46;
    address internal constant chainlinkRETH_ETH = 0x536218f9E9Eb48863970252233c8F271f554C2d0;
    address internal constant chainlinkstETH_ETH = 0x86392dC19c0b719886221c78AB11eb8Cf5c52812;
    address internal constant chainlinkcbETH_ETH = 0xF017fcB346A1885194689bA23Eff2fE6fA5C483b;
    address internal constant chainlinkBAL_ETH = 0xC1438AA3823A6Ba0C159CfA8D98dF5A994bA120b;

    address internal constant ccipRouterMainnet = 0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D;
    address internal constant ccipWoethTokenPool = 0xdCa0A2341ed5438E06B9982243808A76B9ADD6d0;

    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    // OUSD
    address internal constant Guardian = 0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899;
    address internal constant VaultProxy = 0xE75D77B1865Ae93c7eaa3040B038D7aA7BC02F70;
    address internal constant Vault = 0xf251Cb9129fdb7e9Ca5cad097dE3eA70caB9d8F9;
    address internal constant OUSDProxy = 0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86;
    address internal constant OUSD = 0xB72b3f5523851C2EB0cA14137803CA4ac7295f3F;
    address internal constant CompoundStrategyProxy = 0x12115A32a19e4994C2BA4A5437C22CEf5ABb59C3;
    address internal constant CompoundStrategy = 0xFaf23Bd848126521064184282e8AD344490BA6f0;
    address internal constant CurveUSDCStrategyProxy = 0x67023c56548BA15aD3542E65493311F19aDFdd6d;
    address internal constant CurveUSDCStrategy = 0x96E89b021E4D72b680BB0400fF504eB5f4A24327;
    address internal constant CurveUSDTStrategyProxy = 0xe40e09cD6725E542001FcB900d9dfeA447B529C0;
    address internal constant CurveUSDTStrategy = 0x75Bc09f72db1663Ed35925B89De2b5212b9b6Cb3;
    address internal constant CurveOUSDMetaPool = 0x87650D7bbfC3A9F10587d7778206671719d9910D;
    address internal constant CurveLUSDMetaPool = 0x7A192DD9Cc4Ea9bdEdeC9992df74F1DA55e60a19;
    address internal constant ConvexOUSDAMOStrategy = 0x89Eb88fEdc50FC77ae8a18aAD1cA0ac27f777a90;
    address internal constant CurveOUSDAMOStrategy = 0x26a02ec47ACC2A3442b757F45E0A82B8e993Ce11;
    address internal constant CurveOUSDGauge = 0x25f0cE4E2F8dbA112D9b115710AC297F816087CD;
    address internal constant ConvexVoter = 0x989AEb4d175e16225E39E87d0D97A3360524AD80;
    address internal constant CurveOUSDUSDTPool = 0x37715D41Ee0AF05E77ad3a434a11bbFF473eFe41;
    address internal constant CurveOUSDUSDTGauge = 0x74231E4d96498A30FCEaf9aACCAbBD79339Ecd7f;

    // Old OETH/ETH Convex AMO (no longer used)
    address internal constant ConvexOETHAMOStrategy = 0x1827F9eA98E0bf96550b2FC20F7233277FcD7E63;
    address internal constant ConvexOETHGauge = 0xd03BE91b1932715709e18021734fcB91BB431715;
    address internal constant CVXETHRewardsPool = 0x24b65DC1cf053A8D96872c323d29e86ec43eB33A;

    // New Curve OETH/WETH AMO
    address internal constant CurveOETHAMOStrategy = 0xba0e352AB5c13861C26e4E773e7a833C3A223FE6;
    address internal constant CurveOETHETHplusGauge = 0xCAe10a7553AccA53ad58c4EC63e3aB6Ad6546F71;

    // Votemarket - StakeDAO
    address internal constant CampaignRemoteManager = 0x177198aDb759a9715bC7259BE1b7bE535BeD7542;

    // Morpho
    address internal constant MorphoStrategyProxy = 0x5A4eEe58744D1430876d5cA93cAB5CcB763C037D;
    address internal constant MorphoAaveStrategyProxy = 0x79F2188EF9350A1dC11A062cca0abE90684b0197;
    address internal constant HarvesterProxy = 0x21Fb5812D70B3396880D30e90D9e5C1202266c89;
    address internal constant MorphoSteakhouseUSDCVault = 0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB;
    address internal constant MorphoGauntletPrimeUSDCVault = 0xdd0f28e19C1780eb6396170735D45153D261490d;
    address internal constant MorphoGauntletPrimeUSDTVault = 0x8CB3649114051cA5119141a34C200D65dc0Faa73;
    address internal constant MorphoOUSDv2StrategyProxy = 0x3643cafA6eF3dd7Fcc2ADaD1cabf708075AFFf6e;
    address internal constant MorphoOUSDv1Vault = 0x5B8b9FA8e4145eE06025F642cAdB1B47e5F39F04;
    address internal constant MorphoGauntletPrimeUSDCStrategyProxy = 0x2B8f37893EE713A4E9fF0cEb79F27539f20a32a1;
    address internal constant MorphoGauntletPrimeUSDTStrategyProxy = 0xe3ae7C80a1B02Ccd3FB0227773553AEB14e32F26;
    address internal constant MetaMorphoStrategyProxy = 0x603CDEAEC82A60E3C4A10dA6ab546459E5f64Fa0;
    address internal constant MorphoOUSDv2Adaptor = 0xD8F093dCE8504F10Ac798A978eF9E0C230B2f5fF;
    address internal constant MorphoOUSDv2Vault = 0xFB154c729A16802c4ad1E8f7FF539a8b9f49c960;
    address internal constant Morpho = 0x8888882f8f843896699869179fB6E4f7e3B58888;
    address internal constant MorphoLens = 0x930f1b46e1D081Ec1524efD95752bE3eCe51EF67;
    address internal constant MorphoToken = 0x58D97B57BB95320F9a05dC918Aef65434969c2B2;
    address internal constant LegacyMorphoToken = 0x9994E35Db50125E0DF82e4c2dde62496CE330999;

    address internal constant UniswapOracle = 0xc15169Bad17e676b3BaDb699DEe327423cE6178e;
    address internal constant CompensationClaims = 0x9C94df9d594BA1eb94430C006c269C314B1A8281;
    address internal constant Flipper = 0xcecaD69d7D4Ed6D52eFcFA028aF8732F27e08F70;

    // Governance
    address internal constant Timelock = 0x35918cDE7233F2dD33fA41ae3Cb6aE0e42E0e69F;
    address internal constant OldTimelock = 0x72426BA137DEC62657306b12B1E869d43FeC6eC7;
    address internal constant GovernorFive = 0x3cdD07c16614059e66344a7b579DAB4f9516C0b6;
    address internal constant GovernorSix = 0x1D3Fbd4d129Ddd2372EA85c5Fa00b2682081c9EC;

    // OETH
    address internal constant OETHProxy = 0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3;
    address internal constant WOETHProxy = 0xDcEe70654261AF21C44c093C300eD3Bb97b78192;
    address internal constant OETHVaultProxy = 0x39254033945AA2E4809Cc2977E7087BEE48bd7Ab;
    address internal constant OETHZapper = 0x9858e47BCbBe6fBAC040519B02d7cd4B2C470C66;
    address internal constant FraxETHStrategy = 0x3fF8654D633D4Ea0faE24c52Aec73B4A20D0d0e5;
    address internal constant FraxETHRedeemStrategy = 0x95A8e45afCfBfEDd4A1d41836ED1897f3Ef40A9e;
    address internal constant OETHHarvesterProxy = 0x0D017aFA83EAce9F10A8EC5B6E13941664A6785C;
    address internal constant OETHHarvesterSimpleProxy = 0x6D416E576eECBB9F897856a7c86007905274ed04;

    // OETH tokens
    address internal constant sfrxETH = 0xac3E018457B222d93114458476f3E3416Abbe38F;
    address internal constant frxETH = 0x5E8422345238F34275888049021821E8E08CAa1f;
    address internal constant rETH = 0xae78736Cd615f374D3085123A210448E74Fc6393;
    address internal constant stETH = 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84;
    address internal constant wstETH = 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0;
    address internal constant FraxETHMinter = 0xbAFA44EFE7901E04E39Dad13167D089C559c1138;

    // 1Inch
    address internal constant oneInchRouterV5 = 0x1111111254EEB25477B68fb85Ed929f73A960582;

    // Curve Pools
    address internal constant CurveStableswapFactoryNG = 0x6A8cbed756804B16E05E741eDaBd5cB544AE21bf;
    address internal constant CurveTriPool = 0x4eBdF703948ddCEA3B11f675B4D1Fba9d2414A14;
    address internal constant CurveCVXPool = 0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4;
    address internal constant curve_OUSD_USDC_pool = 0x6d18E1a7faeB1F0467A77C0d293872ab685426dc;
    address internal constant curve_OUSD_USDC_gauge = 0x1eF8B6Ea6434e722C916314caF8Bf16C81cAF2f9;
    address internal constant curve_OETH_WETH_pool = 0xcc7d5785AD5755B6164e21495E07aDb0Ff11C2A8;
    address internal constant curve_OETH_WETH_gauge = 0x36cC1d791704445A5b6b9c36a667e511d4702F3f;

    // Curve governance
    address internal constant veCRV = 0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2;
    address internal constant CurveGaugeController = 0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB;

    // Curve Pool Booster
    address internal constant CurvePoolBoosterOETH = 0x7B5e7aDEBC2da89912BffE55c86675CeCE59803E;
    address internal constant CurvePoolBoosterBribesModule = 0x6320Db7a3c1B95fD5684DC725C2cda9B82Fa20Fa;
    address internal constant MerklPoolBoosterBribesModule = 0x6241f5e4ad5af39ef3aE54801E0AE431e0B70369;

    // Beacon chain
    address internal constant beaconChainDepositContract = 0x00000000219ab540356cBB839Cbe05303d7705Fa;
    address internal constant mockBeaconRoots = 0xC033785181372379dB2BF9dD32178a7FDf495AcD;
    address internal constant beaconRoots = 0x000F3df6D732807Ef1319fB7B8bB8522d0Beac02;
    address internal constant beaconChainWithdrawRequest = 0x00000961Ef480Eb55e80D19ad83579A64c007002;

    // Native Staking Strategy
    address internal constant BeaconProofs = 0xc4444C5D9e7C1a5A0a01c5E4b11692d589DcAF22;
    address internal constant CompoundingStakingStrategyProxy = 0x25e1d468B14005716111d5e8464573e5135275f4;

    address internal constant validatorRegistrator = 0x4b91827516f79d6F6a1F292eD99671663b09169a;
    address internal constant LidoWithdrawalQueue = 0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1;
    address internal constant DaiUsdsMigrationContract = 0x3225737a9Bbb6473CB4a45b7244ACa2BeFdB276A;
    address internal constant ClaimStrategyRewardsSafeModule = 0x1b84E64279D63f48DdD88B9B2A7871e817152A44;

    // Passthrough
    address internal constant passthrough_curve_OUSD_3POOL = 0x261Fe804ff1F7909c27106dE7030d5A33E72E1bD;
    address internal constant passthrough_uniswap_OUSD_USDT = 0xF29c14dD91e3755ddc1BADc92db549007293F67b;
    address internal constant passthrough_uniswap_OETH_OGN = 0x2D3007d07aF522988A0Bf3C57Ee1074fA1B27CF1;
    address internal constant passthrough_uniswap_OETH_WETH = 0x216dEBBF25e5e67e6f5B2AD59c856Fc364478A6A;

    // Consensus layer
    address internal constant toConsensus_consolidation = 0x0000BBdDc7CE488642fb579F8B00f3a590007251;
    address internal constant toConsensus_withdrawals = 0x00000961Ef480Eb55e80D19ad83579A64c007002;

    // Merkl
    address internal constant CampaignCreator = 0x8BB4C975Ff3c250e0ceEA271728547f3802B36Fd;

    // Morpho Markets
    bytes32 internal constant MorphoOethUsdcMarket = 0xb8fef900b383db2dbbf4458c7f46acf5b140f26d603a6d1829963f241b82510e;

    // Crosschain
    address internal constant CrossChainMasterStrategy = 0xB1d624fc40824683e2bFBEfd19eB208DbBE00866;

    address internal constant oethWhaleAddress = 0xA7c82885072BADcF3D0277641d55762e65318654;
}

library Base {
    address internal constant HarvesterProxy = 0x247872f58f2fF11f9E8f89C1C48e460CfF0c6b29;
    address internal constant BridgedWOETH = 0xD8724322f44E5c58D7A815F542036fb17DbbF839;
    address internal constant AERO = 0x940181a94A35A4569E4529A3CDfB74e38FD98631;
    address internal constant aeroRouterAddress = 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43;
    address internal constant aeroVoterAddress = 0x16613524e02ad97eDfeF371bC883F2F5d6C480A5;
    address internal constant aeroFactoryAddress = 0x420DD381b31aEf6683db6B902084cB0FFECe40Da;
    address internal constant aeroGaugeGovernorAddress = 0xE6A41fE61E7a1996B59d508661e3f524d6A32075;
    address internal constant aeroQuoterV2Address = 0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0;
    address internal constant ethUsdPriceFeed = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
    address internal constant aeroUsdPriceFeed = 0x4EC5970fC728C5f65ba413992CD5fF6FD70fcfF0;
    address internal constant WETH = 0x4200000000000000000000000000000000000006;
    address internal constant wethAeroPoolAddress = 0x80aBe24A3ef1fc593aC5Da960F232ca23B2069d0;
    address internal constant governor = 0x92A19381444A001d62cE67BaFF066fA1111d7202;
    /// @dev 5/8 Multisig, holder of the vaults' `adminAddr`. The same Safe as the
    ///      governor above; aliased rather than repeated so the two cannot drift.
    address internal constant admin = governor;
    address internal constant strategist = 0x28bce2eE5775B652D92bB7c2891A89F036619703;
    address internal constant timelock = 0xf817cb3092179083c48c014688D98B72fB61464f;
    address internal constant multichainStrategist = 0x4FF1b9D9ba8558F5EAfCec096318eA0d8b541971;
    address internal constant BridgedWOETHOracleFeed = 0xe96EB1EDa83d18cbac224233319FA5071464e1b9;

    // Aerodrome
    address internal constant nonFungiblePositionManager = 0x827922686190790b37229fd06084350E74485b72;
    address internal constant slipstreamPoolFactory = 0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A;
    address internal constant aerodromeOETHbWETHClPool = 0x6446021F4E396dA3df4235C62537431372195D38;
    address internal constant aerodromeOETHbWETHClGauge = 0xdD234DBe2efF53BED9E8fC0e427ebcd74ed4F429;
    address internal constant swapRouter = 0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5;
    address internal constant sugarHelper = 0x0AD09A66af0154a84e86F761313d02d0abB6edd5;
    address internal constant quoterV2 = 0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0;
    address internal constant oethbBribesContract = 0x685cE0E36Ca4B81F13B7551C76143D962568f6DD;
    address internal constant OZRelayerAddress = 0xc0D6fa24D135c006dE5B8b2955935466A03D920a;
    address internal constant MerklPoolBoosterBribesModule = 0xf6B23291bF4993832b92A05c67d5f43eF3287C6a;

    // Curve
    address internal constant CRV = 0x8Ee73c484A26e0A5df2Ee2a4960B789967dd0415;
    address internal constant OETHb_WETH_pool = 0x302A94E3C28c290EAF2a4605FC52e11Eb915f378;
    address internal constant OETHb_WETH_gauge = 0x9da8420dbEEBDFc4902B356017610259ef7eeDD8;
    address internal constant childLiquidityGaugeFactory = 0xe35A879E5EfB4F1Bb7F70dCF3250f2e19f096bd8;

    address internal constant OETHBaseVaultProxy = 0x98a0CbeF61bD2D21435f433bE4CD42B56B38CC93;
    address internal constant OETHBaseProxy = 0xDBFeFD2e8460a6Ee4955A68582F85708BAEA60A3;
    address internal constant BridgedWOETHStrategyProxy = 0x80c864704DD06C3693ed5179190786EE38ACf835;
    address internal constant CCIPRouter = 0x881e3A65B4d4a04dD529061dd0071cf975F58bCD;
    address internal constant MerklDistributor = 0x8BB4C975Ff3c250e0ceEA271728547f3802B36Fd;
    address internal constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant MorphoOusdV2Vault = 0x2Ba14b2e1E7D2189D3550b708DFCA01f899f33c1;

    // Crosschain
    address internal constant CrossChainRemoteStrategy = 0xB1d624fc40824683e2bFBEfd19eB208DbBE00866;
}

library Hoodi {
    address internal constant OETHVaultProxy = 0xD0cC28bc8F4666286F3211e465ecF1fe5c72AC8B;
    address internal constant WETH = 0x2387fD72C1DA19f6486B843F5da562679FbB4057;
    address internal constant beaconChainDepositContract = 0x00000000219ab540356cBB839Cbe05303d7705Fa;
    address internal constant mockBeaconRoots = 0xdCfcAE4A084AA843eE446f400B23aA7B6340484b;
}

library Plume {
    address internal constant WETH = 0xca59cA09E5602fAe8B629DeE83FfA819741f14be;
    address internal constant BridgedWOETH = 0xD8724322f44E5c58D7A815F542036fb17DbbF839;
    address internal constant timelock = 0x6C6f8F839A7648949873D3D2beEa936FC2932e5c;
    address internal constant WPLUME = 0xEa237441c92CAe6FC17Caaf9a7acB3f953be4bd1;
    address internal constant MaverickV2Factory = 0x056A588AfdC0cdaa4Cab50d8a4D2940C5D04172E;
    address internal constant MaverickV2PoolLens = 0x15B4a8cc116313b50C19BCfcE4e5fc6EC8C65793;
    address internal constant MaverickV2Quoter = 0xf245948e9cf892C351361d298cc7c5b217C36D82;
    address internal constant MaverickV2Router = 0x35e44dc4702Fd51744001E248B49CBf9fcc51f0C;
    address internal constant MaverickV2Position = 0x0b452E8378B65FD16C0281cfe48Ed9723b8A1950;
    address internal constant MaverickV2LiquidityManager = 0x28d79eddBF5B215cAccBD809B967032C1E753af7;
    address internal constant OethpWETHRoosterPool = 0x3F86B564A9B530207876d2752948268b9Bf04F71;
    address internal constant strategist = 0x4FF1b9D9ba8558F5EAfCec096318eA0d8b541971;
    address internal constant admin = 0x92A19381444A001d62cE67BaFF066fA1111d7202;
    address internal constant BridgedWOETHOracleFeed = 0x4915600Ed7d85De62011433eEf0BD5399f677e9b;
}

library ArbitrumOne {
    address internal constant WOETHProxy = 0xD8724322f44E5c58D7A815F542036fb17DbbF839;
    address internal constant admin = 0xfD1383fb4eE74ED9D83F2cbC67507bA6Eac2896a;
}

library HyperEVM {
    address internal constant USDC = 0xb88339CB7199b77E23DB6E890353E22632Ba630f;
    address internal constant MorphoOusdV2Vault = 0xE90959cbE7E56b5eBFF9AD12de611A4976F2d2B1;
    address internal constant CrossChainRemoteStrategy = 0xE0228DB13F8C4Eb00fD1e08e076b09eF5cD0EA1e;
    address internal constant admin = 0x92A19381444A001d62cE67BaFF066fA1111d7202;
    address internal constant timelock = 0x77121911A387c9e4Eae46345E0f831A6da8a1364;
    address internal constant OZRelayerAddress = 0xC79Ad862c66E140D1D1E3fE65D33f98d7b4a0517;
}
