import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://dataloop-production.up.railway.app/api/v1";

export const TOKEN_KEY = "admin_token";
export const USER_KEY = "admin_user";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401 || status === 403) {
      window.dispatchEvent(
        new CustomEvent("dataloop:auth-error", {
          detail: { status },
        })
      );
    }

    return Promise.reject(error);
  }
);

export function getApiError(error) {
  const data = error?.response?.data;

  if (data?.message) return data.message;

  if (data?.errors) {
    return Object.values(data.errors).flat().join(" ");
  }

  if (error?.message === "Network Error") {
    return "Impossible de joindre l'API. Verifie la connexion ou la configuration CORS.";
  }

  return "Une erreur est survenue. Reessaie dans un instant.";
}

export default apiClient;
