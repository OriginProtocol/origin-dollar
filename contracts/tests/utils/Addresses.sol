// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

library CrossChain {
    address internal constant zero = 0x0000000000000000000000000000000000000000;
    address internal constant dead = 0x0000000000000000000000000000000000000001;
    address internal constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address internal constant createX = 0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed;
    address internal constant multichainStrategist = 0x4FF1b9D9ba8558F5EAfCec096318eA0d8b541971;
    address internal constant multichainBuybackOperator = 0xBB077E716A5f1F1B63ed5244eBFf5214E50fec8c;
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
    address internal constant CampaignRemoteManager = 0x53aD4Cd1F1e52DD02aa9FC4A8250A1b74F351CA2;

    // Morpho
    address internal constant MorphoStrategyProxy = 0x5A4eEe58744D1430876d5cA93cAB5CcB763C037D;
    address internal constant MorphoAaveStrategyProxy = 0x79F2188EF9350A1dC11A062cca0abE90684b0197;
    address internal constant HarvesterProxy = 0x21Fb5812D70B3396880D30e90D9e5C1202266c89;
    address internal constant MorphoSteakhouseUSDCVault = 0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB;
    address internal constant MorphoGauntletPrimeUSDCVault = 0xdd0f28e19C1780eb6396170735D45153D261490d;
    address internal constant MorphoGauntletPrimeUSDTVault = 0x8CB3649114051cA5119141a34C200D65dc0Faa73;
    address internal constant MorphoOUSDv2StrategyProxy = 0x3643cafA6eF3dd7Fcc2ADaD1cabf708075AFFf6e;
    address internal constant MorphoOUSDv1Vault = 0x5B8b9FA8e4145eE06025F642cAdB1B47e5F39F04;
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
    address internal constant CurvePoolBoosterBribesModule = 0x82447F7C3eF0a628B0c614A3eA0898a5bb7c18fe;

    // SSV network
    address internal constant SSV = 0x9D65fF81a3c488d585bBfb0Bfe3c7707c7917f54;
    address internal constant SSVNetwork = 0xDD9BC35aE942eF0cFa76930954a156B3fF30a4E1;

    // Beacon chain
    address internal constant beaconChainDepositContract = 0x00000000219ab540356cBB839Cbe05303d7705Fa;
    address internal constant mockBeaconRoots = 0xC033785181372379dB2BF9dD32178a7FDf495AcD;
    address internal constant beaconRoots = 0x000F3df6D732807Ef1319fB7B8bB8522d0Beac02;
    address internal constant beaconChainWithdrawRequest = 0x00000961Ef480Eb55e80D19ad83579A64c007002;

    // Native Staking Strategy
    address internal constant NativeStakingSSVStrategyProxy = 0x34eDb2ee25751eE67F68A45813B22811687C0238;
    address internal constant NativeStakingSSVStrategy2Proxy = 0x4685dB8bF2Df743c861d71E6cFb5347222992076;
    address internal constant NativeStakingSSVStrategy3Proxy = 0xE98538A0e8C2871C2482e1Be8cC6bd9F8E8fFD63;

    address internal constant validatorRegistrator = 0x4b91827516f79d6F6a1F292eD99671663b09169a;
    address internal constant LidoWithdrawalQueue = 0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1;
    address internal constant DaiUsdsMigrationContract = 0x3225737a9Bbb6473CB4a45b7244ACa2BeFdB276A;
    address internal constant ClaimStrategyRewardsSafeModule = 0x1b84E64279D63f48DdD88B9B2A7871e817152A44;

    // LayerZero
    address internal constant LayerZeroEndpointV2 = 0x1a44076050125825900e736c501f859c50fE728c;
    address internal constant WOETHOmnichainAdapter = 0x7d1bEa5807e6af125826d56ff477745BB89972b8;
    address internal constant ETHOmnichainAdapter = 0x77b2043768d28E9C9aB44E1aBfC95944bcE57931;

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

    // Curve
    address internal constant CRV = 0x8Ee73c484A26e0A5df2Ee2a4960B789967dd0415;
    address internal constant OETHb_WETH_pool = 0x302A94E3C28c290EAF2a4605FC52e11Eb915f378;
    address internal constant OETHb_WETH_gauge = 0x9da8420dbEEBDFc4902B356017610259ef7eeDD8;
    address internal constant childLiquidityGaugeFactory = 0xe35A879E5EfB4F1Bb7F70dCF3250f2e19f096bd8;

    address internal constant CCIPRouter = 0x881e3A65B4d4a04dD529061dd0071cf975F58bCD;
    address internal constant MerklDistributor = 0x8BB4C975Ff3c250e0ceEA271728547f3802B36Fd;
    address internal constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant MorphoOusdV2Vault = 0x2Ba14b2e1E7D2189D3550b708DFCA01f899f33c1;

    // Crosschain
    address internal constant CrossChainRemoteStrategy = 0xB1d624fc40824683e2bFBEfd19eB208DbBE00866;
}

