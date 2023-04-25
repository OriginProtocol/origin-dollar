const fetchOETHPortfolio = (req, res) => {
  try {
    const { address } = req.params;
    return res.json({
      address,
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
      return fetchOETHPortfolio(req, res);
    default:
      res.setHeader('Allow', ['POST', 'OPTIONS']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
};

export default handler;
