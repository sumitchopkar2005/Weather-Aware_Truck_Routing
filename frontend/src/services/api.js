import axios from "axios";

const client = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1",
  timeout: 60000,
});

export async function analyzeTrip(payload, signal) {
  const response = await client.post("/routes/analyze/", payload, { signal });
  return response.data;
}
