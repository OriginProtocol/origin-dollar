interface Audit {
  id: number;
  attributes: {
    name: string;
    auditUrl: string;
    publishedAt: string;
    createdAt: string;
    updatedAt: string;
  };
}

export default Audit;
