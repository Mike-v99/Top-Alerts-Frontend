// src/pages/App.jsx
//
// This is the existing Top-Alerts UI (price-alert-app-v3.jsx) wired to live data.
// useAlerts() replaces all mock state. useAuth() gates Pro features.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth }   from "../context/AuthContext.jsx";
import { useAlerts } from "../hooks/useAlerts.js";
import { billingApi } from "../api/client.js";

// ── Themes (same as v3) ───────────────────────────────────────────────────────
const THEMES = {
  paper: {
    bg: "#f4f0e8", bgCard: "#ede9df", bgDeep: "#e6e2d8", bgModal: "#ede9df", bgInput: "#e6e2d8",
    border: "#d0c8b8", borderLight: "#ddd5c5", text: "#1a1200", textMid: "#6a6050", textFaint: "#aaa090",
    accent: "#8a6a00", accentBg: "rgba(138,106,0,0.1)", accentBorder: "rgba(138,106,0,0.25)",
    green: "#1a8a44", greenGlow: "none", yellow: "#c89000", yellowGlow: "none", red: "#cc2222", redGlow: "none",
    gridColor: "rgba(138,106,0,0.06)", proGradient: "#ede5cc", proBorder: "rgba(138,106,0,0.3)",
    btnPrimary: "#1a1200", btnText: "#f4f0e8", activeTab: "#1a1200", activeTabBorder: "#1a1200",
    planActiveBg: "#1a1200", planActiveText: "#f4f0e8", planInactiveText: "#aaa090",
    sparkStroke: "#8a6a00", sparkFire: "#8a6a00", icon: "☀",
  },
  charcoal: {
    bg: "#141414", bgCard: "#1a1a1a", bgDeep: "#0f0f0f", bgModal: "#1a1a1a", bgInput: "#0f0f0f",
    border: "#282828", borderLight: "#222", text: "#e0e0e0", textMid: "#888", textFaint: "#444",
    accent: "#cccccc", accentBg: "rgba(255,255,255,0.06)", accentBorder: "rgba(255,255,255,0.15)",
    green: "#3ddc84", greenGlow: "0 0 8px #3ddc84", yellow: "#bbbbbb", yellowGlow: "none",
    red: "#ff5a5a", redGlow: "0 0 8px #ff5a5a",
    gridColor: "rgba(255,255,255,0.02)", proGradient: "#1e1e1e", proBorder: "rgba(255,255,255,0.12)",
    btnPrimary: "#e0e0e0", btnText: "#141414", activeTab: "#e0e0e0", activeTabBorder: "#888",
    planActiveBg: "#282828", planActiveText: "#e0e0e0", planInactiveText: "#444",
    sparkStroke: "#aaa", sparkFire: "#ccc", icon: "◑",
  },
};

const ASSETS = ["BTC/USD","ETH/USD","SOL/USD","AAPL","TSLA","SPY","GOLD"];
const FREE_TRIGGERS = [
  { id: "price_above", label: "Price rises above", icon: "↑", input: "price",   desc: "Fires when price exceeds your target" },
  { id: "price_below", label: "Price drops below", icon: "↓", input: "price",   desc: "Fires when price falls under your target" },
  { id: "pct_change",  label: "% change exceeds",  icon: "±", input: "percent", desc: "Fires on big moves in either direction" },
];
const PRO_TRIGGERS = [
  { id: "ma_cross_above", label: "Price crosses above MA",  icon: "↗", input: "ma",     desc: "Bullish MA crossover" },
  { id: "ma_cross_below", label: "Price crosses below MA",  icon: "↘", input: "ma",     desc: "Bearish MA crossover" },
  { id: "golden_cross",   label: "Golden Cross",            icon: "✦", input: null,     desc: "50MA crosses above 200MA" },
  { id: "death_cross",    label: "Death Cross",             icon: "✗", input: null,     desc: "50MA crosses below 200MA" },
  { id: "rsi_overbought", label: "RSI Overbought >70",      icon: "⚡", input: null,    desc: "Potential pullback signal" },
  { id: "rsi_oversold",   label: "RSI Oversold <30",        icon: "▼", input: null,     desc: "Potential reversal signal" },
  { id: "macd_cross",     label: "MACD Signal Cross",       icon: "⊕", input: null,     desc: "MACD line crosses signal" },
  { id: "bb_breakout",    label: "Bollinger Band Breakout", icon: "◈", input: "bb",     desc: "Price exits Bollinger Band" },
  { id: "volume_surge",   label: "Volume Surge",            icon: "▲", input: "volume", desc: "Unusual volume detected" },
];
const MA_OPTIONS = ["9","20","50","100","200"];
const BB_OPTIONS = ["Upper Band","Lower Band"];
const DELIVERY   = [
  { id: "push", label: "Push", pro: false },{ id: "email", label: "Email", pro: false },
  { id: "sms",  label: "SMS",  pro: true  },{ id: "webhook", label: "Webhook", pro: true },
];

