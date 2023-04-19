import DuneClient from "../../lib/dune";

export const queryByJob = async (jobId) => {
  try {
    const client = new DuneClient(process.env.DUNE_API_KEY);
    return await client.getResult(jobId);
  } catch (e) {
    console.error(e);
    throw e;
  }
};

const handler = async (req, res) => {
  const { method } = req;
  switch (method) {
    case "GET":
      const data = await queryByJob(req.jobId);
      res.json(data);
      break;
    default:
      res.setHeader("Allow", ["GET", "OPTIONS"]);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
};
