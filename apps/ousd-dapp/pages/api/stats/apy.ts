const fetchAPY = (req, res) => {
  try {
    return res.json({
      '7d': 0,
      '30d': 0,
      '60d': 0,
      '90d': 0,
      '365d': 0,
    });
  } catch (error) {
    return res.json({
      error: error.message,
    });
  }
};

const handler = async (req, res) => {
  const { method } = req;
  switch (method) {
    case 'GET':
      return fetchAPY(req, res);
    default:
      res.setHeader('Allow', ['POST', 'OPTIONS']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
};

export default handler;
