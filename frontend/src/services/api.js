const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * Central helper for all backend requests.
 */
export async function apiRequest(path, options = {}) {
  const currentToken = localStorage.getItem("fgl_dev_token") || "";

  const headers = {
    "Content-Type": "application/json",
    ...(currentToken ? { "x-user-id": currentToken, Authorization: `Bearer ${currentToken}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Invalid JSON response (${response.status})`);
  }

  if (!response.ok) {
    const error = new Error(data.message || data.error || "Request failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  devLogin: (userId) => apiRequest("/api/dev/login", { method: "POST", body: JSON.stringify({ userId }) }),
  getDevUsers: () => apiRequest("/api/dev/users"),

  // Audience
  getPass: (eventCode = "FGL-2026") => apiRequest(`/api/audience/pass?eventCode=${eventCode}`),

  // Gate
  redeemPass: ({ qrToken, gateId, deviceId }) =>
    apiRequest("/api/gate/redeem", {
      method: "POST",
      body: JSON.stringify({
        qr_token: qrToken,
        gate_id: gateId,
        device_id: deviceId
      })
    }),
  getGates: () => apiRequest("/api/gate/gates")
};

export default api;
