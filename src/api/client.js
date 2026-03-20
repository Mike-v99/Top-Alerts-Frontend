// src/api/client.js
//
// Thin wrapper around fetch. Attaches the Supabase JWT automatically.
// All functions return { data, error }.

import { supabase } from "../lib/supabase.js";

const BASE = import.meta.env.VITE_API_URL;

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return {
    "Content-Type": "application/json",
    Authorization:  `Bearer ${session.access_token}`,
  };
}

async function request(method, path, body) {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || "Request failed", upgrade: json.upgrade };
    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export const alertsApi = {
  list:   ()          => request("GET",    "/alerts"),
  create: (payload)   => request("POST",   "/alerts", payload),
  update: (id, patch) => request("PATCH",  `/alerts/${id}`, patch),
  remove: (id)        => request("DELETE", `/alerts/${id}`),
  history:()          => request("GET",    "/alerts/history"),
};

// ── Stripe ────────────────────────────────────────────────────────────────────

export const billingApi = {
  createCheckout: (priceId) =>
    request("POST", "/stripe/create-checkout", {
      priceId,
      userId:    supabase.auth.getUser().then(r => r.data.user?.id),
      userEmail: supabase.auth.getUser().then(r => r.data.user?.email),
    }),

  createPortal: (userId) =>
    request("POST", "/stripe/create-portal", { userId }),
};
