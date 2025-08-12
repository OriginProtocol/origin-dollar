const fetch = require("node-fetch");
const { resolveContract } = require("../utils/resolvers");

async function tenderlyUpload({ name }) {
  const contract = await resolveContract(name);

  const { chainId } = await ethers.provider.getNetwork();
  await uploadContractToTenderly(contract.address, name, chainId);
}

async function tenderlySync(taskArguments, hre) {
  const allDeployments = await hre.deployments.all();
  const deployedContracts = Object.entries(allDeployments).map(
    ([name, deployment]) => ({
      name,
      address: deployment.address,
    })
  );
  const { chainId } = await ethers.provider.getNetwork();
  const allTenderlyContracts = await fetchAllContractsFromTenderly(chainId);

  for (let i = 0; i < deployedContracts.length; i++) {
    let presentInTenderly = false;
    const deployedContract = deployedContracts[i];
    for (let j = 0; j < allTenderlyContracts.length; j++) {
      if (
        deployedContract.address.toLowerCase() ==
        allTenderlyContracts[j].toLowerCase()
      ) {
        presentInTenderly = true;
      }
    }

    if (presentInTenderly) {
      console.log(
        `✓ contract ${deployedContract.name}[${deployedContract.address}] already detected by Tenderly`
      );
      continue;
    }

    await uploadContractToTenderly(
      deployedContract.address,
      deployedContract.name,
      chainId
    );
    console.log(
      `✅ contract ${deployedContract.name}[${deployedContract.address}] added to Tenderly`
    );
  }
}

async function uploadContractToTenderly(address, name, networkId) {
  if (!process.env.TENDERLY_ACCESS_TOKEN) {
    throw new Error("TENDERLY_ACCESS_TOKEN env var missing");
  }

  const baseUrl = `https://api.tenderly.co/api/v1/account/origin-protocol/project/origin/address`;

  const payload = {
    network_id: `${networkId}`,
    address: address,
    display_name: name,
  };

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "X-Access-Key": `${process.env.TENDERLY_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `API request failed with status ${
        response.status
      }: ${await response.text()}`
    );
  }

  const data = await response.json();
  return data;
}

async function fetchAllContractsFromTenderly() {
  if (!process.env.TENDERLY_ACCESS_TOKEN) {
    throw new Error("TENDERLY_ACCESS_TOKEN env var missing");
  }

  const baseUrl = `https://api.tenderly.co/api/v1/account/origin-protocol/project/origin/contracts?accountType=contract`;

  let url = baseUrl;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-Access-Key": `${process.env.TENDERLY_ACCESS_TOKEN}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `API request failed with status ${
        response.status
      }: ${await response.text()}`
    );
  }

  const data = await response.json();

  // return the array of contract addresses
  return data.map((contractData) => contractData.contract.address);
}

module.exports = {
  tenderlySync,
  tenderlyUpload,
};
