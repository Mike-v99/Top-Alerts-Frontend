// src/pages/App.jsx
//
// This is the existing Top-Alerts UI (price-alert-app-v3.jsx) wired to live data.
// useAlerts() replaces all mock state. useAuth() gates Pro features.

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth }   from "../context/AuthContext.jsx";
import { useAlerts } from "../hooks/useAlerts.js";
import { billingApi } from "../api/client.js";

// ── Themes (same as v3) ───────────────────────────────────────────────────────
const THEMES = {
  paper: {
    bg: "#faf9f6", bgCard: "#f4f2ed", bgDeep: "#ede9e0", bgModal: "#f4f2ed", bgInput: "#ede9e0",
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

  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [mobileExpanded, setMobileExpanded] = useState(null); // symbol of expanded ticker
  const [mobileNewsOpen, setMobileNewsOpen] = useState(false);
  const [mobileChartFull, setMobileChartFull] = useState(false); // fullscreen chart overlay
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
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
  const [chartSymbol,   setChartSymbol]   = useState(null);
  const [chartRange,    setChartRange]    = useState("1D");
  const [chartData,     setChartData]     = useState([]);
  const [chartLoading,  setChartLoading]  = useState(false);
  const [chartLabel,    setChartLabel]    = useState("Dow 30");
  const chartPanelRef = useRef(null);
  const [flyingCard,   setFlyingCard]   = useState(null); // {x,y,label,symbol}
  const [tickerDetails, setTickerDetails] = useState(null); // { name, description, sic_description, market_cap, ... }
  const [week52Data,    setWeek52Data]    = useState(null); // { high, low, yearChange }
  const [tickerNews,    setTickerNews]    = useState([]);
  const [newsLoading,   setNewsLoading]   = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [modalSource,      setModalSource]      = useState("standalone"); // "card" | "standalone"
  const [modalAssetLabel,  setModalAssetLabel]  = useState(""); // display name from card
  const [modalSymbolSearch, setModalSymbolSearch] = useState("");
  const [modalSearchResults, setModalSearchResults] = useState([]);
  const [modalSearchLoading, setModalSearchLoading] = useState(false);
  const [modalPrice,  setModalPrice]  = useState(null); // { price, change, changePct, marketOpen }

  // ── Calendar state ─────────────────────────────────────────────────────────
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }; });
  const [calSelectedDay, setCalSelectedDay] = useState(new Date().getDate());
  const [calEvents, setCalEvents] = useState([]); // merged array of all event types
  const [calLoading, setCalLoading] = useState(false);
  const [calFilters, setCalFilters] = useState({ earnings: true, economic: true, ipo: true, split: true, dividend: true, holiday: true });
  const [calEventAlert, setCalEventAlert] = useState(null); // event object for alert popup
  const [calAlertTiming, setCalAlertTiming] = useState("1day"); // "15min" | "1hr" | "1day" | "after"
  const [calCollapsed, setCalCollapsed] = useState({}); // { earnings: true, ipo: true, ... }

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

  // ── Massive.com real-time prices ─────────────────────────────────────────────
  useEffect(() => {
    const key = import.meta.env.VITE_MASSIVE_KEY || "";
    if (!key) { setMarketLoading(false); return; }

    let ws = null;
    let fallback = null;
    let destroyed = false;

    const symbolToId = Object.fromEntries(MARKET_SYMBOLS.map(m => [m.symbol, m.id]));

    // Fetch snapshot for multiple symbols in one call
    async function fetchSnapshots(symbols) {
      try {
        const tickers = symbols.join(",");
        const res  = await fetch(`https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers}&apiKey=${key}`);
        const data = await res.json();
        return (data.tickers || []).map(t => {
          const price = t.lastTrade?.p || t.day?.c || t.min?.c || 0;
          return {
            id: symbolToId[t.ticker] || t.ticker,
            symbol: t.ticker,
            price,
            change: t.todaysChange || 0,
            changePct: t.todaysChangePerc || 0,
            prevClose: t.prevDay?.c || 0,
            high: t.day?.h || 0,
            low: t.day?.l || 0,
            open: t.day?.o || 0,
            volume: t.day?.v || 0,
            prevVolume: t.prevDay?.v || 0,
          };
        }).filter(r => r.price !== 0);
      } catch (e) {
        console.error("[Massive] snapshot error", e);
        return [];
      }
    }

    // Load all market symbols in one batch request
    async function loadInitialQuotes() {
      const results = await fetchSnapshots(MARKET_SYMBOLS.map(m => m.symbol));
      if (results.length > 0) {
        const out = {};
        results.forEach(r => { out[r.id] = r; });
        setMarketData(prev => ({ ...prev, ...out }));
        setMarketLoading(false);
      }
    }

    // Fetch watchlist symbols in one batch
    async function loadWatchlistQuotes(saved) {
      if (!saved.length) return;
      const results = await fetchSnapshots(saved.map(m => m.symbol));
      results.forEach(r => {
        setWatchData(prev => ({ ...prev, [r.symbol]: r }));
      });
    }

    // Massive WebSocket — true tick-by-tick from all US exchanges
    function connectWS() {
      if (destroyed) return;
      ws = new WebSocket(`wss://delayed.polygon.io/stocks`);

      ws.onopen = () => {
        ws.send(JSON.stringify({ action: "auth", params: key }));
      };

      ws.onmessage = (event) => {
        console.log("[WS]", event.data.slice(0, 150));
        try {
          const msgs = JSON.parse(event.data);
          msgs.forEach(msg => {
            // After auth success, subscribe to all symbols
            if (msg.ev === "status" && msg.status === "auth_success") {
              const subs = MARKET_SYMBOLS.map(m => `A.${m.symbol}`).join(",");
              ws.send(JSON.stringify({ action: "subscribe", params: subs }));
            }
            // Per-second aggregate event (smoother than raw trades)
            if (msg.ev === "A") {
              const id = symbolToId[msg.sym];
              if (!id) return;
              setMarketData(prev => {
                if (!prev[id]) return prev;
                const oldPrice  = prev[id].price;
                const prevClose = prev[id].prevClose || oldPrice;
                const newPrice  = msg.c || msg.vw || msg.p;
                const change    = newPrice - prevClose;
                const changePct = prevClose ? (change / prevClose) * 100 : 0;
                const dir = newPrice > oldPrice ? "up" : newPrice < oldPrice ? "down" : null;
                if (dir) {
                  setFlashState(f => ({ ...f, [id]: dir }));
                  setTimeout(() => setFlashState(f => { const n = {...f}; delete n[id]; return n; }), 700);
                }
                return { ...prev, [id]: { ...prev[id], price: newPrice, change, changePct } };
              });
            }
          });
        } catch (e) {}
      };

      ws.onerror = (e) => console.warn("[WS] error", e);
      ws.onclose = (e) => { console.log("[WS] closed", e.code, e.reason); if (!destroyed) setTimeout(connectWS, 3000); };
    }

    // Start everything
    loadInitialQuotes();
    connectWS();
    fallback = setInterval(loadInitialQuotes, 30000);

    // Load watchlist on mount
    const saved = (() => { try { return JSON.parse(localStorage.getItem("ta-watchlist") || "[]"); } catch { return []; } })();
    loadWatchlistQuotes(saved);

    return () => {
      destroyed = true;
      clearInterval(fallback);
      if (ws) ws.close();
    };
  }, []);

  // Default chart to DIA on mount
  useEffect(() => {
    setChartSymbol("DIA");
    setChartRange("1D");
    fetchChart("DIA", "1D");
    fetchTickerDetails("DIA");
    fetchTickerNews("DIA");
    fetch52Week("DIA");
  }, []);

  const [form, setForm] = useState({
    asset: "BTC/USD", trigger: null, value: "",
    ma: "50", bb: "Upper Band", volume: "3",
    delivery: ["push"], cooldown: "60", webhook_url: "",
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
      const key = import.meta.env.VITE_MASSIVE_KEY || "";
      const res  = await fetch(`https://api.massive.com/v3/reference/tickers?search=${encodeURIComponent(q)}&active=true&market=stocks&limit=8&apiKey=${key}`);
      const data = await res.json();
      const results = (data.results || []).map(r => ({
        symbol: r.ticker,
        description: r.name,
        type: r.type,
        displaySymbol: r.ticker,
      }));
      setSearchResults(results);
    } catch (e) { setSearchResults([]); }
    setSearchLoading(false);
  }

  // ── Chart data ────────────────────────────────────────────────────────────────────────
  async function fetchChart(symbol, range) {
    setChartLoading(true);
    setChartData([]);
    try {
      const key = import.meta.env.VITE_MASSIVE_KEY || "";
      const now   = new Date();
      const pad   = n => String(n).padStart(2, "0");
      const fmt   = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      const mapR  = r => ({ t: r.t, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v });
      const getAggs = (mult, span, f, t) =>
        fetch(`https://api.massive.com/v2/aggs/ticker/${symbol}/range/${mult}/${span}/${f}/${t}?adjusted=true&sort=asc&limit=300&apiKey=${key}`)
          .then(r => r.json()).then(d => d.results || []).catch(() => []);

      if (range === "15m") {
        // 5 day chart — 15 min candles
        const start = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
        const results = await getAggs(15, "minute", fmt(start), fmt(now));
        if (results.length) setChartData(results.map(mapR));
      } else if (range === "1D") {
        // 1 month chart — daily candles
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const results = await getAggs(1, "day", fmt(start), fmt(now));
        if (results.length) setChartData(results.map(mapR));
      } else if (range === "1W") {
        // 1 year chart — weekly candles
        const start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        const results = await getAggs(1, "week", fmt(start), fmt(now));
        if (results.length) setChartData(results.map(mapR));
      } else {
        // 5 year chart — fetch 3 chunks of ~20 monthly candles each and stitch
        const yr = now.getFullYear();
        const mo = pad(now.getMonth() + 1);
        const chunks = await Promise.all([
          getAggs(1, "month", `${yr - 5}-01-01`, `${yr - 3}-01-01`),
          getAggs(1, "month", `${yr - 3}-01-01`, `${yr - 1}-01-01`),
          getAggs(1, "month", `${yr - 1}-01-01`, `${yr}-${mo}-${pad(now.getDate())}`),
        ]);
        const merged = Object.values(
          chunks.flat().reduce((acc, r) => { acc[r.t] = r; return acc; }, {})
        ).sort((a, b) => a.t - b.t);
        if (merged.length) setChartData(merged.map(mapR));
      }
    } catch (e) { console.error("Chart fetch failed", e); }
    setChartLoading(false);
  }

  // ── Ticker details (company info) ──────────────────────────────────────────
  async function fetchTickerDetails(symbol) {
    try {
      const key = import.meta.env.VITE_MASSIVE_KEY || "";
      const res = await fetch(`https://api.massive.com/v3/reference/tickers/${symbol}?apiKey=${key}`);
      const data = await res.json();
      if (data.results) setTickerDetails(data.results);
    } catch (e) { console.error("Ticker details failed", e); }
  }

  // ── 52-week data ─────────────────────────────────────────────────────────
  async function fetch52Week(symbol) {
    setWeek52Data(null);
    try {
      const key = import.meta.env.VITE_MASSIVE_KEY || "";
      const now = new Date();
      const pad = n => String(n).padStart(2, "0");
      const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      const start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const res = await fetch(`https://api.massive.com/v2/aggs/ticker/${symbol}/range/1/week/${fmt(start)}/${fmt(now)}?adjusted=true&sort=asc&limit=60&apiKey=${key}`);
      const data = await res.json();
      const results = data.results || [];
      if (results.length > 0) {
        const high = Math.max(...results.map(r => r.h));
        const low = Math.min(...results.map(r => r.l));
        const firstClose = results[0].c;
        const lastClose = results[results.length - 1].c;
        const yearChange = firstClose ? ((lastClose - firstClose) / firstClose) * 100 : 0;
        setWeek52Data({ high, low, yearChange });
      }
    } catch (e) { console.error("52-week fetch failed", e); }
  }

  // ── Ticker news ────────────────────────────────────────────────────────────
  async function fetchTickerNews(symbol) {
    setNewsLoading(true);
    setTickerNews([]);
    try {
      const key = import.meta.env.VITE_MASSIVE_KEY || "";
      const res = await fetch(`https://api.massive.com/v2/reference/news?ticker=${symbol}&limit=6&sort=published_utc&order=desc&apiKey=${key}`);
      const data = await res.json();
      if (data.results) {
        console.log("[News] First article fields:", data.results[0] ? Object.keys(data.results[0]) : "none");
        console.log("[News] First article URL:", data.results[0]?.article_url || data.results[0]?.url || "NO URL FIELD");
        setTickerNews(data.results);
      }
    } catch (e) { console.error("Ticker news failed", e); }
    setNewsLoading(false);
  }

  // ── Known US Economic Events (fallback when API doesn't provide) ──────
  function getKnownEconomicEvents(year, month) {
    const pad = n => String(n).padStart(2, "0");
    const m = pad(month + 1);
    const events = [];
    const add = (day, label, impact, time, prev, est) => {
      events.push({ type: "economic", date: `${year}-${m}-${pad(day)}`, label, impact, time, prev: prev ?? null, est: est ?? null, actual: null, country: "US" });
    };

    const nthWeekday = (n, dow) => {
      let count = 0;
      for (let d = 1; d <= 31; d++) {
        const dt = new Date(year, month, d);
        if (dt.getMonth() !== month) break;
        if (dt.getDay() === dow) { count++; if (count === n) return d; }
      }
      return null;
    };
    const firstFriday = nthWeekday(1, 5);
    const secondWed = nthWeekday(2, 3);
    const thirdWed = nthWeekday(3, 3);
    const lastFriday = (() => { for (let d = 31; d >= 1; d--) { const dt = new Date(year, month, d); if (dt.getMonth() === month && dt.getDay() === 5) return d; } return null; })();

    // Nonfarm Payrolls — first Friday
    if (firstFriday) add(firstFriday, "Nonfarm Payrolls", "high", "8:30 AM", "143K", "160K");
    if (firstFriday) add(firstFriday, "Unemployment Rate", "high", "8:30 AM", "4.0%", "4.0%");

    // CPI — typically 2nd or 3rd week
    const cpiDay = nthWeekday(2, 3) || nthWeekday(2, 2);
    if (cpiDay) add(cpiDay, "CPI (YoY)", "high", "8:30 AM", "2.8%", "2.9%");
    if (cpiDay) add(cpiDay, "Core CPI (MoM)", "high", "8:30 AM", "0.3%", "0.3%");

    // PPI — day after CPI
    if (cpiDay && cpiDay + 1 <= new Date(year, month + 1, 0).getDate()) add(cpiDay + 1, "PPI (MoM)", "medium", "8:30 AM", "0.3%", "0.2%");

    // Retail Sales
    const retailDay = nthWeekday(3, 2) || 16;
    if (retailDay <= new Date(year, month + 1, 0).getDate()) add(retailDay, "Retail Sales (MoM)", "high", "8:30 AM", "0.4%", "0.3%");

    // FOMC
    const fomcMonths = [0, 2, 4, 5, 6, 8, 10, 11];
    if (fomcMonths.includes(month)) {
      const fomcDay = thirdWed || nthWeekday(3, 3);
      if (fomcDay) {
        add(fomcDay, "FOMC Rate Decision", "high", "2:00 PM", "4.50%", "4.50%");
        add(fomcDay, "Fed Press Conference", "high", "2:30 PM");
      }
    }

    // GDP
    const gdpMonths = [0, 3, 6, 9];
    const gdpAdvMonths = [1, 4, 7, 10];
    const gdpFinalMonths = [2, 5, 8, 11];
    if (gdpMonths.includes(month) || gdpAdvMonths.includes(month) || gdpFinalMonths.includes(month)) {
      const gdpLabel = gdpMonths.includes(month) ? "GDP (Advance)" : gdpAdvMonths.includes(month) ? "GDP (Second Est.)" : "GDP (Final)";
      const gdpDay = nthWeekday(4, 4) || 27;
      if (gdpDay <= new Date(year, month + 1, 0).getDate()) add(gdpDay, gdpLabel, "high", "8:30 AM", "2.3%", "2.4%");
    }

    // PCE — last Friday
    if (lastFriday) add(lastFriday, "Core PCE Price Index", "high", "8:30 AM", "0.3%", "0.2%");

    // Jobless Claims — every Thursday
    for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) {
      if (new Date(year, month, d).getDay() === 4) add(d, "Initial Jobless Claims", "medium", "8:30 AM", "219K", "215K");
    }

    // Consumer Confidence — last Tuesday
    const lastTuesday = (() => { for (let d = 31; d >= 1; d--) { const dt = new Date(year, month, d); if (dt.getMonth() === month && dt.getDay() === 2) return d; } return null; })();
    if (lastTuesday) add(lastTuesday, "Consumer Confidence", "medium", "10:00 AM", "98.3", "96.0");

    // ISM Manufacturing — first business day
    const firstBizDay = (() => { for (let d = 1; d <= 5; d++) { const dt = new Date(year, month, d); if (dt.getDay() >= 1 && dt.getDay() <= 5) return d; } return 1; })();
    add(firstBizDay, "ISM Manufacturing PMI", "high", "10:00 AM", "50.9", "50.5");

    // Michigan Consumer Sentiment — 2nd Friday
    const secondFriday = nthWeekday(2, 5);
    if (secondFriday) add(secondFriday, "Michigan Consumer Sentiment (Prelim)", "medium", "10:00 AM", "64.7", "63.0");

    // ADP Employment — first Wednesday
    const firstWed = nthWeekday(1, 3);
    if (firstWed) add(firstWed, "ADP Employment Change", "medium", "8:15 AM", "183K", "150K");

    // Durable Goods — ~4th week
    const durableDay = nthWeekday(4, 3) || 25;
    if (durableDay <= new Date(year, month + 1, 0).getDate()) add(durableDay, "Durable Goods Orders (MoM)", "medium", "8:30 AM", "3.2%", "-1.0%");

    // Existing Home Sales — ~3rd week
    const homeSaleDay = nthWeekday(3, 4) || 20;
    if (homeSaleDay <= new Date(year, month + 1, 0).getDate()) add(homeSaleDay, "Existing Home Sales", "medium", "10:00 AM", "4.08M", "4.13M");

    // New Home Sales — ~4th week
    const newHomeDay = nthWeekday(4, 2) || 24;
    if (newHomeDay <= new Date(year, month + 1, 0).getDate()) add(newHomeDay, "New Home Sales", "medium", "10:00 AM", "664K", "680K");

    return events;
  }

  // ── Calendar data fetching ──────────────────────────────────────────────
  async function fetchCalendarData(year, month) {
    setCalLoading(true);
    const key = import.meta.env.VITE_FINNHUB_KEY || "";
    if (!key) { setCalLoading(false); return; }
    const pad = n => String(n).padStart(2, "0");
    const from = `${year}-${pad(month + 1)}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${pad(month + 1)}-${pad(lastDay)}`;
    const base = "https://finnhub.io/api/v1";

    try {
      const [earningsRes, economicRes, ipoRes, holidayRes] = await Promise.allSettled([
        fetch(`${base}/calendar/earnings?from=${from}&to=${to}&token=${key}`).then(r => r.json()),
        fetch(`${base}/calendar/economic?from=${from}&to=${to}&token=${key}`).then(r => r.json()),
        fetch(`${base}/calendar/ipo?from=${from}&to=${to}&token=${key}`).then(r => r.json()),
        fetch(`${base}/stock/market-holiday?exchange=US&token=${key}`).then(r => r.json()),
      ]);

      const merged = [];

      // Earnings
      if (earningsRes.status === "fulfilled") {
        const earnings = earningsRes.value?.earningsCalendar || [];
        console.log("[Calendar] Earnings:", earnings.length, "events");
        const fmtRev = v => {
          if (v == null) return null;
          const n = Number(v);
          if (isNaN(n)) return null;
          if (Math.abs(n) >= 1e12) return `$${(n/1e12).toFixed(1)}T`;
          if (Math.abs(n) >= 1e9) return `$${(n/1e9).toFixed(1)}B`;
          if (Math.abs(n) >= 1e6) return `$${(n/1e6).toFixed(0)}M`;
          if (Math.abs(n) >= 1e3) return `$${(n/1e3).toFixed(0)}K`;
          return `$${n.toFixed(2)}`;
        };
        earnings.forEach(e => {
          const epsEst = e.epsEstimate;
          const epsAct = e.epsActual;
          let beatMiss = null;
          if (epsEst != null && epsAct != null) {
            beatMiss = epsAct > epsEst ? "beat" : epsAct < epsEst ? "miss" : "met";
          }
          merged.push({
            type: "earnings", date: e.date, symbol: e.symbol,
            companyName: null, // will be filled by profile lookup
            label: `Q${e.quarter || "?"} ${e.year || ""} Earnings`,
            est: epsEst != null ? `$${epsEst}` : "—",
            actual: epsAct != null ? `$${epsAct}` : null,
            beatMiss,
            revEst: fmtRev(e.revenueEstimate),
            revActual: fmtRev(e.revenueActual),
            time: e.hour === "bmo" ? "BMO" : e.hour === "amc" ? "AMC" : e.hour || "",
          });
        });

        // Fetch company names for visible earnings symbols (batch first 30 unique)
        const uniqueSymbols = [...new Set(earnings.map(e => e.symbol))].slice(0, 30);
        if (uniqueSymbols.length > 0 && key) {
          Promise.allSettled(
            uniqueSymbols.map(sym =>
              fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${sym}&token=${key}`)
                .then(r => r.json())
                .then(d => ({ symbol: sym, name: d.name || null }))
            )
          ).then(results => {
            const nameMap = {};
            results.forEach(r => { if (r.status === "fulfilled" && r.value.name) nameMap[r.value.symbol] = r.value.name; });
            setCalEvents(prev => prev.map(e => e.type === "earnings" && nameMap[e.symbol] ? { ...e, companyName: nameMap[e.symbol] } : e));
          });
        }
      }

      // Economic — Finnhub may require premium, so add known US economic events as fallback
      if (economicRes.status === "fulfilled") {
        const ecoData = economicRes.value?.economicCalendar || economicRes.value?.result || [];
        const ecoArray = Array.isArray(ecoData) ? ecoData : [];
        console.log("[Calendar] Economic API response:", JSON.stringify(economicRes.value).slice(0, 300));
        ecoArray.forEach(e => {
          const dateStr = e.time?.split("T")[0] || e.date || "";
          if (!dateStr) return;
          merged.push({
            type: "economic", date: dateStr,
            label: e.event || e.name || "Economic Event",
            impact: e.impact === 3 ? "high" : e.impact === 2 ? "medium" : "low",
            time: e.time ? new Date(e.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "",
            prev: e.prev ?? e.previous ?? null,
            est: e.estimate ?? e.forecast ?? null,
            actual: e.actual ?? null,
            country: e.country || "US",
          });
        });

        // If no economic events from API, add known US economic schedule
        if (ecoArray.length === 0) {
          console.log("[Calendar] No economic data from API, using known US schedule");
          const knownEvents = getKnownEconomicEvents(year, month);
          knownEvents.forEach(e => merged.push(e));
        }
      }

      // IPOs
      if (ipoRes.status === "fulfilled") {
        const ipos = ipoRes.value?.ipoCalendar || [];
        console.log("[Calendar] IPOs:", ipos.length, "events");
        ipos.forEach(e => {
          merged.push({
            type: "ipo", date: e.date, symbol: e.symbol || "",
            label: `${e.name || e.symbol || "TBD"} IPO`,
            price: e.price ? `$${e.price}` : e.numberOfShares ? `${(e.numberOfShares / 1e6).toFixed(1)}M shares` : "—",
            time: e.exchange || "",
          });
        });
      }

      // Market Holidays
      if (holidayRes.status === "fulfilled") {
        const holidays = holidayRes.value?.data || holidayRes.value || [];
        const holidayArray = Array.isArray(holidays) ? holidays : [];
        console.log("[Calendar] Holidays:", holidayArray.length, "events");
        holidayArray.forEach(h => {
          const hDate = h.atDate || h.date || "";
          if (!hDate) return;
          // Only include holidays for this month
          const hMonth = parseInt(hDate.split("-")[1], 10) - 1;
          const hYear = parseInt(hDate.split("-")[0], 10);
          if (hMonth === month && hYear === year) {
            merged.push({
              type: "holiday", date: hDate,
              label: h.eventName || h.holiday || "Market Holiday",
              time: h.tradingHour || "Closed",
              impact: "high",
            });
          }
        });
      }

      console.log("[Calendar] Total merged events:", merged.length);
      setCalEvents(merged);
    } catch (e) { console.error("Calendar fetch failed", e); }
    setCalLoading(false);
  }

  // Fetch calendar on month change or tab switch
  useEffect(() => {
    if (tab === "calendar") fetchCalendarData(calMonth.year, calMonth.month);
  }, [tab, calMonth.year, calMonth.month]);


  function openChart(symbol, label, e) {
    // Magnetic pull animation: record card position, animate flying clone to chart panel
    if (e && e.currentTarget) {
      const r = e.currentTarget.getBoundingClientRect();
      setFlyingCard({ x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height, label: label || symbol, symbol });
    }
    setChartSymbol(symbol);
    setChartLabel(label || symbol);
    setChartRange("1D");
    fetchChart(symbol, "1D");
    fetchTickerDetails(symbol);
    fetchTickerNews(symbol);
    fetch52Week(symbol);
  }

  function changeChartRange(range) {
    setChartRange(range);
    if (chartSymbol) fetchChart(chartSymbol, range);
  }

  function addToWatchlist(symbol, description) {
    const entry = { id: symbol, label: description ? description.slice(0, 24) : symbol, symbol };
    const updated = [entry, ...watchlist.filter(w => w.symbol !== symbol)].slice(0, 20);
    setWatchlist(updated);
    try { localStorage.setItem("ta-watchlist", JSON.stringify(updated)); } catch {}
    setSearch(""); setSearchResults([]);
    const key = import.meta.env.VITE_MASSIVE_KEY || "";
    fetch(`https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${symbol}&apiKey=${key}`)
      .then(r => r.json())
      .then(data => {
        const t = data.tickers?.[0];
        const price = t?.lastTrade?.p || t?.day?.c || t?.min?.c || 0;
        if (price !== 0) {
          setWatchData(prev => ({ ...prev, [symbol]: {
            id: symbol, symbol, price,
            change: t.todaysChange || 0,
            changePct: t.todaysChangePerc || 0,
            prevClose: t.prevDay?.c || 0,
            high: t.day?.h || 0,
            low: t.day?.l || 0,
            open: t.day?.o || 0,
            volume: t.day?.v || 0,
            prevVolume: t.prevDay?.v || 0,
          }}));
          showToast(`${symbol} added`);
        } else {
          setWatchlist(prev => {
            const filtered = prev.filter(w => w.symbol !== symbol);
            try { localStorage.setItem("ta-watchlist", JSON.stringify(filtered)); } catch {}
            return filtered;
          });
          showToast(`${symbol} not found`, "warn");
        }
      })
      .catch(() => showToast(`${symbol} not available`, "warn"));
  }

  function removeFromWatchlist(symbol) {
    const updated = watchlist.filter(w => w.symbol !== symbol);
    setWatchlist(updated);
    try { localStorage.setItem("ta-watchlist", JSON.stringify(updated)); } catch {}
  }

  function openModal(assetOverride, assetLabel, initialPrice) {
    // Guard: ignore non-string arguments (e.g. React click events passed accidentally)
    if (assetOverride && typeof assetOverride !== "string") assetOverride = undefined;

    // Free users limited to 10 alerts — show upgrade modal on 11th attempt
    const activeAlerts = alerts.filter(a => a.status !== "deleted").length;
    if (!isPro && activeAlerts >= 10) {
      setShowUpgradeModal(true);
      return;
    }
    setStep(1);
    if (assetOverride) {
      // Opened from a card — seed with known price immediately, then fetch fresh
      setModalSource("card");
      setModalAssetLabel(assetLabel || assetOverride);
      setModalPrice(initialPrice || null);
      setForm(f => ({ ...f, trigger: null, value: "", asset: assetOverride }));
      fetchModalPrice(assetOverride);
    } else {
      // Opened standalone — user needs to search for a symbol
      setModalSource("standalone");
      setModalAssetLabel("");
      setModalSymbolSearch("");
      setModalSearchResults([]);
      setForm(f => ({ ...f, trigger: null, value: "", asset: "" }));
    }
    setShowModal(true);
  }

  async function searchModalSymbols(q) {
    if (!q || q.length < 1) { setModalSearchResults([]); return; }
    setModalSearchLoading(true);
    try {
      const key = import.meta.env.VITE_MASSIVE_KEY || "";
      const res  = await fetch(`https://api.massive.com/v3/reference/tickers?search=${encodeURIComponent(q)}&active=true&market=stocks&limit=6&apiKey=${key}`);
      const data = await res.json();
      setModalSearchResults((data.results || []).map(r => ({ symbol: r.ticker, name: r.name, type: r.type })));
    } catch { setModalSearchResults([]); }
    setModalSearchLoading(false);
  }

  async function fetchModalPrice(symbol) {
    // Don't clear existing price — keep showing it until fresh data arrives
    try {
      const key = import.meta.env.VITE_MASSIVE_KEY || "";
      const res  = await fetch(`https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${symbol}&apiKey=${key}`);
      const data = await res.json();
      const t = data.tickers?.[0];
      if (!t) return;
      const price     = t.lastTrade?.p || t.day?.c || t.min?.c || 0;
      const prevClose = t.prevDay?.c || 0;
      const change    = t.todaysChange || 0;
      const changePct = t.todaysChangePerc || 0;
      // Market is open if there's a last trade price different from prev close
      const marketOpen = !!(t.lastTrade?.p && t.lastTrade.p !== prevClose);
      if (price) setModalPrice({ price, change, changePct, marketOpen });
    } catch {}
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
      webhook_url:   form.delivery.includes("webhook") ? form.webhook_url : null,
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
      <style>{`
        @keyframes slideFromLeft  { from { transform: translateX(-60%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideFromRight { from { transform: translateX(60%);  opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .price-slide-up   { animation: slideFromLeft  0.22s cubic-bezier(0.22,1,0.36,1) forwards; }
        .price-slide-down { animation: slideFromRight 0.22s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes chartPanelPulse {
          0%   { box-shadow: 0 0 0 0px rgba(138,106,0,0.5); }
          50%  { box-shadow: 0 0 0 6px rgba(138,106,0,0.15); }
          100% { box-shadow: 0 0 0 0px rgba(138,106,0,0); }
        }
        .chart-panel-pulse { animation: chartPanelPulse 0.5s ease-out forwards; }
      `}</style>



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

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: isMobile ? "16px 16px" : "32px 20px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isMobile ? 16 : 36 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 4 : 8 }}>
              <span style={{ fontSize: isMobile ? 20 : 38, color: isMobile ? "#1a1200" : "#5F5E5A", lineHeight: 1 }}>◈</span>
              <span style={{ fontSize: isMobile ? 22 : 45, letterSpacing: "1px", fontWeight: isMobile ? 700 : 400 }}>
                <span style={{ color: isMobile ? "#1a1200" : "#5F5E5A" }}>TOP</span>
                <span style={{ color: isMobile ? "#1a1200" : "#5F5E5A" }}>-</span>
                <span style={{ color: isMobile ? "#1a1200" : "#5F5E5A" }}>ALERTS</span>
              </span>
            </div>
            {!isMobile && <div style={{ ...mono, fontSize: 9, letterSpacing: "3px", color: "#5F5E5A", marginTop: 2 }}>INTELLIGENT PRICE ALERTS</div>}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 4 : 8 }}>
            {/* Theme toggle */}
            <button onClick={() => setThemeName(t => t === "paper" ? "charcoal" : "paper")} style={{
              ...font, fontSize: isMobile ? 14 : 18, background: T.bgCard,
              border: themeName === "paper" ? "2px solid #f5a623" : "2px solid #ffffff",
              borderRadius: 8, padding: isMobile ? "4px 8px" : "6px 12px", cursor: "pointer",
            }}>
              <span style={{ color: themeName === "paper" ? "#f5a623" : "#ffffff" }}>{T.icon}</span>
            </button>

            {/* Plan badge */}
            <div style={{ ...mono, fontSize: 9, letterSpacing: "1.5px",
              background: isPro ? T.accentBg : "transparent",
              color: isPro ? T.accent : isMobile ? "#6a6050" : T.textFaint,
              border: `1px solid ${isPro ? T.accentBorder : isMobile ? "#8a8070" : T.border}`,
              padding: isMobile ? "4px 8px" : "6px 12px", borderRadius: 8 }}>
              {profile?.plan?.toUpperCase() || "FREE"}
            </div>

            {/* User + sign out */}
            {user ? (
              <button onClick={() => { signOut(); navigate("/"); }} style={{
                ...font, fontSize: isMobile ? 12 : 16, background: T.bgCard, border: `1px solid ${T.border}`,
                borderRadius: 8, padding: isMobile ? "4px 8px" : "6px 12px", cursor: "pointer", color: T.textFaint,
              }}>
                {user?.email?.split("@")[0]} ↩
              </button>
            ) : (
              <button onClick={() => navigate("/login")} style={{
                ...font, fontSize: isMobile ? 14 : 18, background: "none", border: `2px solid ${isMobile ? "#1a1200" : "#5F5E5A"}`,
                borderRadius: 8, padding: isMobile ? "4px 10px" : "6px 16px", cursor: "pointer", color: isMobile ? "#1a1200" : "#5F5E5A", fontWeight: isMobile ? 600 : 400,
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
        <div style={{ display: "flex", flexWrap: isMobile ? "wrap" : "nowrap", gap: isMobile ? 0 : 0, marginBottom: isMobile ? 10 : 28, borderBottom: `1px solid ${T.border}` }}>
          {["market","alerts","calendar","pricing"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: isMobile ? "8px 10px" : "10px 22px", background: "none", border: "none", cursor: "pointer",
              ...font, fontSize: isMobile ? 13 : 20, letterSpacing: isMobile ? "0.5px" : "1px", fontWeight: isMobile && tab === t ? 700 : 400,
              color: tab === t ? (isMobile ? "#1a1200" : T.activeTab) : (isMobile ? "#8a8070" : T.textFaint),
              borderBottom: tab === t ? `2px solid ${isMobile ? "#1a1200" : T.activeTabBorder}` : "2px solid transparent",
              marginBottom: -1, transition: "all 0.2s", flexShrink: 0,
            }}>
              {t.toUpperCase()}
            </button>
          ))}
          <button onClick={() => openModal()} style={{
            marginLeft: "auto", padding: isMobile ? "6px 14px" : "8px 22px", background: "#0a1f4a", border: "none",
            borderRadius: 8, cursor: "pointer", ...font, fontSize: isMobile ? 12 : 20, color: "#e8f2ff", flexShrink: 0,
            fontWeight: 600,
          }}>
            + ALERT
          </button>
        </div>

        {/* Search bar — full width above columns (market tab only) */}
        {tab === "market" && (
          <div style={{ position: "relative", marginBottom: isMobile ? 12 : 20 }}>
            <input
              type="text"
              placeholder={isMobile ? "Search any symbol" : "Search any symbol — AAPL, TSLA, ETH-USD..."}
              value={search}
              onChange={e => { setSearch(e.target.value); searchSymbols(e.target.value); }}
              style={{
                width: "100%", padding: isMobile ? "10px 14px" : "12px 16px", boxSizing: "border-box",
                background: T.bgCard, border: isMobile ? `2px solid ${search ? T.accent : "#5F5E5A"}` : `1px solid ${search ? T.accent : T.border}`,
                borderRadius: 10, color: T.text, ...font, fontSize: isMobile ? 16 : 18,
                outline: "none", transition: "border 0.2s",
              }}
            />
            {search && (
              <button onClick={() => { setSearch(""); setSearchResults([]); }} style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 18,
              }}>×</button>
            )}
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
                  <div key={r.symbol} onClick={() => { addToWatchlist(r.symbol, r.description); openChart(r.symbol, r.description); }} style={{
                    padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                    borderBottom: `1px solid ${T.border}`, transition: "background 0.15s",
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
        )}

        {/* Pricing tab — rendered outside two-column layout for full-width centering */}
        {tab === "pricing" && (
          <PricingPage T={T} font={font} mono={mono} currentPlan={profile?.plan || "free"} onUpgrade={handleUpgrade} isMobile={isMobile} />
        )}

        {/* Calendar tab — rendered outside two-column layout for full width */}
        {tab === "calendar" && (() => {
          const yr = calMonth.year;
          const mo = calMonth.month;
          const daysInMonth = new Date(yr, mo + 1, 0).getDate();
          const firstDow = new Date(yr, mo, 1).getDay();
          const today = new Date();
          const isCurrentMonth = yr === today.getFullYear() && mo === today.getMonth();
          const todayDate = isCurrentMonth ? today.getDate() : -1;
          const monthName = new Date(yr, mo).toLocaleDateString("en-US", { month: "long", year: "numeric" });
          const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
          const fullDayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

          const dotColor = t => t === "earnings" ? "#378ADD" : t === "economic" ? "#f5a623" : t === "ipo" ? "#1a8a44" : t === "split" ? "#9b59b6" : t === "holiday" ? "#5F5E5A" : "#cc2222";
          const impactColor = i => i === "high" ? "#cc2222" : i === "medium" ? "#f5a623" : T.textFaint;

          const eventsByDay = {};
          calEvents.filter(e => calFilters[e.type]).forEach(e => {
            const d = parseInt(e.date?.split("-")[2], 10);
            if (d >= 1 && d <= daysInMonth) {
              if (!eventsByDay[d]) eventsByDay[d] = [];
              eventsByDay[d].push(e);
            }
          });
          const selEvents = eventsByDay[calSelectedDay] || [];

          // Count events by type for the filter cards
          const eventCounts = {};
          calEvents.forEach(e => { eventCounts[e.type] = (eventCounts[e.type] || 0) + 1; });

          // Event type config — Economic first
          const eventTypes = [
            ["economic","Economic","#f5a623","📅"],
            ["earnings","Earnings","#378ADD","📊"],
            ["ipo","IPO","#1a8a44","🚀"],
            ["split","Split","#9b59b6","✂️"],
            ["dividend","Dividend","#cc2222","💰"],
            ["holiday","Holiday","#5F5E5A","🏖️"],
          ];

          return (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <div style={{ ...mono, fontSize: 10, letterSpacing: "2px", color: "#5F5E5A", marginBottom: 6 }}>CALENDAR</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ ...font, fontSize: isMobile ? 20 : 28, fontWeight: 600, color: T.text }}>{monthName}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => setCalMonth(p => { const d = new Date(p.year, p.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, background: "none", cursor: "pointer", color: T.textMid, fontSize: 14 }}>‹</button>
                      <button onClick={() => setCalMonth(p => { const d = new Date(p.year, p.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, background: "none", cursor: "pointer", color: T.textMid, fontSize: 14 }}>›</button>
                    </div>
                    {!isCurrentMonth && (
                      <button onClick={() => { const n = new Date(); setCalMonth({ year: n.getFullYear(), month: n.getMonth() }); setCalSelectedDay(n.getDate()); }} style={{ padding: "4px 12px", border: "2px solid #5F5E5A", borderRadius: 6, background: "none", cursor: "pointer", ...font, fontSize: 12, color: "#5F5E5A" }}>Today</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Filter cards — card-style toggles with counts */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(6, 1fr)", gap: 8, marginBottom: 20 }}>
                {eventTypes.map(([id, lbl, col, icon]) => {
                  const active = calFilters[id];
                  const count = eventCounts[id] || 0;
                  return (
                    <button key={id} onClick={() => setCalFilters(f => ({ ...f, [id]: !f[id] }))} style={{
                      background: T.bgCard, border: `2px solid ${active ? col : T.border}`,
                      borderRadius: 12, padding: "12px 14px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                      opacity: active ? 1 : 0.5, transition: "all 0.15s",
                    }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: active ? col + "18" : T.bgDeep, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icon}</div>
                      <div>
                        <div style={{ ...font, fontSize: 14, fontWeight: 500, color: T.text }}>{lbl}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.textFaint, marginTop: 2 }}>{count} events</div>
                      </div>
                    </button>
                  );
                })}
                </div>

              {calLoading && <div style={{ textAlign: "center", padding: 60, color: T.textFaint, ...mono, fontSize: 13 }}>Loading calendar...</div>}

              {!calLoading && (
                <div>
                  {/* Calendar grid — full width */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, background: T.border, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                    {dayNames.map(d => (
                      <div key={d} style={{ background: T.bgCard, padding: 10, textAlign: "center", ...mono, fontSize: 12, color: T.textFaint, letterSpacing: "1px" }}>{d.toUpperCase()}</div>
                    ))}
                    {Array.from({ length: firstDow }).map((_, i) => (
                      <div key={`e${i}`} style={{ background: T.bg, padding: 10, minHeight: 90 }} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const d = i + 1;
                      const evts = eventsByDay[d] || [];
                      const isSel = d === calSelectedDay;
                      const isToday = d === todayDate;
                      const isWeekend = (d + firstDow - 1) % 7 === 0 || (d + firstDow - 1) % 7 === 6;
                      return (
                        <div key={d} onClick={() => setCalSelectedDay(d)} style={{
                          background: isToday ? T.bgDeep : T.bg,
                          border: isSel ? "2px solid #0a1f4a" : "2px solid transparent",
                          padding: isMobile ? 4 : 8, minHeight: isMobile ? 60 : 90, cursor: "pointer", transition: "all 0.15s",
                        }}>
                          <div style={{ fontSize: isMobile ? 12 : 16, fontWeight: isToday ? 700 : 500, color: isWeekend ? T.textFaint : T.text, marginBottom: isMobile ? 2 : 5 }}>
                            {isToday ? (
                              <span style={{ background: "#5F5E5A", color: "#fff", width: isMobile ? 20 : 28, height: isMobile ? 20 : 28, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 10 : 14 }}>{d}</span>
                            ) : d}
                          </div>
                          {(() => {
                            const typeOrd = { economic: 0, earnings: 1, ipo: 2, split: 3, dividend: 4, holiday: 5 };
                            const sorted = [...evts].sort((a, b) => (typeOrd[a.type] ?? 9) - (typeOrd[b.type] ?? 9));
                            const maxShow = isMobile ? 2 : 3;
                            return sorted.slice(0, maxShow).map((e, j) => (
                            <div key={j} style={{ fontSize: isMobile ? 8 : 12, color: T.textMid, display: "flex", alignItems: "center", gap: isMobile ? 2 : 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: isMobile ? 1 : 3 }}>
                              <span style={{ width: isMobile ? 4 : 7, height: isMobile ? 4 : 7, borderRadius: "50%", background: dotColor(e.type), flexShrink: 0 }} />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{e.type === "earnings" ? e.symbol : e.type === "ipo" ? "IPO" : e.type === "split" ? e.symbol : e.type === "dividend" ? e.symbol : (e.label || "").split(" ").slice(0, isMobile ? 1 : 3).join(" ")}</span>
                            </div>
                          ));
                          })()}
                          {evts.length > (isMobile ? 2 : 3) && (() => {
                            const remaining = evts.length - (isMobile ? 2 : 3);
                            if (isMobile) return <div style={{ ...mono, fontSize: 7, color: T.textFaint, marginTop: 1 }}>+{remaining}</div>;
                            const counts = {};
                            evts.forEach(e => { counts[e.type] = (counts[e.type] || 0) + 1; });
                            const icons = { economic: "📅", earnings: "📊", ipo: "🚀", split: "✂️", dividend: "💰", holiday: "🏖️" };
                            const parts = Object.entries(counts).map(([t, c]) => `${c}${icons[t] || ""}`).join(" · ");
                            return <div style={{ ...mono, fontSize: 9, color: T.textFaint, marginTop: 2 }}>+{remaining} more ({parts})</div>;
                          })()}
                        </div>
                      );
                    })}
                    {Array.from({ length: (7 - (firstDow + daysInMonth) % 7) % 7 }).map((_, i) => (
                      <div key={`f${i}`} style={{ background: T.bg, padding: isMobile ? 4 : 10, minHeight: isMobile ? 60 : 90 }} />
                    ))}
                  </div>

                  {/* Detail panel below — cobalt style */}
                  <div style={{ marginTop: isMobile ? 12 : 20, background: "#0a1f4a", borderRadius: isMobile ? 10 : 14, padding: isMobile ? "14px 16px" : "22px 28px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <div style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "2px" }}>
                        EVENTS · {new Date(yr, mo, calSelectedDay).toLocaleDateString("en-US", { month: "long", day: "numeric" }).toUpperCase()}
                      </div>
                      <div style={{ ...font, fontSize: 16, fontWeight: 500, color: "#e8f2ff" }}>
                        {fullDayNames[new Date(yr, mo, calSelectedDay).getDay()]}, {new Date(yr, mo, calSelectedDay).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </div>
                    </div>

                    {selEvents.length === 0 && (
                      <div style={{ padding: "24px 0", textAlign: "center", color: "rgba(255,255,255,0.3)", ...font, fontSize: 14 }}>No events on this day — click a day above</div>
                    )}

                    {selEvents.length > 0 && (() => {
                      const typeOrder = { economic: 0, earnings: 1, ipo: 2, split: 3, dividend: 4, holiday: 5 };
                      const typeLabels = { economic: "ECONOMIC EVENTS", earnings: "EARNINGS REPORTS", ipo: "IPOs", split: "STOCK SPLITS", dividend: "DIVIDENDS", holiday: "MARKET HOLIDAYS" };
                      const typeIcons = { economic: "📅", earnings: "📊", ipo: "🚀", split: "✂️", dividend: "💰", holiday: "🏖️" };
                      const sorted = [...selEvents].sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9));

                      // Group by type
                      const groups = {};
                      sorted.forEach(e => {
                        if (!groups[e.type]) groups[e.type] = [];
                        groups[e.type].push(e);
                      });

                      return Object.entries(groups).map(([type, items]) => {
                        const isOpen = !calCollapsed[type];
                        const col = dotColor(type);
                        const previewItems = items.slice(0, 5);

                        return (
                        <div key={type} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          {/* Accordion header */}
                          <div onClick={() => setCalCollapsed(p => ({ ...p, [type]: !p[type] }))} style={{
                            padding: "14px 0", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
                            background: isOpen ? col + "08" : "transparent", margin: "0 -28px", padding: "14px 28px",
                            transition: "background 0.15s",
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 14 }}>{typeIcons[type]}</span>
                              <span style={{ ...mono, fontSize: 10, letterSpacing: "2px", color: col }}>{typeLabels[type] || type.toUpperCase()}</span>
                              <span style={{ background: col + "33", color: col, ...mono, fontSize: 10, padding: "2px 8px", borderRadius: 10 }}>{items.length}</span>
                            </div>
                            <span style={{ ...font, fontSize: 12, color: isOpen ? col : "rgba(255,255,255,0.3)" }}>{isOpen ? "▲ Collapse" : "▼ Expand"}</span>
                          </div>

                          {/* Collapsed preview — ticker pills */}
                          {!isOpen && (
                            <div style={{ display: "flex", gap: 6, padding: "0 0 12px", flexWrap: "wrap" }}>
                              {previewItems.map((e, j) => (
                                <span key={j} style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.04)", padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
                                  {e.symbol || e.label?.split(" ").slice(0, 2).join(" ")}
                                </span>
                              ))}
                              {items.length > 5 && <span style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.15)", padding: "4px 0" }}>+{items.length - 5} more…</span>}
                            </div>
                          )}

                          {/* Expanded content */}
                          {isOpen && (
                            <div style={{ padding: "0 0 16px" }}>

                          {type === "economic" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {items.map((e, i) => (
                                <div key={i} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderLeft: `3px solid ${col}`, borderRadius: 8, padding: "12px 16px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ ...font, fontSize: 15, fontWeight: 500, color: "#e8f2ff" }}>{e.label}</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      {e.impact && <span style={{ ...mono, fontSize: 9, color: impactColor(e.impact), border: `1px solid ${impactColor(e.impact)}44`, background: impactColor(e.impact) + "22", padding: "2px 8px", borderRadius: 4 }}>{e.impact.toUpperCase()}</span>}
                                      {e.time && <span style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{e.time}</span>}
                                    </div>
                                  </div>
                                  <div style={{ display: "flex", gap: 24, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)", alignItems: "center" }}>
                                    <div><span style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>PREVIOUS</span><div style={{ ...mono, fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{e.prev ?? "—"}</div></div>
                                    <div><span style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>FORECAST</span><div style={{ ...font, fontSize: 14, fontWeight: 500, color: "#e8f2ff", marginTop: 2 }}>{e.est ?? "—"}</div></div>
                                    <div><span style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>ACTUAL</span><div style={{ ...font, fontSize: 14, fontWeight: 500, color: e.actual != null ? "#3ddc84" : "rgba(255,255,255,0.2)", marginTop: 2 }}>{e.actual ?? "Pending"}</div></div>
                                    <div style={{ flex: 1 }} />
                                    <button onClick={(ev) => { ev.stopPropagation(); setCalEventAlert(e); }} style={{
                                      padding: "8px 16px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                                      borderRadius: 8, cursor: "pointer", ...font, fontSize: 13, color: "#e8f2ff",
                                      display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                                    }}>🔔 Set Alert</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {type === "earnings" && (
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : items.length === 1 ? "1fr" : "1fr 1fr", gap: 8 }}>
                              {items.map((e, i) => (
                                <div key={i} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderLeft: `3px solid ${col}`, borderRadius: 8, padding: "12px 16px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ ...font, fontSize: 16, fontWeight: 600, color: "#e8f2ff" }}>{e.symbol}</span>
                                        {e.beatMiss === "beat" && <span style={{ ...mono, fontSize: 9, color: "#3ddc84", background: "rgba(61,220,132,0.15)", border: "1px solid rgba(61,220,132,0.3)", padding: "1px 6px", borderRadius: 4 }}>▲ BEAT</span>}
                                        {e.beatMiss === "miss" && <span style={{ ...mono, fontSize: 9, color: "#cc2222", background: "rgba(204,34,34,0.15)", border: "1px solid rgba(204,34,34,0.3)", padding: "1px 6px", borderRadius: 4 }}>▼ MISS</span>}
                                        {e.beatMiss === "met" && <span style={{ ...mono, fontSize: 9, color: "#f5a623", background: "rgba(245,166,35,0.15)", border: "1px solid rgba(245,166,35,0.3)", padding: "1px 6px", borderRadius: 4 }}>— MET</span>}
                                      </div>
                                      {e.companyName && <div style={{ ...font, fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.companyName}</div>}
                                      <div style={{ ...font, fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{e.label}</div>
                                    </div>
                                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                                      {e.time && <span style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 4 }}>{e.time}</span>}
                                      <button onClick={(ev) => { ev.stopPropagation(); setCalEventAlert(e); }} style={{
                                        padding: "6px 12px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                                        borderRadius: 6, cursor: "pointer", ...font, fontSize: 12, color: "#e8f2ff",
                                        display: "flex", alignItems: "center", gap: 4,
                                      }}>🔔 Alert</button>
                                    </div>
                                  </div>
                                  <div style={{ display: "flex", gap: 20, marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" }}>
                                    <div><span style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>EST EPS</span><div style={{ ...font, fontSize: 14, fontWeight: 500, color: "#e8f2ff", marginTop: 2 }}>{e.est || "—"}</div></div>
                                    {e.actual && <div><span style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>ACTUAL EPS</span><div style={{ ...font, fontSize: 14, fontWeight: 500, color: e.beatMiss === "beat" ? "#3ddc84" : e.beatMiss === "miss" ? "#cc2222" : "#e8f2ff", marginTop: 2 }}>{e.actual}</div></div>}
                                    {e.revEst && <div><span style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>REV EST</span><div style={{ ...font, fontSize: 13, fontWeight: 500, color: "#e8f2ff", marginTop: 2 }}>{e.revEst}</div></div>}
                                    {e.revActual && <div><span style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>REV ACTUAL</span><div style={{ ...font, fontSize: 13, fontWeight: 500, color: "#3ddc84", marginTop: 2 }}>{e.revActual}</div></div>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {(type === "ipo" || type === "split" || type === "dividend" || type === "holiday") && (
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : items.length === 1 ? "1fr" : "1fr 1fr", gap: 8 }}>
                              {items.map((e, i) => (
                                <div key={i} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderLeft: `3px solid ${col}`, borderRadius: 8, padding: "12px 16px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                      {e.symbol && <div style={{ ...font, fontSize: 15, fontWeight: 600, color: "#e8f2ff" }}>{e.symbol}</div>}
                                      <div style={{ ...font, fontSize: 13, color: e.symbol ? "rgba(255,255,255,0.45)" : "#e8f2ff", marginTop: e.symbol ? 2 : 0 }}>{e.label}</div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                                        {e.time && <span style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{e.time}</span>}
                                        {e.price && <span style={{ ...mono, fontSize: 11, color: "#e8f2ff" }}>{e.price}</span>}
                                        {e.impact && <span style={{ ...mono, fontSize: 9, color: impactColor(e.impact), border: `1px solid ${impactColor(e.impact)}44`, background: impactColor(e.impact) + "22", padding: "2px 6px", borderRadius: 4 }}>{e.impact.toUpperCase()}</span>}
                                      </div>
                                      {type !== "holiday" && e.symbol && (
                                        <button onClick={(ev) => { ev.stopPropagation(); setCalEventAlert(e); }} style={{
                                          padding: "6px 12px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                                          borderRadius: 6, cursor: "pointer", ...font, fontSize: 12, color: "#e8f2ff",
                                          display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
                                        }}>🔔</button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                            </div>
                          )}
                        </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── MOBILE LAYOUT ──────────────────────────────────────────────── */}
        {isMobile && tab === "market" && (
          <div>
            <div style={{ ...mono, fontSize: 11, letterSpacing: "2px", color: "#1a1200", marginBottom: 8, fontWeight: 600 }}>WATCHLIST</div>
            {MARKET_SYMBOLS.map(m => {
              const d = marketData[m.id];
              const up = d?.changePct >= 0;
              const col = !d ? T.textFaint : up ? T.green : T.red;
              const arrow = up ? "▲" : "▼";
              const isExpanded = mobileExpanded === m.symbol;
              const snap = d || {};

              return (
                <div key={m.id} style={{
                  background: isExpanded ? T.bgCard : "transparent",
                  border: isExpanded ? "2px solid #0a1f4a" : "none",
                  borderBottom: isExpanded ? "2px solid #0a1f4a" : `1px solid ${T.border}`,
                  borderRadius: isExpanded ? 12 : 0,
                  marginBottom: isExpanded ? 8 : 0,
                }}>
                  {/* Collapsed row */}
                  <div onClick={() => {
                    try {
                      if (isExpanded) { setMobileExpanded(null); }
                      else { setMobileExpanded(m.symbol); openChart(m.symbol, m.label); }
                    } catch (err) { console.error("Mobile expand error:", err); }
                  }} style={{ padding: isExpanded ? "14px 14px" : "14px 0", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...font, fontSize: 22, fontWeight: 700, color: "#1a1200" }}>{m.label}</div>
                      <div style={{ ...mono, fontSize: 14, color: "#6a6050" }}>{m.symbol}</div>
                    </div>
                    {!isExpanded && (
                      <div style={{ display: "flex", gap: 12, alignItems: "center", paddingRight: 10 }}>
                        <div style={{ textAlign: "center" }}><div style={{ ...mono, fontSize: 10, color: "#8a8070", fontWeight: 500 }}>HIGH</div><div style={{ ...mono, fontSize: 13, color: "#1a1200", fontWeight: 500 }}>{snap.high ? `$${Number(snap.high).toFixed(2)}` : "—"}</div></div>
                        <div style={{ textAlign: "center" }}><div style={{ ...mono, fontSize: 10, color: "#8a8070", fontWeight: 500 }}>LOW</div><div style={{ ...mono, fontSize: 13, color: "#1a1200", fontWeight: 500 }}>{snap.low ? `$${Number(snap.low).toFixed(2)}` : "—"}</div></div>
                        <div style={{ textAlign: "center" }}><div style={{ ...mono, fontSize: 10, color: "#8a8070", fontWeight: 500 }}>VOL</div><div style={{ ...mono, fontSize: 13, color: "#1a1200", fontWeight: 500 }}>{snap.volume ? (snap.volume >= 1e9 ? `${(snap.volume/1e9).toFixed(1)}B` : snap.volume >= 1e6 ? `${(snap.volume/1e6).toFixed(1)}M` : snap.volume >= 1e3 ? `${(snap.volume/1e3).toFixed(0)}K` : snap.volume) : "—"}</div></div>
                      </div>
                    )}
                    <div style={{ textAlign: "right", minWidth: 85 }}>
                      <div style={{ ...font, fontSize: 22, fontWeight: 700, color: "#1a1200" }}>{d ? `$${Number(d.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</div>
                      <div style={{ ...mono, fontSize: 14, color: col, fontWeight: 600 }}>{d ? `${arrow} ${Math.abs(d.changePct).toFixed(2)}%` : ""}</div>
                    </div>
                  </div>

                  {/* Expanded card */}
                  {isExpanded && (
                    <div onClick={(ev) => ev.stopPropagation()} style={{ padding: "0 14px 14px" }}>

                      {/* Fundamentals grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: "#c0b8a8", borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
                        {[
                          ["Prev. Close", snap && snap.prevClose ? `$${Number(snap.prevClose).toFixed(2)}` : "—"],
                          ["Open", snap && snap.open ? `$${Number(snap.open).toFixed(2)}` : "—"],
                          ["Volume", snap && snap.volume ? (snap.volume >= 1e9 ? `${(snap.volume/1e9).toFixed(1)}B` : snap.volume >= 1e6 ? `${(snap.volume/1e6).toFixed(1)}M` : `${snap.volume}`) : "—"],
                          ["Day High", snap && snap.high ? `$${Number(snap.high).toFixed(2)}` : "—"],
                          ["Day Low", snap && snap.low ? `$${Number(snap.low).toFixed(2)}` : "—"],
                          ["Change", d && d.changePct != null ? `${d.changePct >= 0 ? "+" : ""}${d.changePct.toFixed(2)}%` : "—"],
                        ].map(([label, val], idx) => (
                          <div key={idx} style={{ background: T.bg, padding: 8, textAlign: "center" }}>
                            <div style={{ ...mono, fontSize: 10, color: "#6a6050", fontWeight: 500 }}>{label}</div>
                            <div style={{ ...mono, fontSize: 14, color: "#1a1200", fontWeight: 600, marginTop: 2 }}>{val}</div>
                          </div>
                        ))}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={(ev) => { ev.stopPropagation(); openModal(m.symbol, m.label); }} style={{ flex: 1, padding: 11, background: "#0a1f4a", color: "#e8f2ff", border: "none", borderRadius: 8, ...font, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>+ Set Alert</button>
                        <button onClick={(ev) => {
                          ev.stopPropagation();
                          setWatchlist(prev => {
                            const exists = prev.some(w => w.symbol === m.symbol);
                            const next = exists ? prev.filter(w => w.symbol !== m.symbol) : [...prev, { symbol: m.symbol, label: m.label }];
                            localStorage.setItem("ta-watchlist", JSON.stringify(next));
                            return next;
                          });
                        }} style={{ flex: 1, padding: 11, background: "none", color: "#1a1200", border: "2px solid #5F5E5A", borderRadius: 8, ...font, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                          {watchlist.some(w => w.symbol === m.symbol) ? "✓ Watchlisted" : "+ Watchlist"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* User watchlist items */}
            {watchlist.filter(w => !MARKET_SYMBOLS.some(m => m.symbol === w.symbol)).map(w => {
              const wd = watchData[w.symbol];
              const up = wd?.changePct >= 0;
              const col = !wd ? T.textFaint : up ? T.green : T.red;
              const arrow = up ? "▲" : "▼";
              return (
                <div key={w.symbol} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <div onClick={() => {
                    if (mobileExpanded === w.symbol) setMobileExpanded(null);
                    else { setMobileExpanded(w.symbol); setMobileNewsOpen(false); openChart(w.symbol, w.label); }
                  }} style={{ padding: "12px 0", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ ...font, fontSize: 15, fontWeight: 600, color: T.text }}>{w.label || w.symbol}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.textFaint }}>{w.symbol}</div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 75 }}>
                      <div style={{ ...font, fontSize: 16, fontWeight: 600, color: T.text }}>{wd ? `$${Number(wd.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</div>
                      <div style={{ ...mono, fontSize: 11, color: col }}>{wd ? `${arrow} ${Math.abs(wd.changePct).toFixed(2)}%` : ""}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Mobile alerts tab */}
        {isMobile && tab === "alerts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {loading && <div style={{ textAlign: "center", padding: 40, color: T.textFaint, ...font, fontSize: 14 }}>Loading...</div>}
            {!loading && alerts.filter(a => a.status !== "deleted").map((a) => (
              <div key={a.id} style={{
                background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10,
                padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
                position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${T.accent},transparent)` }} />
                <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  background: a.status === "triggered" ? T.red : a.status === "paused" ? T.textFaint : T.green }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...font, fontSize: 16, fontWeight: 500, color: T.text }}>{a.asset}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.textFaint, marginTop: 2 }}>{a.trigger_type?.replace(/_/g, " ")}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ ...mono, fontSize: 9, color: a.status === "triggered" ? T.red : a.status === "paused" ? T.textFaint : T.green,
                    border: `1px solid ${a.status === "triggered" ? T.red : a.status === "paused" ? T.textFaint : T.green}33`,
                    background: `${a.status === "triggered" ? T.red : a.status === "paused" ? T.textFaint : T.green}11`,
                    padding: "3px 8px", borderRadius: 4 }}>
                    {a.status.toUpperCase()}
                  </div>
                  <button onClick={() => togglePause(a.id)} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 14 }}>
                    {a.status === "paused" ? "▶" : "⏸"}
                  </button>
                  <button onClick={() => deleteAlert(a.id)} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 16 }}>×</button>
                </div>
              </div>
            ))}
            {!loading && alerts.filter(a => a.status !== "deleted").length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: T.textFaint, ...font, fontSize: 14 }}>No alerts yet — create one above</div>
            )}
          </div>
        )}

        {/* ── DESKTOP TWO-COLUMN LAYOUT ────────────────────────────────── */}
        {!isMobile && (
        <>
        {/* Two-column layout */}
        <div style={{ display: "flex", gap: 20 }}>

          {/* Left column — Watchlist */}
          <div style={{ width: 210, flexShrink: 0 }}>
            {tab === "market" && (
              <div>
                <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: "#5F5E5A", marginBottom: 10 }}>WATCHLIST</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {MARKET_SYMBOLS.map(m => {
                    const d   = marketData[m.id];
                    const up  = d?.changePct >= 0;
                    const col = !d ? T.border : up ? T.green : T.red;
                    const isActive = chartSymbol === m.symbol;
                    return (
                      <div key={m.id} onClick={(e) => openChart(m.symbol, m.label, e)} style={{
                        background: isActive ? T.bgDeep : T.bgCard,
                        border: `1px solid ${isActive ? T.accent : T.border}`,
                        borderLeft: `4px solid ${col}`,
                        borderRadius: 9,
                        padding: "10px 12px",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        transition: "all 0.2s",
                      }}>
                        <div>
                          <div style={{ ...font, fontSize: 13, fontWeight: 500, color: T.text }}>{m.label}</div>
                          <div style={{ ...mono, fontSize: 10, color: T.textFaint, marginTop: 1 }}>{m.symbol}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ overflow: "hidden" }}>
                            <div
                              key={d?.price}
                              className={flashState[m.id] === "up" ? "price-slide-up" : flashState[m.id] === "down" ? "price-slide-down" : ""}
                              style={{ ...font, fontSize: 14, fontWeight: 500, color: flashState[m.id] === "up" ? T.green : flashState[m.id] === "down" ? T.red : T.text, transition: "color 0.8s" }}>
                              {marketLoading && !d ? "—" : d?.price ? `$${Number(d.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                            </div>
                          </div>
                          {d && <div style={{ ...mono, fontSize: 10, color: col, marginTop: 1 }}>
                            {up ? "▲" : "▼"} {Math.abs(d.changePct).toFixed(2)}%
                          </div>}
                        </div>
                      </div>
                    );
                  })}

                  {/* User watchlist items */}
                  {watchlist.length > 0 && (
                    <>
                      <div style={{ height: 1, background: T.border, margin: "6px 0" }} />
                      {watchlist.map(m => {
                        const d = watchData[m.symbol];
                        const up = d?.changePct >= 0;
                        const col = !d ? T.border : up ? T.green : T.red;
                        const isActive = chartSymbol === m.symbol;
                        return (
                          <div key={m.symbol} style={{
                            background: isActive ? T.bgDeep : T.bgCard,
                            border: `1px solid ${isActive ? T.accent : T.border}`,
                            borderLeft: `4px solid ${col}`,
                            borderRadius: 9, padding: "10px 12px", cursor: "pointer",
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            transition: "all 0.2s", position: "relative",
                          }}>
                            <div onClick={(e) => openChart(m.symbol, m.label, e)} style={{ flex: 1 }}>
                              <div style={{ ...font, fontSize: 13, fontWeight: 500, color: T.text }}>{m.label}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.textFaint, marginTop: 1 }}>{m.symbol}</div>
                            </div>
                            <div style={{ textAlign: "right" }} onClick={(e) => openChart(m.symbol, m.label, e)}>
                              <div style={{ ...font, fontSize: 14, fontWeight: 500, color: T.text }}>
                                {d?.price ? `$${Number(d.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                              </div>
                              {d && <div style={{ ...mono, fontSize: 10, color: col, marginTop: 1 }}>
                                {up ? "▲" : "▼"} {Math.abs(d.changePct).toFixed(2)}%
                              </div>}
                            </div>
                            <button onClick={() => removeFromWatchlist(m.symbol)} style={{
                              position: "absolute", top: 2, right: 4,
                              background: "none", border: "none", color: T.textFaint,
                              cursor: "pointer", fontSize: 11, lineHeight: 1, opacity: 0.5,
                            }}>×</button>
                          </div>
                        );
                      })}
                    </>
                  )}

                  <div style={{ ...mono, fontSize: 9, color: T.textFaint, textAlign: "center", marginTop: 4 }}>
                    Live · WebSocket
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right column — Main content */}
          <div style={{ flex: 1, minWidth: 0 }}>

        {/* Market tab */}
        {tab === "market" && (
          <div>

            {/* Chart panel — always visible, defaults to DIA */}
            {chartSymbol && (() => {
              const d = marketData[chartSymbol] || watchData[chartSymbol];
              const up = d?.changePct >= 0;
              const col = !d ? T.textFaint : up ? T.green : T.red;
              const fmt = n => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              return (
                <div>
                  {/* Chart */}
                  <div ref={chartPanelRef} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ ...font, fontSize: 18, fontWeight: 500, color: T.text }}>{chartLabel}</span>
                        <span style={{ ...mono, fontSize: 10, color: T.textFaint }}>{chartSymbol}</span>
                        {d && <>
                          <span style={{ ...font, fontSize: 18, fontWeight: 500, color: T.text, marginLeft: 8 }}>{fmt(d.price)}</span>
                          <span style={{ ...mono, fontSize: 11, color: col }}>{up ? "▲" : "▼"} {Math.abs(d.changePct).toFixed(2)}%</span>
                        </>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {[["15m","5D"],["1D","1M"],["1W","1Y"],["1M","5Y"]].map(([r,lbl]) => (
                          <button key={r} onClick={() => changeChartRange(r)} style={{
                            ...mono, fontSize: 11, padding: "3px 10px", borderRadius: 6, cursor: "pointer",
                            background: chartRange === r ? T.btnPrimary : "none",
                            color: chartRange === r ? T.btnText : T.textFaint,
                            border: `1px solid ${chartRange === r ? T.btnPrimary : T.border}`,
                          }}>{lbl}</button>
                        ))}
                        <button onClick={() => openModal(chartSymbol, chartLabel, d ? { price: d.price, change: d.change, changePct: d.changePct, marketOpen: !!d.price } : null)} style={{
                          padding: "5px 14px", background: "none", border: "2px solid #5F5E5A", borderRadius: 6,
                          cursor: "pointer", ...font, fontSize: 13, color: "#5F5E5A", whiteSpace: "nowrap", marginLeft: 4,
                        }}>+ SET ALERT</button>
                      </div>
                    </div>
                    {chartLoading && (
                      <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", ...mono, fontSize: 11, color: T.textFaint }}>
                        Loading chart...
                      </div>
                    )}
                    {!chartLoading && chartData.length > 0 && (
                      <CandlestickChart data={chartData} T={T} range={chartRange} />
                    )}
                    {!chartLoading && chartData.length === 0 && (
                      <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", ...mono, fontSize: 11, color: T.textFaint }}>
                        No data available for this range
                      </div>
                    )}
                  </div>

                  {/* Fundamentals table */}
                  {d && (() => {
                    const fmtVol = v => v >= 1e9 ? `${(v/1e9).toFixed(2)}B` : v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : `${v}`;
                    const cell = (label, value) => (
                      <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRight: `1px solid ${T.borderLight}` }}>
                        <span style={{ ...font, fontSize: 13, color: T.textMid }}>{label}</span>
                        <span style={{ ...mono, fontSize: 13, color: T.text, fontWeight: 500, textAlign: "right" }}>{value}</span>
                      </div>
                    );
                    return (
                      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: `1px solid ${T.borderLight}` }}>
                          {cell("Prev. Close", d.prevClose ? fmt(d.prevClose) : "—")}
                          {cell("Volume", d.volume ? fmtVol(d.volume) : "—")}
                          {cell("Day's Range", d.low && d.high ? `${fmt(d.low)} – ${fmt(d.high)}` : "—")}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: `1px solid ${T.borderLight}` }}>
                          {cell("Open", d.open ? fmt(d.open) : "—")}
                          {cell("Avg Vol. (3m)", "—")}
                          {cell("52 Wk Range", week52Data ? `${fmt(week52Data.low)} – ${fmt(week52Data.high)}` : "—")}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
                          <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRight: `1px solid ${T.borderLight}` }}>
                            <span style={{ ...font, fontSize: 13, color: T.textMid }}>1-Year Change</span>
                            <span style={{ ...mono, fontSize: 13, fontWeight: 500, color: week52Data?.yearChange >= 0 ? T.green : T.red }}>{week52Data ? `${week52Data.yearChange >= 0 ? "+" : ""}${week52Data.yearChange.toFixed(2)}%` : "—"}</span>
                          </div>
                          {cell("Change", `${d.change >= 0 ? "+" : ""}${d.change?.toFixed(2)}`)}
                          <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ ...font, fontSize: 13, color: T.textMid }}>Change %</span>
                            <span style={{ ...mono, fontSize: 13, fontWeight: 500, color: col }}>{d.changePct >= 0 ? "+" : ""}{d.changePct?.toFixed(2)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Day range bar */}
                  {d && d.high && d.low && d.high !== d.low && (() => {
                    const rangePct = Math.min(100, Math.max(0, ((d.price - d.low) / (d.high - d.low)) * 100));
                    return (
                      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                        <div style={{ ...mono, fontSize: 9, letterSpacing: "1px", color: T.textFaint, marginBottom: 8 }}>DAY RANGE POSITION</div>
                        <div style={{ height: 6, background: T.bgDeep, borderRadius: 3, position: "relative" }}>
                          <div style={{ height: "100%", width: `${rangePct.toFixed(1)}%`, background: col, borderRadius: 3, transition: "width 0.5s" }} />
                          <div style={{ position: "absolute", top: -3, left: `${rangePct.toFixed(1)}%`, width: 12, height: 12, borderRadius: "50%", background: T.text, border: `2px solid ${T.bgCard}`, transform: "translateX(-50%)", transition: "left 0.5s" }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                          <span style={{ ...mono, fontSize: 10, color: T.textFaint }}>L {fmt(d.low)}</span>
                          <span style={{ ...mono, fontSize: 10, color: T.text, fontWeight: 500 }}>Current {fmt(d.price)}</span>
                          <span style={{ ...mono, fontSize: 10, color: T.textFaint }}>H {fmt(d.high)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Ticker details — company info */}
                  {tickerDetails && (
                    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: "18px 18px", marginBottom: 16 }}>
                      <div style={{ ...mono, fontSize: 9, letterSpacing: "1px", color: T.textFaint, marginBottom: 12 }}>ABOUT {chartSymbol}</div>
                      <div style={{ ...font, fontSize: 16, fontWeight: 500, color: T.text, marginBottom: 6 }}>{tickerDetails.name}</div>
                      {tickerDetails.description && (
                        <div style={{ ...font, fontSize: 13, color: T.textMid, lineHeight: 1.6, marginBottom: 14 }}>
                          {tickerDetails.description.length > 300 ? tickerDetails.description.slice(0, 300) + "..." : tickerDetails.description}
                        </div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {tickerDetails.sic_description && (
                          <div>
                            <div style={{ ...mono, fontSize: 9, color: T.textFaint, letterSpacing: "1px" }}>SECTOR</div>
                            <div style={{ ...font, fontSize: 13, color: T.text, marginTop: 3 }}>{tickerDetails.sic_description}</div>
                          </div>
                        )}
                        {tickerDetails.market_cap && (
                          <div>
                            <div style={{ ...mono, fontSize: 9, color: T.textFaint, letterSpacing: "1px" }}>MARKET CAP</div>
                            <div style={{ ...font, fontSize: 13, color: T.text, marginTop: 3 }}>
                              {tickerDetails.market_cap >= 1e12 ? `$${(tickerDetails.market_cap / 1e12).toFixed(2)}T`
                                : tickerDetails.market_cap >= 1e9 ? `$${(tickerDetails.market_cap / 1e9).toFixed(2)}B`
                                : `$${(tickerDetails.market_cap / 1e6).toFixed(0)}M`}
                            </div>
                          </div>
                        )}
                        {tickerDetails.total_employees && (
                          <div>
                            <div style={{ ...mono, fontSize: 9, color: T.textFaint, letterSpacing: "1px" }}>EMPLOYEES</div>
                            <div style={{ ...font, fontSize: 13, color: T.text, marginTop: 3 }}>{Number(tickerDetails.total_employees).toLocaleString()}</div>
                          </div>
                        )}
                        {tickerDetails.homepage_url && (
                          <div>
                            <div style={{ ...mono, fontSize: 9, color: T.textFaint, letterSpacing: "1px" }}>WEBSITE</div>
                            <a href={tickerDetails.homepage_url} target="_blank" rel="noopener noreferrer" style={{ ...font, fontSize: 13, color: "#378ADD", textDecoration: "none", marginTop: 3, display: "block" }}>
                              {tickerDetails.homepage_url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 30)}
                            </a>
                          </div>
                        )}
                        {tickerDetails.list_date && (
                          <div>
                            <div style={{ ...mono, fontSize: 9, color: T.textFaint, letterSpacing: "1px" }}>IPO DATE</div>
                            <div style={{ ...font, fontSize: 13, color: T.text, marginTop: 3 }}>{new Date(tickerDetails.list_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</div>
                          </div>
                        )}
                        {tickerDetails.primary_exchange && (
                          <div>
                            <div style={{ ...mono, fontSize: 9, color: T.textFaint, letterSpacing: "1px" }}>EXCHANGE</div>
                            <div style={{ ...font, fontSize: 13, color: T.text, marginTop: 3 }}>{tickerDetails.primary_exchange}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* News */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 12 }}>LATEST NEWS · {chartSymbol}</div>
                    {newsLoading && (
                      <div style={{ padding: "20px 0", textAlign: "center", ...mono, fontSize: 11, color: T.textFaint }}>Loading news...</div>
                    )}
                    {!newsLoading && tickerNews.length === 0 && (
                      <div style={{ padding: "20px 0", textAlign: "center", ...mono, fontSize: 11, color: T.textFaint }}>No recent news found</div>
                    )}
                    {!newsLoading && tickerNews.map((article, i) => (
                      <a key={i} href={article.article_url} target="_blank" rel="noopener noreferrer" style={{
                        display: "flex", gap: 14, padding: "14px 0", borderBottom: i < tickerNews.length - 1 ? `1px solid ${T.border}` : "none",
                        textDecoration: "none", color: "inherit",
                      }}>
                        {article.image_url && (
                          <div style={{ width: 80, height: 56, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: T.bgDeep }}>
                            <img src={article.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.target.style.display = "none"} />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ ...font, fontSize: 14, fontWeight: 500, color: T.text, lineHeight: 1.4, marginBottom: 4 }}>
                            {article.title?.length > 80 ? article.title.slice(0, 80) + "..." : article.title}
                          </div>
                          <div style={{ ...mono, fontSize: 10, color: T.textFaint, lineHeight: 1.5, marginBottom: 4 }}>
                            {article.description?.length > 120 ? article.description.slice(0, 120) + "..." : article.description || ""}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ ...mono, fontSize: 9, color: T.textFaint }}>{article.publisher?.name || ""}</span>
                            <span style={{ ...mono, fontSize: 9, color: T.border }}>·</span>
                            <span style={{ ...mono, fontSize: 9, color: T.textFaint }}>
                              {article.published_utc ? new Date(article.published_utc).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                            </span>
                            {article.insights?.[0]?.sentiment && (
                              <>
                                <span style={{ ...mono, fontSize: 9, color: T.border }}>·</span>
                                <span style={{ ...mono, fontSize: 9, color: article.insights[0].sentiment === "positive" ? T.green : article.insights[0].sentiment === "negative" ? T.red : T.textFaint }}>
                                  {article.insights[0].sentiment === "positive" ? "▲ Bullish" : article.insights[0].sentiment === "negative" ? "▼ Bearish" : "— Neutral"}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}
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

        </div>{/* end main content */}
        </div>{/* end two-column layout */}
        </>
        )}{/* end !isMobile */}
      </div>

      {/* Upgrade modal — shown when free user hits 10 alert limit */}
      {showUpgradeModal && (
        <UpgradeModal T={T} font={font} mono={mono} onClose={() => setShowUpgradeModal(false)} onUpgrade={() => { setShowUpgradeModal(false); setTab("pricing"); }} />
      )}

      {/* Fullscreen chart overlay — mobile */}
      {mobileChartFull && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: T.bg, display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${T.border}` }}>
            <div>
              <div style={{ ...font, fontSize: 18, fontWeight: 700, color: "#1a1200" }}>{chartLabel || chartSymbol}</div>
              <div style={{ ...mono, fontSize: 12, color: "#6a6050" }}>{chartSymbol}</div>
            </div>
            <button onClick={() => setMobileChartFull(false)} style={{
              width: 36, height: 36, borderRadius: 8, border: "none",
              background: "#0a1f4a", cursor: "pointer", fontSize: 18, color: "#e8f2ff",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>×</button>
          </div>
          {/* Chart — full width */}
          <div style={{ flex: 1, overflow: "auto", padding: "8px 0" }}>
            {chartData.length > 0 && <CandlestickChart data={chartData} T={T} range={chartRange} />}
            {chartData.length === 0 && <div style={{ textAlign: "center", padding: 60, ...mono, fontSize: 14, color: "#6a6050" }}>No chart data</div>}
          </div>
          {/* Range buttons */}
          <div style={{ display: "flex", gap: 6, justifyContent: "center", padding: "12px 16px", borderTop: `1px solid ${T.border}` }}>
            {[["15m","5D"],["1D","1M"],["1W","1Y"],["1M","5Y"]].map(([r, lbl]) => (
              <span key={r} onClick={() => changeChartRange(r)} style={{
                padding: "8px 16px", borderRadius: 8, ...mono, fontSize: 13, cursor: "pointer", fontWeight: 600,
                background: chartRange === r ? "#0a1f4a" : T.bgCard,
                color: chartRange === r ? "#e8f2ff" : "#1a1200",
                border: chartRange === r ? "none" : `1px solid ${T.border}`,
              }}>{lbl}</span>
            ))}
          </div>
        </div>
      )}

      {/* Event Alert Popup */}
      {calEventAlert && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => { setCalEventAlert(null); setCalAlertTiming("1day"); }} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", width: isMobile ? "95vw" : 480, maxHeight: "90vh", overflowY: "auto", borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
            {/* Header */}
            <div style={{ background: "#0a1f4a", padding: "18px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ ...font, fontSize: 20, color: "#e8f2ff" }}>🔔 Set Event Alert</div>
                <button onClick={() => { setCalEventAlert(null); setCalAlertTiming("1day"); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 22 }}>×</button>
              </div>
              {/* Event card */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: `${calEventAlert.type === "earnings" ? "#378ADD" : calEventAlert.type === "economic" ? "#f5a623" : calEventAlert.type === "ipo" ? "#1a8a44" : "#9b59b6"}25`, border: `1px solid ${calEventAlert.type === "earnings" ? "#378ADD" : calEventAlert.type === "economic" ? "#f5a623" : calEventAlert.type === "ipo" ? "#1a8a44" : "#9b59b6"}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                  {calEventAlert.type === "earnings" ? "📊" : calEventAlert.type === "economic" ? "📅" : calEventAlert.type === "ipo" ? "🚀" : "✂️"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...font, fontSize: 15, fontWeight: 500, color: "#e8f2ff" }}>
                    {calEventAlert.symbol ? `${calEventAlert.symbol} — ` : ""}{calEventAlert.label}
                  </div>
                  {calEventAlert.companyName && <div style={{ ...font, fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{calEventAlert.companyName}</div>}
                  <div style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                    {calEventAlert.date} {calEventAlert.time ? `· ${calEventAlert.time}` : ""}
                  </div>
                </div>
                {calEventAlert.impact && (
                  <span style={{ ...mono, fontSize: 9, color: calEventAlert.impact === "high" ? "#cc2222" : "#f5a623", border: `1px solid ${calEventAlert.impact === "high" ? "#cc2222" : "#f5a623"}44`, background: `${calEventAlert.impact === "high" ? "#cc2222" : "#f5a623"}22`, padding: "2px 8px", borderRadius: 4 }}>{calEventAlert.impact.toUpperCase()}</span>
                )}
              </div>
            </div>

            {/* Body */}
            <div style={{ background: T.bg, padding: 24 }}>
              <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 12 }}>WHEN TO ALERT</div>

              {/* Timing options */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
                {[
                  ["15min", "⏰", "15 min before", "Quick heads up"],
                  ["1hr", "⏰", "1 hour before", "Time to prepare"],
                  ["1day", "📅", "1 day before", "Plan ahead"],
                  ["after", "📊", "After results", "Get the actual data"],
                ].map(([id, icon, title, desc]) => (
                  <button key={id} onClick={() => setCalAlertTiming(id)} style={{
                    background: T.bgCard, border: calAlertTiming === id ? "2px solid #0a1f4a" : `1px solid ${T.border}`,
                    borderRadius: 10, padding: 14, cursor: "pointer", textAlign: "left",
                  }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
                    <div style={{ ...font, fontSize: 14, fontWeight: 500, color: T.text }}>{title}</div>
                    <div style={{ ...font, fontSize: 11, color: T.textFaint, marginTop: 2 }}>{desc}</div>
                    {calAlertTiming === id && <div style={{ ...mono, fontSize: 9, color: "#378ADD", marginTop: 6 }}>✓ SELECTED</div>}
                  </button>
                ))}
              </div>

              {/* After results options — only show when "after" is selected */}
              {calAlertTiming === "after" && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 10 }}>NOTIFY WHEN</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      ["any", "📊", "Any Result", "Notify as soon as actual data is published"],
                      ...(calEventAlert.type === "earnings" ? [
                        ["beat", "▲", "Beats Estimate", `Actual EPS comes in above ${calEventAlert.est || "estimate"}`],
                        ["miss", "▼", "Misses Estimate", `Actual EPS comes in below ${calEventAlert.est || "estimate"}`],
                      ] : []),
                    ].map(([id, icon, title, desc]) => (
                      <div key={id} style={{
                        background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8,
                        padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                      }}>
                        <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ ...font, fontSize: 13, fontWeight: 500, color: T.text }}>{title}</div>
                          <div style={{ ...font, fontSize: 11, color: T.textFaint, marginTop: 1 }}>{desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery */}
              <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 10 }}>DELIVERY</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
                <div style={{ padding: "12px 16px", borderRadius: 9, border: `1px solid #f5a623`, background: "rgba(245,166,35,0.08)", ...font, fontSize: 14, color: T.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>Push <span style={{ color: "#f5a623" }}>✓</span></div>
                <div style={{ padding: "12px 16px", borderRadius: 9, border: `1px solid #f5a623`, background: "rgba(245,166,35,0.08)", ...font, fontSize: 14, color: T.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>Email <span style={{ color: "#f5a623" }}>✓</span></div>
                <div style={{ padding: "12px 16px", borderRadius: 9, border: `1px solid ${T.border}`, ...font, fontSize: 14, color: T.textFaint, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>SMS <span style={{ ...mono, fontSize: 9, color: T.border, border: `1px solid ${T.border}`, padding: "2px 5px", borderRadius: 3 }}>PRO</span></div>
                <div style={{ padding: "12px 16px", borderRadius: 9, border: `1px solid ${T.border}`, ...font, fontSize: 14, color: T.textFaint, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>Webhook <span style={{ ...mono, fontSize: 9, color: T.border, border: `1px solid ${T.border}`, padding: "2px 5px", borderRadius: 3 }}>PRO</span></div>
              </div>

              <button onClick={() => {
                const timingLabels = { "15min": "15 minutes before", "1hr": "1 hour before", "1day": "1 day before", "after": "when results are released" };
                showToast(`Alert set for ${calEventAlert.symbol || calEventAlert.label} — ${timingLabels[calAlertTiming]}`);
                setCalEventAlert(null);
                setCalAlertTiming("1day");
              }} style={{ width: "100%", padding: 14, background: "#0a1f4a", color: "#e8f2ff", border: "none", borderRadius: 10, ...font, fontSize: 16, fontWeight: 500, cursor: "pointer" }}>
                Save Alert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flying card animation — ghost fade trail #8 */}
      {flyingCard && (
        <FlyingCard
          card={flyingCard}
          chartPanelRef={chartPanelRef}
          T={T}
          onDone={() => setFlyingCard(null)}
        />
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: isMobile ? 14 : 18, width: "100%", maxWidth: isMobile ? "100%" : 540, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 40px 80px rgba(0,0,0,0.3)" }}>

            {/* Modal header — cobalt blue with integrated search */}
            <div style={{ background: "#0a1f4a", borderRadius: "18px 18px 0 0", position: "sticky", top: 0, zIndex: 10 }}>
              {/* Top row: step + title + close */}
              <div style={{ padding: "18px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", border: "2px solid #378ADD", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#e8f2ff", flexShrink: 0 }}>
                    {step}
                  </div>
                  <div>
                    <div style={{ fontSize: 20, color: "#e8f2ff" }}>{step === 1 ? "Choose Trigger" : step === 2 ? "Configure" : "Delivery"}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
                      {[1,2,3].map(s => <div key={s} style={{ width: s <= step ? 20 : 6, height: 3, borderRadius: 2, background: s <= step ? "#378ADD" : "rgba(255,255,255,0.15)", transition: "all 0.3s" }} />)}
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 22 }}>×</button>
              </div>

              {/* Asset search / display row — always in header */}
              <div style={{ padding: "14px 24px 18px" }}>
                {!form.asset ? (
                  /* Search input */
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="Search symbol — AAPL, TSLA, BTC-USD..."
                      value={modalSymbolSearch}
                      onChange={e => { setModalSymbolSearch(e.target.value); searchModalSymbols(e.target.value); }}
                      autoFocus
                      style={{ width: "100%", padding: "11px 14px", boxSizing: "border-box", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "#e8f2ff", ...font, fontSize: 15, outline: "none", caretColor: "#378ADD" }}
                    />
                    {modalSymbolSearch && (
                      <button onClick={() => { setModalSymbolSearch(""); setModalSearchResults([]); }} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 18 }}>×</button>
                    )}
                  </div>
                ) : (
                  /* Selected asset card */
                  <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(55,138,221,0.25)", border: "1px solid rgba(55,138,221,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ ...mono, fontSize: 10, color: "#378ADD", fontWeight: 700 }}>{form.asset?.slice(0,3)}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ ...font, fontSize: 15, fontWeight: 500, color: "#e8f2ff" }}>{form.asset}</div>
                      <div style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{modalAssetLabel !== form.asset ? modalAssetLabel : ""}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ ...font, fontSize: 15, fontWeight: 500, color: "#e8f2ff" }}>
                        {modalPrice ? `$${Number(modalPrice.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}
                      </div>
                      {modalPrice && (
                        <div style={{ ...mono, fontSize: 8, color: modalPrice.marketOpen ? (modalPrice.changePct >= 0 ? "#3ddc84" : "#ff5a5a") : "rgba(255,255,255,0.3)", marginTop: 2 }}>
                          {modalPrice.marketOpen ? `${modalPrice.changePct >= 0 ? "▲" : "▼"} ${Math.abs(modalPrice.changePct).toFixed(2)}%` : "CLOSED"}
                        </div>
                      )}
                    </div>
                    <button onClick={() => { setForm(f => ({ ...f, asset: "" })); setModalAssetLabel(""); setModalSymbolSearch(""); setModalSearchResults([]); setModalPrice(null); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 16, marginLeft: 4, flexShrink: 0 }}>×</button>
                  </div>
                )}
                {/* Search results dropdown — inside header */}
                {!form.asset && (modalSearchResults.length > 0 || modalSearchLoading) && (
                  <div style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, overflow: "hidden", marginTop: 6 }}>
                    {modalSearchLoading && <div style={{ padding: "10px 14px", ...mono, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Searching...</div>}
                    {modalSearchResults.map(r => (
                      <div key={r.symbol} onClick={() => { setForm(f => ({ ...f, asset: r.symbol })); setModalAssetLabel(r.name); setModalSymbolSearch(r.symbol); setModalSearchResults([]); fetchModalPrice(r.symbol); }}
                        style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div style={{ ...mono, fontSize: 11, color: "#378ADD", minWidth: 52, fontWeight: 500 }}>{r.symbol}</div>
                        <div style={{ ...font, fontSize: 14, color: "#e8f2ff", flex: 1 }}>{(r.name || "").slice(0, 32)}</div>
                        <div style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{r.type}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Step 1 — Triggers */}
            {step === 1 && (
              <div>
                {/* Triggers — always visible, disabled if no asset */}
                <div style={{ padding: "20px 24px" }}>
                  <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 10 }}>FREE TRIGGERS</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                    {FREE_TRIGGERS.map(t => {
                      const iconBg  = t.id === "price_above" ? "rgba(26,138,68,0.12)" : t.id === "price_below" ? "rgba(204,34,34,0.12)" : "rgba(138,106,0,0.12)";
                      const iconCol = t.id === "price_above" ? T.green : t.id === "price_below" ? T.red : T.accent;
                      const disabled = !form.asset;
                      return (
                        <button key={t.id} onClick={() => { if (disabled) return; setForm(f => ({ ...f, trigger: t })); setStep(2); }} style={{
                          padding: "10px 14px", borderRadius: 10,
                          border: `1px solid ${T.border}`,
                          background: T.bgCard,
                          color: T.text, cursor: disabled ? "not-allowed" : "pointer", ...font,
                          textAlign: "left", display: "flex", gap: 12, alignItems: "center",
                          opacity: disabled ? 0.4 : 1, transition: "opacity 0.2s",
                        }}>
                          <div style={{ width: 32, height: 32, borderRadius: 7, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16, color: iconCol }}>{t.icon}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 500 }}>{t.label}</div>
                            <div style={{ ...mono, fontSize: 10, color: T.textFaint, marginTop: 2 }}>{t.desc}</div>
                          </div>
                          <span style={{ fontSize: 14, color: T.textFaint }}>→</span>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 10 }}>PRO TRIGGERS</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {PRO_TRIGGERS.map(t => {
                      const disabled = !form.asset;
                      return (
                        <button key={t.id} onClick={() => { if (disabled) return; if (!isPro) { setShowModal(false); setTab("pricing"); showToast("Pro plan required", "warn"); return; } setForm(f => ({ ...f, trigger: t })); setStep(2); }} style={{
                          padding: "10px 14px", borderRadius: 10,
                          border: `1px solid ${T.border}`,
                          background: T.bgCard,
                          cursor: disabled ? "not-allowed" : "pointer", ...font,
                          textAlign: "left", display: "flex", gap: 12, alignItems: "center",
                          opacity: disabled ? 0.4 : isPro ? 1 : 0.45, transition: "opacity 0.2s",
                        }}>
                          <div style={{ width: 32, height: 32, borderRadius: 7, background: T.bgDeep, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14, color: T.textFaint }}>{t.icon}</div>
                          <span style={{ flex: 1, fontSize: 14, color: T.text }}>{t.label}</span>
                          {!isPro
                            ? <span style={{ ...mono, fontSize: 8, color: T.textFaint, border: `1px solid ${T.border}`, padding: "2px 6px", borderRadius: 3, flexShrink: 0 }}>PRO</span>
                            : <span style={{ fontSize: 14, color: T.textFaint }}>→</span>
                          }
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 — Configure value */}
            {step === 2 && form.trigger && (
              <div style={{ padding: "22px 28px" }}>
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 22 }}>
                  <div style={{ background: "#0a1f4a", padding: "14px 18px", display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(55,138,221,0.2)", border: "1px solid rgba(55,138,221,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                      {form.trigger.icon}
                    </div>
                    <div>
                      <div style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{form.asset}</div>
                      <div style={{ fontSize: 18, color: "#e8f2ff", marginTop: 2 }}>{form.trigger.label}</div>
                    </div>
                  </div>
                  {modalPrice && (
                    <div style={{ background: T.bgCard, borderTop: `1px solid ${T.border}`, padding: "7px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ ...font, fontSize: 14, fontWeight: 500, color: T.text }}>${Number(modalPrice.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      {modalPrice.marketOpen
                        ? <span style={{ ...mono, fontSize: 10, color: modalPrice.changePct >= 0 ? T.green : T.red }}>{modalPrice.changePct >= 0 ? "▲" : "▼"} {Math.abs(modalPrice.changePct).toFixed(2)}% · {modalPrice.changePct >= 0 ? "+" : ""}{Number(modalPrice.change).toFixed(2)}</span>
                        : <span style={{ ...mono, fontSize: 9, color: T.textMid, border: `1px solid ${T.border}`, borderRadius: 3, padding: "1px 6px" }}>CLOSED</span>
                      }
                    </div>
                  )}
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

                {/* Webhook URL input — shown when webhook is selected */}
                {form.delivery.includes("webhook") && (
                  <div style={{ marginBottom: 22 }}>
                    <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 8 }}>WEBHOOK URL</div>
                    <input
                      type="url"
                      placeholder="https://your-server.com/webhook"
                      value={form.webhook_url}
                      onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))}
                      style={{ width: "100%", padding: "11px 14px", boxSizing: "border-box", background: T.bgInput, border: `1px solid ${form.webhook_url ? T.accent : T.border}`, borderRadius: 9, color: T.text, ...font, fontSize: 14, outline: "none" }}
                    />
                    <div style={{ ...mono, fontSize: 9, color: T.textFaint, marginTop: 6, lineHeight: 1.5 }}>
                      We'll POST a JSON payload with alert details when this alert fires.
                    </div>
                  </div>
                )}

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


// ── UpgradeModal — shown when free user hits 10-alert limit ─────────────────
function UpgradeModal({ T, font, mono, onClose, onUpgrade }) {
  const benefits = [
    { icon: "∞", title: "Unlimited alerts",       desc: "No cap — monitor as many assets as you want" },
    { icon: "⚡", title: "12 trigger types",       desc: "RSI, MACD, Bollinger Bands, Golden Cross and more" },
    { icon: "◈", title: "Multi-condition logic",  desc: "Combine AND/OR conditions in a single alert" },
    { icon: "↗", title: "SMS & Webhook delivery", desc: "Get notified via text or pipe into any workflow" },
    { icon: "⏱", title: "Custom cooldowns",       desc: "Control how often the same alert can fire" },
    { icon: "★", title: "Priority delivery",      desc: "Alerts processed first in the queue" },
  ];

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: T.bgModal, border: `1px solid ${T.border}`, borderRadius: 18, width: "100%", maxWidth: 480, boxShadow: "0 40px 80px rgba(0,0,0,0.3)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ background: T.btnPrimary, padding: "28px 32px 24px", position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: T.btnText, opacity: 0.5, cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
          <div style={{ ...mono, fontSize: 10, letterSpacing: "2px", color: T.btnText, opacity: 0.6, marginBottom: 8 }}>FREE PLAN LIMIT REACHED</div>
          <div style={{ fontSize: 24, color: T.btnText, marginBottom: 6 }}>You've used all 10 free alerts</div>
          <div style={{ ...mono, fontSize: 12, color: T.btnText, opacity: 0.65, lineHeight: 1.5 }}>Upgrade to Pro for unlimited alerts and advanced triggers</div>
        </div>

        {/* Benefits list */}
        <div style={{ padding: "24px 32px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            {benefits.map(b => (
              <div key={b.title} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 16, color: T.accent, flexShrink: 0, marginTop: 1 }}>{b.icon}</span>
                <div>
                  <div style={{ ...font, fontSize: 13, fontWeight: 500, color: T.text }}>{b.title}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.textFaint, marginTop: 2, lineHeight: 1.4 }}>{b.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Price + CTA */}
          <div style={{ background: T.bgDeep, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ ...mono, fontSize: 10, color: T.textFaint, letterSpacing: "1px" }}>PRO PLAN</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                <span style={{ fontSize: 28, color: T.text }}>$9</span>
                <span style={{ ...mono, fontSize: 11, color: T.textFaint }}>/mo</span>
              </div>
            </div>
            <button onClick={onUpgrade} style={{
              padding: "10px 24px", background: T.btnPrimary, border: "none", borderRadius: 9,
              cursor: "pointer", ...font, fontSize: 16, color: T.btnText,
            }}>
              UPGRADE NOW →
            </button>
          </div>

          <div style={{ textAlign: "center", ...mono, fontSize: 10, color: T.textFaint }}>
            14-day money-back guarantee · Cancel anytime
          </div>
        </div>
      </div>
    </div>
  );
}

// ── FlyingCard — ghost fade trail animation (concept #8) ────────────────────
// Card glides smoothly to chart, leaving fading ghost copies behind it.
function FlyingCard({ card, chartPanelRef, T, onDone }) {
  const elRef = useRef(null);

  useEffect(() => {
    if (!elRef.current || !chartPanelRef.current) { onDone(); return; }

    const el = elRef.current;
    const panelRect = chartPanelRef.current.getBoundingClientRect();
    const targetX   = panelRect.left + window.scrollX + panelRect.width  / 2 - card.w / 2;
    const targetY   = panelRect.top  + window.scrollY + panelRect.height / 2 - card.h / 2;

    // Container for ghost clones — appended to body so they are fixed-positioned
    const ghosts = [];
    let lastGhostFrame = -1;

    let start = null;
    const duration = 700;

    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    function spawnGhost(x, y) {
      const g = document.createElement('div');
      g.style.cssText = [
        'position:fixed',
        'top:0','left:0',
        `width:${card.w}px`,`height:${card.h}px`,
        `transform:translate(${x}px,${y}px)`,
        `background:${T.bgCard}`,
        `border:1px solid ${T.accent}`,
        'border-radius:11px',
        'pointer-events:none',
        'z-index:9998',
        'opacity:0.45',
        'transition:opacity 0.55s ease-out',
        'box-sizing:border-box',
        'padding:10px 14px',
        'display:flex','flex-direction:column','justify-content:center',
      ].join(';');
      g.innerHTML = `<div style="font-family:'Roboto',sans-serif;font-size:13px;font-weight:500;color:${T.text};opacity:0.5">${card.label}</div>`;
      document.body.appendChild(g);
      ghosts.push(g);
      // Fade out after short delay
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { g.style.opacity = '0'; });
      });
      setTimeout(() => g.remove(), 600);
    }

    function step(ts) {
      if (!start) start = ts;
      const raw  = Math.min((ts - start) / duration, 1);
      const ease = easeOutCubic(raw);

      const x = card.x + (targetX - card.x) * ease;
      const y = card.y + (targetY - card.y) * ease;
      const opacity = raw > 0.78 ? 1 - (raw - 0.78) * (1 / 0.22) : 1;

      el.style.transform = `translate(${x}px, ${y}px)`;
      el.style.opacity   = Math.max(0, opacity);

      // Spawn a ghost every ~8 animation frames while not fading out yet
      const frameNum = Math.floor(raw * 60);
      if (raw < 0.75 && frameNum % 8 === 0 && frameNum !== lastGhostFrame) {
        lastGhostFrame = frameNum;
        spawnGhost(x, y);
      }

      if (raw < 1) {
        requestAnimationFrame(step);
      } else {
        // Pulse chart panel
        if (chartPanelRef.current) {
          chartPanelRef.current.classList.add('chart-panel-pulse');
          setTimeout(() => chartPanelRef.current?.classList.remove('chart-panel-pulse'), 500);
        }
        onDone();
      }
    }

    requestAnimationFrame(step);

    return () => { ghosts.forEach(g => g.remove()); };
  }, []);

  return (
    <div
      ref={elRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: card.w,
        height: card.h,
        transform: `translate(${card.x}px, ${card.y}px)`,
        background: T.bgCard,
        border: `1.5px solid ${T.accent}`,
        borderRadius: 11,
        pointerEvents: "none",
        zIndex: 9999,
        padding: "10px 14px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        willChange: "transform, opacity",
      }}
    >
      <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 13, fontWeight: 500, color: T.text }}>{card.label}</div>
      <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: T.textFaint, marginTop: 2 }}>{card.symbol}</div>
    </div>
  );
}

// ── Candlestick Chart ────────────────────────────────────────────────────────
function CandlestickChart({ data, T, range }) {
  const [hover, setHover] = useState(null); // { x, y, candle, svgX, svgY }
  const svgRef = useRef(null);

  if (!data || !data.length) return <div style={{ padding: 20, textAlign: "center", color: "#6a6050", fontSize: 12 }}>No data</div>;

  const W = range === "1M" ? 700 : 600, H = 200, PAD = { top: 10, right: 10, bottom: 24, left: 52 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const highs = data.map(d => d.h).filter(v => v != null);
  const lows  = data.map(d => d.l).filter(v => v != null);
  const minP  = lows.length ? Math.min(...lows) : 0;
  const maxP  = highs.length ? Math.max(...highs) : 1;
  const priceRange = maxP - minP || 1;

  const scaleY  = p => cH - ((p - minP) / priceRange) * cH;
  const barW    = range === "1M"
    ? Math.max(1, (cW / data.length) * 0.5)
    : Math.max(1, Math.min(12, (cW / data.length) * 0.7));
  const spacing = data.length > 0 ? cW / data.length : 1;

  const fmtPrice = n => n >= 1000
    ? `$${(n/1000).toFixed(1)}k`
    : `$${Number(n).toFixed(2)}`;

  const yTicks = 4;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => minP + (priceRange * i) / yTicks);

  function formatXLabel(ts) {
    const dt = new Date(ts);
    if (range === "1M") return dt.getFullYear().toString();
    else if (range === "1W") return dt.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    else if (range === "1D") return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    else return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatTooltipDate(ts) {
    const dt = new Date(ts);
    if (range === "15m") return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function getXLabels() {
    if (range === "1M") {
      const byYear = {};
      data.forEach((d, i) => {
        const year = new Date(d.t).getFullYear();
        if (!byYear[year]) byYear[year] = [];
        byYear[year].push({ d, i });
      });
      return Object.values(byYear).map(candles => {
        const mid = Math.floor(candles.length / 2);
        return candles[mid];
      });
    }
    const xStep = Math.ceil(data.length / 5);
    return data
      .map((d, i) => ({ d, i }))
      .filter(({ i }) => i % xStep === 0 || i === data.length - 1);
  }

  const xLabels = getXLabels();

  function handleMouseMove(e) {
    if (!svgRef.current || !data.length) return;
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleYr = H / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const svgX = (clientX - rect.left) * scaleX;
    const svgY = (clientY - rect.top) * scaleYr;

    // Find closest candle
    const idx = Math.round((svgX - PAD.left - spacing / 2) / spacing);
    const clampedIdx = Math.max(0, Math.min(data.length - 1, idx));
    const candle = data[clampedIdx];
    const candleX = PAD.left + clampedIdx * spacing + spacing / 2;

    // Interpolate price from Y position
    const priceAtY = minP + ((cH - (svgY - PAD.top)) / cH) * priceRange;

    setHover({ svgX: candleX, svgY, candle, priceAtY, idx: clampedIdx });
  }

  return (
    <div style={{ position: "relative" }} onMouseLeave={() => setHover(null)} onTouchEnd={() => setHover(null)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block", cursor: hover ? "crosshair" : "default", touchAction: "none" }}
        onMouseMove={handleMouseMove}
        onTouchMove={(e) => { e.preventDefault(); handleMouseMove(e); }}
        onTouchStart={(e) => { e.preventDefault(); handleMouseMove(e); }}
      >
        <text x="300" y="9" textAnchor="middle" fontSize="8" fill="#aaa" fontFamily="monospace">{`${data.length} candles · ${data.length > 0 ? new Date(data[0].t).toLocaleDateString("en-US",{month:"short",year:"numeric"}) : ""} → ${data.length > 0 ? new Date(data[data.length-1].t).toLocaleDateString("en-US",{month:"short",year:"numeric"}) : ""}`}</text>
        {/* Y grid lines + labels */}
        {yLabels.map((v, i) => {
          const y = PAD.top + scaleY(v);
          return (
            <g key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y}
                stroke={T.border} strokeWidth="0.5" strokeDasharray="3,3" />
              <text x={PAD.left - 4} y={y + 4} textAnchor="end"
                fontSize="9" fill={T.textFaint} fontFamily="'DM Mono',monospace">
                {fmtPrice(v)}
              </text>
            </g>
          );
        })}

        {/* Candles */}
        {data.map((d, i) => {
          const x     = PAD.left + i * spacing + spacing / 2;
          const up    = d.c >= d.o;
          const col   = up ? T.green : T.red;
          const top   = PAD.top + scaleY(Math.max(d.o, d.c));
          const bot   = PAD.top + scaleY(Math.min(d.o, d.c));
          const hHi   = PAD.top + scaleY(d.h);
          const hLo   = PAD.top + scaleY(d.l);
          const bodyH = Math.max(1, bot - top);

          return (
            <g key={i}>
              <line x1={x} x2={x} y1={hHi} y2={hLo} stroke={col} strokeWidth="1" />
              <rect x={x - barW/2} y={top} width={barW} height={bodyH}
                fill={col} stroke={col} strokeWidth="0.5" fillOpacity={0.9} />
            </g>
          );
        })}

        {/* Crosshair */}
        {hover && hover.svgY >= PAD.top && hover.svgY <= H - PAD.bottom && (
          <g style={{ pointerEvents: "none" }}>
            {/* Vertical line */}
            <line x1={hover.svgX} x2={hover.svgX} y1={PAD.top} y2={H - PAD.bottom}
              stroke={T.textFaint} strokeWidth="0.5" strokeDasharray="4,3" opacity="0.7" />
            {/* Horizontal line */}
            <line x1={PAD.left} x2={W - PAD.right} y1={hover.svgY} y2={hover.svgY}
              stroke={T.textFaint} strokeWidth="0.5" strokeDasharray="4,3" opacity="0.7" />
            {/* Price label on Y axis */}
            <rect x={0} y={hover.svgY - 8} width={PAD.left - 2} height={16} rx="3" fill={T.text} />
            <text x={PAD.left - 6} y={hover.svgY + 3.5} textAnchor="end" fontSize="8" fill={T.bg} fontFamily="'DM Mono',monospace" fontWeight="500">
              {fmtPrice(hover.priceAtY)}
            </text>
            {/* Date label on X axis */}
            {hover.candle && (
              <>
                <rect x={hover.svgX - 32} y={H - PAD.bottom + 2} width={64} height={16} rx="3" fill={T.text} />
                <text x={hover.svgX} y={H - PAD.bottom + 13} textAnchor="middle" fontSize="7.5" fill={T.bg} fontFamily="'DM Mono',monospace" fontWeight="500">
                  {formatTooltipDate(hover.candle.t)}
                </text>
              </>
            )}
            {/* Dot at crosshair intersection */}
            <circle cx={hover.svgX} cy={hover.svgY} r="3" fill={T.text} stroke={T.bg} strokeWidth="1.5" />
          </g>
        )}

        {/* X axis labels */}
        {xLabels.map(({ d, i }) => {
          const x = PAD.left + i * spacing + spacing / 2;
          return (
            <text key={i} x={x} y={H - 4} textAnchor="middle"
              fontSize="9" fill={T.textFaint} fontFamily="'DM Mono',monospace">
              {formatXLabel(d.t)}
            </text>
          );
        })}
      </svg>

      {/* OHLC tooltip */}
      {hover && hover.candle && hover.svgY >= PAD.top && hover.svgY <= H - PAD.bottom && (
        <div style={{
          position: "absolute", top: 4, right: 4, pointerEvents: "none",
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 6,
          padding: "6px 10px", display: "flex", gap: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: T.textFaint }}>
            O <span style={{ color: T.text, fontWeight: 500 }}>{fmtPrice(hover.candle.o)}</span>
          </div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: T.textFaint }}>
            H <span style={{ color: T.green, fontWeight: 500 }}>{fmtPrice(hover.candle.h)}</span>
          </div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: T.textFaint }}>
            L <span style={{ color: T.red, fontWeight: 500 }}>{fmtPrice(hover.candle.l)}</span>
          </div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: T.textFaint }}>
            C <span style={{ color: hover.candle.c >= hover.candle.o ? T.green : T.red, fontWeight: 500 }}>{fmtPrice(hover.candle.c)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pricing page (inline) ─────────────────────────────────────────────────────

function PricingPage({ T, font, mono, currentPlan, onUpgrade, isMobile }) {
  const isFree = !currentPlan || currentPlan === "free";
  const proPriceId = import.meta.env.VITE_STRIPE_PRO_PRICE_ID;

  const freeFeatures = ["10 active alerts","Price above / below","% change alerts","Push & Email"];
  const proFeatures  = ["Unlimited alerts","All 12 trigger types","Multi-condition AND/OR","90-day backtesting","SMS & Webhook","Alert cooldown","Priority delivery"];

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: isMobile ? 20 : 40 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: "3px", color: T.textFaint, marginBottom: 10 }}>PRICING</div>
        <div style={{ ...font, fontSize: isMobile ? 24 : 36, fontWeight: 500, color: T.text }}>Simple, transparent pricing</div>
        <div style={{ ...font, fontSize: isMobile ? 13 : 15, color: T.textMid, marginTop: 8 }}>Start free. Upgrade when you need more power.</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 16 : 24, maxWidth: 900, margin: "0 auto" }}>
        {/* Free card */}
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, padding: "36px 32px" }}>
          <div style={{ ...mono, fontSize: 10, letterSpacing: "2px", color: T.textFaint, marginBottom: 8 }}>FREE</div>
          <div style={{ ...font, fontSize: 48, fontWeight: 500, color: T.text, marginBottom: 4 }}>$0</div>
          <div style={{ ...font, fontSize: 14, color: T.textMid, marginBottom: 28 }}>For casual watchers</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
            {freeFeatures.map(f => (
              <div key={f} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ color: T.green, fontSize: 14 }}>✓</span>
                <span style={{ ...font, fontSize: 15, color: T.text }}>{f}</span>
              </div>
            ))}
          </div>
          {isFree ? (
            <div style={{ textAlign: "center", padding: 12, border: `1px solid ${T.border}`, borderRadius: 10, ...mono, fontSize: 11, color: T.textFaint }}>✓ CURRENT PLAN</div>
          ) : (
            <div style={{ textAlign: "center", padding: 12, border: `1px solid ${T.border}`, borderRadius: 10, ...mono, fontSize: 11, color: T.textFaint }}>FREE PLAN</div>
          )}
        </div>

        {/* Pro card — cobalt filled */}
        <div style={{ background: "#0a1f4a", borderRadius: 16, padding: "36px 32px", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, right: 0, width: 150, height: 150, background: "radial-gradient(circle, rgba(55,138,221,0.15), transparent)", borderRadius: "0 16px 0 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ ...mono, fontSize: 10, letterSpacing: "2px", color: "#378ADD" }}>PRO</div>
            <div style={{ ...mono, fontSize: 8, letterSpacing: "1.5px", color: "#378ADD", background: "rgba(55,138,221,0.15)", padding: "3px 8px", borderRadius: 4 }}>RECOMMENDED</div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
            <span style={{ ...font, fontSize: 48, fontWeight: 500, color: "#e8f2ff" }}>$9</span>
            <span style={{ ...font, fontSize: 16, color: "rgba(255,255,255,0.4)" }}>/mo</span>
          </div>
          <div style={{ ...font, fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 28 }}>For serious traders</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
            {proFeatures.map(f => (
              <div key={f} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ color: "#3ddc84", fontSize: 14 }}>✓</span>
                <span style={{ ...font, fontSize: 15, color: "rgba(255,255,255,0.85)" }}>{f}</span>
              </div>
            ))}
          </div>
          {isFree ? (
            <button onClick={() => proPriceId && onUpgrade(proPriceId)} style={{
              width: "100%", padding: 14, background: "#e8f2ff", color: "#0a1f4a",
              border: "none", borderRadius: 10, ...font, fontSize: 16, fontWeight: 500, cursor: "pointer",
            }}>Upgrade to Pro →</button>
          ) : (
            <div style={{ textAlign: "center", padding: 12, border: "1px solid rgba(55,138,221,0.3)", borderRadius: 10, ...mono, fontSize: 11, color: "#378ADD", background: "rgba(55,138,221,0.1)" }}>✓ PRO ACTIVE</div>
          )}
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 24, ...mono, fontSize: 10, color: T.textFaint }}>14-day money-back guarantee · Cancel anytime</div>
    </div>
  );
}
