import DuneClient, { toChartData, jobsLookup } from "../../../../lib/dune";

export const getOUSDMarketshareRelativeToETH = async () => {
  try {
    const client = new DuneClient(process.env.DUNE_API_KEY);

    const {
      result: { rows },
    } = await client.refresh(jobsLookup.ousdSupplyRelativeEthereum.queryId);

    rows?.reverse();

    const { total, labels } = toChartData(rows, {
      ousd: "total",
      day: "labels",
    });

    return {
      labels,
      datasets: [
        {
          id: "total",
          label: "%",
          data: total.map((item) => item * 100),
        },
      ],
    };
  } catch (e) {
    console.error(e);
    throw e;
  }
};

const getHandler = async (req, res) => {
  try {
    const data = await getOUSDMarketshareRelativeToETH();
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      error:
        error.message ||
        "Internal server error on relative eth marketshare query",
    });
  }
};

const handler = async (req, res) => {
  const { method } = req;
  switch (method) {
    case "GET":
      return getHandler(req, res);
    default:
      res.setHeader("Allow", ["GET", "OPTIONS"]);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
};

export default handler;
