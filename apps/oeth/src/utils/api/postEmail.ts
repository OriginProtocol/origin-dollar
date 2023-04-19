interface PostEmailResponse {
  email: string;
  action: "added" | "exists" | "invalid";
}

const postEmail = async (email: string) => {
  const fetchRes = await fetch(
    `${process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT}/api/v1/subscribe`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
      }),
    }
  );

  if (!fetchRes.ok) throw new Error("Failed to post email");

  const response: PostEmailResponse = await fetchRes.json();

  return response;
};

export default postEmail;
