// src/hooks/useAlerts.js
import { useState, useEffect, useCallback } from "react";
import { alertsApi } from "../api/client.js";

export function useAlerts() {
  const [alerts,  setAlerts]  = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await alertsApi.list();
    if (error) setError(error);
    else setAlerts(data.alerts || []);
    setLoading(false);
  }, []);

  const fetchHistory = useCallback(async () => {
    const { data, error } = await alertsApi.history();
    if (!error) setHistory(data.history || []);
  }, []);

  useEffect(() => {
    fetchAlerts();
    fetchHistory();
  }, []);

  // ── Create ─────────────────────────────────────────────────────────────────

  async function createAlert(payload) {
    // Optimistic insert with temp id
    const temp = { ...payload, id: `temp-${Date.now()}`, status: "active", fire_count: 0 };
    setAlerts((prev) => [temp, ...prev]);

    const { data, error, upgrade } = await alertsApi.create(payload);

    if (error) {
      // Roll back
      setAlerts((prev) => prev.filter((a) => a.id !== temp.id));
      return { error, upgrade };
    }

    // Replace temp with real record
    setAlerts((prev) => prev.map((a) => (a.id === temp.id ? data.alert : a)));
    return { data: data.alert, error: null };
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  async function updateAlert(id, patch) {
    // Optimistic
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    const { data, error } = await alertsApi.update(id, patch);
    if (error) {
      await fetchAlerts(); // revert
      return { error };
    }
    setAlerts((prev) => prev.map((a) => (a.id === id ? data.alert : a)));
    return { data: data.alert, error: null };
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function deleteAlert(id) {
    // Optimistic remove
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    const { error } = await alertsApi.remove(id);
    if (error) {
      await fetchAlerts(); // revert
      return { error };
    }
    return { error: null };
  }

  // ── Toggle pause ───────────────────────────────────────────────────────────

  async function togglePause(id) {
    const alert = alerts.find((a) => a.id === id);
    if (!alert) return;
    const newStatus = alert.status === "active" ? "paused" : "active";
    return updateAlert(id, { status: newStatus });
  }

  return {
    alerts, history, loading, error,
    createAlert, updateAlert, deleteAlert, togglePause,
    refresh: fetchAlerts,
  };
}
