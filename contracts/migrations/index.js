async function main() {
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const mockUsdt = await MockUSDT.deploy();

  const MockTUSD = await ethers.getContractFactory("MockTUSD");
  const mockTusd = await MockTUSD.deploy();

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUsdc = await MockUSDC.deploy();

  const MockDAI = await ethers.getContractFactory("MockDAI");
  const mockDai = await MockDAI.deploy();

  const stablecoinMocks = await Promise.all([
    mockUsdt.deployed(),
    mockTusd.deployed(),
    mockUsdc.deployed(),
    mockDai.deployed(),
  ]);

  const Kernel = await ethers.getContractFactory("Kernel");
  const kernel = await Kernel.deploy();

  const OUSD = await ethers.getContractFactory("OUSD");
  const oUsd = await OUSD.deploy(kernel.address);

  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy(oUsd.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
