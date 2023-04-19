const ttl = 1000 * 60 * 5; // 5min
// Instance level cache on server
let voterCountCache: number = 0;
let lastUpdated: number = 0;

const fetchVoterCount = async () => {
  if (Date.now() < lastUpdated + ttl) return voterCountCache;

  try {
    const response: Response = await fetch(
      `${process.env.NEXT_PUBLIC_ETHPLORER_URL}/getTokenInfo/0x0c4576ca1c365868e162554af8e385dc3e7c66d9?apiKey=freekey`
    );

    const { holdersCount } = await response.json();

    voterCountCache = holdersCount;
    lastUpdated = Date.now();

    return holdersCount;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

export default fetchVoterCount;
