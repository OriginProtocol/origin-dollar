export async function fetchCollateral() {
  const endpoint = `${process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT}/api/v1/collateral`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error("Failed to fetch collateral");
  }
  return response.json();
}
