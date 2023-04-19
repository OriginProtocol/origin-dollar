const fetchImprovementProposals = async () => {
  const offChainCount = await fetchOffChainProposalCount();
  const onChainCount = await fetchOnChainProposalCount();

  return offChainCount + onChainCount;
};

const fetchOffChainProposalCount = async () => {
  const data = JSON.stringify({
    query: `{
            proposals (
                first: 1000,
                skip: 0,
                where: {
                space_in: ["ousdgov.eth"],
                },
                orderBy: "created",
                orderDirection: desc
            ) {
                id
            }
        }`,
  });

  let count: number;

  try {
    const response = await fetch("https://hub.snapshot.org/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: data,
    });

    const { data: responseData } = await response.json();
    count = responseData.proposals.length;
  } catch (err) {
    console.error("Error fetching proposal count from off-chain");
    throw err;
  }

  return count;
};

const fetchOnChainProposalCount = async () => {
  const fetchUrl = `${process.env.NEXT_PUBLIC_GOV_URL}/api/proposals?onlyCount=true`;
  let count: number;
  try {
    const response = await fetch(fetchUrl);
    ({ count } = await response.json());
  } catch (err) {
    console.error("Error fetching proposal count from chain");
    throw err;
  }

  return count;
};
export default fetchImprovementProposals;
