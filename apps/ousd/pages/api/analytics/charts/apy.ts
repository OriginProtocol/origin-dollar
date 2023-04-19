import DuneClient, { toChartData, jobsLookup } from "../../../../lib/dune";

export const getApy = async () => {
  try {
    const client = new DuneClient(process.env.DUNE_API_KEY);

    const {
      result: { rows },
    } = await client.refresh(jobsLookup.apy.queryId);

    const { _7_day, _14_day, _30_day, total, labels } = toChartData(rows, {
      _7_day_apy: "_7_day",
      _14_day_apy: "_14_day",
      _30_day_apy: "_30_day",
      apy: "total",
      block_date: "labels",
    });

    return {
      labels,
      datasets: [
        {
          id: "_7_day",
          label: "7 Day",
          data: _7_day,
        },
        {
          id: "_14_day",
          label: "14 Day",
          data: _14_day,
        },
        {
          id: "_30_day",
          label: "30 Day",
          data: _30_day,
        },
        {
          id: "total",
          label: "APY",
          data: total,
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
    const data = await getApy();
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      error,
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