library Sonic {
    address internal constant wS = 0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38;
    address internal constant WETH = 0x309C92261178fA0CF748A855e90Ae73FDb79EBc7;
    address internal constant SFC = 0xFC00FACE00000000000000000000000000000000;
    address internal constant nodeDriver = 0xD100a01e00000000000000000000000000000001;
    address internal constant nodeDriveAuth = 0xD100ae0000000000000000000000000000000000;
    address internal constant validatorRegistrator = 0x531B8D5eD6db72A56cF1238D4cE478E7cB7f2825;
    address internal constant admin = 0xAdDEA7933Db7d83855786EB43a238111C69B00b6;
    address internal constant guardian = 0x63cdd3072F25664eeC6FAEFf6dAeB668Ea4de94a;
    address internal constant timelock = 0x31a91336414d3B955E494E7d485a6B06b55FC8fB;

    address internal constant OSonicProxy = 0xb1e25689D55734FD3ffFc939c4C3Eb52DFf8A794;
    address internal constant WOSonicProxy = 0x9F0dF7799f6FDAd409300080cfF680f5A23df4b1;
    address internal constant OSonicVaultProxy = 0xa3c0eCA00D2B76b4d1F170b0AB3FdeA16C180186;
    address internal constant SonicStakingStrategy = 0x596B0401479f6DfE1cAF8c12838311FeE742B95c;
    address internal constant SonicSwapXAMOStrategyProxy = 0xbE19cC5654e30dAF04AD3B5E06213D70F4e882eE;

    // SwapX
    address internal constant SWPx = 0xA04BC7140c26fc9BB1F36B1A604C7A5a88fb0E70;
    address internal constant SwapXOwner = 0xAdB5A1518713095C39dBcA08Da6656af7249Dd20;
    address internal constant SwapXVoter = 0xC1AE2779903cfB84CB9DEe5c03EcEAc32dc407F2;
    address internal constant SwapXPairFactory = 0x05c1be79d3aC21Cc4B727eeD58C9B2fF757F5663;
    address internal constant SwapXSWPxOSPool = 0x9Cb484FAD38D953bc79e2a39bBc93655256F0B16;
    address internal constant SwapXTreasury = 0x896c3f0b63a8DAE60aFCE7Bca73356A9b611f3c8;

    address internal constant SwapXOsUSDCe_pool = 0x84EA9fAfD41abAEc5a53248f79Fa05ADA0058a96;
    address internal constant SwapXOsUSDCe_gaugeOS = 0x737938a25D811A3F324aC0257d75b5e88d0a6FC3;
    address internal constant SwapXOsUSDCe_extBribeOS = 0x41688C9bb59ce191F6BB57c5829ac9D50A03E410;
    address internal constant SwapXOsUSDCe_gaugeUSDC = 0xB660B984F80a89044Aa3841F1a1C78B2F596393f;
    address internal constant SwapXOsUSDCe_extBribeUSDC = 0xBCF88f38865B7712da4DE0a8eFC286C601CAE5e7;

    address internal constant SwapXOsGEMSx_pool = 0x9ac7F5961a452e9cD5Be5717bD2c3dF412D1c1a5;

    address internal constant SwapXWSOS_pool = 0xcfE67b6c7B65c8d038e666b3241a161888B7f2b0;
    address internal constant SwapXWSOS_gauge = 0x083D761B2A3e1fb5914FA61c6Bf11A93dcb60709;
    address internal constant SwapXWSOS_fees = 0x9532392268eEd87959A1Cf346b14569c82b11090;

    address internal constant SwapXOsUSDCeMultisigBooster = 0x4636269e7CDc253F6B0B210215C3601558FE80F6;
    address internal constant SwapXOsGEMSxMultisigBooster = 0xE2c01Cc951E8322992673Fa2302054375636F7DE;

    // Equalizer
    address internal constant Equalizer_WsOs_pool = 0x99ff9d3E8B26Fea85a7a103D9e576EfdC38fB530;
    address internal constant Equalizer_WsOs_extBribeOS = 0x2726Be050f22B9aFF2b582758aeEa504cDa6fA62;
    address internal constant Equalizer_ThcOs_pool = 0xd6f5d565410c536e3e9C4FCf05560518C2C56440;
    address internal constant Equalizer_ThcOs_extBribeOS = 0x9e566ce25A90A07125b7c697ca8f01bbC41Cb3B3;

    // SwapX pools
    address internal constant SwapX_OsSfrxUSD_pool = 0x9255F31eF9B35d085cED6fE29F9E077EB1f513C6;
    address internal constant SwapX_OsSfrxUSD_gaugeOS = 0x99d8E114F1a6359c6048Ae5Cce163786c0Ce97DF;
    address internal constant SwapX_OsSfrxUSD_extBribeOS = 0xb7A1a8AC3Cb1a40bbE73894c0b5e911d3a1ac075;
    address internal constant SwapX_OsSfrxUSD_gaugeOther = 0x88d6c63f1EF23bDff2bD483831074dc23d8416d4;
    address internal constant SwapX_OsSfrxUSD_extBribeOther = 0xD1ECb64C0C20F2500a259DF4d125d0e21Eaa24cD;

    address internal constant SwapX_OsScUSD_pool = 0x370428430503B3b5970Ccaf530CbC71d02C3B61a;
    address internal constant SwapX_OsScUSD_gaugeOS = 0x23bDc38a3bA72DE7B32A1bC01DFfB99Ce4CF8b2b;
    address internal constant SwapX_OsScUSD_extBribeOS = 0xF22ea5dEE8FC4A12Dd4263448e2c1C2494c1E6f4;
    address internal constant SwapX_OsScUSD_gaugeOther = 0x1FFCD52e4E452F35a92ED58CE94629E8d9DC09CF;
    address internal constant SwapX_OsScUSD_extBribeOther = 0xBD365648bEbe932f8394F726D4A83FBd684E6b72;

    address internal constant SwapX_OsSilo_pool = 0x2ab09e10F75965Ccc369C8B86071f351141Dc0a1;
    address internal constant SwapX_OsSilo_gaugeOS = 0x016889e5E0F026c030D28321f3190A39206120AD;
    address internal constant SwapX_OsSilo_extBribeOS = 0x91BF8dc9D93ed1aC1aFaD78bB9B48F04bDF01F36;
    address internal constant SwapX_OsSilo_gaugeOther = 0x6e4e2e895223f62Cc53bA56128a58bC58D79BEa0;
    address internal constant SwapX_OsSilo_extBribeOther = 0xe0fd09bae2A254e19fc75fCEC967a373E0b63909;

    address internal constant SwapX_OsFiery_pool = 0xC3a185226d594B56d3e5cF52308d07FE972cA769;
    address internal constant SwapX_OsFiery_gaugeOS = 0xBb3cFc4f69ecfaeb9fd4d263bD8549C8CCFd25d7;
    address internal constant SwapX_OsFiery_extBribeOS = 0x5ee96bE5747867560D18F042991E045401601b01;

    address internal constant SwapX_OsHedgy_pool = 0x1695D6BD8D8ADC8B87c6204bE34D34d19A3Fe1d6;
    address internal constant SwapX_OsHedgy_yf_treasury = 0x4C884677427A975d1b99286E99188c82D71223C8;

    address internal constant SwapX_OsMYRD_pool = 0x6228739b26f49AE9Cd953D82366934e209175E81;
    address internal constant SwapX_OsMYRD_gaugeOS = 0xA9Bb2b8B92a546a53466B5E7d8D8f2F03032FB41;
    address internal constant SwapX_OsMYRD_extBribeOS = 0x5599bfd59a9EE0E8b65aB2d2449F4bdf28c75edc;

    address internal constant SwapX_OsBes_pool = 0x97fE831cC56da84321f404a300e2Be81b5bd668A;
    address internal constant SwapX_OsBes_gaugeOS = 0x77546B40445d3eca6111944DFe902de0514A4F80;
    address internal constant SwapX_OsBes_extBribeOS = 0x19582ff8ffD7695eE177061eb4AC3fCA520F3638;
    address internal constant SwapX_OsBes_gaugeOther = 0xfBA3606310f3d492031176eC85DFbeD67F5799F2;
    address internal constant SwapX_OsBes_extBribeOther = 0x298B8934bC89d19F89A1F8Eb620659E6678e3539;

    address internal constant SwapX_OsBRNx_pool = 0x12dAb9825B85B07f8DdDe746066B7Ed6Bc4c06F8;
    address internal constant SwapX_OsBRNx_gaugeOS = 0xBd896eB3503A2eC0f246B3C0B7D8D434F7c697Fc;
    address internal constant SwapX_OsBRNx_extBribeOS = 0x0B2d62B1B025751249543d47765f55a66Dd526c7;
    address internal constant SwapX_OsBRNx_gaugeOther = 0xaE519dE817775E394Fc854d966065a97Facfc934;
    address internal constant SwapX_OsBRNx_extBribeOther = 0xC9FA26E55e92e1D9c63A6FDF9b91FaC794523203;

    // Shadow
    address internal constant Shadow_OsEco_pool = 0xFd0Cee796348Fd99AB792C471f4419b4c56cf6b8;
    address internal constant Shadow_OsEco_yf_treasury = 0x4B9919603170c77936D8ec2C08b604844E861699;
    address internal constant Shadow_SWETH_pool = 0xB6d9B069F6B96A507243d501d1a23b3fCCFC85d3;
    address internal constant Shadow_SWETH_gaugeV2 = 0xF5C7598C953E49755576CDA6b2B2A9dAaf89a837;

    // Merkl
    address internal constant MerklWhale = 0xA9DdD91249DFdd450E81E1c56Ab60E1A62651701;

    // Metropolis
    address internal constant Metropolis_Voter = 0x03A9896A464C515d13f2679df337bF95bc891fdA;
    address internal constant Metropolis_RewarderFactory = 0xd9db92613867FE0d290CE64Fe737E2F8B80CADc3;
    address internal constant Metropolis_Pools_OsWOs = 0x3987a13D675c66570bC28c955685a9bcA2dCF26e;
    address internal constant Metropolis_Pools_OsMoon = 0xc0aac9BB9fb72a77e3bc8beE46D3E227C84a54C0;
    address internal constant Metropolis_OsWs_pool = 0x3987a13D675c66570bC28c955685a9bcA2dCF26e;

    // Curve
    address internal constant CRV = 0x5Af79133999f7908953E94b7A5CF367740Ebee35;
    address internal constant WS_OS_pool = 0x7180F41A71f13FaC52d2CfB17911f5810c8B0BB9;
    address internal constant WS_OS_gauge = 0x9CA6dE419e9fc7bAC876DE07F0f6Ec96331Ba207;
    address internal constant childLiquidityGaugeFactory = 0xf3A431008396df8A8b2DF492C913706BDB0874ef;

    address internal constant MerklDistributor = 0x8BB4C975Ff3c250e0ceEA271728547f3802B36Fd;
}

