const { deployOnPlume } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const { getTxOpts } = require("../../utils/tx");
const addresses = require("../../utils/addresses");

module.exports = deployOnPlume(
  {
    deployName: "001_woeth",
  },
  async ({ ethers }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Deploy Proxy
    await deployWithConfirmation("BridgedWOETHProxy", []);
    const cWOETHProxy = await ethers.getContract("BridgedWOETHProxy");
    console.log("BridgedWOETHProxy address:", cWOETHProxy.address);

    // Deploy Bridged WOETH Token implementation
    await deployWithConfirmation("BridgedWOETH", []);
    const cWOETHImpl = await ethers.getContract("BridgedWOETH");
    console.log("BridgedWOETH address:", cWOETHImpl.address);

    const cWOETH = await ethers.getContractAt(
      "BridgedWOETH",
      cWOETHProxy.address
    );

    const initData = cWOETHImpl.interface.encodeFunctionData(
      "initialize()",
      []
    );

    // Initialize the proxy
    // prettier-ignore
    await withConfirmation(
      cWOETHProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          cWOETHImpl.address,
          deployerAddr, // Pretend Deployer is Governor for now
          initData,
          await getTxOpts()
        )
    );
    console.log("Initialized BridgedWOETHProxy");

    // Deploy OmnichainL2Adapter
    const dOmnichainL2Adapter = await deployWithConfirmation(
      "OmnichainL2Adapter",
      [cWOETHProxy.address, addresses.plume.LayerZeroEndpointV2, deployerAddr]
    );

    console.log("OmnichainL2Adapter address:", dOmnichainL2Adapter.address);

    // Grant permissions to the adapter
    await withConfirmation(
      cWOETH
        .connect(sDeployer)
        .grantRole(await cWOETHImpl.MINTER_ROLE(), dOmnichainL2Adapter.address)
    );

    await withConfirmation(
      cWOETH
        .connect(sDeployer)
        .grantRole(await cWOETHImpl.BURNER_ROLE(), dOmnichainL2Adapter.address)
    );
    console.log("Granted minter & burner roles to OmnichainL2Adapter");

    // Set Peer
    const cOmnichainL2Adapter = await ethers.getContract("OmnichainL2Adapter");

    await withConfirmation(
      cOmnichainL2Adapter.connect(sDeployer).setPeer(
        // Ref: https://docs.layerzero.network/v2/deployments/deployed-contracts
        "30101", // Ethereum endpoint ID
        ethers.utils.zeroPad(addresses.mainnet.WOETHOmnichainAdapter, 32)
      )
    );
    console.log("Peer set for OmnichainL2Adapter");
  }
);
