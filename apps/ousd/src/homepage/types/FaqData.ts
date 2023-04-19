interface FaqData {
  id: number;
  attributes: {
    question: string;
    answer: string;
    createdAt: string;
    updatedAt: string;
    publishedAt: string;
  };
}

export default FaqData;
