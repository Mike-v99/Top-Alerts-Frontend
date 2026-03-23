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

  // Local alerts for unauthenticated users
  const [localAlerts, setLocalAlerts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ta-local-alerts") || "[]"); } catch { return []; }
  });
  function saveLocalAlerts(arr) {
    setLocalAlerts(arr);
    try { localStorage.setItem("ta-local-alerts", JSON.stringify(arr)); } catch {}
  }
  // Combined alerts — server + local
  const allAlerts = user ? alerts : localAlerts;

  function handleDeleteAlert(id) {
    if (String(id).startsWith("local-")) {
      saveLocalAlerts(localAlerts.filter(a => a.id !== id));
    } else {
      deleteAlert(id);
    }
  }
  function handleTogglePause(id) {
    if (String(id).startsWith("local-")) {
      saveLocalAlerts(localAlerts.map(a => a.id === id ? { ...a, status: a.status === "paused" ? "active" : "paused" } : a));
    } else {
      togglePause(id);
    }
  }

  const [themeName, setThemeName] = useState("paper");
  const [tab,       setTab]       = useState("market");
  const [showModal, setShowModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showProBanner, setShowProBanner] = useState(false);
  const [proBannerExiting, setProBannerExiting] = useState(false);

  // Show Pro banner briefly on login/refresh
  useEffect(() => {
    if (isPro && user) {
      setShowProBanner(true);
      setProBannerExiting(false);
      const timer = setTimeout(() => {
        setProBannerExiting(true);
        setTimeout(() => { setShowProBanner(false); setProBannerExiting(false); }, 400);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isPro, user]);
  const [step,      setStep]      = useState(1);
  const [toast,     setToast]     = useState(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.top = `-${window.scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
      window.scrollTo(0, parseInt(scrollY || "0") * -1);
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
    };
  }, [showModal]);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [mobileExpanded, setMobileExpanded] = useState(null); // symbol of expanded ticker
  const [mobileNewsOpen, setMobileNewsOpen] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState(null); // id of expanded alert card
  const [editMode, setEditMode] = useState(false); // watchlist reorder mode
  const [desktopEditMode, setDesktopEditMode] = useState(false); // desktop watchlist edit
  const [desktopCardOrder, setDesktopCardOrder] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("ta-desktop-order"));
      if (saved && saved.length) return saved;
    } catch {}
    return MARKET_SYMBOLS.map(m => m.symbol);
  });
  const [hiddenCards, setHiddenCards] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ta-hidden-cards") || "[]"); } catch { return []; }
  });
  const [marketView, setMarketView] = useState("watchlist"); // "watchlist" or "hotlist"
  const [hotlistFilter, setHotlistFilter] = useState("gainers"); // gainers, losers, + pro filters
  const [hotlistProOpen, setHotlistProOpen] = useState(false); // pro dropdown open
  const [hotlistData, setHotlistData] = useState({ gainers: [], losers: [] });
  const [expandedHotlist, setExpandedHotlist] = useState(null); // symbol of expanded hotlist card
  const [mobileChartFull, setMobileChartFull] = useState(false); // fullscreen chart overlay
  const [mobileProTriggersOpen, setMobileProTriggersOpen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(() => typeof window !== "undefined" && window.innerWidth > window.innerHeight);

  async function shareTicker(symbol, label, price, changePct) {
    const text = `Check out ${label || symbol} (${symbol}) on Top-Alerts — currently $${Number(price).toFixed(2)} (${changePct >= 0 ? "▲" : "▼"} ${Math.abs(changePct).toFixed(2)}% today)`;
    const url = `https://top-alerts.com?symbol=${symbol}`;

    // Pro users get chart screenshot
    if (isPro) {
      try {
        showToast("Capturing chart...");
        // Dynamically load html2canvas if not loaded
        if (!window.html2canvas) {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        const cardEl = document.getElementById(`swipe-card-${symbol}`);
        if (cardEl && window.html2canvas) {
          const canvas = await window.html2canvas(cardEl, {
            backgroundColor: "#faf9f6",
            scale: 2,
            useCORS: true,
            logging: false,
          });
          const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
          const file = new File([blob], `${symbol}-chart.png`, { type: "image/png" });

          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `${label || symbol} — $${Number(price).toFixed(2)}`,
              text,
              url,
              files: [file],
            });
            return;
          } else {
            // Fallback: download the image
            const link = document.createElement("a");
            link.href = canvas.toDataURL("image/png");
            link.download = `${symbol}-chart.png`;
            link.click();
            showToast("Chart screenshot saved!");
            return;
          }
        }
      } catch (err) {
        console.error("Screenshot share failed:", err);
        // Fall through to text share
      }
    }

    // Free users (or screenshot fallback): text + URL share
    if (navigator.share) {
      navigator.share({ title: `${label || symbol} — $${Number(price).toFixed(2)}`, text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`).then(() => showToast("Copied to clipboard", "ok")).catch(() => {});
    }
  }

  const [swipedJustNow, setSwipedJustNow] = useState(false);
  const swipeRefs = useRef({}); // { symbol: { startX, startY, currentX, isHorizontal, el } }
  const [swipeRender, setSwipeRender] = useState(0); // force re-render for swipe visuals

  function handleTouchStart(symbol, e) {
    const touch = e.touches[0];
    swipeRefs.current[symbol] = { startX: touch.clientX, startY: touch.clientY, currentX: touch.clientX, isHorizontal: null };
    setSwipedJustNow(false);
  }
  function handleTouchMove(symbol, e) {
    const s = swipeRefs.current[symbol];
    if (!s) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - s.startX);
    const dy = Math.abs(touch.clientY - s.startY);
    if (s.isHorizontal === null && (dx > 8 || dy > 8)) {
      s.isHorizontal = dx > dy;
    }
    if (s.isHorizontal === false) return;
    s.currentX = touch.clientX;
    // Directly update DOM for smooth performance
    const el = document.getElementById(`swipe-card-${symbol}`);
    if (el) {
      const diff = Math.max(0, s.startX - s.currentX);
      el.style.transform = `translateX(-${diff}px)`;
      el.style.transition = "none";
    }
  }
  function handleTouchEnd(symbol) {
    const s = swipeRefs.current[symbol];
    if (!s) return;
    const diff = s.startX - s.currentX;
    const el = document.getElementById(`swipe-card-${symbol}`);
    const wrapper = document.getElementById(`swipe-wrapper-${symbol}`);
    if (s.isHorizontal && diff > 120) {
      // Animate card off screen
      if (el) {
        el.style.transition = "transform 0.2s ease";
        el.style.transform = "translateX(-100%)";
      }
      setSwipedJustNow(true);
      // After card slides out, collapse the row height
      setTimeout(() => {
        if (wrapper) {
          wrapper.style.transition = "max-height 0.25s ease, opacity 0.25s ease, margin 0.25s ease";
          wrapper.style.maxHeight = "0px";
          wrapper.style.opacity = "0";
          wrapper.style.marginBottom = "0px";
          wrapper.style.overflow = "hidden";
        }
        // After collapse animation, remove from state
        setTimeout(() => {
          removeFromWatchlist(symbol);
          setSwipedJustNow(false);
        }, 250);
      }, 200);
    } else {
      // Snap back
      if (el) {
        el.style.transition = "transform 0.25s ease";
        el.style.transform = "translateX(0)";
      }
      if (s.isHorizontal && diff > 10) {
        setSwipedJustNow(true);
        setTimeout(() => setSwipedJustNow(false), 200);
      }
    }
    delete swipeRefs.current[symbol];
  }
  // Swipe offset is now handled via direct DOM manipulation in handleTouchMove

  // ── Edit mode reorder — simple move up/down ─────────────────────────
  // Edit mode — reorder disabled (static list)
  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768);
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", () => setTimeout(check, 100));
    return () => { window.removeEventListener("resize", check); window.removeEventListener("orientationchange", check); };
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
  const [earningsDates, setEarningsDates] = useState([]); // [{ date, epsEstimate, revenueEstimate, quarter }]
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
          const isLive = !!(t.lastTrade?.p || (t.day?.c && t.day.c !== 0));
          const price = isLive ? (t.lastTrade?.p || t.day?.c || t.min?.c || 0) : (t.prevDay?.c || 0);
          const prevClose = t.prevDay?.c || 0;
          const prevOpen = t.prevDay?.o || 0;
          // Live market: use API's todaysChange values
          // Closed market: calculate Friday's open→close change
          const change = isLive ? (t.todaysChange || 0) : (prevClose && prevOpen ? prevClose - prevOpen : 0);
          const changePct = isLive ? (t.todaysChangePerc || 0) : (prevOpen && prevOpen !== 0 ? ((prevClose - prevOpen) / prevOpen) * 100 : 0);
          return {
            id: symbolToId[t.ticker] || t.ticker,
            symbol: t.ticker,
            price,
            change,
            changePct,
            prevClose,
            high: isLive ? (t.day?.h || 0) : (t.prevDay?.h || 0),
            low: isLive ? (t.day?.l || 0) : (t.prevDay?.l || 0),
            open: isLive ? (t.day?.o || 0) : (t.prevDay?.o || 0),
            volume: isLive ? (t.day?.v || 0) : (t.prevDay?.v || 0),
            prevVolume: t.prevDay?.v || 0,
            marketOpen: isLive,
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
      let wsRetries = 0;
      ws.onclose = (e) => { console.log("[WS] closed", e.code); if (!destroyed && wsRetries < 3) { wsRetries++; setTimeout(connectWS, 5000); } };
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
    setChartRange("5m");
    fetchChart("DIA", "5m");
    fetchTickerDetails("DIA");
    if (window.innerWidth >= 768) fetchTickerNews("DIA");
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

  // Sync local alerts to server when user logs in
  useEffect(() => {
    if (!user) return;
    const locals = JSON.parse(localStorage.getItem("ta-local-alerts") || "[]");
    if (locals.length === 0) return;
    (async () => {
      for (const la of locals) {
        try {
          await createAlert({
            asset: la.asset,
            asset_type: la.asset_type,
            trigger_type: la.trigger_type,
            trigger_value: la.trigger_value,
            delivery: la.delivery,
            webhook_url: la.webhook_url,
            cooldown_mins: la.cooldown_mins,
          });
        } catch (e) { console.error("Sync local alert failed:", e); }
      }
      localStorage.removeItem("ta-local-alerts");
      setLocalAlerts([]);
      showToast(`${locals.length} alert${locals.length > 1 ? "s" : ""} synced to your account`);
    })();
  }, [user]);

  // ── Hotlist data fetching ──────────────────────────────────────────────
  useEffect(() => {
    if (marketView !== "hotlist" && tab !== "hotlist") return;
    const key = import.meta.env.VITE_MASSIVE_KEY || "";
    if (!key) return;
    (async () => {
      try {
        // First try the live gainers/losers endpoints
        const res = await fetch(`https://api.massive.com/v2/snapshot/locale/us/markets/stocks/gainers?apiKey=${key}`);
        const data = await res.json();
        const liveGainers = (data.tickers || []).slice(0, 20).map(t => ({
          symbol: t.ticker, name: t.ticker,
          price: t.lastTrade?.p || t.day?.c || t.prevDay?.c || 0,
          changePct: t.todaysChangePerc || 0,
          change: t.todaysChange || 0,
          volume: t.day?.v || t.prevDay?.v || 0,
        })).filter(t => t.price > 1).slice(0, 10);

        const res2 = await fetch(`https://api.massive.com/v2/snapshot/locale/us/markets/stocks/losers?apiKey=${key}`);
        const data2 = await res2.json();
        const liveLosers = (data2.tickers || []).slice(0, 20).map(t => ({
          symbol: t.ticker, name: t.ticker,
          price: t.lastTrade?.p || t.day?.c || t.prevDay?.c || 0,
          changePct: t.todaysChangePerc || 0,
          change: t.todaysChange || 0,
          volume: t.day?.v || t.prevDay?.v || 0,
        })).filter(t => t.price > 1).slice(0, 10);

        if (liveGainers.length > 0 || liveLosers.length > 0) {
          setHotlistData({ gainers: liveGainers, losers: liveLosers });
          return;
        }

        // Market closed — build hotlist from snapshot of popular tickers using prevDay data
        const popular = "AAPL,MSFT,NVDA,TSLA,AMZN,GOOGL,META,NFLX,AMD,INTC,PLTR,SOFI,RIVN,LCID,NIO,MSTR,SMCI,COIN,HOOD,RKLB,BA,DIS,PYPL,SQ,SHOP,SNAP,UBER,ABNB,CRWD,SNOW,JPM,GS,BAC,WFC,V,MA,UNH,JNJ,PFE,LLY,XOM,CVX,COP,LULU,NKE,SBUX,MCD,WMT,COST,TGT".split(",");
        const snapRes = await fetch(`https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${popular.join(",")}&apiKey=${key}`);
        const snapData = await snapRes.json();
        const allTickers = (snapData.tickers || []).map(t => {
          const prevClose = t.prevDay?.c || 0;
          const prevOpen = t.prevDay?.o || 0;
          const change = prevClose && prevOpen ? prevClose - prevOpen : 0;
          const changePct = prevOpen && prevOpen !== 0 ? ((prevClose - prevOpen) / prevOpen) * 100 : 0;
          return {
            symbol: t.ticker, name: t.ticker,
            price: prevClose,
            changePct,
            change,
            volume: t.prevDay?.v || 0,
          };
        }).filter(t => t.price > 1);

        const sorted = [...allTickers].sort((a, b) => b.changePct - a.changePct);
        const fallbackGainers = sorted.filter(t => t.changePct > 0).slice(0, 10);
        const fallbackLosers = sorted.filter(t => t.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 10);

        setHotlistData({ gainers: fallbackGainers, losers: fallbackLosers });
      } catch (e) { console.error("Hotlist fetch error:", e); }
    })();
  }, [marketView, tab]);

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

      if (range === "5m") {
        // 1 day chart — 5 min candles
        const start = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
        const results = await getAggs(5, "minute", fmt(start), fmt(now));
        if (results.length) setChartData(results.map(mapR));
      } else if (range === "15m") {
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

  // ── Earnings dates (4 quarters) ────────────────────────────────────────
  async function fetchEarningsDates(symbol) {
    setEarningsDates([]);
    try {
      const fKey = import.meta.env.VITE_FINNHUB_KEY || "";
      if (!fKey) return;
      const now = new Date();
      const pad = n => String(n).padStart(2, "0");
      const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      // Fetch a wide range: 6 months back + 12 months forward to find 4 quarters
      const from = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      const to = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      const res = await fetch(`https://finnhub.io/api/v1/calendar/earnings?symbol=${symbol}&from=${fmt(from)}&to=${fmt(to)}&token=${fKey}`);
      const data = await res.json();
      console.log("[Earnings]", symbol, "response:", (data.earningsCalendar || []).length, "events");
      const all = (data.earningsCalendar || [])
        .filter(e => e.symbol === symbol)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      // Get the next 4 upcoming (or mix of past + upcoming to fill 4)
      const upcoming = all.filter(e => new Date(e.date) >= now);
      const past = all.filter(e => new Date(e.date) < now).slice(-2);
      const combined = [...past, ...upcoming].slice(0, 4);
      setEarningsDates(combined.map(e => ({
        date: e.date,
        quarter: e.quarter || null,
        year: e.year || null,
        epsEstimate: e.epsEstimate || null,
        epsActual: e.epsActual || null,
        revenueEstimate: e.revenueEstimate || null,
        revenueActual: e.revenueActual || null,
        hour: e.hour || null, // "bmo" (before market open) or "amc" (after market close)
      })));
    } catch (e) { console.error("Earnings dates fetch failed", e); }
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
    setChartRange("5m");
    fetchChart(symbol, "5m");
    fetchTickerDetails(symbol);
    if (!isMobile) fetchTickerNews(symbol);
    fetch52Week(symbol);
    fetchEarningsDates(symbol);
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
        const isLive = !!(t?.lastTrade?.p || (t?.day?.c && t.day.c !== 0));
        const price = isLive ? (t?.lastTrade?.p || t?.day?.c || t?.min?.c || 0) : (t?.prevDay?.c || 0);
        if (price !== 0) {
          const prevClose = t.prevDay?.c || 0;
          const prevOpen = t.prevDay?.o || 0;
          setWatchData(prev => ({ ...prev, [symbol]: {
            id: symbol, symbol, price,
            change: isLive ? (t.todaysChange || 0) : (prevClose && prevOpen ? prevClose - prevOpen : 0),
            changePct: isLive ? (t.todaysChangePerc || 0) : (prevOpen ? ((prevClose - prevOpen) / prevOpen) * 100 : 0),
            prevClose,
            high: isLive ? (t.day?.h || 0) : (t.prevDay?.h || 0),
            low: isLive ? (t.day?.l || 0) : (t.prevDay?.l || 0),
            open: isLive ? (t.day?.o || 0) : prevOpen,
            volume: isLive ? (t.day?.v || 0) : (t.prevDay?.v || 0),
            prevVolume: t.prevDay?.v || 0,
            marketOpen: isLive,
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
    const activeAlerts = allAlerts.filter(a => a.status !== "deleted").length;
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

    // If not logged in, save to localStorage
    if (!user) {
      const localAlert = {
        id: `local-${Date.now()}`,
        asset: form.asset,
        asset_type: form.asset.includes("/") ? "crypto" : "stock",
        trigger_type: form.trigger.id,
        trigger_value: tv,
        delivery: form.delivery,
        webhook_url: form.delivery.includes("webhook") ? form.webhook_url : null,
        cooldown_mins: parseInt(form.cooldown),
        status: "active",
        created_at: new Date().toISOString(),
        local: true, // flag for syncing later
      };
      const updated = [...localAlerts, localAlert];
      saveLocalAlerts(updated);
      setShowModal(false);
      showToast("Alert saved locally — sign in to enable delivery");
      return;
    }

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
        @keyframes slideUpIn { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideDownOut { from { transform: translateY(0); opacity: 1; } to { transform: translateY(100%); opacity: 0; } }
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
              <span style={{ fontSize: isMobile ? 20 : 38, color: isMobile ? T.text : themeName === "charcoal" ? "#e0e0e0" : "#5F5E5A", lineHeight: 1 }}>◈</span>
              <span style={{ fontSize: isMobile ? 22 : 45, letterSpacing: "1px", fontWeight: isMobile ? 700 : 400 }}>
                <span style={{ color: isMobile ? T.text : themeName === "charcoal" ? "#e0e0e0" : "#5F5E5A" }}>TOP</span>
                <span style={{ color: isMobile ? T.text : themeName === "charcoal" ? "#e0e0e0" : "#5F5E5A" }}>-</span>
                <span style={{ color: isMobile ? T.text : themeName === "charcoal" ? "#e0e0e0" : "#5F5E5A" }}>ALERTS</span>
              </span>
            </div>
            {!isMobile && <div style={{ ...mono, fontSize: 9, letterSpacing: "3px", color: themeName === "charcoal" ? "#888" : "#5F5E5A", marginTop: 2 }}>INTELLIGENT PRICE ALERTS</div>}
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

            {/* User profile / sign in */}
            {user ? (
              <button onClick={() => setShowProfile(p => !p)} style={{
                ...font, fontSize: isMobile ? 14 : 16, background: T.bgCard, border: `1px solid ${T.border}`,
                borderRadius: 8, padding: isMobile ? "6px 12px" : "8px 14px", cursor: "pointer", color: T.text,
                display: "flex", alignItems: "center", gap: 6, fontWeight: 500,
              }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#0a1f4a", color: "#e8f2ff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                  {(user?.email?.[0] || "U").toUpperCase()}
                </span>
                {!isMobile && <span>{user?.email?.split("@")[0]}</span>}
              </button>
            ) : (
              <button onClick={() => navigate("/login")} style={{
                ...font, fontSize: isMobile ? 14 : 18, background: "none",
                border: `2px solid ${isMobile ? T.text : themeName === "charcoal" ? "#e0e0e0" : T.textMid}`,
                borderRadius: 8, padding: isMobile ? "4px 10px" : "6px 16px", cursor: "pointer",
                color: isMobile ? T.text : themeName === "charcoal" ? "#e0e0e0" : "#5F5E5A",
                fontWeight: isMobile ? 600 : 400,
              }}>
                SIGN IN
              </button>
            )}
          </div>
        </div>

        {/* Pro plan active banner — slides up into place, then slides back down */}
        {showProBanner && (
          <div style={{ overflow: "hidden", marginBottom: 12 }}>
            <div style={{
              background: "linear-gradient(135deg,#0a1f4a,#1a3a6a)", borderRadius: 12, padding: "16px 20px",
              display: "flex", alignItems: "center", gap: 12,
              boxShadow: "0 4px 16px rgba(10,31,74,0.2)",
              animation: proBannerExiting ? "slideDownOut 0.4s ease forwards" : "slideUpIn 0.4s cubic-bezier(0.22,1,0.36,1) forwards",
            }}>
              <span style={{ fontSize: 22 }}>⚡</span>
              <div style={{ flex: 1 }}>
                <div style={{ ...font, fontSize: 16, fontWeight: 600, color: "#e8f2ff" }}>Pro Plan Active</div>
                <div style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>All premium features unlocked</div>
              </div>
              <button onClick={() => { setProBannerExiting(true); setTimeout(() => { setShowProBanner(false); setProBannerExiting(false); }, 400); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", flexWrap: isMobile ? "wrap" : "nowrap", gap: isMobile ? 0 : 0, marginBottom: isMobile ? 10 : 28, borderBottom: `1px solid ${T.border}` }}>
          {(isPro ? ["market","hotlist","alerts","calendar"] : ["market","hotlist","alerts","calendar","pricing"]).map(t => (
            <button key={t} onClick={() => { setTab(t); if (t === "hotlist") setMarketView("hotlist"); }} style={{
              padding: isMobile ? "8px 10px" : "10px 22px", background: "none", border: "none", cursor: "pointer",
              ...font, fontSize: isMobile ? 13 : 20, letterSpacing: isMobile ? "0.5px" : "1px", fontWeight: isMobile && tab === t ? 700 : (t === "alerts" || t === "hotlist" ? 600 : 400),
              color: t === "alerts" ? "#cc2222" : t === "hotlist" ? (tab === t ? "#f5a623" : "#c89000") : (tab === t ? (isMobile ? T.text : T.activeTab) : T.textMid),
              borderBottom: tab === t ? `2px solid ${t === "alerts" ? "#cc2222" : t === "hotlist" ? "#f5a623" : (isMobile ? T.text : T.activeTabBorder)}` : "2px solid transparent",
              marginBottom: -1, transition: "all 0.2s", flexShrink: 0,
            }}>
              {t === "hotlist" ? "🔥 HOTLIST" : t.toUpperCase()}
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
                background: T.bgCard, border: isMobile ? `2px solid ${search ? T.accent : T.textMid}` : `1px solid ${search ? T.accent : T.border}`,
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

        {/* Hotlist tab — desktop full page */}
        {tab === "hotlist" && !isMobile && (
          <div>
            {/* Filter pills */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
              <span onClick={() => setHotlistFilter("gainers")} style={{
                ...mono, fontSize: 12, cursor: "pointer",
                background: hotlistFilter === "gainers" || hotlistFilter === "losers" ? "#0a1f4a" : T.bgCard,
                color: hotlistFilter === "gainers" || hotlistFilter === "losers" ? "#e8f2ff" : T.textMid,
                border: `1px solid ${hotlistFilter === "gainers" || hotlistFilter === "losers" ? "#0a1f4a" : T.border}`,
                borderRadius: 8, padding: "8px 16px", fontWeight: 600,
              }}>🟢 Gainers & 🔴 Losers</span>
              <span style={{ width: 1, height: 24, background: T.border }} />
              {["Volume","Volatile","52W High","52W Low","Pre-Market","After-Hours"].map(fl => {
                const fKey = fl.toLowerCase().replace(/\s+/g, '_');
                const isActive = hotlistFilter === fKey;
                return (
                <span key={fl} onClick={() => {
                  if (isPro) { setHotlistFilter(fKey); }
                  else { showToast("Pro plan required", "warn"); }
                }} style={{
                  ...mono, fontSize: 12,
                  color: isActive ? "#e8f2ff" : T.textFaint,
                  background: isActive ? "#0a1f4a" : T.bgCard,
                  border: `1px solid ${isActive ? "#0a1f4a" : T.border}`, borderRadius: 8, padding: "8px 14px",
                  cursor: "pointer", opacity: isPro || isActive ? 1 : 0.5,
                }}>{fl} {!isPro && !isActive && <span style={{ ...mono, fontSize: 7, background: "#0a1f4a", color: "#e8f2ff", padding: "1px 5px", borderRadius: 2, marginLeft: 2 }}>PRO</span>}</span>
                );
              })}
            </div>

            {/* Content area — switches based on active filter */}
            {(hotlistFilter === "gainers" || hotlistFilter === "losers") ? (
            /* Default: Gainers | Losers | Chart */
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 20, alignItems: "start" }}>
              {/* Gainers column */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ ...mono, fontSize: 10, letterSpacing: "2px", color: "#1a8a44", fontWeight: 600 }}>🟢 TOP GAINERS</div>
                  <div style={{ ...mono, fontSize: 10, color: T.textFaint }}>{hotlistData.gainers.length} stocks</div>
                </div>
                <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                  {hotlistData.gainers.length === 0 && <div style={{ textAlign: "center", padding: 40, color: T.textFaint, ...mono, fontSize: 13 }}>Market closed — hotlist updates when market opens</div>}
                  {hotlistData.gainers.map((t, i) => (
                    <div key={t.symbol} onClick={() => openChart(t.symbol, t.name)} style={{
                      padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                      borderBottom: `1px solid ${T.border}`, transition: "background 0.15s",
                      background: chartSymbol === t.symbol ? T.bgDeep : "transparent",
                    }} onMouseEnter={e => e.currentTarget.style.background = T.bgDeep} onMouseLeave={e => { if (chartSymbol !== t.symbol) e.currentTarget.style.background = "transparent"; }}>
                      <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(26,138,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", ...mono, fontSize: 12, color: "#1a8a44", fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...font, fontSize: 15, fontWeight: 600, color: T.text }}>{t.symbol}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.textFaint, marginTop: 1 }}>{t.name !== t.symbol ? t.name : ""}</div>
                      </div>
                      <div style={{ ...font, fontSize: 15, fontWeight: 600, color: T.text, marginRight: 8 }}>${Number(t.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div style={{ ...mono, fontSize: 11, color: "#fff", background: "#1a8a44", padding: "4px 10px", borderRadius: 6, fontWeight: 600 }}>▲{Math.abs(t.changePct).toFixed(2)}%</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Losers column */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ ...mono, fontSize: 10, letterSpacing: "2px", color: "#cc2222", fontWeight: 600 }}>🔴 TOP LOSERS</div>
                  <div style={{ ...mono, fontSize: 10, color: T.textFaint }}>{hotlistData.losers.length} stocks</div>
                </div>
                <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                  {hotlistData.losers.length === 0 && <div style={{ textAlign: "center", padding: 40, color: T.textFaint, ...mono, fontSize: 13 }}>Market closed — hotlist updates when market opens</div>}
                  {hotlistData.losers.map((t, i) => (
                    <div key={t.symbol} onClick={() => openChart(t.symbol, t.name)} style={{
                      padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                      borderBottom: `1px solid ${T.border}`, transition: "background 0.15s",
                      background: chartSymbol === t.symbol ? T.bgDeep : "transparent",
                    }} onMouseEnter={e => e.currentTarget.style.background = T.bgDeep} onMouseLeave={e => { if (chartSymbol !== t.symbol) e.currentTarget.style.background = "transparent"; }}>
                      <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(204,34,34,0.12)", display: "flex", alignItems: "center", justifyContent: "center", ...mono, fontSize: 12, color: "#cc2222", fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...font, fontSize: 15, fontWeight: 600, color: T.text }}>{t.symbol}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.textFaint, marginTop: 1 }}>{t.name !== t.symbol ? t.name : ""}</div>
                      </div>
                      <div style={{ ...font, fontSize: 15, fontWeight: 600, color: T.text, marginRight: 8 }}>${Number(t.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div style={{ ...mono, fontSize: 11, color: "#fff", background: "#cc2222", padding: "4px 10px", borderRadius: 6, fontWeight: 600 }}>▼{Math.abs(t.changePct).toFixed(2)}%</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart panel — sticky */}
              <div style={{ position: "sticky", top: 20 }}>
                {chartSymbol ? (
                  <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                    {/* Header */}
                    <div style={{ padding: "24px 24px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ ...font, fontSize: 26, fontWeight: 700, color: T.text }}>{chartLabel || chartSymbol} <span style={{ ...mono, fontSize: 14, color: T.textFaint }}>{chartSymbol}</span></div>
                          {(() => {
                            const ht = hotlistData.gainers.concat(hotlistData.losers).find(x => x.symbol === chartSymbol);
                            if (!ht) return null;
                            const col = ht.changePct >= 0 ? "#1a8a44" : "#cc2222";
                            return (
                              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6 }}>
                                <span style={{ ...font, fontSize: 32, fontWeight: 700, color: T.text }}>${Number(ht.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <span style={{ ...mono, fontSize: 16, color: col, fontWeight: 700 }}>{ht.changePct >= 0 ? "▲" : "▼"} {Math.abs(ht.changePct).toFixed(2)}%</span>
                                <span style={{ ...mono, fontSize: 13, color: col }}>{ht.changePct >= 0 ? "+" : ""}${Number(ht.change).toFixed(2)}</span>
                              </div>
                            );
                          })()}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {[["5m","1D"],["15m","5D"],["1D","1M"],["1W","1Y"],["1M","5Y"]].map(([r, lbl]) => (
                            <span key={r} onClick={() => changeChartRange(r)} style={{
                              padding: "6px 14px", borderRadius: 7, ...mono, fontSize: 12, cursor: "pointer", fontWeight: 600,
                              background: chartRange === r ? "#0a1f4a" : T.bgDeep,
                              color: chartRange === r ? "#e8f2ff" : T.textMid,
                              border: chartRange === r ? "none" : `1px solid ${T.border}`,
                            }}>{lbl}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Chart */}
                    <div style={{ padding: "0 24px", minHeight: 280 }}>
                      {chartData.length > 0 ? <CandlestickChart data={chartData} T={T} range={chartRange} /> : <div style={{ textAlign: "center", padding: 60, ...mono, fontSize: 14, color: T.textMid }}>Loading chart...</div>}
                    </div>

                    {/* Action buttons */}
                    <div style={{ padding: "16px 24px", display: "flex", gap: 10 }}>
                      <button onClick={() => openModal(chartSymbol, chartLabel)} style={{ padding: "12px 24px", background: "#0a1f4a", color: "#e8f2ff", border: "none", borderRadius: 10, ...font, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>+ Set Alert</button>
                      <button onClick={() => {
                        const ht = hotlistData.gainers.concat(hotlistData.losers).find(x => x.symbol === chartSymbol);
                        if (ht) shareTicker(ht.symbol, ht.name, ht.price, ht.changePct);
                      }} style={{ padding: "12px 24px", background: "none", color: "#0a1f4a", border: "2px solid #0a1f4a", borderRadius: 10, ...font, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>↗ Share</button>
                      {(() => {
                        const alreadyIn = watchlist.some(w => w.symbol === chartSymbol) || MARKET_SYMBOLS.some(ms => ms.symbol === chartSymbol);
                        return alreadyIn ? (
                          <span style={{ padding: "12px 24px", ...font, fontSize: 15, fontWeight: 600, color: "#1a8a44" }}>✓ In Watchlist</span>
                        ) : (
                          <button onClick={() => {
                            setWatchlist(prev => { const next = [...prev, { symbol: chartSymbol, label: chartLabel || chartSymbol }]; localStorage.setItem("ta-watchlist", JSON.stringify(next)); return next; });
                            showToast(`${chartSymbol} added to watchlist`);
                          }} style={{ padding: "12px 24px", background: "linear-gradient(135deg,#0a1f4a,#1a3a6a)", color: "#e8f2ff", border: "none", borderRadius: 10, ...font, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>+ Watchlist</button>
                        );
                      })()}
                    </div>

                    {/* Stats grid — matches Market tab style */}
                    <div style={{ padding: "0 24px 16px" }}>
                      {(() => {
                        const ht = hotlistData.gainers.concat(hotlistData.losers).find(x => x.symbol === chartSymbol);
                        const md = marketData[chartSymbol];
                        const fmt = v => `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        const fmtVol = v => v >= 1e9 ? `${(v/1e9).toFixed(2)}B` : v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : `${v}`;
                        const prevClose = md?.prevClose || (ht ? ht.price - ht.change : null);
                        const vol = md?.volume || ht?.volume || 0;
                        const high = md?.high || 0;
                        const low = md?.low || 0;
                        const open = md?.open || 0;
                        const change = md?.change ?? ht?.change ?? 0;
                        const changePct = md?.changePct ?? ht?.changePct ?? 0;
                        const cell = (label, value, color) => (
                          <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRight: `1px solid ${T.borderLight}` }}>
                            <span style={{ ...font, fontSize: 13, color: T.textMid }}>{label}</span>
                            <span style={{ ...mono, fontSize: 13, color: color || T.text, fontWeight: 500, textAlign: "right" }}>{value}</span>
                          </div>
                        );
                        return (
                          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: `1px solid ${T.borderLight}` }}>
                              {cell("Prev. Close", prevClose ? fmt(prevClose) : "—")}
                              {cell("Volume", vol ? fmtVol(vol) : "—")}
                              {cell("Day's Range", high && low ? `${fmt(low)} – ${fmt(high)}` : "—")}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: `1px solid ${T.borderLight}` }}>
                              {cell("Open", open ? fmt(open) : "—")}
                              {cell("Avg Vol. (3m)", "—")}
                              {cell("52 Wk Range", week52Data ? `${fmt(week52Data.low)} – ${fmt(week52Data.high)}` : "—")}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
                              {cell("1-Year Change", week52Data ? `${week52Data.yearChange >= 0 ? "+" : ""}${week52Data.yearChange.toFixed(2)}%` : "—", week52Data?.yearChange >= 0 ? "#1a8a44" : "#cc2222")}
                              {cell("Change", `${change >= 0 ? "+" : ""}${Number(change).toFixed(2)}`)}
                              <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ ...font, fontSize: 13, color: T.textMid }}>Change %</span>
                                <span style={{ ...mono, fontSize: 13, fontWeight: 500, color: changePct >= 0 ? "#1a8a44" : "#cc2222" }}>{changePct >= 0 ? "+" : ""}{Number(changePct).toFixed(2)}%</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* About */}
                    {tickerDetails && (
                      <div style={{ padding: "0 24px 16px" }}>
                        <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 8 }}>ABOUT {chartSymbol}</div>
                        <div style={{ ...font, fontSize: 13, color: T.textMid, lineHeight: 1.6 }}>
                          {tickerDetails.description ? tickerDetails.description.slice(0, 300) + (tickerDetails.description.length > 300 ? "..." : "") : tickerDetails.name || ""}
                        </div>
                        {tickerDetails.sic_description && <div style={{ ...mono, fontSize: 11, color: T.textFaint, marginTop: 6 }}>Sector: {tickerDetails.sic_description}</div>}
                      </div>
                    )}

                    {/* News */}
                    {tickerNews.length > 0 && (
                      <div style={{ padding: "0 24px 24px" }}>
                        <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 10 }}>LATEST NEWS</div>
                        {tickerNews.slice(0, 4).map((article, idx) => (
                          <a key={idx} href={article.article_url} target="_blank" rel="noopener noreferrer" style={{
                            display: "flex", gap: 14, padding: "12px 0", borderBottom: idx < 3 ? `1px solid ${T.border}` : "none",
                            textDecoration: "none", color: "inherit",
                          }}>
                            {article.image_url && <img src={article.image_url} alt="" style={{ width: 70, height: 50, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />}
                            <div style={{ flex: 1 }}>
                              <div style={{ ...font, fontSize: 13, fontWeight: 500, color: T.text, lineHeight: 1.4 }}>{article.title}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.textFaint, marginTop: 4 }}>{article.publisher?.name} · {new Date(article.published_utc).toLocaleDateString()}</div>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 60, textAlign: "center" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
                    <div style={{ ...font, fontSize: 16, color: T.textMid, marginBottom: 4 }}>Select a ticker</div>
                    <div style={{ ...mono, fontSize: 12, color: T.textFaint }}>Click any stock to view chart, stats & news</div>
                  </div>
                )}
              </div>
            </div>
            ) : (
            /* Pro filter: single ranked list in 2 columns (1-10 | 11-20) + Chart */
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 20, alignItems: "start" }}>
              {/* Column 1: ranks 1-10 */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ ...mono, fontSize: 10, letterSpacing: "2px", color: "#0a1f4a", fontWeight: 600 }}>
                    {hotlistFilter === "volume" ? "📊" : hotlistFilter === "volatile" ? "⚡" : hotlistFilter === "52w_high" ? "📈" : hotlistFilter === "52w_low" ? "📉" : hotlistFilter === "pre-market" ? "🌅" : "🌙"}{" "}
                    {hotlistFilter.toUpperCase().replace(/_/g, " ")} · 1–10
                  </div>
                </div>
                <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ textAlign: "center", padding: 40, color: T.textFaint, ...mono, fontSize: 13 }}>
                    Pro filter data coming soon
                  </div>
                </div>
              </div>
              {/* Column 2: ranks 11-20 */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ ...mono, fontSize: 10, letterSpacing: "2px", color: "#0a1f4a", fontWeight: 600 }}>
                    {hotlistFilter.toUpperCase().replace(/_/g, " ")} · 11–20
                  </div>
                </div>
                <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ textAlign: "center", padding: 40, color: T.textFaint, ...mono, fontSize: 13 }}>
                    Pro filter data coming soon
                  </div>
                </div>
              </div>
              {/* Chart panel — same as default */}
              <div style={{ position: "sticky", top: 20 }}>
                {chartSymbol ? (
                  <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                    <div style={{ padding: "24px 24px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ ...font, fontSize: 26, fontWeight: 700, color: T.text }}>{chartLabel || chartSymbol} <span style={{ ...mono, fontSize: 14, color: T.textFaint }}>{chartSymbol}</span></div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {[["5m","1D"],["15m","5D"],["1D","1M"],["1W","1Y"],["1M","5Y"]].map(([r, lbl]) => (
                            <span key={r} onClick={() => changeChartRange(r)} style={{
                              padding: "6px 14px", borderRadius: 7, ...mono, fontSize: 12, cursor: "pointer", fontWeight: 600,
                              background: chartRange === r ? "#0a1f4a" : T.bgDeep, color: chartRange === r ? "#e8f2ff" : T.textMid,
                              border: chartRange === r ? "none" : `1px solid ${T.border}`,
                            }}>{lbl}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: "0 24px", minHeight: 280 }}>
                      {chartData.length > 0 ? <CandlestickChart data={chartData} T={T} range={chartRange} /> : <div style={{ textAlign: "center", padding: 60, ...mono, fontSize: 14, color: T.textMid }}>Loading chart...</div>}
                    </div>
                    <div style={{ padding: "16px 24px", display: "flex", gap: 10 }}>
                      <button onClick={() => openModal(chartSymbol, chartLabel)} style={{ padding: "12px 24px", background: "#0a1f4a", color: "#e8f2ff", border: "none", borderRadius: 10, ...font, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>+ Set Alert</button>
                      <button onClick={() => {
                        setWatchlist(prev => { const next = [...prev, { symbol: chartSymbol, label: chartLabel || chartSymbol }]; localStorage.setItem("ta-watchlist", JSON.stringify(next)); return next; });
                        showToast(`${chartSymbol} added to watchlist`);
                      }} style={{ padding: "12px 24px", background: "linear-gradient(135deg,#0a1f4a,#1a3a6a)", color: "#e8f2ff", border: "none", borderRadius: 10, ...font, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>+ Watchlist</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 60, textAlign: "center" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
                    <div style={{ ...font, fontSize: 16, color: T.textMid, marginBottom: 4 }}>Select a ticker</div>
                    <div style={{ ...mono, fontSize: 12, color: T.textFaint }}>Click any stock to view chart, stats & news</div>
                  </div>
                )}
              </div>
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
                  <div style={{ ...mono, fontSize: 10, letterSpacing: "2px", color: T.textMid, marginBottom: 6 }}>CALENDAR</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ ...font, fontSize: isMobile ? 20 : 28, fontWeight: 600, color: T.text }}>{monthName}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => setCalMonth(p => { const d = new Date(p.year, p.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, background: "none", cursor: "pointer", color: T.textMid, fontSize: 14 }}>‹</button>
                      <button onClick={() => setCalMonth(p => { const d = new Date(p.year, p.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, background: "none", cursor: "pointer", color: T.textMid, fontSize: 14 }}>›</button>
                    </div>
                    {!isCurrentMonth && (
                      <button onClick={() => { const n = new Date(); setCalMonth({ year: n.getFullYear(), month: n.getMonth() }); setCalSelectedDay(n.getDate()); }} style={{ padding: "4px 12px", border: `2px solid ${T.textMid}`, borderRadius: 6, background: "none", cursor: "pointer", ...font, fontSize: 12, color: T.textMid }}>Today</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Filter cards — card-style toggles with counts */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(6, 1fr)", gap: isMobile ? 6 : 8, marginBottom: 20, overflow: "hidden" }}>
                {eventTypes.map(([id, lbl, col, icon]) => {
                  const active = calFilters[id];
                  const count = eventCounts[id] || 0;
                  return (
                    <button key={id} onClick={() => setCalFilters(f => ({ ...f, [id]: !f[id] }))} style={{
                      background: T.bgCard, border: `2px solid ${active ? col : T.border}`,
                      borderRadius: isMobile ? 10 : 12, padding: isMobile ? "8px 6px" : "12px 14px", cursor: "pointer",
                      display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: "center", gap: isMobile ? 4 : 10, textAlign: isMobile ? "center" : "left",
                      opacity: active ? 1 : 0.5, transition: "all 0.15s", minWidth: 0,
                    }}>
                      <div style={{ width: isMobile ? 28 : 36, height: isMobile ? 28 : 36, borderRadius: 8, background: active ? col + "18" : T.bgDeep, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 14 : 18, flexShrink: 0 }}>{icon}</div>
                      <div>
                        <div style={{ ...font, fontSize: isMobile ? 11 : 14, fontWeight: 500, color: T.text }}>{lbl}</div>
                        <div style={{ ...mono, fontSize: isMobile ? 9 : 10, color: T.textFaint, marginTop: 1 }}>{count}</div>
                      </div>
                    </button>
                  );
                })}
                </div>

              {calLoading && <div style={{ textAlign: "center", padding: 60, color: T.textFaint, ...mono, fontSize: 13 }}>Loading calendar...</div>}

              {!calLoading && (
                <div style={{ overflow: "hidden" }}>
                  {/* Calendar grid — full width */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, background: T.border, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                    {dayNames.map(d => (
                      <div key={d} style={{ background: T.bgCard, padding: isMobile ? 6 : 10, textAlign: "center", ...mono, fontSize: isMobile ? 9 : 12, color: T.textFaint, letterSpacing: "1px" }}>{d.toUpperCase()}</div>
                    ))}
                    {Array.from({ length: firstDow }).map((_, i) => (
                      <div key={`e${i}`} style={{ background: T.bg, padding: isMobile ? 4 : 10, minHeight: isMobile ? 50 : 90 }} />
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
                              <span style={{ background: T.textMid, color: "#fff", width: isMobile ? 20 : 28, height: isMobile ? 20 : 28, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 10 : 14 }}>{d}</span>
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
            {/* Watchlist / Hotlist segmented toggle */}
            <div style={{ display: "flex", border: `2px solid ${T.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
              <div onClick={() => { setMarketView("watchlist"); setHotlistProOpen(false); }} style={{
                flex: 1, padding: 12, textAlign: "center", cursor: "pointer",
                ...mono, fontSize: 12, letterSpacing: "0.5px",
                background: marketView === "watchlist" ? "#0a1f4a" : T.bg,
                color: marketView === "watchlist" ? "#e8f2ff" : T.textMid,
                fontWeight: marketView === "watchlist" ? 700 : 500,
              }}>Watchlist</div>
              <div onClick={() => { setMarketView("hotlist"); setEditMode(false); setMobileExpanded(null); }} style={{
                flex: 1, padding: 12, textAlign: "center", cursor: "pointer",
                ...mono, fontSize: 12, letterSpacing: "0.5px",
                background: marketView === "hotlist" ? "#0a1f4a" : T.bg,
                color: marketView === "hotlist" ? "#e8f2ff" : T.textMid,
                fontWeight: marketView === "hotlist" ? 700 : 500,
                borderLeft: `1px solid ${T.border}`,
              }}>🔥 Hotlist</div>
            </div>

            {/* ── HOTLIST VIEW ─────────────────── */}
            {marketView === "hotlist" && (
              <div>
                {/* Segmented filter bar: Gainers | Losers | Pro */}
                <div style={{ display: "flex", border: `2px solid ${T.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
                  <div onClick={() => { setHotlistFilter("gainers"); setHotlistProOpen(false); }} style={{
                    flex: 1, padding: 12, textAlign: "center", cursor: "pointer",
                    ...mono, fontSize: 12, letterSpacing: "0.5px",
                    background: hotlistFilter === "gainers" ? "#1a8a44" : T.bg,
                    color: hotlistFilter === "gainers" ? "#fff" : "#1a8a44",
                    fontWeight: 700,
                  }}>Gainers</div>
                  <div onClick={() => { setHotlistFilter("losers"); setHotlistProOpen(false); }} style={{
                    flex: 1, padding: 12, textAlign: "center", cursor: "pointer",
                    ...mono, fontSize: 12, letterSpacing: "0.5px",
                    background: hotlistFilter === "losers" ? "#cc2222" : T.bg,
                    color: hotlistFilter === "losers" ? "#fff" : "#cc2222",
                    fontWeight: 700,
                    borderLeft: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}`,
                  }}>Losers</div>
                  <div onClick={() => {
                    setHotlistProOpen(p => !p);
                  }} style={{
                    flex: 1, padding: 12, textAlign: "center", cursor: "pointer",
                    ...mono, fontSize: 12, letterSpacing: "0.5px",
                    background: "#0a1f4a",
                    color: "#fff",
                    fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  }}>
                    <span style={{ fontSize: 8, background: "rgba(255,255,255,0.2)", color: "#fff", padding: "2px 5px", borderRadius: 2, fontWeight: 700 }}>PRO</span>
                    More
                  </div>
                </div>

                {/* Pro dropdown */}
                {hotlistProOpen && (
                  <div style={{ background: "#0a1f4a", borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
                      {["Volume","Volatile","52W High","52W Low","Pre-Market","After-Hours"].map(f => (
                        <button key={f} onClick={() => {
                          if (isPro) { setHotlistFilter(f.toLowerCase().replace(/\s+/g, '_').replace('52w_', 'w52_')); setHotlistProOpen(false); }
                          else { showToast("Pro plan required", "warn"); }
                        }} style={{
                          ...mono, fontSize: 11, color: "#fff",
                          background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: 8, padding: "10px 0", textAlign: "center", cursor: "pointer",
                        }}>{f}</button>
                      ))}
                    </div>
                    {!isPro && (
                      <button onClick={() => { setHotlistProOpen(false); setTab("pricing"); }} style={{
                        width: "100%", padding: 11, background: "#e8f2ff", color: "#0a1f4a",
                        border: "none", borderRadius: 8, ...font, fontSize: 14, fontWeight: 700, cursor: "pointer",
                      }}>Unlock Pro Filters — $9/mo</button>
                    )}
                  </div>
                )}

                {/* Hotlist results */}
                <div>
                  <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: hotlistFilter === "losers" ? "#cc2222" : "#1a8a44", marginBottom: 6, fontWeight: 600 }}>
                    {hotlistFilter === "losers" ? "TOP LOSERS TODAY" : "TOP GAINERS TODAY"}
                  </div>
                  {(hotlistFilter === "losers" ? hotlistData.losers : hotlistData.gainers).length === 0 && (
                    <div style={{ textAlign: "center", padding: 40, color: T.textFaint, ...mono, fontSize: 12 }}>Market closed — hotlist updates when market opens</div>
                  )}
                  {(hotlistFilter === "losers" ? hotlistData.losers : hotlistData.gainers).map((t, i) => {
                    const up = t.changePct >= 0;
                    const col = up ? "#1a8a44" : "#cc2222";
                    const arrow = up ? "▲" : "▼";
                    const isExpanded = expandedHotlist === t.symbol;
                    const d = { price: t.price, changePct: t.changePct, change: t.change };
                    const snap = { open: null, prevClose: null, dayHigh: null, dayLow: null, volume: t.volume };
                    return (
                      <div key={t.symbol} style={{
                        background: isExpanded ? T.bgCard : T.bg,
                        border: isExpanded ? "2px solid #0a1f4a" : "none",
                        borderBottom: isExpanded ? "2px solid #0a1f4a" : `1px solid ${T.border}`,
                        borderRadius: isExpanded ? 12 : 0,
                        marginBottom: isExpanded ? 8 : 0,
                      }}>
                        {/* Collapsed row */}
                        <div onClick={() => {
                          try {
                            if (isExpanded) { setExpandedHotlist(null); }
                            else { setExpandedHotlist(t.symbol); setChartData([]); setChartLoading(true); openChart(t.symbol, t.name); }
                          } catch (err) { console.error("Hotlist expand error:", err); }
                        }} style={{ padding: isExpanded ? "14px 14px" : "14px 8px 14px 0", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                          <div style={{ width: 26, height: 26, borderRadius: 7, background: `${col}15`, display: "flex", alignItems: "center", justifyContent: "center", ...mono, fontSize: 12, color: col, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ ...font, fontSize: 22, fontWeight: 700, color: T.text }}>{t.symbol}</div>
                            <div style={{ ...mono, fontSize: 14, color: T.textMid }}>{t.name !== t.symbol ? t.name : ""}</div>
                          </div>
                          {!isExpanded && (
                            <div style={{ textAlign: "center", flexShrink: 0 }}>
                              <div style={{ ...mono, fontSize: 13, color: col, fontWeight: 600 }}>{up ? "+" : "-"}${t.change != null ? `$${Math.abs(Number(t.change)).toFixed(2)}` : ""}</div>
                            </div>
                          )}
                          <div style={{ textAlign: "right", minWidth: 85 }}>
                            <div style={{ ...font, fontSize: 22, fontWeight: 700, color: T.text }}>${Number(t.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div style={{ ...mono, fontSize: 14, color: col, fontWeight: 600 }}>{arrow} {Math.abs(t.changePct).toFixed(2)}%</div>
                          </div>
                        </div>

                        {/* Expanded card */}
                        {isExpanded && (
                          <div onClick={(ev) => ev.stopPropagation()} style={{ padding: "0 14px 14px" }}>
                            {/* Add to watchlist button */}
                            {(() => {
                              const alreadyInWatchlist = watchlist.some(w => w.symbol === t.symbol) || MARKET_SYMBOLS.some(ms => ms.symbol === t.symbol);
                              return alreadyInWatchlist ? (
                                <button disabled style={{
                                  width: "100%", padding: 14, background: "#1a8a44", color: "#fff",
                                  border: "none", borderRadius: 10, ...font, fontSize: 15, fontWeight: 700, marginBottom: 12,
                                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: 0.8,
                                }}>✓ In Watchlist</button>
                              ) : (
                                <button onClick={(ev) => {
                                  ev.stopPropagation();
                                  const newItem = { symbol: t.symbol, label: t.name || t.symbol };
                                  setWatchlist(prev => { const next = [...prev, newItem]; localStorage.setItem("ta-watchlist", JSON.stringify(next)); return next; });
                                  showToast(`${t.symbol} added to watchlist`);
                                }} style={{
                                  width: "100%", padding: 14, background: "linear-gradient(135deg,#0a1f4a,#1a3a6a)", color: "#e8f2ff",
                                  border: "none", borderRadius: 10, ...font, fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 12,
                                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                  boxShadow: "0 4px 12px rgba(10,31,74,0.2)",
                                }}>+ Watchlist</button>
                              );
                            })()}
                            {/* Chart */}
                            <div style={{ background: T.bgDeep, borderRadius: 10, overflow: "hidden", marginBottom: 8, minHeight: 180 }}>
                              {!chartLoading && chartData && chartData.length > 0 && chartSymbol === t.symbol ? (
                                <div style={{ width: "100%", overflow: "hidden" }}>
                                  <CandlestickChart data={chartData} T={T} range={chartRange} />
                                </div>
                              ) : (
                                <div style={{ textAlign: "center", padding: 30, ...mono, fontSize: 12, color: T.textMid }}>{chartLoading ? "Loading chart..." : "No data"}</div>
                              )}
                              <div style={{ display: "flex", gap: 4, justifyContent: "center", padding: "6px 8px", alignItems: "center" }}>
                                {[["5m","1D"],["15m","5D"],["1D","1M"],["1W","1Y"],["1M","5Y"]].map(([r, lbl]) => (
                                  <span key={r} onClick={(ev) => { ev.stopPropagation(); changeChartRange(r); }} style={{
                                    padding: "4px 12px", borderRadius: 5, ...mono, fontSize: 11, cursor: "pointer",
                                    background: chartRange === r ? "#0a1f4a" : "transparent",
                                    color: chartRange === r ? "#e8f2ff" : T.textMid,
                                  }}>{lbl}</span>
                                ))}
                              </div>
                            </div>

                            {/* Action buttons */}
                            <div style={{ display: "flex", gap: 8 }}>
                              <button onClick={(ev) => { ev.stopPropagation(); openModal(t.symbol, t.name); }} style={{ flex: 1, padding: 11, background: "#0a1f4a", color: "#e8f2ff", border: "none", borderRadius: 8, ...font, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>+ Set Alert</button>
                              <button onClick={(ev) => { ev.stopPropagation(); shareTicker(t.symbol, t.name, t.price, t.changePct); }} style={{ flex: 1, padding: 11, background: "none", color: "#0a1f4a", border: "2px solid #0a1f4a", borderRadius: 8, ...font, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                                <span style={{ fontSize: 16 }}>↗</span> Share
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── WATCHLIST VIEW ─────────────────── */}
            {marketView === "watchlist" && (
            <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 8 }}>
              <button onClick={() => { setEditMode(p => !p); setMobileExpanded(null); }} style={{
                ...font, fontSize: 14, fontWeight: 600, cursor: "pointer", borderRadius: 8, padding: "6px 16px",
                background: editMode ? "#0a1f4a" : "none",
                color: editMode ? "#e8f2ff" : "#0a1f4a",
                border: editMode ? "none" : "2px solid #0a1f4a",
              }}>{editMode ? "Done" : "✎ Edit"}</button>
            </div>
            {editMode && (
              <div style={{ background: "rgba(10,31,74,0.06)", border: "2px solid #0a1f4a", borderRadius: 10, padding: "8px 14px", marginBottom: 12, textAlign: "center", ...mono, fontSize: 11, color: "#0a1f4a", fontWeight: 600 }}>
                Tap arrows to reorder · Swipe left to remove
              </div>
            )}
            {MARKET_SYMBOLS.map(m => {
              const d = marketData[m.id];
              const up = d?.changePct >= 0;
              const col = !d ? T.textFaint : up ? T.green : T.red;
              const arrow = up ? "▲" : "▼";
              const isExpanded = mobileExpanded === m.symbol;
              const snap = d || {};

              return (
                <div key={m.id} id={`swipe-wrapper-${m.symbol}`} style={{ position: "relative", overflow: "hidden", marginBottom: isExpanded ? 8 : 0, maxHeight: 2000 }}>
                  {/* Delete button revealed by swipe */}
                  <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 90, background: "#cc2222", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: isExpanded ? "0 12px 12px 0" : 0 }}
                    onClick={() => removeFromWatchlist(m.symbol)}>
                    <div style={{ color: "#fff", ...font, fontSize: 13, fontWeight: 600, textAlign: "center" }}>
                      <div style={{ fontSize: 18, marginBottom: 2 }}>✕</div>
                      Remove
                    </div>
                  </div>
                  {/* Card content */}
                  <div id={`swipe-card-${m.symbol}`} data-reorder-id={`reorder-${m.symbol}`} style={{
                    position: "relative", zIndex: 1,
                    background: isExpanded ? T.bgCard : T.bg,
                    border: isExpanded ? "2px solid #0a1f4a" : "none",
                    borderBottom: isExpanded ? "2px solid #0a1f4a" : `1px solid ${T.border}`,
                    borderRadius: isExpanded ? 12 : 0,
                    touchAction: "pan-y",
                  }}
                    onTouchStart={(e) => !editMode && handleTouchStart(m.symbol, e)}
                    onTouchMove={(e) => !editMode && handleTouchMove(m.symbol, e)}
                    onTouchEnd={() => !editMode && handleTouchEnd(m.symbol)}
                  >
                  {/* Collapsed row */}
                  <div onClick={() => {
                    if (swipedJustNow || editMode) return;
                    try {
                      if (isExpanded) { setMobileExpanded(null); }
                      else { setMobileExpanded(m.symbol); openChart(m.symbol, m.label); }
                    } catch (err) { console.error("Mobile expand error:", err); }
                  }} style={{ padding: isExpanded ? "14px 14px" : "14px 8px 14px 0", display: "flex", alignItems: "center", gap: 10, cursor: editMode ? "default" : "pointer" }}>
                    {/* Edit mode indicator */}
                    {editMode && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "8px 4px", flexShrink: 0 }}>
                        <div style={{ width: 18, height: 2, background: T.textFaint, borderRadius: 1 }} />
                        <div style={{ width: 18, height: 2, background: T.textFaint, borderRadius: 1 }} />
                        <div style={{ width: 18, height: 2, background: T.textFaint, borderRadius: 1 }} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...font, fontSize: 22, fontWeight: 700, color: T.text }}>{m.label}</div>
                      <div style={{ ...mono, fontSize: 14, color: T.textMid }}>{m.symbol}</div>
                    </div>
                    {!isExpanded && d && (
                      <div style={{ textAlign: "center", flexShrink: 0 }}>
                        <div style={{ ...mono, fontSize: 13, color: col, fontWeight: 600 }}>{d.changePct >= 0 ? "+" : "-"}${d.change != null ? `$${Math.abs(Number(d.change)).toFixed(2)}` : ""}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.textMid, marginTop: 2 }}>Open {snap.open ? `$${Number(snap.open).toFixed(2)}` : "—"}</div>
                      </div>
                    )}
                    <div style={{ textAlign: "right", minWidth: 85 }}>
                      <div style={{ ...font, fontSize: 22, fontWeight: 700, color: T.text }}>{d ? `$${Number(d.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</div>
                      <div style={{ ...mono, fontSize: 14, color: col, fontWeight: 600 }}>{d ? `${arrow} ${Math.abs(d.changePct).toFixed(2)}%` : ""}</div>
                    </div>
                  </div>

                  {/* Expanded card */}
                  {isExpanded && (
                    <div onClick={(ev) => ev.stopPropagation()} style={{ padding: "0 14px 14px" }}>

                      {/* Chart */}
                      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 8, padding: 4 }}>
                        {chartLoading && <div style={{ textAlign: "center", padding: 30, ...mono, fontSize: 12, color: T.textMid }}>Loading chart...</div>}
                        {!chartLoading && chartData && chartData.length > 0 && (
                          <div style={{ overflowX: "auto" }}>
                            <CandlestickChart data={chartData} T={T} range={chartRange} />
                          </div>
                        )}
                        {!chartLoading && (!chartData || chartData.length === 0) && (
                          <div style={{ textAlign: "center", padding: 30, ...mono, fontSize: 12, color: T.textMid }}>Loading data...</div>
                        )}
                        <div style={{ display: "flex", gap: 4, justifyContent: "center", padding: "6px 8px", alignItems: "center" }}>
                          {[["5m","1D"],["15m","5D"],["1D","1M"],["1W","1Y"],["1M","5Y"]].map(([r, lbl]) => (
                            <span key={r} onClick={(ev) => { ev.stopPropagation(); changeChartRange(r); }} style={{
                              padding: "4px 12px", borderRadius: 5, ...mono, fontSize: 11, cursor: "pointer",
                              background: chartRange === r ? "#0a1f4a" : "transparent",
                              color: chartRange === r ? "#e8f2ff" : T.textMid,
                            }}>{lbl}</span>
                          ))}
                          <button onClick={(ev) => { ev.stopPropagation(); setMobileChartFull(true); }} style={{
                            marginLeft: "auto", width: 30, height: 30, borderRadius: 6, border: "none",
                            background: "#0a1f4a", cursor: "pointer", color: "#e8f2ff",
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                          }}>⛶</button>
                        </div>
                      </div>

                      {/* Fundamentals grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: T.border, borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
                        {[
                          ["Prev. Close", snap && snap.prevClose ? `$${Number(snap.prevClose).toFixed(2)}` : "—"],
                          ["Open", snap && snap.open ? `$${Number(snap.open).toFixed(2)}` : "—"],
                          ["Volume", snap && snap.volume ? (snap.volume >= 1e9 ? `${(snap.volume/1e9).toFixed(1)}B` : snap.volume >= 1e6 ? `${(snap.volume/1e6).toFixed(1)}M` : `${snap.volume}`) : "—"],
                          ["Day High", snap && snap.high ? `$${Number(snap.high).toFixed(2)}` : "—"],
                          ["Day Low", snap && snap.low ? `$${Number(snap.low).toFixed(2)}` : "—"],
                          ["Change", d && d.changePct != null ? `${d.changePct >= 0 ? "+" : ""}${d.changePct.toFixed(2)}%` : "—"],
                        ].map(([label, val], idx) => (
                          <div key={idx} style={{ background: T.bg, padding: 8, textAlign: "center" }}>
                            <div style={{ ...mono, fontSize: 10, color: T.textMid, fontWeight: 500 }}>{label}</div>
                            <div style={{ ...mono, fontSize: 14, color: T.text, fontWeight: 600, marginTop: 2 }}>{val}</div>
                          </div>
                        ))}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={(ev) => { ev.stopPropagation(); openModal(m.symbol, m.label); }} style={{ flex: 1, padding: 11, background: "#0a1f4a", color: "#e8f2ff", border: "none", borderRadius: 8, ...font, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>+ Set Alert</button>
                        <button onClick={(ev) => { ev.stopPropagation(); if (d) shareTicker(m.symbol, m.label, d.price, d.changePct); }} style={{ flex: 1, padding: 11, background: "none", color: "#0a1f4a", border: "2px solid #0a1f4a", borderRadius: 8, ...font, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <span style={{ fontSize: 16 }}>↗</span> Share
                        </button>
                      </div>
                      {/* Swipe hint */}
                      <div style={{ textAlign: "center", marginTop: 8, ...mono, fontSize: 10, color: T.textFaint }}>← Swipe left to remove</div>
                    </div>
                  )}
                  </div>
                </div>
              );
            })}

            {/* User watchlist items */}
            {watchlist.filter(w => !MARKET_SYMBOLS.some(m => m.symbol === w.symbol)).map(w => {
              const wd = watchData[w.symbol];
              const up = wd?.changePct >= 0;
              const col = !wd ? T.textFaint : up ? T.green : T.red;
              const arrow = up ? "▲" : "▼";
              const isExpanded = mobileExpanded === w.symbol;
              const snap = wd || {};
              return (
                <div key={w.symbol} id={`swipe-wrapper-${w.symbol}`} style={{ position: "relative", overflow: "hidden", marginBottom: isExpanded ? 8 : 0, maxHeight: 2000 }}>
                  {/* Delete button revealed by swipe */}
                  <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 90, background: "#cc2222", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: isExpanded ? "0 12px 12px 0" : 0 }}
                    onClick={() => removeFromWatchlist(w.symbol)}>
                    <div style={{ color: "#fff", ...font, fontSize: 13, fontWeight: 600, textAlign: "center" }}>
                      <div style={{ fontSize: 18, marginBottom: 2 }}>✕</div>
                      Remove
                    </div>
                  </div>
                  {/* Card content */}
                  <div id={`swipe-card-${w.symbol}`} style={{
                    position: "relative", zIndex: 1,
                    background: isExpanded ? T.bgCard : T.bg,
                    border: isExpanded ? "2px solid #0a1f4a" : "none",
                    borderBottom: isExpanded ? "2px solid #0a1f4a" : `1px solid ${T.border}`,
                    borderRadius: isExpanded ? 12 : 0,
                    touchAction: "pan-y",
                  }}
                    onTouchStart={(e) => !editMode && handleTouchStart(w.symbol, e)}
                    onTouchMove={(e) => !editMode && handleTouchMove(w.symbol, e)}
                    onTouchEnd={() => !editMode && handleTouchEnd(w.symbol)}
                  >
                  <div onClick={() => {
                    if (swipedJustNow || editMode) return;
                    try {
                      if (isExpanded) { setMobileExpanded(null); }
                      else { setMobileExpanded(w.symbol); openChart(w.symbol, w.label); }
                    } catch (err) { console.error("Watchlist expand error:", err); }
                  }} style={{ padding: isExpanded ? "14px 14px" : "14px 8px 14px 0", display: "flex", alignItems: "center", gap: 10, cursor: editMode ? "default" : "pointer" }}>
                    {/* Move buttons — only in edit mode (user watchlist items don't reorder market symbols) */}
                    {editMode && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "8px 4px", flexShrink: 0 }}>
                        <div style={{ width: 18, height: 2, background: T.textFaint, borderRadius: 1 }} />
                        <div style={{ width: 18, height: 2, background: T.textFaint, borderRadius: 1 }} />
                        <div style={{ width: 18, height: 2, background: T.textFaint, borderRadius: 1 }} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...font, fontSize: 22, fontWeight: 700, color: T.text }}>{w.label || w.symbol}</div>
                      <div style={{ ...mono, fontSize: 14, color: T.textMid }}>{w.symbol}</div>
                    </div>
                    {!isExpanded && wd && (
                      <div style={{ textAlign: "center", flexShrink: 0 }}>
                        <div style={{ ...mono, fontSize: 13, color: col, fontWeight: 600 }}>{wd.changePct >= 0 ? "+" : "-"}${wd.change != null ? `$${Math.abs(Number(wd.change)).toFixed(2)}` : ""}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.textMid, marginTop: 2 }}>Open {snap.open ? `$${Number(snap.open).toFixed(2)}` : "—"}</div>
                      </div>
                    )}
                    <div style={{ textAlign: "right", minWidth: 85 }}>
                      <div style={{ ...font, fontSize: 22, fontWeight: 700, color: T.text }}>{wd ? `$${Number(wd.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</div>
                      <div style={{ ...mono, fontSize: 14, color: col, fontWeight: 600 }}>{wd ? `${arrow} ${Math.abs(wd.changePct).toFixed(2)}%` : ""}</div>
                    </div>
                  </div>

                  {/* Expanded card */}
                  {isExpanded && (
                    <div onClick={(ev) => ev.stopPropagation()} style={{ padding: "0 14px 14px" }}>
                      {/* Chart */}
                      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 8, padding: 4 }}>
                        {chartLoading && <div style={{ textAlign: "center", padding: 30, ...mono, fontSize: 12, color: T.textMid }}>Loading chart...</div>}
                        {!chartLoading && chartData && chartData.length > 0 && (
                          <div style={{ overflowX: "auto" }}>
                            <CandlestickChart data={chartData} T={T} range={chartRange} />
                          </div>
                        )}
                        {!chartLoading && (!chartData || chartData.length === 0) && (
                          <div style={{ textAlign: "center", padding: 30, ...mono, fontSize: 12, color: T.textMid }}>Loading data...</div>
                        )}
                        <div style={{ display: "flex", gap: 4, justifyContent: "center", padding: "6px 8px", alignItems: "center" }}>
                          {[["5m","1D"],["15m","5D"],["1D","1M"],["1W","1Y"],["1M","5Y"]].map(([r, lbl]) => (
                            <span key={r} onClick={(ev) => { ev.stopPropagation(); changeChartRange(r); }} style={{
                              padding: "4px 12px", borderRadius: 5, ...mono, fontSize: 11, cursor: "pointer",
                              background: chartRange === r ? "#0a1f4a" : "transparent",
                              color: chartRange === r ? "#e8f2ff" : T.textMid,
                            }}>{lbl}</span>
                          ))}
                          <button onClick={(ev) => { ev.stopPropagation(); setMobileChartFull(true); }} style={{
                            marginLeft: "auto", width: 30, height: 30, borderRadius: 6, border: "none",
                            background: "#0a1f4a", cursor: "pointer", color: "#e8f2ff",
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                          }}>⛶</button>
                        </div>
                      </div>

                      {/* Fundamentals grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: T.border, borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
                        {[
                          ["Prev. Close", snap && snap.prevClose ? `$${Number(snap.prevClose).toFixed(2)}` : "—"],
                          ["Open", snap && snap.open ? `$${Number(snap.open).toFixed(2)}` : "—"],
                          ["Volume", snap && snap.volume ? (snap.volume >= 1e9 ? `${(snap.volume/1e9).toFixed(1)}B` : snap.volume >= 1e6 ? `${(snap.volume/1e6).toFixed(1)}M` : `${snap.volume}`) : "—"],
                          ["Day High", snap && snap.high ? `$${Number(snap.high).toFixed(2)}` : "—"],
                          ["Day Low", snap && snap.low ? `$${Number(snap.low).toFixed(2)}` : "—"],
                          ["Change", wd && wd.changePct != null ? `${wd.changePct >= 0 ? "+" : ""}${wd.changePct.toFixed(2)}%` : "—"],
                        ].map(([label, val], idx) => (
                          <div key={idx} style={{ background: T.bg, padding: 8, textAlign: "center" }}>
                            <div style={{ ...mono, fontSize: 10, color: T.textMid, fontWeight: 500 }}>{label}</div>
                            <div style={{ ...mono, fontSize: 14, color: T.text, fontWeight: 600, marginTop: 2 }}>{val}</div>
                          </div>
                        ))}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={(ev) => { ev.stopPropagation(); openModal(w.symbol, w.label); }} style={{ flex: 1, padding: 11, background: "#0a1f4a", color: "#e8f2ff", border: "none", borderRadius: 8, ...font, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>+ Set Alert</button>
                        <button onClick={(ev) => { ev.stopPropagation(); if (wd) shareTicker(w.symbol, w.label, wd.price, wd.changePct); }} style={{ flex: 1, padding: 11, background: "none", color: "#0a1f4a", border: "2px solid #0a1f4a", borderRadius: 8, ...font, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <span style={{ fontSize: 16 }}>↗</span> Share
                        </button>
                      </div>
                      {/* Swipe hint */}
                      <div style={{ textAlign: "center", marginTop: 8, ...mono, fontSize: 10, color: T.textFaint }}>← Swipe left to remove</div>
                    </div>
                  )}
                  </div>
                </div>
              );
            })}
            </div>
            )}{/* end watchlist view */}
          </div>
        )}

        {/* Mobile alerts tab */}
        {isMobile && tab === "alerts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {loading && <div style={{ textAlign: "center", padding: 40, color: T.textFaint, ...font, fontSize: 14 }}>Loading...</div>}
            {!loading && allAlerts.filter(a => a.status !== "deleted").map((a) => {
              const isOpen = expandedAlert === a.id;
              const triggerLabel = a.trigger_type?.replace(/_/g, " ") || "";
              const triggerVal = a.trigger_value ? (a.trigger_value.price ? `$${a.trigger_value.price}` : a.trigger_value.percent ? `${a.trigger_value.percent}%` : a.trigger_value.ma_period ? `${a.trigger_value.ma_period}D MA` : a.trigger_value.band || a.trigger_value.volume_multiplier ? `${a.trigger_value.volume_multiplier}×` : "") : "";
              const deliveryArr = Array.isArray(a.delivery) ? a.delivery : [];
              return (
              <div key={a.id} style={{
                background: T.bgCard, border: isOpen ? "2px solid #0a1f4a" : `1px solid ${T.border}`, borderRadius: 12,
                overflow: "hidden",
              }}>
                {/* Collapsed row — tap to expand */}
                <div onClick={() => setExpandedAlert(isOpen ? null : a.id)} style={{
                  padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                }}>
                  <div style={{ position: "relative" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                      background: a.status === "triggered" ? T.red : a.status === "paused" ? T.textFaint : T.green }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...font, fontSize: 18, fontWeight: 600, color: T.text }}>{a.asset}</div>
                    <div style={{ ...mono, fontSize: 12, color: T.textMid, marginTop: 2 }}>{triggerLabel}{triggerVal ? ` · ${triggerVal}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ ...mono, fontSize: 10, color: a.status === "triggered" ? T.red : a.status === "paused" ? T.textFaint : T.green,
                      border: `1px solid ${a.status === "triggered" ? T.red : a.status === "paused" ? T.textFaint : T.green}33`,
                      background: `${a.status === "triggered" ? T.red : a.status === "paused" ? T.textFaint : T.green}11`,
                      padding: "4px 10px", borderRadius: 4 }}>
                      {a.status.toUpperCase()}
                    </div>
                    <span style={{ fontSize: 14, color: T.textFaint }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Expanded details */}
                {isOpen && (
                  <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${T.border}` }}>
                    {/* Trigger info */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0", borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: triggerLabel.includes("above") ? "rgba(26,138,68,0.12)" : triggerLabel.includes("below") ? "rgba(204,34,34,0.12)" : "rgba(138,106,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: triggerLabel.includes("above") ? T.green : triggerLabel.includes("below") ? T.red : T.accent, flexShrink: 0 }}>
                        {triggerLabel.includes("above") ? "↑" : triggerLabel.includes("below") ? "↓" : "±"}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ ...font, fontSize: 16, fontWeight: 600, color: T.text }}>{triggerLabel}</div>
                        {triggerVal && <div style={{ ...mono, fontSize: 14, color: T.accent, fontWeight: 600, marginTop: 2 }}>{triggerVal}</div>}
                      </div>
                    </div>

                    {/* Delivery methods */}
                    <div style={{ padding: "14px 0", borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ ...mono, fontSize: 10, letterSpacing: "1.5px", color: T.textFaint, marginBottom: 8 }}>DELIVERY</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {deliveryArr.length > 0 ? deliveryArr.map(d => (
                          <span key={d} style={{ ...mono, fontSize: 12, color: T.text, background: T.bgDeep, padding: "5px 12px", borderRadius: 6, border: `1px solid ${T.border}` }}>
                            {d === "email" ? "📧 Email" : d === "push" ? "🔔 Push" : d === "sms" ? "💬 SMS" : d === "webhook" ? "🔗 Webhook" : d}
                          </span>
                        )) : <span style={{ ...mono, fontSize: 12, color: T.textFaint }}>None set</span>}
                      </div>
                      {!user && <div style={{ ...font, fontSize: 13, color: "#cc2222", marginTop: 8, fontWeight: 500 }}>⚠ Please sign in to activate alerts</div>}
                    </div>

                    {/* Created date */}
                    {a.created_at && (
                      <div style={{ padding: "10px 0", ...mono, fontSize: 11, color: T.textFaint }}>
                        Created {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <button onClick={() => {
                        // Open modal pre-filled with this alert's data
                        setForm(f => ({ ...f, asset: a.asset, delivery: deliveryArr.length > 0 ? deliveryArr : ["email"] }));
                        setModalAssetLabel(a.asset);
                        fetchModalPrice(a.asset);
                        setStep(3);
                        setShowModal(true);
                      }} style={{ flex: 1, padding: 11, background: "#0a1f4a", color: "#e8f2ff", border: "none", borderRadius: 8, ...font, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                        ✎ Edit Delivery
                      </button>
                      <button onClick={() => handleTogglePause(a.id)} style={{
                        flex: 1, padding: 11, background: "none",
                        color: a.status === "paused" ? T.green : T.textMid,
                        border: `2px solid ${a.status === "paused" ? T.green : T.textMid}`,
                        borderRadius: 8, ...font, fontSize: 14, fontWeight: 600, cursor: "pointer",
                      }}>
                        {a.status === "paused" ? "▶ Resume" : "⏸ Pause"}
                      </button>
                    </div>
                    <button onClick={() => { handleDeleteAlert(a.id); setExpandedAlert(null); }} style={{
                      marginTop: 6, width: "100%", padding: 10, background: "none",
                      color: "#cc2222", border: "1px solid #cc2222", borderRadius: 8,
                      ...font, fontSize: 13, fontWeight: 500, cursor: "pointer",
                    }}>Delete Alert</button>
                  </div>
                )}
              </div>
              );
            })}
            {!loading && allAlerts.filter(a => a.status !== "deleted").length === 0 && (
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ ...mono, fontSize: 9, letterSpacing: "2px", color: T.textMid }}>WATCHLIST</div>
                  <button onClick={() => setDesktopEditMode(p => !p)} style={{
                    ...mono, fontSize: 10, fontWeight: 600, cursor: "pointer", borderRadius: 6, padding: "3px 10px",
                    background: desktopEditMode ? "#0a1f4a" : "none",
                    color: desktopEditMode ? "#e8f2ff" : "#0a1f4a",
                    border: desktopEditMode ? "none" : `1px solid #0a1f4a`,
                  }}>{desktopEditMode ? "Done" : "✎ Edit"}</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {desktopCardOrder
                    .map(sym => MARKET_SYMBOLS.find(m => m.symbol === sym))
                    .filter(Boolean)
                    .filter(m => !hiddenCards.includes(m.symbol))
                    .concat(MARKET_SYMBOLS.filter(m => !desktopCardOrder.includes(m.symbol) && !hiddenCards.includes(m.symbol)))
                    .map((m, idx, arr) => {
                    const d   = marketData[m.id];
                    const up  = d?.changePct >= 0;
                    const col = !d ? T.border : up ? T.green : T.red;
                    const isActive = chartSymbol === m.symbol;
                    return (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {/* Move / Delete controls */}
                        {desktopEditMode && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                            <button onClick={() => {
                              if (idx === 0) return;
                              const order = [...desktopCardOrder];
                              const ci = order.indexOf(m.symbol);
                              // Find previous visible symbol
                              const visibleSyms = arr.map(a => a.symbol);
                              const prevSym = visibleSyms[idx - 1];
                              const pi = order.indexOf(prevSym);
                              if (ci >= 0 && pi >= 0) { [order[ci], order[pi]] = [order[pi], order[ci]]; }
                              setDesktopCardOrder(order);
                              try { localStorage.setItem("ta-desktop-order", JSON.stringify(order)); } catch {}
                            }} style={{
                              width: 20, height: 16, borderRadius: "4px 4px 1px 1px", border: `1px solid ${T.border}`,
                              background: idx === 0 ? T.bgDeep : T.bgCard, color: idx === 0 ? T.textFaint : T.text,
                              fontSize: 9, cursor: idx === 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                            }}>▲</button>
                            <button onClick={() => {
                              if (idx === arr.length - 1) return;
                              const order = [...desktopCardOrder];
                              const ci = order.indexOf(m.symbol);
                              const visibleSyms = arr.map(a => a.symbol);
                              const nextSym = visibleSyms[idx + 1];
                              const ni = order.indexOf(nextSym);
                              if (ci >= 0 && ni >= 0) { [order[ci], order[ni]] = [order[ni], order[ci]]; }
                              setDesktopCardOrder(order);
                              try { localStorage.setItem("ta-desktop-order", JSON.stringify(order)); } catch {}
                            }} style={{
                              width: 20, height: 16, borderRadius: "1px 1px 4px 4px", border: `1px solid ${T.border}`,
                              background: idx === arr.length - 1 ? T.bgDeep : T.bgCard, color: idx === arr.length - 1 ? T.textFaint : T.text,
                              fontSize: 9, cursor: idx === arr.length - 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                            }}>▼</button>
                          </div>
                        )}
                        {/* Card */}
                        <div onClick={(e) => !desktopEditMode && openChart(m.symbol, m.label, e)} style={{
                          flex: 1,
                          background: isActive ? T.bgDeep : T.bgCard,
                          border: `1px solid ${isActive ? T.accent : T.border}`,
                          borderLeft: `4px solid ${col}`,
                          borderRadius: 10,
                          padding: "14px 16px",
                          cursor: desktopEditMode ? "default" : "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          transition: "all 0.2s",
                        }}>
                          <div>
                            <div style={{ ...font, fontSize: 16, fontWeight: 600, color: T.text }}>{m.label}</div>
                            <div style={{ ...mono, fontSize: 11, color: T.textFaint, marginTop: 2 }}>{m.symbol}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ overflow: "hidden" }}>
                              <div
                                key={d?.price}
                                className={flashState[m.id] === "up" ? "price-slide-up" : flashState[m.id] === "down" ? "price-slide-down" : ""}
                                style={{ ...font, fontSize: 17, fontWeight: 600, color: flashState[m.id] === "up" ? T.green : flashState[m.id] === "down" ? T.red : T.text, transition: "color 0.8s" }}>
                                {marketLoading && !d ? "—" : d?.price ? `$${Number(d.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                              </div>
                            </div>
                            {d && <div style={{ ...mono, fontSize: 12, color: col, marginTop: 2 }}>
                              {up ? "▲" : "▼"} {Math.abs(d.changePct).toFixed(2)}%
                            </div>}
                          </div>
                        </div>
                        {/* Delete button */}
                        {desktopEditMode && (
                          <button onClick={() => {
                            const next = [...hiddenCards, m.symbol];
                            setHiddenCards(next);
                            try { localStorage.setItem("ta-hidden-cards", JSON.stringify(next)); } catch {}
                          }} style={{
                            width: 22, height: 22, borderRadius: "50%", border: `1px solid #cc2222`,
                            background: "none", color: "#cc2222", fontSize: 13, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0, lineHeight: 1,
                          }}>×</button>
                        )}
                      </div>
                    );
                  })}

                  {/* Restore hidden cards button */}
                  {desktopEditMode && hiddenCards.length > 0 && (
                    <button onClick={() => {
                      setHiddenCards([]);
                      try { localStorage.removeItem("ta-hidden-cards"); } catch {}
                    }} style={{
                      ...mono, fontSize: 10, color: "#0a1f4a", background: "none", border: `1px solid #0a1f4a`,
                      borderRadius: 6, padding: "6px 12px", cursor: "pointer", width: "100%", marginTop: 4,
                    }}>Restore {hiddenCards.length} hidden</button>
                  )}

                  {/* User watchlist items */}
                  {watchlist.length > 0 && (
                    <>
                      <div style={{ height: 1, background: T.border, margin: "6px 0" }} />
                      {watchlist.map((m, wIdx) => {
                        const d = watchData[m.symbol];
                        const up = d?.changePct >= 0;
                        const col = !d ? T.border : up ? T.green : T.red;
                        const isActive = chartSymbol === m.symbol;
                        return (
                          <div key={m.symbol} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            {desktopEditMode && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                                <button onClick={() => {
                                  if (wIdx === 0) return;
                                  const next = [...watchlist];
                                  [next[wIdx], next[wIdx - 1]] = [next[wIdx - 1], next[wIdx]];
                                  setWatchlist(next);
                                  try { localStorage.setItem("ta-watchlist", JSON.stringify(next)); } catch {}
                                }} style={{
                                  width: 20, height: 16, borderRadius: "4px 4px 1px 1px", border: `1px solid ${T.border}`,
                                  background: wIdx === 0 ? T.bgDeep : T.bgCard, color: wIdx === 0 ? T.textFaint : T.text,
                                  fontSize: 9, cursor: wIdx === 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                                }}>▲</button>
                                <button onClick={() => {
                                  if (wIdx === watchlist.length - 1) return;
                                  const next = [...watchlist];
                                  [next[wIdx], next[wIdx + 1]] = [next[wIdx + 1], next[wIdx]];
                                  setWatchlist(next);
                                  try { localStorage.setItem("ta-watchlist", JSON.stringify(next)); } catch {}
                                }} style={{
                                  width: 20, height: 16, borderRadius: "1px 1px 4px 4px", border: `1px solid ${T.border}`,
                                  background: wIdx === watchlist.length - 1 ? T.bgDeep : T.bgCard, color: wIdx === watchlist.length - 1 ? T.textFaint : T.text,
                                  fontSize: 9, cursor: wIdx === watchlist.length - 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                                }}>▼</button>
                              </div>
                            )}
                            <div style={{
                              flex: 1,
                              background: isActive ? T.bgDeep : T.bgCard,
                              border: `1px solid ${isActive ? T.accent : T.border}`,
                              borderLeft: `4px solid ${col}`,
                              borderRadius: 10, padding: "14px 16px", cursor: desktopEditMode ? "default" : "pointer",
                              display: "flex", justifyContent: "space-between", alignItems: "center",
                              transition: "all 0.2s",
                            }}>
                              <div onClick={(e) => !desktopEditMode && openChart(m.symbol, m.label, e)} style={{ flex: 1 }}>
                                <div style={{ ...font, fontSize: 16, fontWeight: 600, color: T.text }}>{m.label}</div>
                                <div style={{ ...mono, fontSize: 11, color: T.textFaint, marginTop: 2 }}>{m.symbol}</div>
                              </div>
                              <div style={{ textAlign: "right" }} onClick={(e) => !desktopEditMode && openChart(m.symbol, m.label, e)}>
                                <div style={{ ...font, fontSize: 17, fontWeight: 600, color: T.text }}>
                                  {d?.price ? `$${Number(d.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                                </div>
                                {d && <div style={{ ...mono, fontSize: 12, color: col, marginTop: 2 }}>
                                  {up ? "▲" : "▼"} {Math.abs(d.changePct).toFixed(2)}%
                                </div>}
                              </div>
                            </div>
                            {desktopEditMode && (
                              <button onClick={() => removeFromWatchlist(m.symbol)} style={{
                                width: 22, height: 22, borderRadius: "50%", border: `1px solid #cc2222`,
                                background: "none", color: "#cc2222", fontSize: 13, cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0, lineHeight: 1,
                              }}>×</button>
                            )}
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
                        {[["5m","1D"],["15m","5D"],["1D","1M"],["1W","1Y"],["1M","5Y"]].map(([r,lbl]) => (
                          <button key={r} onClick={() => changeChartRange(r)} style={{
                            ...mono, fontSize: 11, padding: "3px 10px", borderRadius: 6, cursor: "pointer",
                            background: chartRange === r ? T.btnPrimary : "none",
                            color: chartRange === r ? T.btnText : T.textFaint,
                            border: `1px solid ${chartRange === r ? T.btnPrimary : T.border}`,
                          }}>{lbl}</button>
                        ))}
                        <button onClick={() => openModal(chartSymbol, chartLabel, d ? { price: d.price, change: d.change, changePct: d.changePct, marketOpen: !!d.price } : null)} style={{
                          padding: "5px 14px", background: "none",
                          border: `2px solid ${themeName === "charcoal" ? "#e0e0e0" : T.textMid}`,
                          borderRadius: 6, cursor: "pointer", ...font, fontSize: 13,
                          color: themeName === "charcoal" ? "#e0e0e0" : "#5F5E5A",
                          whiteSpace: "nowrap", marginLeft: 4,
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

                  {/* Quarterly Earnings Dates */}
                  {earningsDates.length > 0 && (
                    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: "18px 18px", marginBottom: 16 }}>
                      <div style={{ ...mono, fontSize: 9, letterSpacing: "1px", color: T.textFaint, marginBottom: 12 }}>QUARTERLY EARNINGS · {chartSymbol}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                        {earningsDates.map((e, i) => {
                          const d = new Date(e.date + "T00:00:00");
                          const isPast = d < new Date();
                          const beat = e.epsActual && e.epsEstimate ? e.epsActual > e.epsEstimate : null;
                          return (
                            <div key={i} style={{
                              background: isPast ? T.bgDeep : "rgba(10,31,74,0.04)",
                              border: `1px solid ${isPast ? T.border : "rgba(10,31,74,0.15)"}`,
                              borderRadius: 8, padding: "12px 10px", textAlign: "center",
                              position: "relative", overflow: "hidden",
                            }}>
                              {!isPast && i === 0 && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#0a1f4a" }} />}
                              <div style={{ ...mono, fontSize: 10, color: T.textFaint, marginBottom: 4 }}>
                                {e.quarter ? `Q${e.quarter} ${e.year || ""}` : `Q${i + 1}`}
                              </div>
                              <div style={{ ...font, fontSize: 14, fontWeight: 600, color: T.text }}>
                                {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </div>
                              <div style={{ ...mono, fontSize: 9, color: T.textFaint, marginTop: 2 }}>
                                {d.getFullYear()}
                              </div>
                              {e.hour && (
                                <div style={{ ...mono, fontSize: 8, color: T.textFaint, marginTop: 4, letterSpacing: "0.5px" }}>
                                  {e.hour === "bmo" ? "Before Open" : e.hour === "amc" ? "After Close" : e.hour}
                                </div>
                              )}
                              {isPast && e.epsActual != null && (
                                <div style={{ ...mono, fontSize: 10, color: beat ? "#1a8a44" : beat === false ? "#cc2222" : T.textMid, fontWeight: 600, marginTop: 4 }}>
                                  EPS: ${Number(e.epsActual).toFixed(2)}
                                  {e.epsEstimate != null && <span style={{ color: T.textFaint, fontWeight: 400 }}> / est ${Number(e.epsEstimate).toFixed(2)}</span>}
                                </div>
                              )}
                              {!isPast && e.epsEstimate != null && (
                                <div style={{ ...mono, fontSize: 10, color: T.textMid, marginTop: 4 }}>
                                  Est: ${Number(e.epsEstimate).toFixed(2)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

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
            {!loading && allAlerts.filter(a => a.status !== "deleted").map((a) => {
              const isOpen = expandedAlert === a.id;
              const triggerLabel = a.trigger_type?.replace(/_/g, " ") || "";
              const triggerVal = a.trigger_value ? (a.trigger_value.price ? `$${a.trigger_value.price}` : a.trigger_value.percent ? `${a.trigger_value.percent}%` : a.trigger_value.ma_period ? `${a.trigger_value.ma_period}D MA` : a.trigger_value.band || (a.trigger_value.volume_multiplier ? `${a.trigger_value.volume_multiplier}×` : "")) : "";
              const deliveryArr = Array.isArray(a.delivery) ? a.delivery : [];
              return (
              <div key={a.id} style={{
                background: T.bgCard,
                border: isOpen ? "2px solid #0a1f4a" : `1px solid ${a.status === "triggered" ? T.red + "55" : T.border}`,
                borderRadius: 11, overflow: "hidden", cursor: "pointer",
              }}>
                {/* Collapsed row */}
                <div onClick={() => setExpandedAlert(isOpen ? null : a.id)} style={{
                  padding: "18px 22px", display: "flex", alignItems: "center", gap: 16,
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                    background: a.status === "triggered" ? T.red : a.status === "paused" ? T.textFaint : T.green,
                    boxShadow: a.status === "triggered" ? T.redGlow : a.status === "paused" ? "none" : T.greenGlow }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 20, color: T.text }}>{a.asset}</span>
                      {a.is_multi && <span style={{ ...mono, fontSize: 9, background: "rgba(100,180,255,0.1)", color: "#6ab4ff", padding: "2px 7px", borderRadius: 3, letterSpacing: 1 }}>MULTI</span>}
                    </div>
                    <div style={{ ...mono, fontSize: 11, color: T.textFaint, marginTop: 3 }}>
                      {triggerLabel}{triggerVal ? ` · ${triggerVal}` : ""}
                      {a.fire_count > 0 && <span style={{ marginLeft: 10, color: T.accent }}>Fired {a.fire_count}×</span>}
                    </div>
                  </div>
                  <div style={{ ...mono, fontSize: 10, letterSpacing: 1,
                    color: a.status === "triggered" ? T.red : a.status === "paused" ? T.textFaint : T.green,
                    border: `1px solid ${a.status === "triggered" ? T.red + "55" : T.border}`,
                    padding: "4px 10px", borderRadius: 4 }}>
                    {a.status.toUpperCase()}
                  </div>
                  <span style={{ fontSize: 14, color: T.textFaint }}>{isOpen ? "▲" : "▼"}</span>
                </div>

                {/* Expanded details */}
                {isOpen && (
                  <div style={{ padding: "0 22px 18px", borderTop: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", gap: 16, padding: "16px 0", borderBottom: `1px solid ${T.border}` }}>
                      {/* Delivery */}
                      <div style={{ flex: 1 }}>
                        <div style={{ ...mono, fontSize: 9, letterSpacing: "1.5px", color: T.textFaint, marginBottom: 8 }}>DELIVERY</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {deliveryArr.length > 0 ? deliveryArr.map(d => (
                            <span key={d} style={{ ...mono, fontSize: 11, color: T.text, background: T.bgDeep, padding: "5px 12px", borderRadius: 6, border: `1px solid ${T.border}` }}>
                              {d === "email" ? "📧 Email" : d === "push" ? "🔔 Push" : d === "sms" ? "💬 SMS" : d === "webhook" ? "🔗 Webhook" : d}
                            </span>
                          )) : <span style={{ ...mono, fontSize: 11, color: T.textFaint }}>None set</span>}
                        </div>
                        {!user && <div style={{ ...font, fontSize: 13, color: "#cc2222", marginTop: 8, fontWeight: 500 }}>⚠ Please sign in to activate alerts</div>}
                      </div>
                      {/* Meta */}
                      <div>
                        <div style={{ ...mono, fontSize: 9, letterSpacing: "1.5px", color: T.textFaint, marginBottom: 8 }}>INFO</div>
                        {a.created_at && <div style={{ ...mono, fontSize: 11, color: T.textMid }}>Created {new Date(a.created_at).toLocaleDateString()}</div>}
                        {a.last_fired_at && <div style={{ ...mono, fontSize: 11, color: T.textMid, marginTop: 4 }}>Last fired {new Date(a.last_fired_at).toLocaleDateString()}</div>}
                        {a.fire_count > 0 && <div style={{ ...mono, fontSize: 11, color: T.accent, marginTop: 4 }}>Fired {a.fire_count}×</div>}
                      </div>
                    </div>
                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button onClick={(ev) => {
                        ev.stopPropagation();
                        setForm(f => ({ ...f, asset: a.asset, delivery: deliveryArr.length > 0 ? deliveryArr : ["email"] }));
                        setModalAssetLabel(a.asset);
                        fetchModalPrice(a.asset);
                        setStep(3);
                        setShowModal(true);
                      }} style={{ padding: "8px 18px", background: "#0a1f4a", color: "#e8f2ff", border: "none", borderRadius: 8, ...font, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                        ✎ Edit Delivery
                      </button>
                      <button onClick={(ev) => { ev.stopPropagation(); handleTogglePause(a.id); }} style={{
                        padding: "8px 18px", background: "none",
                        color: a.status === "paused" ? T.green : T.textMid,
                        border: `1px solid ${a.status === "paused" ? T.green : T.border}`,
                        borderRadius: 8, ...font, fontSize: 14, cursor: "pointer",
                      }}>
                        {a.status === "paused" ? "▶ Resume" : "⏸ Pause"}
                      </button>
                      <button onClick={(ev) => { ev.stopPropagation(); handleDeleteAlert(a.id); setExpandedAlert(null); }} style={{
                        padding: "8px 18px", background: "none", color: "#cc2222", border: "1px solid #cc2222",
                        borderRadius: 8, ...font, fontSize: 14, cursor: "pointer",
                      }}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
              );
            })}
            {!loading && allAlerts.filter(a => a.status !== "deleted").length === 0 && (
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
        <div style={{
          position: "fixed", top: 0, left: 0, zIndex: 9998, background: T.bg,
          width: "100vh", height: "100vw",
          transform: "rotate(90deg)", transformOrigin: "top left",
          marginLeft: "100vw",
          display: "flex", flexDirection: "column",
          touchAction: "none",
        }}>
          {/* Header with extra padding for safe area */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            <div>
              <div style={{ ...font, fontSize: 18, fontWeight: 700, color: T.text }}>{chartLabel || chartSymbol}</div>
              <div style={{ ...mono, fontSize: 12, color: T.textMid }}>{chartSymbol}</div>
            </div>
            <button onClick={() => setMobileChartFull(false)} style={{
              width: 40, height: 40, borderRadius: 10, border: "none",
              background: "#0a1f4a", cursor: "pointer", fontSize: 20, color: "#e8f2ff",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>×</button>
          </div>
          {/* Chart */}
          <div style={{ flex: 1, overflow: "hidden", padding: "12px 24px" }}>
            {chartData.length > 0 && <CandlestickChart data={chartData} T={T} range={chartRange} />}
            {chartData.length === 0 && <div style={{ textAlign: "center", padding: 60, ...mono, fontSize: 14, color: T.textMid }}>No chart data</div>}
          </div>
          {/* Range buttons with bottom padding */}
          <div style={{ display: "flex", gap: 6, justifyContent: "center", padding: "12px 24px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
            {[["5m","1D"],["15m","5D"],["1D","1M"],["1W","1Y"],["1M","5Y"]].map(([r, lbl]) => (
              <span key={r} onClick={() => changeChartRange(r)} style={{
                padding: "8px 16px", borderRadius: 8, ...mono, fontSize: 13, cursor: "pointer", fontWeight: 600,
                background: chartRange === r ? "#0a1f4a" : T.bgCard,
                color: chartRange === r ? "#e8f2ff" : T.text,
                border: chartRange === r ? "none" : `1px solid ${T.border}`,
              }}>{lbl}</span>
            ))}
          </div>
        </div>
      )}

      {/* Event Alert Popup */}
      {calEventAlert && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none" }}
          onTouchMove={e => e.preventDefault()}>
          <div onClick={() => { setCalEventAlert(null); setCalAlertTiming("1day"); }} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", width: isMobile ? "95vw" : 480, maxHeight: "90vh", overflowY: "auto", borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.4)", touchAction: "pan-y", overscrollBehavior: "contain" }}
            onTouchMove={e => e.stopPropagation()}>
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
      {/* Profile overlay */}
      {showProfile && user && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99, touchAction: "none" }}
          onClick={() => setShowProfile(false)}
          onTouchMove={e => e.preventDefault()}>
          <div onClick={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} style={{
            position: "absolute", top: isMobile ? 70 : 80, right: isMobile ? 16 : 40,
            width: isMobile ? "calc(100vw - 32px)" : 340,
            background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16,
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden",
          }}>
            {/* Profile header */}
            <div style={{ background: "#0a1f4a", padding: "24px 20px", textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(55,138,221,0.25)", border: "2px solid rgba(55,138,221,0.4)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#e8f2ff", marginBottom: 10 }}>
                {(user?.email?.[0] || "U").toUpperCase()}
              </div>
              <div style={{ ...font, fontSize: 18, fontWeight: 600, color: "#e8f2ff" }}>{user?.email?.split("@")[0]}</div>
              <div style={{ ...mono, fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{user?.email}</div>
            </div>

            {/* Plan info */}
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ ...mono, fontSize: 10, letterSpacing: "1.5px", color: T.textFaint, marginBottom: 8 }}>SUBSCRIPTION</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ ...font, fontSize: 18, fontWeight: 700, color: isPro ? "#378ADD" : T.text }}>{isPro ? "Pro" : "Free"}</div>
                  {isPro && <span style={{ ...mono, fontSize: 9, color: "#378ADD", background: "rgba(55,138,221,0.1)", padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(55,138,221,0.2)" }}>ACTIVE</span>}
                </div>
                {!isPro && (
                  <button onClick={() => { setShowProfile(false); setTab("pricing"); }} style={{
                    ...font, fontSize: 13, fontWeight: 600, background: "#0a1f4a", color: "#e8f2ff",
                    border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer",
                  }}>Upgrade</button>
                )}
              </div>
            </div>

            {/* Stats */}
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ ...mono, fontSize: 10, color: T.textFaint }}>ACTIVE ALERTS</div>
                <div style={{ ...font, fontSize: 20, fontWeight: 700, color: T.text, marginTop: 4 }}>{allAlerts.filter(a => a.status === "active").length}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ ...mono, fontSize: 10, color: T.textFaint }}>WATCHLIST</div>
                <div style={{ ...font, fontSize: 20, fontWeight: 700, color: T.text, marginTop: 4 }}>{watchlist.length}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ ...mono, fontSize: 10, color: T.textFaint }}>LIMIT</div>
                <div style={{ ...font, fontSize: 20, fontWeight: 700, color: T.text, marginTop: 4 }}>{isPro ? "∞" : "10"}</div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ padding: "12px 20px" }}>
              <button onClick={() => { setShowProfile(false); signOut(); navigate("/"); }} style={{
                width: "100%", padding: 12, background: "none", color: "#cc2222",
                border: "1px solid #cc2222", borderRadius: 10,
                ...font, fontSize: 15, fontWeight: 600, cursor: "pointer",
              }}>Sign Out</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "center", padding: isMobile ? "8px 0 0" : 20, touchAction: "none", overscrollBehavior: "contain" }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          onTouchMove={e => e.preventDefault()}>
          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: isMobile ? "14px 14px 0 0" : 18, width: "100%", maxWidth: isMobile ? "100%" : 540, maxHeight: isMobile ? "100%" : "90vh", height: isMobile ? "calc(100vh - 8px)" : "auto", boxShadow: "0 40px 80px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", overflow: "hidden" }}
            onTouchMove={e => e.stopPropagation()}>

            {/* Modal header — cobalt blue, fixed outside scroll */}
            <div style={{ background: "#0a1f4a", borderRadius: isMobile ? "14px 14px 0 0" : "18px 18px 0 0", flexShrink: 0 }}>
              {/* Top row: step + title + close */}
              <div style={{ padding: "18px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", border: "2px solid #378ADD", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#e8f2ff", flexShrink: 0 }}>
                    {step}
                  </div>
                  <div>
                    <div style={{ fontSize: isMobile ? 26 : 20, color: "#e8f2ff" }}>{step === 1 ? "Set Alert" : "Delivery"}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
                      {[1,3].map(s => <div key={s} style={{ width: s <= step ? 20 : 6, height: 3, borderRadius: 2, background: s <= step ? "#378ADD" : "rgba(255,255,255,0.15)", transition: "all 0.3s" }} />)}
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: isMobile ? 26 : 22 }}>×</button>
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
                      <div style={{ ...font, fontSize: isMobile ? 20 : 15, fontWeight: isMobile ? 600 : 500, color: "#e8f2ff" }}>{form.asset}</div>
                      <div style={{ ...mono, fontSize: isMobile ? 13 : 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{modalAssetLabel !== form.asset ? modalAssetLabel : ""}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ ...font, fontSize: isMobile ? 22 : 15, fontWeight: isMobile ? 600 : 500, color: "#e8f2ff" }}>
                        {modalPrice ? `$${Number(modalPrice.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}
                      </div>
                      {modalPrice && (
                        <div style={{ ...mono, fontSize: isMobile ? 12 : 8, color: modalPrice.marketOpen ? (modalPrice.changePct >= 0 ? "#3ddc84" : "#ff5a5a") : "rgba(255,255,255,0.3)", marginTop: 2 }}>
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

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: "auto", touchAction: "pan-y", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>

            {/* Step 1 — Triggers */}
            {step === 1 && (
              <div>
                <div style={{ padding: "20px 24px" }}>

                  {/* Single-screen trigger + input — both mobile and desktop */}
                    <div>
                      {/* Selected trigger with inline input */}
                      {FREE_TRIGGERS.map(t => {
                        const isSelected = form.trigger?.id === t.id;
                        const iconBg = t.id === "price_above" ? "rgba(26,138,68,0.12)" : t.id === "price_below" ? "rgba(204,34,34,0.12)" : "rgba(138,106,0,0.12)";
                        const iconCol = t.id === "price_above" ? T.green : t.id === "price_below" ? T.red : T.accent;
                        const disabled = !form.asset;
                        return (
                          <div key={t.id} style={{
                            background: T.bgCard, border: isSelected ? "2px solid #0a1f4a" : `1px solid ${T.border}`,
                            borderRadius: 12, padding: 16, marginBottom: 8, cursor: disabled ? "not-allowed" : "pointer",
                            opacity: disabled ? 0.4 : 1,
                          }} onClick={() => { if (!disabled) setForm(f => ({ ...f, trigger: t })); }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div style={{ width: 44, height: 44, borderRadius: 8, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: iconCol, flexShrink: 0 }}>{t.icon}</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ ...font, fontSize: 20, fontWeight: isSelected ? 600 : 500, color: T.text }}>{t.label}</div>
                                <div style={{ ...mono, fontSize: 13, color: "#3a3a3a", marginTop: 3 }}>{t.desc}</div>
                              </div>
                              {isSelected && <span style={{ ...mono, fontSize: 13, color: "#0a1f4a", fontWeight: 600 }}>✓</span>}
                              {!isSelected && <span style={{ fontSize: 18, color: T.textFaint }}>→</span>}
                            </div>
                            {/* Inline input when selected */}
                            {isSelected && t.input === "price" && (
                              <div style={{ marginTop: 14 }} onClick={(ev) => ev.stopPropagation()}>
                                <div style={{ ...mono, fontSize: 12, letterSpacing: "2px", color: "#3a3a3a", marginBottom: 6 }}>TARGET PRICE (USD)</div>
                                <input type="number" placeholder="0.00" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                                  style={{ width: "100%", padding: "14px 14px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, ...font, fontSize: 24, fontWeight: 600, outline: "none", boxSizing: "border-box" }} />
                              </div>
                            )}
                            {isSelected && t.input === "percent" && (
                              <div style={{ marginTop: 14 }} onClick={(ev) => ev.stopPropagation()}>
                                <div style={{ ...mono, fontSize: 12, letterSpacing: "2px", color: "#3a3a3a", marginBottom: 6 }}>% CHANGE THRESHOLD</div>
                                <input type="number" placeholder="5" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                                  style={{ width: "100%", padding: "14px 14px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, ...font, fontSize: 24, fontWeight: 600, outline: "none", boxSizing: "border-box" }} />
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Pro triggers — collapsible, cobalt blue promotional */}
                      <div style={{ background: "#0a1f4a", borderRadius: 12, overflow: "hidden", marginTop: 10, marginBottom: 20 }}>
                        <div onClick={() => setMobileProTriggersOpen(p => !p)} style={{
                          padding: "16px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
                          cursor: "pointer",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 14 }}>⚡</span>
                            <span style={{ ...mono, fontSize: 13, letterSpacing: "1.5px", color: "#e8f2ff", fontWeight: 700 }}>PRO TRIGGERS</span>
                            <span style={{ ...mono, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>({PRO_TRIGGERS.length})</span>
                          </div>
                          <span style={{ ...font, fontSize: 14, color: mobileProTriggersOpen ? "#e8f2ff" : "rgba(255,255,255,0.5)" }}>{mobileProTriggersOpen ? "▲ Hide" : "▼ Show"}</span>
                        </div>
                        {!mobileProTriggersOpen && (
                          <div style={{ padding: "0 16px 14px" }}>
                            <div style={{ ...font, fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>Unlock advanced triggers like MA crossovers, RSI, Bollinger Bands & more</div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {PRO_TRIGGERS.slice(0, 4).map(t => (
                                <span key={t.id} style={{ ...mono, fontSize: 11, color: "#e8f2ff", background: "rgba(255,255,255,0.1)", padding: "5px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)" }}>{t.label.split(" ").slice(0, 2).join(" ")}</span>
                              ))}
                              <span style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.4)", padding: "5px 0" }}>+{PRO_TRIGGERS.length - 4} more</span>
                            </div>
                          </div>
                        )}
                        {mobileProTriggersOpen && (
                          <div style={{ padding: "6px 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                            {PRO_TRIGGERS.map(t => {
                              const isSelected = form.trigger?.id === t.id;
                              const iconBg = T.bgDeep;
                              return (
                              <div key={t.id}>
                              <button onClick={() => {
                                if (!form.asset) return;
                                if (!isPro) { setShowModal(false); setTab("pricing"); showToast("Pro plan required", "warn"); return; }
                                setForm(f => ({ ...f, trigger: t }));
                              }} style={{
                                width: "100%", padding: 16, borderRadius: 12,
                                border: isSelected ? "2px solid #0a1f4a" : `1px solid ${T.border}`,
                                background: T.bgCard, cursor: !form.asset ? "not-allowed" : "pointer", ...font,
                                textAlign: "left", display: "flex", gap: 12, alignItems: "center",
                                opacity: !form.asset ? 0.4 : isPro ? 1 : 0.45,
                              }}>
                                <div style={{ width: isMobile ? 44 : 38, height: isMobile ? 44 : 38, borderRadius: 8, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: isMobile ? 20 : 18, color: T.textFaint }}>{t.icon}</div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: isMobile ? 20 : 16, color: T.text, fontWeight: isSelected ? 600 : 500 }}>{t.label}</div>
                                  <div style={{ ...mono, fontSize: isMobile ? 13 : 11, color: T.textMid, marginTop: 3 }}>{t.desc}</div>
                                </div>
                                {!isPro && <span style={{ ...mono, fontSize: 10, color: T.textFaint, border: `1px solid ${T.border}`, padding: "2px 6px", borderRadius: 3 }}>PRO</span>}
                                {isSelected && <span style={{ ...mono, fontSize: 13, color: "#0a1f4a", fontWeight: 600 }}>✓</span>}
                                {!isSelected && isPro && <span style={{ fontSize: isMobile ? 18 : 14, color: T.textFaint }}>→</span>}
                              </button>
                              {/* Inline input for selected Pro trigger */}
                              {isSelected && t.input === "ma" && (
                                <div style={{ padding: "12px 14px" }} onClick={(ev) => ev.stopPropagation()}>
                                  <div style={{ ...mono, fontSize: 12, letterSpacing: "2px", color: T.textFaint, marginBottom: 8 }}>MOVING AVERAGE PERIOD</div>
                                  <div style={{ display: "flex", gap: 8 }}>
                                    {MA_OPTIONS.map(mv => <button key={mv} onClick={() => setForm(f => ({ ...f, ma: mv }))} style={{ ...chipBtn(form.ma === mv), flex: 1, padding: "10px 0", textAlign: "center" }}>{mv}D</button>)}
                                  </div>
                                </div>
                              )}
                              {isSelected && t.input === "bb" && (
                                <div style={{ padding: "12px 14px" }} onClick={(ev) => ev.stopPropagation()}>
                                  <div style={{ ...mono, fontSize: 12, letterSpacing: "2px", color: T.textFaint, marginBottom: 8 }}>BAND</div>
                                  <div style={{ display: "flex", gap: 8 }}>
                                    {BB_OPTIONS.map(bv => <button key={bv} onClick={() => setForm(f => ({ ...f, bb: bv }))} style={{ ...chipBtn(form.bb === bv), flex: 1, padding: "10px 0", textAlign: "center" }}>{bv}</button>)}
                                  </div>
                                </div>
                              )}
                              {isSelected && t.input === "volume" && (
                                <div style={{ padding: "12px 14px" }} onClick={(ev) => ev.stopPropagation()}>
                                  <div style={{ ...mono, fontSize: 12, letterSpacing: "2px", color: T.textFaint, marginBottom: 8 }}>SURGE MULTIPLIER</div>
                                  <div style={{ display: "flex", gap: 8 }}>
                                    {["2","3","5","10"].map(vv => <button key={vv} onClick={() => setForm(f => ({ ...f, volume: vv }))} style={{ ...chipBtn(form.volume === vv), flex: 1, padding: "10px 0", textAlign: "center" }}>{vv}×</button>)}
                                  </div>
                                </div>
                              )}
                              {isSelected && t.input === null && (
                                <div style={{ padding: "10px 14px", ...mono, fontSize: 11, color: T.textMid, background: T.bgDeep, borderRadius: 8, margin: "6px 0", textAlign: "center" }}>
                                  This trigger fires automatically — no configuration needed.
                                </div>
                              )}
                              </div>
                              );
                            })}
                            {!isPro && (
                              <button onClick={() => { setShowModal(false); setTab("pricing"); }} style={{
                                marginTop: 6, width: "100%", padding: 12, background: "#e8f2ff", color: "#0a1f4a",
                                border: "none", borderRadius: 8, ...font, fontSize: 15, fontWeight: 700, cursor: "pointer",
                              }}>Upgrade to Pro →</button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Continue button — goes to step 3 (delivery) */}
                      <button onClick={() => { if (form.trigger) setStep(3); }} style={{
                        width: "100%", padding: 16, background: form.trigger ? "#0a1f4a" : T.border, color: form.trigger ? "#e8f2ff" : T.textFaint,
                        border: "none", borderRadius: 10, ...font, fontSize: 20, fontWeight: 600, cursor: form.trigger ? "pointer" : "not-allowed",
                      }}>CONTINUE →</button>
                    </div>
                </div>
              </div>
            )}

            {/* Step 3 — Delivery */}
            {step === 3 && (
              <div style={{ padding: isMobile ? "20px" : "22px 28px" }}>

                {/* Alert summary */}
                {form.trigger && (
                  <div style={{ background: T.bgDeep, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: form.trigger.id === "price_above" ? "rgba(26,138,68,0.12)" : form.trigger.id === "price_below" ? "rgba(204,34,34,0.12)" : "rgba(138,106,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: form.trigger.id === "price_above" ? T.green : form.trigger.id === "price_below" ? T.red : T.accent, flexShrink: 0 }}>{form.trigger.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ ...font, fontSize: 16, fontWeight: 600, color: T.text }}>{form.trigger.label}</div>
                      <div style={{ ...mono, fontSize: 14, color: form.trigger.id === "price_above" ? T.green : form.trigger.id === "price_below" ? T.red : T.accent, fontWeight: 600, marginTop: 2 }}>{form.value ? (form.trigger.input === "percent" ? `${form.value}%` : `$${form.value}`) : ""}</div>
                    </div>
                    <div onClick={() => setStep(1)} style={{ ...mono, fontSize: 11, color: "#0a1f4a", fontWeight: 600, cursor: "pointer" }}>Edit ✎</div>
                  </div>
                )}

                <div style={{ ...mono, fontSize: isMobile ? 12 : 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 12 }}>{isMobile ? "DELIVERY CHANNELS" : "DELIVERY METHOD"}</div>

                {/* Mobile: toggle switches */}
                {isMobile ? (
                  <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
                    {DELIVERY.map((d, idx) => {
                      const blocked = d.pro && !isPro;
                      const active = form.delivery.includes(d.id) && !blocked;
                      const emoji = d.id === "email" ? "📧" : d.id === "push" ? "🔔" : d.id === "sms" ? "💬" : "🔗";
                      const desc = d.id === "email" ? "Account email" : d.id === "push" ? "Browser notifications" : d.id === "sms" ? "Text message" : "POST endpoint";
                      return (
                        <div key={d.id} onClick={() => !blocked && setForm(f => ({ ...f, delivery: active ? f.delivery.filter(x => x !== d.id) : [...f.delivery, d.id] }))}
                          style={{
                            padding: "18px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
                            borderBottom: idx < DELIVERY.length - 1 ? `1px solid ${T.border}` : "none",
                            opacity: blocked ? 0.45 : 1, cursor: blocked ? "not-allowed" : "pointer",
                          }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ fontSize: 22 }}>{emoji}</span>
                            <div>
                              <div style={{ ...font, fontSize: 18, fontWeight: active ? 600 : 500, color: T.text }}>{d.label}</div>
                              <div style={{ ...mono, fontSize: 11, color: T.textFaint }}>{desc}</div>
                            </div>
                          </div>
                          {blocked ? (
                            <span style={{ ...mono, fontSize: 10, color: "#0a1f4a", border: "1px solid #0a1f4a", padding: "3px 8px", borderRadius: 4, fontWeight: 600 }}>PRO</span>
                          ) : (
                            <div style={{ width: 52, height: 30, borderRadius: 15, background: active ? "#0a1f4a" : T.border, padding: 3, display: "flex", alignItems: "center", justifyContent: active ? "flex-end" : "flex-start", transition: "all 0.2s" }}>
                              <div style={{ width: 24, height: 24, borderRadius: 12, background: "#fff" }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Desktop: original 2x2 grid */
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
                )}

                {/* Webhook URL input — shown when webhook is selected */}
                {form.delivery.includes("webhook") && (
                  <div style={{ marginBottom: 22 }}>
                    <div style={{ ...mono, fontSize: isMobile ? 12 : 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 8 }}>WEBHOOK URL</div>
                    <input
                      type="url"
                      placeholder="https://your-server.com/webhook"
                      value={form.webhook_url}
                      onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))}
                      style={{ width: "100%", padding: "11px 14px", boxSizing: "border-box", background: T.bgInput, border: `1px solid ${form.webhook_url ? T.accent : T.border}`, borderRadius: 9, color: T.text, ...font, fontSize: 14, outline: "none" }}
                    />
                    <div style={{ ...mono, fontSize: isMobile ? 11 : 9, color: T.textFaint, marginTop: 6, lineHeight: 1.5 }}>
                      We'll POST a JSON payload with alert details when this alert fires.
                    </div>
                  </div>
                )}

                {isPro && (
                  <>
                    <div style={{ ...mono, fontSize: isMobile ? 12 : 9, letterSpacing: "2px", color: T.textFaint, marginBottom: 10 }}>COOLDOWN</div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
                      {[["15","15m"],["60","1h"],["240","4h"],["1440","24h"]].map(([v,l]) => (
                        <button key={v} onClick={() => setForm(f => ({ ...f, cooldown: v }))} style={{ ...chipBtn(form.cooldown === v), flex: 1, padding: "10px 0", textAlign: "center" }}>{l}</button>
                      ))}
                    </div>
                  </>
                )}

                <button onClick={handleSaveAlert} style={{ width: "100%", padding: isMobile ? 16 : 13, background: T.btnPrimary, border: "none", borderRadius: isMobile ? 10 : 9, cursor: "pointer", ...font, fontSize: 20, color: T.btnText }}>
                  SAVE ALERT
                </button>
                <button onClick={() => setStep(1)} style={{ marginTop: 8, width: "100%", padding: 10, background: "none", border: "none", color: T.textFaint, cursor: "pointer", ...font, fontSize: isMobile ? 14 : 16 }}>← Back</button>
              </div>
            )}
            </div>{/* end scrollable body */}
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
    { icon: "📸", title: "Share chart screenshots", desc: "Share beautiful chart images with price data to social" },
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

  if (!data || !data.length) return <div style={{ padding: 20, textAlign: "center", color: T.textMid, fontSize: 12 }}>No data</div>;

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
        <text x="300" y="9" textAnchor="middle" fontSize="8" fill={T.textFaint} fontFamily="monospace">{`${data.length} candles · ${data.length > 0 ? new Date(data[0].t).toLocaleDateString("en-US",{month:"short",year:"numeric"}) : ""} → ${data.length > 0 ? new Date(data[data.length-1].t).toLocaleDateString("en-US",{month:"short",year:"numeric"}) : ""}`}</text>
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
  const [pricingTab, setPricingTab] = useState("pro"); // "free" or "pro" — default Pro

  const freeFeatures = ["10 active alerts","Price above / below","% change alerts","Push & Email"];
  const proFeatures  = ["Unlimited alerts","All 12 trigger types","Multi-condition AND/OR","90-day backtesting","SMS & Webhook","Share chart screenshots","Alert cooldown","Priority delivery"];

  return (
    <div style={{ maxWidth: isMobile ? "100%" : 600, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: isMobile ? 20 : 28 }}>
        <div style={{ ...font, fontSize: isMobile ? 28 : 36, fontWeight: 800, color: T.text, lineHeight: 1.2 }}>Choose your plan</div>
        <div style={{ ...font, fontSize: isMobile ? 15 : 16, color: T.textMid, marginTop: 8 }}>Start free. Upgrade anytime.</div>
      </div>

      {/* Toggle tabs */}
      <div style={{ display: "flex", background: T.bgDeep, borderRadius: 12, padding: 4, marginBottom: isMobile ? 24 : 28 }}>
        <div onClick={() => setPricingTab("free")} style={{
          flex: 1, textAlign: "center", padding: isMobile ? 12 : 14, borderRadius: 10, cursor: "pointer",
          ...font, fontSize: isMobile ? 15 : 16,
          fontWeight: pricingTab === "free" ? 700 : 500,
          background: pricingTab === "free" ? T.bgCard : "transparent",
          color: pricingTab === "free" ? T.text : T.textMid,
          boxShadow: pricingTab === "free" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
          transition: "all 0.2s",
        }}>Free</div>
        <div onClick={() => setPricingTab("pro")} style={{
          flex: 1, textAlign: "center", padding: isMobile ? 12 : 14, borderRadius: 10, cursor: "pointer",
          ...font, fontSize: isMobile ? 15 : 16,
          fontWeight: pricingTab === "pro" ? 700 : 500,
          background: pricingTab === "pro" ? "#0a1f4a" : "transparent",
          color: pricingTab === "pro" ? "#e8f2ff" : T.textMid,
          boxShadow: pricingTab === "pro" ? "0 2px 8px rgba(10,31,74,0.3)" : "none",
          transition: "all 0.2s",
        }}>Pro</div>
      </div>

      {/* Pro card — shown when Pro tab selected */}
      {pricingTab === "pro" && (
        <div>
          <div style={{ background: "linear-gradient(135deg,#0a1f4a 0%,#1a3a6a 100%)", borderRadius: 20, padding: isMobile ? "32px 24px" : "36px 32px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, background: "rgba(55,138,221,0.15)", borderRadius: "50%" }} />
            <div style={{ position: "absolute", bottom: -30, left: -20, width: 80, height: 80, background: "rgba(55,138,221,0.1)", borderRadius: "50%" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, position: "relative" }}>
              <div>
                <div style={{ ...mono, fontSize: isMobile ? 11 : 10, letterSpacing: "2px", color: "#378ADD", fontWeight: 600 }}>PRO</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                  <span style={{ ...font, fontSize: isMobile ? 48 : 52, fontWeight: 800, color: "#e8f2ff", lineHeight: 1 }}>$9</span>
                  <span style={{ ...font, fontSize: isMobile ? 18 : 20, color: "rgba(255,255,255,0.4)" }}>/mo</span>
                </div>
              </div>
              <div style={{ ...mono, fontSize: isMobile ? 10 : 9, color: "#e8f2ff", background: "rgba(55,138,221,0.2)", padding: "6px 12px", borderRadius: 20, border: "1px solid rgba(55,138,221,0.3)" }}>SAVE 40% yearly</div>
            </div>
            <div style={{ ...font, fontSize: isMobile ? 15 : 14, color: "rgba(255,255,255,0.6)", marginBottom: 24 }}>For serious traders who need every edge</div>
            {proFeatures.map(f => (
              <div key={f} style={{ display: "flex", alignItems: "center", padding: "8px 0", ...font, fontSize: isMobile ? 15 : 14, color: "#e8f2ff" }}>
                <span style={{ color: "#378ADD", marginRight: 10, fontSize: 16 }}>✓</span>{f}
              </div>
            ))}
            {isFree ? (
              <button onClick={() => proPriceId && onUpgrade(proPriceId)} style={{
                marginTop: 24, width: "100%", padding: isMobile ? 16 : 14, background: "#e8f2ff", color: "#0a1f4a",
                border: "none", borderRadius: 12, ...font, fontSize: isMobile ? 18 : 16, fontWeight: 700, cursor: "pointer",
              }}>Start Pro — $9/mo</button>
            ) : (
              <div style={{ marginTop: 24, textAlign: "center", padding: 14, border: "1px solid rgba(55,138,221,0.3)", borderRadius: 12, ...mono, fontSize: 12, color: "#378ADD", background: "rgba(55,138,221,0.1)" }}>✓ PRO ACTIVE</div>
            )}
          </div>
          <div style={{ textAlign: "center", ...mono, fontSize: isMobile ? 11 : 10, color: T.textFaint }}>14-day money-back guarantee · Cancel anytime</div>
        </div>
      )}

      {/* Free card — shown when Free tab selected */}
      {pricingTab === "free" && (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, padding: isMobile ? "24px 24px" : "36px 32px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ ...mono, fontSize: isMobile ? 11 : 10, letterSpacing: "2px", color: T.textFaint }}>FREE</div>
              <div style={{ ...font, fontSize: isMobile ? 32 : 48, fontWeight: 800, color: T.text }}>$0</div>
            </div>
            {isFree && (
              <div style={{ ...mono, fontSize: isMobile ? 10 : 9, color: T.green, background: `${T.green}15`, padding: "4px 10px", borderRadius: 4 }}>✓ CURRENT</div>
            )}
          </div>
          <div style={{ ...font, fontSize: isMobile ? 14 : 13, color: T.textMid, marginBottom: 20 }}>For casual watchers</div>
          {freeFeatures.map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", padding: "8px 0", ...font, fontSize: isMobile ? 15 : 14, color: T.text }}>
              <span style={{ color: T.green, marginRight: 10, fontSize: 16 }}>✓</span>{f}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
