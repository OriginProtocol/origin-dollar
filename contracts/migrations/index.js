async function main() {
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const mockUsdt = await MockUSDT.deploy();

  const MockTUSD = await ethers.getContractFactory("MockTUSD");
  const mockTusd = await MockTUSD.deploy();

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUsdc = await MockUSDC.deploy();

  const MockDAI = await ethers.getContractFactory("MockDAI");
  const mockDai = await MockDAI.deploy();

  await Promise.all([
    mockUsdt.deployed(),
    mockTusd.deployed(),
    mockUsdc.deployed(),
    mockDai.deployed(),
  ]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