export default function AppPage() {
  const navigate = useNavigate();
  const { user, profile, isPro, signOut } = useAuth();
  const { alerts, history, loading, createAlert, deleteAlert, togglePause } = useAlerts();

  const [themeName, setThemeName] = useState("paper");
  const [tab,       setTab]       = useState("market");
  const [showModal, setShowModal] = useState(false);
  const [step,      setStep]      = useState(1);
  const [toast,     setToast]     = useState(null);
  const [marketData, setMarketData] = useState({});
  const [marketLoading, setMarketLoading] = useState(true);
  const [flashState,    setFlashState]    = useState({});
  const [search,        setSearch]        = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [watchlist,     setWatchlist]     = useState(() => {
    try { return JSON.parse(localStorage.getItem("ta-watchlist") || "[]"); } catch { return []; }
  });
  const [watchData,     setWatchData]     = useState({});

  const MARKET_SYMBOLS = [
    { id: "DIA",   label: "Dow 30",  symbol: "DIA"  },
    { id: "SPY",   label: "S&P 500", symbol: "SPY"  },
    { id: "VIXY",  label: "VIX",     symbol: "VIXY" },
    { id: "QQQ",   label: "Nasdaq",  symbol: "QQQ"  },
    { id: "UUP",   label: "DXY",     symbol: "UUP"  },
    { id: "IBIT",  label: "BTC/USD", symbol: "IBIT" },
    { id: "USO",   label: "USO",     symbol: "USO"  },
    { id: "GLD",   label: "Gold",    symbol: "GLD"  },
  ];

  // ── WebSocket real-time prices (Finnhub free tier: up to 50 symbols) ─────────
  useEffect(() => {
    const key = import.meta.env.VITE_FINNHUB_KEY || "";
    if (!key) { setMarketLoading(false); return; }

    let ws = null;
    let fallback = null;
    let destroyed = false;

    const symbolToId = Object.fromEntries(MARKET_SYMBOLS.map(m => [m.symbol, m.id]));

    // REST fallback — always runs every 15s regardless of WebSocket state
    async function loadInitialQuotes() {
      const results = await Promise.allSettled(
        MARKET_SYMBOLS.map(async (m) => {
          const res  = await fetch(`https://finnhub.io/api/v1/quote?symbol=${m.symbol}&token=${key}`);
          const data = await res.json();
          return { id: m.id, price: data.c, change: data.d, changePct: data.dp, prevClose: data.pc };
        })
      );
      const out = {};
      results.forEach((r, i) => { if (r.status === "fulfilled" && r.value.price) out[MARKET_SYMBOLS[i].id] = r.value; });
      if (Object.keys(out).length > 0) {
        setMarketData(prev => ({ ...prev, ...out }));
        setMarketLoading(false);
      }
    }

    // WebSocket with auto-reconnect
    function connectWS() {
      if (destroyed) return;
      ws = new WebSocket(`wss://ws.finnhub.io?token=${key}`);

      ws.onopen = () => {
        MARKET_SYMBOLS.forEach(m => ws.send(JSON.stringify({ type: "subscribe", symbol: m.symbol })));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type !== "trade" || !msg.data?.length) return;
          const updates = {};
          msg.data.forEach(trade => {
            const id = symbolToId[trade.s];
            if (!id) return;
            if (!updates[id] || trade.t > updates[id].t) updates[id] = { price: trade.p, t: trade.t };
          });
          if (Object.keys(updates).length > 0) {
            setMarketData(prev => {
              const next = { ...prev };
              const flashes = {};
              Object.entries(updates).forEach(([id, update]) => {
                if (next[id]) {
                  const oldPrice  = next[id].price;
                  const prevClose = next[id].prevClose || oldPrice;
                  const change    = update.price - prevClose;
                  const changePct = prevClose ? (change / prevClose) * 100 : 0;
                  next[id] = { ...next[id], price: update.price, change, changePct };
                  if (update.price > oldPrice) flashes[id] = "up";
                  else if (update.price < oldPrice) flashes[id] = "down";
                }
              });
              if (Object.keys(flashes).length > 0) {
                setFlashState(flashes);
                setTimeout(() => setFlashState({}), 600);
              }
              return next;
            });
          }
        } catch (e) {}
      };

      ws.onerror = () => console.warn("[WS] error");

      // Auto-reconnect after 3s if closed unexpectedly
      ws.onclose = () => {
        if (!destroyed) setTimeout(connectWS, 3000);
      };
    }

    // Start everything
    loadInitialQuotes();
    connectWS();
    fallback = setInterval(loadInitialQuotes, 15000);

    return () => {
      destroyed = true;
      clearInterval(fallback);
      if (ws) ws.close();
    };
  }, []);
  const [form, setForm] = useState({
    asset: "BTC/USD", trigger: null, value: "",
    ma: "50", bb: "Upper Band", volume: "3",
    delivery: ["push"], cooldown: "60",
  });

  const T    = THEMES[themeName];
  const font = { fontFamily: "'Roboto', sans-serif" };
  const mono = { fontFamily: "'Roboto', sans-serif" };

  const chipBtn = (active) => ({
    padding: "7px 14px", borderRadius: 7,
    border: `1px solid ${active ? T.accent : T.border}`,
    background: active ? T.accentBg : "transparent",
    color: active ? T.accent : T.textFaint,
    cursor: "pointer", ...font, fontSize: 17, transition: "all 0.15s",
  });

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Symbol search ──────────────────────────────────────────────────────────
  async function searchSymbols(q) {
    if (!q || q.length < 1) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const key = import.meta.env.VITE_FINNHUB_KEY || "";
      const res  = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${key}`);
      const data = await res.json();
      setSearchResults((data.result || []).slice(0, 8));
    } catch (e) { setSearchResults([]); }
    setSearchLoading(false);
  }

  function addToWatchlist(symbol, description) {
    const entry = { id: symbol, label: description ? description.slice(0, 20) : symbol, symbol };
    const updated = [entry, ...watchlist.filter(w => w.symbol !== symbol)].slice(0, 20);
    setWatchlist(updated);
    try { localStorage.setItem("ta-watchlist", JSON.stringify(updated)); } catch {}
    setSearch(""); setSearchResults([]);
    const key = import.meta.env.VITE_FINNHUB_KEY || "";
    fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`)
      .then(r => r.json())
      .then(data => {
        if (data.c) setWatchData(prev => ({ ...prev, [symbol]: { id: symbol, price: data.c, change: data.d, changePct: data.dp, prevClose: data.pc } }));
      });
    showToast(`${symbol} added to watchlist`);
  }

  function removeFromWatchlist(symbol) {
    const updated = watchlist.filter(w => w.symbol !== symbol);
    setWatchlist(updated);
    try { localStorage.setItem("ta-watchlist", JSON.stringify(updated)); } catch {}
  }

  function openModal(assetOverride) {
    if (!user) { navigate("/login"); return; }
    setStep(1);
    setForm(f => ({ ...f, trigger: null, value: "", ...(assetOverride ? { asset: assetOverride } : {}) }));
    setShowModal(true);
  }

  async function handleSaveAlert() {
    // Build trigger_value payload
    const tv = form.trigger?.input === "price"   ? { price: parseFloat(form.value) }
             : form.trigger?.input === "percent"  ? { percent: parseFloat(form.value) }
             : form.trigger?.input === "ma"       ? { ma_period: parseInt(form.ma) }
             : form.trigger?.input === "bb"       ? { band: form.bb === "Upper Band" ? "upper" : "lower" }
             : form.trigger?.input === "volume"   ? { volume_multiplier: parseInt(form.volume) }
             : {};

    const { error, upgrade } = await createAlert({
      asset:         form.asset,
      asset_type:    form.asset.includes("/") ? "crypto" : "stock",
      trigger_type:  form.trigger.id,
      trigger_value: tv,
      delivery:      form.delivery,
      cooldown_mins: parseInt(form.cooldown),
    });

    if (upgrade) {
      setShowModal(false);
      setTab("pricing");
      showToast("Upgrade to Pro to unlock this feature", "warn");
      return;
    }
    if (error) { showToast(error, "error"); return; }

    setShowModal(false);
    showToast("Alert created!");
  }

  async function handleUpgrade(priceId) {
    const { data, error } = await billingApi.createCheckout(priceId);
    if (error) { showToast(error, "error"); return; }
    window.location.href = data.url;  // redirect to Stripe Checkout
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: T.bg, ...font, color: T.text, position: "relative", overflowX: "hidden", transition: "background 0.3s" }}>
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />

      {/* Grid */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: `linear-gradient(${T.gridColor} 1px,transparent 1px),linear-gradient(90deg,${T.gridColor} 1px,transparent 1px)`,
        backgroundSize: "44px 44px" }} />

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 200,
          background: toast.type === "success" ? T.btnPrimary : toast.type === "warn" ? T.yellow : T.red,
          color: T.btnText, padding: "12px 20px", borderRadius: 10,
          ...font, fontSize: 18, boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ position: "relative", zIndex: 1, maxWidth: 820, margin: "0 auto", padding: "32px 20px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 52, color: "#cc2222", lineHeight: 1 }}>◈</span>
              <span style={{ fontSize: 56, letterSpacing: "1px" }}>
                <span style={{ color: T.text }}>TOP</span>
                <span style={{ color: "#1a8a44" }}>-</span>
                <span style={{ color: T.text }}>ALERTS</span>
              </span>
            </div>
            <div style={{ ...mono, fontSize: 9, letterSpacing: "3px", color: T.textFaint, marginTop: 2 }}>INTELLIGENT PRICE ALERTS</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Theme toggle */}
            <button onClick={() => setThemeName(t => t === "paper" ? "charcoal" : "paper")} style={{
              ...font, fontSize: 18, background: T.bgCard, border: `1px solid ${T.border}`,
              borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: T.textMid,
            }}>
              {T.icon}
            </button>

            {/* Plan badge */}
            <div style={{ ...mono, fontSize: 9, letterSpacing: "1.5px",
              background: isPro ? T.accentBg : "transparent",
              color: isPro ? T.accent : T.textFaint,
              border: `1px solid ${isPro ? T.accentBorder : T.border}`,
              padding: "6px 12px", borderRadius: 8 }}>
              {profile?.plan?.toUpperCase() || "FREE"}
            </div>

            {/* User + sign out */}
            {user ? (
              <button onClick={() => { signOut(); navigate("/"); }} style={{
                ...font, fontSize: 16, background: T.bgCard, border: `1px solid ${T.border}`,
                borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: T.textFaint,
              }}>
                {user?.email?.split("@")[0]} ↩
              </button>
            ) : (
              <button onClick={() => navigate("/login")} style={{
                ...font, fontSize: 18, background: T.btnPrimary, border: "none",
                borderRadius: 8, padding: "6px 16px", cursor: "pointer", color: T.btnText,
              }}>
                SIGN IN
              </button>
            )}
          </div>
        </div>

        {/* Pro banner */}
        {isPro && (
          <div style={{ background: T.proGradient, border: `1px solid ${T.accentBorder}`, borderRadius: 12, padding: "14px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 20 }}>⚡</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, color: T.accent }}>Pro Plan Active</div>
              <div style={{ ...mono, fontSize: 10, color: T.textFaint, marginTop: 2 }}>Advanced triggers · Multi-condition logic · Backtesting · Webhook delivery</div>
            </div>
            <div style={{ ...mono, fontSize: 9, color: T.textFaint, border: `1px solid ${T.border}`, padding: "4px 12px", borderRadius: 5 }}>UNLIMITED</div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", marginBottom: 28, borderBottom: `1px solid ${T.border}` }}>
          {["market","alerts","history","pricing"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "10px 22px", background: "none", border: "none", cursor: "pointer",
              ...font, fontSize: 20, letterSpacing: "1px",
              color: tab === t ? T.activeTab : T.textFaint,
              borderBottom: tab === t ? `2px solid ${T.activeTabBorder}` : "2px solid transparent",
              marginBottom: -1, transition: "all 0.2s",
            }}>
              {t.toUpperCase()}
            </button>
          ))}
          <button onClick={openModal} style={{
            marginLeft: "auto", padding: "8px 22px", background: T.btnPrimary, border: "none",
            borderRadius: 8, cursor: "pointer", ...font, fontSize: 20, color: T.btnText,
          }}>
            + NEW ALERT
          </button>
        </div>

        {/* Two-column layout for market tab */}
        <div style={{ display: "flex", gap: 20 }}>

          {/* Market sidebar — always visible */}
          <div style={{ width: 200, flexShrink: 0 }}>
            <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 10 }}>MARKETS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {MARKET_SYMBOLS.map(m => {
                const d = marketData[m.id];
                const up = d?.changePct >= 0;
                return (
                  <div key={m.id} style={{
                    background: T.bgCard, border: `1px solid ${T.border}`,
                    borderRadius: 9, padding: "10px 12px",
                    cursor: "pointer",
                    borderLeft: `3px solid ${!d ? T.border : up ? T.green : T.red}`,
                  }} onClick={() => { setForm(f => ({ ...f, asset: m.label })); openModal(); }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ ...font, fontSize: 16, color: T.text }}>{m.label}</span>
                      {d && <span style={{ ...mono, fontSize: 9, color: up ? T.green : T.red }}>
                        {up ? "▲" : "▼"} {Math.abs(d.changePct).toFixed(2)}%
                      </span>}
                    </div>
                    <div style={{ ...mono, fontSize: 11, marginTop: 2, color: flashState[m.id] === "up" ? T.green : flashState[m.id] === "down" ? T.red : T.textMid, transition: "color 0.4s" }}>
                      {marketLoading && !d ? "..." : d?.price ? `$${Number(d.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                    </div>
                  </div>
                );
              })}
              <div style={{ ...mono, fontSize: 9, color: T.textFaint, textAlign: "center", marginTop: 4 }}>
                Live · WebSocket
              </div>
            </div>
          </div>

          {/* Main content */}
          <div style={{ flex: 1, minWidth: 0 }}>

        {/* Market tab */}
        {tab === "market" && (
          <div>
            {/* Search bar */}
            <div style={{ position: "relative", marginBottom: 20 }}>
              <input
                type="text"
                placeholder="Search any symbol — AAPL, TSLA, ETH-USD..."
                value={search}
                onChange={e => { setSearch(e.target.value); searchSymbols(e.target.value); }}
                style={{
                  width: "100%", padding: "12px 16px", boxSizing: "border-box",
                  background: T.bgCard, border: `1px solid ${search ? T.accent : T.border}`,
                  borderRadius: 10, color: T.text, ...font, fontSize: 18,
                  outline: "none", transition: "border 0.2s",
                }}
              />
              {search && (
                <button onClick={() => { setSearch(""); setSearchResults([]); }} style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 18,
                }}>×</button>
              )}

              {/* Search results dropdown */}
              {(searchResults.length > 0 || searchLoading) && search && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50,
                  background: T.bgModal, border: `1px solid ${T.border}`, borderRadius: 10,
                  overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                }}>
                  {searchLoading && (
                    <div style={{ padding: "12px 16px", ...mono, fontSize: 11, color: T.textFaint }}>Searching...</div>
                  )}
                  {searchResults.map(r => (
                    <div key={r.symbol} onClick={() => addToWatchlist(r.symbol, r.description)} style={{
                      padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                      borderBottom: `1px solid ${T.border}`,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = T.bgDeep}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div style={{ ...mono, fontSize: 11, color: T.accent, minWidth: 60, fontWeight: 700 }}>{r.symbol}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ ...font, fontSize: 16, color: T.text }}>{(r.description || "").slice(0, 35)}</div>
                        <div style={{ ...mono, fontSize: 9, color: T.textFaint, marginTop: 1 }}>{r.type} · {r.displaySymbol}</div>
                      </div>
                      <div style={{ ...mono, fontSize: 9, color: T.accent, border: `1px solid ${T.accentBorder}`, padding: "2px 8px", borderRadius: 4 }}>+ ADD</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Watchlist (user-added symbols) */}
            {watchlist.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 10 }}>YOUR WATCHLIST</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {watchlist.map(m => {
                    const d   = watchData[m.symbol];
                    const up  = d?.changePct >= 0;
                    const col = !d ? T.border : up ? T.green : T.red;
                    return (
                      <div key={m.symbol} style={{
                        background: T.bgCard, border: `1px solid ${T.border}`,
                        borderLeft: `4px solid ${col}`, borderRadius: 11, padding: "14px 16px",
                        position: "relative",
                      }}>
                        <button onClick={() => removeFromWatchlist(m.symbol)} style={{
                          position: "absolute", top: 8, right: 10,
                          background: "none", border: "none", color: T.textFaint,
                          cursor: "pointer", fontSize: 14, lineHeight: 1,
                        }}>×</button>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingRight: 16 }}>
                          <div>
                            <div style={{ ...mono, fontSize: 11, color: T.accent, fontWeight: 700 }}>{m.symbol}</div>
                            <div style={{ ...font, fontSize: 16, color: T.text, marginTop: 2 }}>{m.label}</div>
                          </div>
                          {d && <div style={{ textAlign: "right" }}>
                            <div style={{ ...mono, fontSize: 10, color: col }}>{up ? "▲" : "▼"} {Math.abs(d.changePct || 0).toFixed(2)}%</div>
                          </div>}
                        </div>
                        <div style={{ ...font, fontSize: 24, color: T.text, marginTop: 6 }}>
                          {!d ? "Loading..." : d.price ? `$${Number(d.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                        </div>
                        <button onClick={() => openModal(m.symbol)} style={{
                          marginTop: 10, padding: "4px 12px", background: "none",
                          border: `1px solid ${T.accentBorder}`, borderRadius: 6,
                          cursor: "pointer", ...font, fontSize: 14, color: T.accent,
                        }}>+ SET ALERT</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 14 }}>MARKET OVERVIEW</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {MARKET_SYMBOLS.map(m => {
                const d = marketData[m.id];
                const up = d?.changePct >= 0;
                return (
                  <div key={m.id} style={{
                    background: T.bgCard, border: `1px solid ${T.border}`,
                    borderRadius: 11, padding: "16px 18px", position: "relative", overflow: "hidden",
                    borderLeft: `4px solid ${!d ? T.border : up ? T.green : T.red}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ ...font, fontSize: 20, color: T.text }}>{m.label}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.textFaint, marginTop: 2 }}>{m.symbol}</div>
                      </div>
                      {d && <div style={{ textAlign: "right" }}>
                        <div style={{ ...mono, fontSize: 10, color: up ? T.green : T.red, letterSpacing: 1 }}>
                          {up ? "▲" : "▼"} {Math.abs(d.changePct).toFixed(2)}%
                        </div>
                        <div style={{ ...mono, fontSize: 10, color: T.textFaint, marginTop: 2 }}>
                          {up ? "+" : ""}{d.change?.toFixed(2)}
                        </div>
                      </div>}
                    </div>
                    <div style={{ ...font, fontSize: 26, marginTop: 10, color: flashState[m.id] === "up" ? T.green : flashState[m.id] === "down" ? T.red : T.text, transition: "color 0.4s" }}>
                      {marketLoading && !d ? "Loading..." : d?.price ? `$${Number(d.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                    </div>
                    {d?.prevClose && <div style={{ ...mono, fontSize: 9, color: T.textFaint, marginTop: 4 }}>
                      Prev close: ${Number(d.prevClose).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>}
                    <button onClick={() => { setForm(f => ({ ...f, asset: m.label })); openModal(); }} style={{
                      marginTop: 12, padding: "6px 14px", background: "none",
                      border: `1px solid ${T.accentBorder}`, borderRadius: 6,
                      cursor: "pointer", ...font, fontSize: 15, color: T.accent,
                    }}>
                      + SET ALERT
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Alerts tab */}
        {tab === "alerts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading && <div style={{ textAlign: "center", padding: 60, color: T.textFaint, fontSize: 18 }}>Loading...</div>}
            {!loading && alerts.filter(a => a.status !== "deleted").map((a) => (
              <div key={a.id} style={{
                background: T.bgCard,
                border: `1px solid ${a.status === "triggered" ? T.red + "55" : a.status === "paused" ? T.border : T.border}`,
                borderRadius: 11, padding: "18px 22px", display: "flex", alignItems: "center", gap: 16,
                position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${T.accent},transparent)` }} />
                <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  background: a.status === "triggered" ? T.red : a.status === "paused" ? T.textFaint : T.green,
                  boxShadow: a.status === "triggered" ? T.redGlow : a.status === "paused" ? "none" : T.greenGlow }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{a.asset}</span>
                    {a.is_multi && <span style={{ ...mono, fontSize: 9, background: "rgba(100,180,255,0.1)", color: "#6ab4ff", padding: "2px 7px", borderRadius: 3, letterSpacing: 1 }}>MULTI</span>}
                  </div>
                  <div style={{ ...mono, fontSize: 11, color: T.textFaint, marginTop: 3 }}>
                    {a.trigger_type?.replace(/_/g," ")}
                    {a.fire_count > 0 && <span style={{ marginLeft: 10, color: T.accent }}>Fired {a.fire_count}×</span>}
                    {a.last_fired_at && <span style={{ marginLeft: 8, color: T.textFaint }}>Last: {new Date(a.last_fired_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <button onClick={() => togglePause(a.id)} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 6, color: T.textFaint, cursor: "pointer", ...font, fontSize: 14, padding: "4px 10px" }}>
                  {a.status === "paused" ? "▶" : "⏸"}
                </button>
                <div style={{ ...mono, fontSize: 10, letterSpacing: 1,
                  color: a.status === "triggered" ? T.red : a.status === "paused" ? T.textFaint : T.green,
                  border: `1px solid ${a.status === "triggered" ? T.red + "55" : T.border}`,
                  padding: "4px 10px", borderRadius: 4 }}>
                  {a.status.toUpperCase()}
                </div>
                <button onClick={() => deleteAlert(a.id)} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
              </div>
            ))}
            {!loading && alerts.filter(a => a.status !== "deleted").length === 0 && (
              <div style={{ textAlign: "center", padding: 60, color: T.textFaint, fontSize: 18 }}>No alerts yet — create one above</div>
            )}
          </div>
        )}

        {/* History tab */}
        {tab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {history.map((h, i) => (
              <div key={i} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 11, padding: "18px 22px", display: "flex", alignItems: "center", gap: 16, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${T.accent},transparent)` }} />
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.accent, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 20 }}>{h.asset}</div>
                  <div style={{ ...mono, fontSize: 11, color: T.textFaint, marginTop: 3 }}>{h.trigger_type?.replace(/_/g," ")}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ ...mono, fontSize: 11, color: T.textFaint }}>{new Date(h.fired_at).toLocaleString()}</div>
                  {h.price_at_fire && <div style={{ ...mono, fontSize: 11, color: T.accent, marginTop: 2 }}>${Number(h.price_at_fire).toLocaleString()}</div>}
                </div>
              </div>
            ))}
            {history.length === 0 && <div style={{ textAlign: "center", padding: 60, color: T.textFaint, fontSize: 18 }}>No history yet</div>}
          </div>
        )}

        {/* Pricing tab */}
        {tab === "pricing" && (
          <PricingPage T={T} font={font} mono={mono} currentPlan={profile?.plan || "free"} onUpgrade={handleUpgrade} />
        )}

        </div>{/* end main content */}
        </div>{/* end two-column layout */}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={{ background: T.bgModal, border: `1px solid ${T.border}`, borderRadius: 18, width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 40px 80px rgba(0,0,0,0.25)" }}>

            {/* Modal header */}
            <div style={{ padding: "20px 28px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: T.bgModal, zIndex: 10, borderRadius: "18px 18px 0 0" }}>
              <div>
                <div style={{ fontSize: 22 }}>{step === 1 ? "Choose Trigger" : step === 2 ? "Configure" : "Delivery"}</div>
                <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
                  {[1,2,3].map(s => <div key={s} style={{ width: s <= step ? 22 : 7, height: 4, borderRadius: 2, background: s <= step ? T.accent : T.border, transition: "all 0.3s" }} />)}
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 24 }}>×</button>
            </div>

            {/* Step 1 — Asset + Trigger */}
            {step === 1 && (
              <div style={{ padding: "22px 28px" }}>
                <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 8 }}>ASSET</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
                  {ASSETS.map(a => <button key={a} onClick={() => setForm(f => ({ ...f, asset: a }))} style={chipBtn(form.asset === a)}>{a}</button>)}
                </div>
                <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 8 }}>FREE TRIGGERS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                  {FREE_TRIGGERS.map(t => (
                    <button key={t.id} onClick={() => { setForm(f => ({ ...f, trigger: t })); setStep(2); }} style={{
                      padding: "11px 16px", borderRadius: 9,
                      border: `1px solid ${form.trigger?.id === t.id ? T.accent : T.border}`,
                      background: form.trigger?.id === t.id ? T.accentBg : T.bgDeep,
                      color: T.text, cursor: "pointer", ...font, fontSize: 17,
                      textAlign: "left", display: "flex", gap: 10, alignItems: "center",
                    }}>
                      <span style={{ width: 22 }}>{t.icon}</span>
                      <div>
                        <div>{t.label}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.textFaint }}>{t.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: isPro ? T.accent + "88" : T.border, marginBottom: 8 }}>PRO TRIGGERS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {PRO_TRIGGERS.map(t => (
                    <button key={t.id} onClick={() => { if (!isPro) { setShowModal(false); setTab("pricing"); showToast("Pro plan required", "warn"); return; } setForm(f => ({ ...f, trigger: t })); setStep(2); }} style={{
                      padding: "11px 16px", borderRadius: 9,
                      border: `1px solid ${form.trigger?.id === t.id ? T.accent : T.border}`,
                      background: form.trigger?.id === t.id ? T.accentBg : T.bgDeep,
                      color: isPro ? T.text : T.border,
                      cursor: "pointer", ...font, fontSize: 17,
                      textAlign: "left", display: "flex", gap: 10, alignItems: "center",
                    }}>
                      <span style={{ width: 22, opacity: isPro ? 1 : 0.3 }}>{t.icon}</span>
                      <span style={{ flex: 1 }}>{t.label}</span>
                      {!isPro && <span style={{ ...mono, fontSize: 9, color: T.border, border: `1px solid ${T.border}`, padding: "2px 6px", borderRadius: 3 }}>PRO</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2 — Configure value */}
            {step === 2 && form.trigger && (
              <div style={{ padding: "22px 28px" }}>
                <div style={{ background: T.bgDeep, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 18px", marginBottom: 22, display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 24 }}>{form.trigger.icon}</span>
                  <div>
                    <div style={{ ...mono, fontSize: 10, color: T.textFaint }}>{form.asset}</div>
                    <div style={{ fontSize: 20 }}>{form.trigger.label}</div>
                  </div>
                </div>

                {form.trigger.input === "price" && (
                  <div>
                    <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 8 }}>TARGET PRICE (USD)</div>
                    <input type="number" placeholder="0.00" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                      style={{ width: "100%", padding: "12px 14px", background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, ...font, fontSize: 20, outline: "none", boxSizing: "border-box" }} />
                  </div>
                )}
                {form.trigger.input === "percent" && (
                  <div>
                    <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 8 }}>% CHANGE THRESHOLD</div>
                    <input type="number" placeholder="5" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                      style={{ width: "100%", padding: "12px 14px", background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, ...font, fontSize: 20, outline: "none", boxSizing: "border-box" }} />
                  </div>
                )}
                {form.trigger.input === "ma" && (
                  <div>
                    <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 10 }}>MOVING AVERAGE PERIOD</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {MA_OPTIONS.map(m => <button key={m} onClick={() => setForm(f => ({ ...f, ma: m }))} style={{ ...chipBtn(form.ma === m), flex: 1, padding: "10px 0", textAlign: "center" }}>{m}D</button>)}
                    </div>
                  </div>
                )}
                {form.trigger.input === "bb" && (
                  <div>
                    <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 10 }}>BAND</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {BB_OPTIONS.map(b => <button key={b} onClick={() => setForm(f => ({ ...f, bb: b }))} style={{ ...chipBtn(form.bb === b), flex: 1, padding: "10px 0", textAlign: "center" }}>{b}</button>)}
                    </div>
                  </div>
                )}
                {form.trigger.input === "volume" && (
                  <div>
                    <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 10 }}>SURGE MULTIPLIER</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {["2","3","5","10"].map(v => <button key={v} onClick={() => setForm(f => ({ ...f, volume: v }))} style={{ ...chipBtn(form.volume === v), flex: 1, padding: "10px 0", textAlign: "center" }}>{v}×</button>)}
                    </div>
                  </div>
                )}
                {form.trigger.input === null && (
                  <div style={{ background: T.accentBg, border: `1px solid ${T.accentBorder}`, borderRadius: 10, padding: 20, textAlign: "center", ...mono, fontSize: 11, color: T.textMid }}>
                    This trigger fires automatically — no configuration needed.
                  </div>
                )}

                <button onClick={() => setStep(3)} style={{ marginTop: 22, width: "100%", padding: 12, background: T.btnPrimary, border: "none", borderRadius: 9, cursor: "pointer", ...font, fontSize: 20, color: T.btnText }}>
                  CONTINUE →
                </button>
              </div>
            )}

            {/* Step 3 — Delivery */}
            {step === 3 && (
              <div style={{ padding: "22px 28px" }}>
                <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 12 }}>DELIVERY METHOD</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 22 }}>
                  {DELIVERY.map(d => {
                    const blocked = d.pro && !isPro;
                    const active  = form.delivery.includes(d.id) && !blocked;
                    return (
                      <button key={d.id} onClick={() => !blocked && setForm(f => ({ ...f, delivery: active ? f.delivery.filter(x => x !== d.id) : [...f.delivery, d.id] }))} style={{
                        padding: "13px 16px", borderRadius: 9,
                        border: `1px solid ${active ? T.accent : T.border}`,
                        background: active ? T.accentBg : T.bgDeep,
                        color: blocked ? T.border : active ? T.accent : T.textMid,
                        cursor: blocked ? "not-allowed" : "pointer", ...font, fontSize: 18,
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}>
                        {d.label}
                        {blocked ? <span style={{ ...mono, fontSize: 9, color: T.border, border: `1px solid ${T.border}`, padding: "2px 5px", borderRadius: 3 }}>PRO</span>
                          : active ? <span style={{ color: T.accent }}>✓</span> : null}
                      </button>
                    );
                  })}
                </div>

                {isPro && (
                  <>
                    <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 10 }}>COOLDOWN</div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
                      {[["15","15m"],["60","1h"],["240","4h"],["1440","24h"]].map(([v,l]) => (
                        <button key={v} onClick={() => setForm(f => ({ ...f, cooldown: v }))} style={{ ...chipBtn(form.cooldown === v), flex: 1, padding: "10px 0", textAlign: "center" }}>{l}</button>
                      ))}
                    </div>
                  </>
                )}

                <button onClick={handleSaveAlert} style={{ width: "100%", padding: 13, background: T.btnPrimary, border: "none", borderRadius: 9, cursor: "pointer", ...font, fontSize: 20, color: T.btnText }}>
                  SAVE ALERT
                </button>
                <button onClick={() => setStep(2)} style={{ marginTop: 8, width: "100%", padding: 10, background: "none", border: "none", color: T.textFaint, cursor: "pointer", ...font, fontSize: 16 }}>← Back</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pricing page (inline) ─────────────────────────────────────────────────────

