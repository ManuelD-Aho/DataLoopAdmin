import apiClient from "./client";

export async function loginAdmin({ telephone, password }) {
  const { data } = await apiClient.post("/auth/login", { telephone, password });

  if (data?.user?.role !== "admin") {
    throw new Error("Acces refuse: ce compte n'est pas administrateur.");
  }

  return data;
}

export async function getDashboard() {
  const { data } = await apiClient.get("/admin/dashboard");
  return data;
}

export async function getUsers(params) {
  const { data } = await apiClient.get("/admin/users", { params });
  return data;
}

export async function updateUserStatus(id, payload) {
  const { data } = await apiClient.patch(`/admin/users/${id}`, payload);
  return data;
}

export async function getAlerts(params) {
  const { data } = await apiClient.get("/admin/alerts", { params });
  return data;
}

export async function uploadTasks(formData, onUploadProgress) {
  const { data } = await apiClient.post("/admin/tasks/upload", formData, {
    onUploadProgress,
  });

  return data;
}

export async function getDatasets(params) {
  const { data } = await apiClient.get("/admin/datasets", { params });
  return data;
}

export async function exportDataset(id, format = "csv") {
  const response = await apiClient.get(`/admin/datasets/${id}/export`, {
    params: { format },
    responseType: "blob",
  });

  return response.data;
}

export async function updateConfig(payload) {
  const { data } = await apiClient.patch("/admin/config", payload);
  return data;
}
