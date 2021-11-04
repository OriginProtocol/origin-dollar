const fs = require("fs");
const { ethers, network } = require("hardhat");
const addresses = require("../../utils/addresses");

const OUSD_ADDRESS = addresses.mainnet.OUSDProxy;

async function main(config) {
  if (!config.testFile) {
    throw new Error("Must specify --testFile");
  }

  const provider = new ethers.providers.StaticJsonRpcProvider(
    "http://localhost:8545/",
    1
  );
  const WHALE = "0xbe0eb53f46cd790cd13851d5eff43d12404d33e8";
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [WHALE],
  });
  const whale = await provider.getSigner(WHALE);
  console.log(whale);

  console.log("Simulating Transfers");
  const ousd = await ethers.getContractAt("OUSD", OUSD_ADDRESS);
  console.log(OUSD_ADDRESS);
  console.log("Using OUSD at @", ousd.address);

  let globalRCPT = undefined;
  if (config.highres) {
    globalRCPT = await ousd.rebasingCreditsPerTokenHighres();
  } else {
    globalRCPT = await ousd.rebasingCreditsPerToken();
  }
  console.log("Global ", globalRCPT.toString());

  let output = [];

  const data = JSON.parse(fs.readFileSync(config.testFile));

  for (const i in data) {
    const transfer = data[i];
    const from = transfer[0];
    const to = transfer[1];
    const amount = transfer[2];

    const beforeFrom = await ousd.balanceOf(from);
    const beforeTo = await ousd.balanceOf(to);
    // await whale.sendTransaction({to: from, value:"0x10000000000000"})
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [from],
    });
    const signer = await provider.getSigner(from);
    await ousd.connect(signer).transfer(to, amount, {
      gasPrice: 0,
    });
    const afterFrom = await ousd.balanceOf(from);
    const afterTo = await ousd.balanceOf(to);

    console.log(
      "✉️ ",
      parseInt(i) + 1,
      from,
      to,
      amount,
      afterFrom.add(amount).sub(beforeFrom).toString(),
      beforeTo.add(amount).sub(afterTo).toString()
    );
  }
}

function parseArgv() {
  const args = {};
  for (const arg of process.argv) {
    const elems = arg.split("=");
    const key = elems[0];
    const val = elems.length > 1 ? elems[1] : true;
    args[key] = val;
  }
  return args;
}

// Parse config.
const args = parseArgv();
const config = {
  testFile: args["--testFile"],
};

// Run the job.
main(config)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