function PricingPage({ T, font, mono, currentPlan, onUpgrade }) {
  const tiers = [
    { id: "free", name: "Free", price: "$0", period: "/mo", desc: "For casual watchers",
      features: ["3 active alerts","Price above/below","% change alerts","Push & Email"], cta: "Current Plan", priceId: null },
    { id: "pro", name: "Pro", price: "$9", period: "/mo", desc: "For serious traders", badge: "POPULAR",
      features: ["Unlimited alerts","All 12 trigger types","Multi-condition AND/OR","90-day backtesting","SMS & Webhook","Alert cooldown","Priority delivery"], cta: "Upgrade to Pro", priceId: import.meta.env.VITE_STRIPE_PRO_PRICE_ID },
    { id: "team", name: "Team", price: "$49", period: "/mo", desc: "For trading desks",
      features: ["Everything in Pro","5 team members","Shared alert library","Slack & Discord","API access","Priority support"], cta: "Contact Sales", priceId: import.meta.env.VITE_STRIPE_TEAM_PRICE_ID },
  ];

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 28, color: T.text }}>Simple, transparent pricing</div>
        <div style={{ ...mono, fontSize: 11, color: T.textFaint, marginTop: 6 }}>Start free. Upgrade when you're ready.</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        {tiers.map(t => {
          const isCurrent = currentPlan === t.id;
          const isHL = t.id === "pro";
          return (
            <div key={t.id} style={{ background: T.bgCard, border: `1px solid ${isHL ? T.accent+"66" : T.border}`, borderRadius: 14, padding: "22px 18px", position: "relative", overflow: "hidden" }}>
              {isHL && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${T.accent},transparent)` }} />}
              {t.badge && <div style={{ position: "absolute", top: 12, right: 12, ...mono, fontSize: 8, letterSpacing: "1.5px", color: T.accent, background: T.accentBg, border: `1px solid ${T.accentBorder}`, padding: "3px 7px", borderRadius: 4 }}>{t.badge}</div>}
              <div style={{ ...mono, fontSize: 10, fontWeight: 700, color: isHL ? T.accent : T.textMid, letterSpacing: 1, marginBottom: 6 }}>{t.name.toUpperCase()}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 4 }}>
                <span style={{ fontSize: 32, color: T.text }}>{t.price}</span>
                <span style={{ ...mono, fontSize: 11, color: T.textFaint }}>{t.period}</span>
              </div>
              <div style={{ ...mono, fontSize: 11, color: T.textFaint, marginBottom: 18 }}>{t.desc}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
                {t.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: 8 }}>
                    <span style={{ color: isHL ? T.accent : T.green, ...mono, fontSize: 11, flexShrink: 0 }}>✓</span>
                    <span style={{ ...mono, fontSize: 11, color: T.textMid, lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => !isCurrent && t.priceId && onUpgrade(t.priceId)} disabled={isCurrent || !t.priceId} style={{
                width: "100%", padding: "11px 0", borderRadius: 8,
                cursor: isCurrent || !t.priceId ? "default" : "pointer",
                ...font, fontSize: 18,
                border: isHL ? "none" : `1px solid ${T.border}`,
                background: isCurrent ? T.bgDeep : isHL ? T.btnPrimary : "transparent",
                color: isCurrent ? T.textFaint : isHL ? T.btnText : T.textMid,
              }}>
                {isCurrent ? "✓ CURRENT PLAN" : t.cta.toUpperCase()}
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: "center", marginTop: 24, ...mono, fontSize: 10, color: T.textFaint }}>
        14-day money-back guarantee · No credit card required for Free
      </div>
    </div>
  );
}