library Holesky {
    address internal constant WETH = 0x94373a4919B3240D86eA41593D5eBa789FEF3848;
    address internal constant SSV = 0xad45A78180961079BFaeEe349704F411dfF947C6;
    address internal constant SSVNetwork = 0x38A4794cCEd47d3baf7370CcC43B560D3a1beEFA;
    address internal constant beaconChainDepositContract = 0x4242424242424242424242424242424242424242;
    address internal constant NativeStakingSSVStrategyProxy = 0xcf4a9e80Ddb173cc17128A361B98B9A140e3932E;
    address internal constant OETHVaultProxy = 0x19d2bAaBA949eFfa163bFB9efB53ed8701aA5dD9;
    address internal constant Governor = 0x1b94CA50D3Ad9f8368851F8526132272d1a5028C;
    address internal constant validatorRegistrator = 0x3C6B0c7835a2E2E0A45889F64DcE4ee14c1D5CB4;
    address internal constant Guardian = 0x3C6B0c7835a2E2E0A45889F64DcE4ee14c1D5CB4;
}

library Hoodi {
    address internal constant OETHVaultProxy = 0xD0cC28bc8F4666286F3211e465ecF1fe5c72AC8B;
    address internal constant WETH = 0x2387fD72C1DA19f6486B843F5da562679FbB4057;
    address internal constant SSV = 0x9F5d4Ec84fC4785788aB44F9de973cF34F7A038e;
    address internal constant SSVNetwork = 0x58410Bef803ECd7E63B23664C586A6DB72DAf59c;
    address internal constant beaconChainDepositContract = 0x00000000219ab540356cBB839Cbe05303d7705Fa;
    address internal constant defenderRelayer = 0x419B6BdAE482f41b8B194515749F3A2Da26d583b;
    address internal constant mockBeaconRoots = 0xdCfcAE4A084AA843eE446f400B23aA7B6340484b;
}

library Plume {
    address internal constant WETH = 0xca59cA09E5602fAe8B629DeE83FfA819741f14be;
    address internal constant BridgedWOETH = 0xD8724322f44E5c58D7A815F542036fb17DbbF839;
    address internal constant LayerZeroEndpointV2 = 0xC1b15d3B262bEeC0e3565C11C9e0F6134BdaCB36;
    address internal constant WOETHOmnichainAdapter = 0x592CB6A596E7919930bF49a27AdAeCA7C055e4DB;
    address internal constant WETHOmnichainAdapter = 0x4683CE822272CD66CEa73F5F1f9f5cBcaEF4F066;
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

library UnitTests {
    address internal constant CompoundingStakingStrategyProxy = 0x840081c97256d553A8F234D469D797B9535a3B49;
}
