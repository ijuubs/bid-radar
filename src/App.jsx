import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Anchor, Radar, Send, Settings, RefreshCw, Check, Clock, X, Loader2, ArrowLeft, Search, TrendingUp, ListChecks, SlidersHorizontal } from "lucide-react";

const TOKEN_KEY = "fl_oauth_token";
const SKILLS_KEY = "fl_skill_keywords";
const BIDS_KEY = "fl_tracked_bids";
const DEMO_KEY = "fl_demo_mode";
const PROXY_KEY = "fl_proxy_url";
const ANTHROPIC_KEY = "fl_anthropic_key";
const GROQ_KEY = "fl_groq_key";
const DRAFT_PROVIDER_KEY = "fl_draft_provider";
const DEFAULT_API_BASE = "https://www.freelancer.com/api";

const DEMO_PROJECTS = [
  { id: "d1", title: "React dashboard for logistics tracking", description: "Need a full-stack developer to build a React + Node dashboard that tracks shipment status across three warehouses. Should include charts, CSV export, and role-based auth.", budget: "$750 - $1500", bids: 12, skills: ["React", "Node.js", "PostgreSQL"], time: "2h ago", currency: "USD" },
  { id: "d2", title: "SEO audit + Astro site migration", description: "Migrating a content site from WordPress to Astro. Need someone who understands SEO-safe redirects, JSON-LD structured data, and Core Web Vitals.", budget: "$400 - $800", bids: 6, skills: ["Astro", "SEO", "JavaScript"], time: "5h ago", currency: "USD" },
  { id: "d3", title: "Vite + Tailwind calculator tool build-out", description: "Looking for 10 additional unit converter tools added to an existing Vite/Tailwind SEO site. Must match existing component patterns.", budget: "$300 - $600", bids: 4, skills: ["React", "Vite", "Tailwind CSS"], time: "1d ago", currency: "USD" },
  { id: "d4", title: "Fiji travel content writer + on-page SEO", description: "Weekly blog posts about Pacific island travel and relocation, need someone who understands local context and can hit SEO briefs.", budget: "$200 - $450", bids: 3, skills: ["SEO", "Content Writing"], time: "9h ago", currency: "USD" },
];

const STATUS_META = {
  drafted: { label: "Drafted", color: "#8B93A1", icon: Clock },
  submitted: { label: "Submitted", color: "#E8A33D", icon: Send },
  won: { label: "Won", color: "#4FAE7E", icon: Check },
  lost: { label: "Lost", color: "#C15B5B", icon: X },
};

const SORTS = {
  fit: { label: "Best fit", fn: (a, b) => b.score - a.score },
  budget: { label: "Highest budget", fn: (a, b) => parseBudget(b.budget) - parseBudget(a.budget) },
  newest: { label: "Newest", fn: (a, b) => (b.time_submitted || 0) - (a.time_submitted || 0) },
  fewestBids: { label: "Least competition", fn: (a, b) => a.bids - b.bids },
};

function parseBudget(str) {
  const m = (str || "").match(/[\d,]+(\.\d+)?/g);
  if (!m) return 0;
  return Math.max(...m.map(x => parseFloat(x.replace(/,/g, ""))));
}

function scoreProject(project, keywords) {
  if (!keywords.length) return 50;
  const haystack = (project.title + " " + project.description + " " + (project.skills || []).join(" ")).toLowerCase();
  const hits = keywords.filter(k => haystack.includes(k.toLowerCase())).length;
  return Math.min(100, Math.round((hits / keywords.length) * 100));
}

function useLocalState(key, initial) {
  const [val, setVal] = useState(initial);
  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored !== null) setVal(stored);
  }, []);
  const save = (v) => { setVal(v); localStorage.setItem(key, v); };
  return [val, save];
}

export default function BidRadarApp() {
  const [view, setView] = useState("radar"); // radar | bids | setup
  const [token, setToken] = useLocalState(TOKEN_KEY, "");
  const [tokenInput, setTokenInput] = useState("");
  const [demoMode, setDemoModeRaw] = useState(true);
  const [skillsInput, setSkillsInput] = useLocalState(SKILLS_KEY, "React, Node.js, SEO, Astro, Tailwind");
  const [proxyUrl, setProxyUrl] = useLocalState(PROXY_KEY, "");
  const [proxyInput, setProxyInput] = useState("");
  const [anthropicKey, setAnthropicKey] = useLocalState(ANTHROPIC_KEY, "");
  const [anthropicKeyInput, setAnthropicKeyInput] = useState("");
  const [groqKey, setGroqKey] = useLocalState(GROQ_KEY, "");
  const [groqKeyInput, setGroqKeyInput] = useState("");
  const [draftProvider, setDraftProvider] = useLocalState(DRAFT_PROVIDER_KEY, "anthropic");

  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [bidStatuses, setBidStatuses] = useState({});
  const [fetchError, setFetchError] = useState("");
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("fit");
  const [showSort, setShowSort] = useState(false);
  const [bidFilter, setBidFilter] = useState("all");

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY); if (t) setTokenInput(t);
    const p = localStorage.getItem(PROXY_KEY); if (p) setProxyInput(p);
    const a = localStorage.getItem(ANTHROPIC_KEY); if (a) setAnthropicKeyInput(a);
    const g = localStorage.getItem(GROQ_KEY); if (g) setGroqKeyInput(g);
    const d = localStorage.getItem(DEMO_KEY); setDemoModeRaw(d === null ? true : d === "true");
    const b = localStorage.getItem(BIDS_KEY);
    if (b) { try { setBidStatuses(JSON.parse(b)); } catch (e) {} }
    setReady(true);
  }, []);

  const setDemoMode = (v) => { setDemoModeRaw(v); localStorage.setItem(DEMO_KEY, v ? "true" : "false"); };

  const persistBidStatuses = (next) => {
    setBidStatuses(next);
    localStorage.setItem(BIDS_KEY, JSON.stringify(next));
  };

  const saveToken = () => { setToken(tokenInput); if (tokenInput) setDemoMode(false); showToast("Token saved"); };
  const saveProxy = () => { setProxyUrl(proxyInput.trim().replace(/\/$/, "")); showToast("Proxy URL saved"); };
  const saveAnthropic = () => { setAnthropicKey(anthropicKeyInput.trim()); showToast("Anthropic key saved"); };
  const saveGroq = () => { setGroqKey(groqKeyInput.trim()); showToast("Groq key saved"); };

  const apiBase = proxyUrl ? `${proxyUrl}/api` : DEFAULT_API_BASE;
  const keywords = useMemo(() => skillsInput.split(",").map(s => s.trim()).filter(Boolean), [skillsInput]);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    if (demoMode || !token) {
      setTimeout(() => {
        setProjects(DEMO_PROJECTS.map(p => ({ ...p, score: scoreProject(p, keywords) })));
        setLoading(false);
      }, 400);
      return;
    }
    try {
      const q = keywords.join(" ");
      const res = await fetch(
        `${apiBase}/projects/0.1/projects/active/?query=${encodeURIComponent(q)}&full_description=true&job_details=true&limit=30`,
        { headers: { "freelancer-oauth-v1": token } }
      );
      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${bodyText ? " — " + bodyText.slice(0, 150) : ""}`);
      }
      const data = await res.json();
      const raw = data?.result?.projects || [];
      const mapped = raw.map(p => ({
        id: p.id,
        title: p.title,
        description: (p.description || p.preview_description || "").slice(0, 700),
        budget: p.budget ? `${p.budget.minimum ?? "?"} - ${p.budget.maximum ?? "?"} ${p.currency?.code || ""}` : "Not specified",
        bids: p.bid_stats?.bid_count ?? 0,
        skills: (p.jobs || []).map(j => j.name),
        time: new Date((p.time_submitted || 0) * 1000).toLocaleDateString(),
        time_submitted: p.time_submitted || 0,
        currency: p.currency?.code || "",
      }));
      setProjects(mapped.map(p => ({ ...p, score: scoreProject(p, keywords) })));
    } catch (e) {
      const usingProxy = !!proxyUrl;
      setFetchError(
        usingProxy
          ? `Request through your proxy failed: "${e.message}". Showing demo data.`
          : "Couldn't reach Freelancer.com directly (CORS). Set up a proxy in Setup."
      );
      setProjects(DEMO_PROJECTS.map(p => ({ ...p, score: scoreProject(p, keywords) })));
    }
    setLoading(false);
  }, [token, demoMode, keywords, proxyUrl]);

  useEffect(() => { if (ready) fetchProjects(); }, [ready]);

  const visibleProjects = useMemo(() => {
    let list = projects;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(p => p.title.toLowerCase().includes(q) || (p.skills || []).some(s => s.toLowerCase().includes(q)));
    }
    return [...list].sort(SORTS[sortKey].fn);
  }, [projects, query, sortKey]);

  const stats = useMemo(() => {
    const vals = Object.values(bidStatuses);
    const submitted = vals.filter(v => v.status === "submitted").length;
    const won = vals.filter(v => v.status === "won").length;
    const lost = vals.filter(v => v.status === "lost").length;
    const decided = won + lost;
    return { total: vals.length, submitted, won, lost, winRate: decided ? Math.round((won / decided) * 100) : null };
  }, [bidStatuses]);

  const openProject = (p) => {
    setSelected(p);
    setDraft("");
    setBidAmount(String(Math.round(parseBudget(p.budget)) || ""));
  };

  const generateDraft = async () => {
    if (!selected) return;
    const usingGroq = draftProvider === "groq";
    const key = usingGroq ? groqKey : anthropicKey;
    if (!key) { showToast(`Add a ${usingGroq ? "Groq" : "Anthropic"} API key in Setup first`); return; }
    setDrafting(true);
    const prompt = `Write a short, specific, non-generic freelance proposal (120-180 words) for this project. No AI-sounding filler like "I was excited to see your posting" or "synergize". Sound like a real developer who actually read the brief. End with a concrete next step or question.\n\nProject title: ${selected.title}\nDescription: ${selected.description}\nSkills needed: ${(selected.skills || []).join(", ")}\nMy relevant background: full-stack React/Vite/Tailwind developer, experience with SEO-driven content sites, AdSense monetization, and structured data (JSON-LD).`;
    try {
      if (usingGroq) {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            max_tokens: 500,
            messages: [{ role: "user", content: prompt }],
          })
        });
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || `Could not generate draft: ${JSON.stringify(data).slice(0, 200)}`;
        setDraft(text);
      } else {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 500, messages: [{ role: "user", content: prompt }] })
        });
        const data = await response.json();
        const text = data.content?.find(b => b.type === "text")?.text || `Could not generate draft: ${JSON.stringify(data).slice(0, 200)}`;
        setDraft(text);
      }
    } catch (e) {
      setDraft("Draft generation failed: " + e.message);
    }
    setDrafting(false);
  };

  const submitBid = async () => {
    if (!selected) return;
    const next = { ...bidStatuses, [selected.id]: { status: "submitted", amount: bidAmount, at: Date.now(), title: selected.title, budget: selected.budget } };
    if (demoMode || !token) { persistBidStatuses(next); showToast("Bid saved (demo mode)"); return; }
    try {
      const res = await fetch(`${apiBase}/projects/0.1/bids/`, {
        method: "POST",
        headers: { "freelancer-oauth-v1": token, "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: selected.id, bidder_id: null, amount: Number(bidAmount), period: 7, milestone_percentage: 100, description: draft })
      });
      if (!res.ok) throw new Error();
      persistBidStatuses(next);
      showToast("Bid submitted");
    } catch (e) {
      showToast("Bid submission failed — nothing was sent");
    }
  };

  const markStatus = (id, status) => {
    const cur = bidStatuses[id] || {};
    persistBidStatuses({ ...bidStatuses, [id]: { ...cur, status } });
    showToast(`Marked as ${STATUS_META[status].label}`);
  };

  const bidList = useMemo(() => {
    const entries = Object.entries(bidStatuses).map(([id, v]) => ({ id, ...v }));
    entries.sort((a, b) => (b.at || 0) - (a.at || 0));
    if (bidFilter === "all") return entries;
    return entries.filter(e => e.status === bidFilter);
  }, [bidStatuses, bidFilter]);

  return (
    <div style={{ minHeight: "100vh", background: "#12161C", color: "#E8E6E1", fontFamily: "'Inter', sans-serif", paddingBottom: 76 }}>
      <GlobalStyle />

      {/* Header */}
      <div style={{ borderBottom: "1px solid #232833", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#12161Cee", backdropFilter: "blur(8px)", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Anchor size={20} color="#E8A33D" />
          <div>
            <div className="display" style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>Bid Radar</div>
            <div className="mono" style={{ fontSize: 10, color: demoMode ? "#5A6270" : "#4FAE7E" }}>{demoMode ? "DEMO MODE" : "● LIVE · freelancer.com"}</div>
          </div>
        </div>
        <button onClick={fetchProjects} disabled={loading} className="press" style={{ display: "flex", alignItems: "center", gap: 6, background: "#1A1F27", border: "1px solid #2A303B", color: "#E8E6E1", borderRadius: 8, padding: "7px 12px", fontSize: 12 }}>
          {loading ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
        </button>
      </div>

      {fetchError && (
        <div className="view-enter" style={{ margin: "12px 16px 0", padding: "10px 14px", background: "#2A1F1A", border: "1px solid #4A3324", borderRadius: 8, fontSize: 12, color: "#E0B98F" }}>{fetchError}</div>
      )}

      {/* RADAR VIEW */}
      {view === "radar" && !selected && (
        <div className="view-enter" style={{ padding: "16px 16px 8px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", background: "#161B22", border: "1px solid #232833", borderRadius: 10, padding: "0 12px" }}>
              <Search size={15} color="#5A6270" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search jobs or skills" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#E8E6E1", padding: "10px 8px", fontSize: 13 }} />
            </div>
            <button onClick={() => setShowSort(s => !s)} className="press" style={{ display: "flex", alignItems: "center", gap: 6, background: showSort ? "#E8A33D" : "#161B22", color: showSort ? "#12161C" : "#E8E6E1", border: "1px solid #232833", borderRadius: 10, padding: "0 14px", fontSize: 12, fontWeight: 500 }}>
              <SlidersHorizontal size={14} />
            </button>
          </div>

          {showSort && (
            <div className="sort-panel" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {Object.entries(SORTS).map(([k, s]) => (
                <button key={k} onClick={() => { setSortKey(k); setShowSort(false); }} className="press" style={{ fontSize: 12, padding: "6px 12px", borderRadius: 20, border: `1px solid ${sortKey === k ? "#E8A33D" : "#2A303B"}`, background: sortKey === k ? "#E8A33D22" : "#161B22", color: sortKey === k ? "#E8A33D" : "#8B93A1" }}>
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ fontSize: 12, color: "#5A6270", marginBottom: 10 }}>{loading ? "Loading…" : `${visibleProjects.length} matching projects · sorted by ${SORTS[sortKey].label.toLowerCase()}`}</div>

          {loading && (
            <>
              {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 92, marginBottom: 10, animationDelay: `${i * 0.05}s` }} />)}
            </>
          )}

          {!loading && visibleProjects.length === 0 && (
            <EmptyState title="No matches" subtitle="Try different keywords in Setup, or clear your search." />
          )}

          {!loading && visibleProjects.map((p, i) => {
            const status = bidStatuses[p.id]?.status;
            const meta = status ? STATUS_META[status] : null;
            return (
              <div key={p.id} onClick={() => openProject(p)} className="card-item"
                style={{ padding: "14px 16px", marginBottom: 10, borderRadius: 12, border: "1px solid #232833", background: "#161B22", animationDelay: `${Math.min(i, 8) * 0.04}s` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>{p.title}</div>
                  <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: p.score >= 70 ? "#4FAE7E" : p.score >= 40 ? "#E8A33D" : "#5A6270", flexShrink: 0 }}>{p.score}%</div>
                </div>
                <div style={{ fontSize: 12, color: "#8B93A1", marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span className="mono">{p.budget}</span>
                  <span>{p.bids} bids</span>
                  <span>{p.time}</span>
                </div>
                {meta && (
                  <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: meta.color, background: meta.color + "1a", padding: "3px 8px", borderRadius: 20 }}>
                    <meta.icon size={11} /> {meta.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* JOB DETAIL — full screen overlay */}
      {selected && (
        <div className="detail-overlay" style={{ position: "fixed", inset: 0, background: "#12161C", zIndex: 30, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid #232833", position: "sticky", top: 0, background: "#12161Cee", backdropFilter: "blur(8px)" }}>
            <button onClick={() => setSelected(null)} className="press" style={{ background: "none", border: "none", color: "#E8E6E1", display: "flex" }}><ArrowLeft size={20} /></button>
            <div className="display" style={{ fontSize: 15, fontWeight: 600 }}>Project details</div>
          </div>
          <div style={{ padding: "20px 20px 40px" }}>
            <h2 className="display" style={{ fontSize: 20, fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{selected.title}</h2>
            <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 13, color: "#8B93A1", flexWrap: "wrap" }}>
              <span className="mono">{selected.budget}</span>
              <span>{selected.bids} bids so far</span>
              <span className="mono" style={{ color: selected.score >= 70 ? "#4FAE7E" : "#E8A33D" }}>{selected.score}% fit</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
              {(selected.skills || []).map(s => (
                <span key={s} style={{ fontSize: 11, background: "#1A1F27", border: "1px solid #2A303B", borderRadius: 20, padding: "3px 10px", color: "#8B93A1" }}>{s}</span>
              ))}
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "#C7CBD1", marginTop: 18, whiteSpace: "pre-wrap" }}>{selected.description}</p>

            <div style={{ marginTop: 26, borderTop: "1px solid #232833", paddingTop: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div className="display" style={{ fontSize: 15, fontWeight: 600 }}>Proposal draft</div>
                <button onClick={generateDraft} disabled={drafting} className="press" style={{ display: "flex", alignItems: "center", gap: 6, background: "#1A1F27", border: "1px solid #2A303B", color: "#E8E6E1", borderRadius: 8, padding: "7px 12px", fontSize: 12 }}>
                  {drafting ? <Loader2 size={13} className="spin" /> : <Radar size={13} />}
                  {draft ? "Regenerate" : "Generate draft"}
                </button>
              </div>
              <textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Generate a draft, then edit it in your own voice — nothing here submits automatically."
                style={{ width: "100%", minHeight: 160, background: "#0F1319", border: "1px solid #2A303B", borderRadius: 8, padding: 14, color: "#E8E6E1", fontSize: 13, lineHeight: 1.6, resize: "vertical" }} />

              <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#8B93A1" }}>Bid amount</span>
                  <input value={bidAmount} onChange={e => setBidAmount(e.target.value)} className="mono" style={{ width: 90, background: "#0F1319", border: "1px solid #2A303B", borderRadius: 6, padding: "6px 10px", color: "#E8E6E1", fontSize: 13 }} />
                </div>
                <button onClick={submitBid} disabled={!draft} className="press" style={{ display: "flex", alignItems: "center", gap: 7, background: draft ? "#E8A33D" : "#2A303B", color: draft ? "#12161C" : "#5A6270", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, marginLeft: "auto" }}>
                  <Send size={14} /> Submit bid
                </button>
              </div>

              {bidStatuses[selected.id] && (
                <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "#8B93A1", alignSelf: "center" }}>Status:</span>
                  {["submitted", "won", "lost"].map(s => (
                    <button key={s} onClick={() => markStatus(selected.id, s)} className="press" style={{ fontSize: 11, background: bidStatuses[selected.id].status === s ? STATUS_META[s].color + "33" : "#1A1F27", color: bidStatuses[selected.id].status === s ? STATUS_META[s].color : "#8B93A1", border: `1px solid ${bidStatuses[selected.id].status === s ? STATUS_META[s].color : "#2A303B"}`, borderRadius: 20, padding: "4px 10px" }}>
                      {STATUS_META[s].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BIDS VIEW */}
      {view === "bids" && !selected && (
        <div className="view-enter" style={{ padding: "16px 16px 8px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Submitted" value={stats.submitted} color="#E8A33D" />
            <StatCard label="Won" value={stats.won} color="#4FAE7E" />
            <StatCard label="Win rate" value={stats.winRate === null ? "—" : stats.winRate + "%"} color="#4FAE7E" />
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
            {["all", "submitted", "won", "lost"].map(f => (
              <button key={f} onClick={() => setBidFilter(f)} className="press" style={{ fontSize: 12, padding: "6px 12px", borderRadius: 20, whiteSpace: "nowrap", border: `1px solid ${bidFilter === f ? "#E8A33D" : "#2A303B"}`, background: bidFilter === f ? "#E8A33D22" : "#161B22", color: bidFilter === f ? "#E8A33D" : "#8B93A1" }}>
                {f === "all" ? "All" : STATUS_META[f].label}
              </button>
            ))}
          </div>

          {bidList.length === 0 && <EmptyState title="No bids yet" subtitle="Submitted bids will show up here so you can track outcomes." />}

          {bidList.map((b, i) => {
            const meta = STATUS_META[b.status] || STATUS_META.drafted;
            return (
              <div key={b.id} className="card-item" style={{ padding: "14px 16px", marginBottom: 10, borderRadius: 12, border: "1px solid #232833", background: "#161B22", animationDelay: `${Math.min(i, 8) * 0.04}s` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>{b.title || "Untitled project"}</div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: meta.color, background: meta.color + "1a", padding: "3px 8px", borderRadius: 20, height: "fit-content", flexShrink: 0 }}>
                    <meta.icon size={11} /> {meta.label}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#8B93A1", marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {b.amount && <span className="mono">Bid: ${b.amount}</span>}
                  {b.budget && <span className="mono">{b.budget}</span>}
                  <span>{b.at ? new Date(b.at).toLocaleDateString() : ""}</span>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  {["submitted", "won", "lost"].map(s => (
                    <button key={s} onClick={() => markStatus(b.id, s)} className="press" style={{ fontSize: 11, background: b.status === s ? STATUS_META[s].color + "33" : "#1A1F27", color: b.status === s ? STATUS_META[s].color : "#8B93A1", border: `1px solid ${b.status === s ? STATUS_META[s].color : "#2A303B"}`, borderRadius: 20, padding: "3px 10px" }}>
                      {STATUS_META[s].label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SETUP VIEW */}
      {view === "setup" && !selected && (
        <div className="view-enter" style={{ padding: "20px 16px 40px", maxWidth: 560 }}>
          <Field label="Freelancer.com OAuth token" hint="Generate at freelancer.com → Settings → API. Without one, this stays in demo mode.">
            <div style={{ display: "flex", gap: 8 }}>
              <input value={tokenInput} onChange={e => setTokenInput(e.target.value)} type="password" placeholder="Paste token" style={inputStyle} />
              <button onClick={saveToken} className="press" style={saveBtnStyle}>Save</button>
            </div>
          </Field>

          <Field label="Skills / keywords" hint="Comma-separated. Drives the fit score on each job.">
            <input value={skillsInput} onChange={e => setSkillsInput(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </Field>

          <Field label="Proxy URL" hint="Only needed if direct calls get CORS-blocked. Leave blank to call freelancer.com directly.">
            <div style={{ display: "flex", gap: 8 }}>
              <input value={proxyInput} onChange={e => setProxyInput(e.target.value)} placeholder="https://your-worker.workers.dev" style={inputStyle} />
              <button onClick={saveProxy} className="press" style={saveBtnStyle}>Save</button>
            </div>
          </Field>

          <Field label="Proposal drafting provider" hint="Anthropic gives the best writing quality. Groq is free (no credit card, generous daily limit) but uses an open-source model instead of Claude.">
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setDraftProvider("anthropic")} className="press" style={{ flex: 1, fontSize: 12, padding: "8px 10px", borderRadius: 8, border: `1px solid ${draftProvider === "anthropic" ? "#E8A33D" : "#2A303B"}`, background: draftProvider === "anthropic" ? "#E8A33D22" : "#161B22", color: draftProvider === "anthropic" ? "#E8A33D" : "#8B93A1", fontWeight: 500 }}>Anthropic</button>
              <button onClick={() => setDraftProvider("groq")} className="press" style={{ flex: 1, fontSize: 12, padding: "8px 10px", borderRadius: 8, border: `1px solid ${draftProvider === "groq" ? "#E8A33D" : "#2A303B"}`, background: draftProvider === "groq" ? "#E8A33D22" : "#161B22", color: draftProvider === "groq" ? "#E8A33D" : "#8B93A1", fontWeight: 500 }}>Groq (free)</button>
            </div>
          </Field>

          <Field label="Anthropic API key" hint="From console.anthropic.com → API Keys. Requires credits. Stored only in this browser.">
            <div style={{ display: "flex", gap: 8 }}>
              <input value={anthropicKeyInput} onChange={e => setAnthropicKeyInput(e.target.value)} type="password" placeholder="sk-ant-..." style={inputStyle} />
              <button onClick={saveAnthropic} className="press" style={saveBtnStyle}>Save</button>
            </div>
          </Field>

          <Field label="Groq API key (free tier)" hint="From console.groq.com → API Keys — no credit card needed. Stored only in this browser.">
            <div style={{ display: "flex", gap: 8 }}>
              <input value={groqKeyInput} onChange={e => setGroqKeyInput(e.target.value)} type="password" placeholder="gsk_..." style={inputStyle} />
              <button onClick={saveGroq} className="press" style={saveBtnStyle}>Save</button>
            </div>
          </Field>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderTop: "1px solid #232833", marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Demo mode</div>
              <div style={{ fontSize: 11, color: "#5A6270" }}>Browse sample jobs without a live token</div>
            </div>
            <button onClick={() => setDemoMode(!demoMode)} style={{ width: 44, height: 26, borderRadius: 20, background: demoMode ? "#E8A33D" : "#2A303B", border: "none", position: "relative", flexShrink: 0, transition: "background 0.2s ease" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#12161C", position: "absolute", top: 3, left: demoMode ? 21 : 3, transition: "left 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)" }} />
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast-pop" style={{ position: "fixed", bottom: 84, left: "50%", background: "#1A1F27", border: "1px solid #2A303B", color: "#E8E6E1", padding: "10px 18px", borderRadius: 30, fontSize: 13, zIndex: 40, boxShadow: "0 8px 24px #00000055" }}>
          {toast}
        </div>
      )}

      {/* Bottom nav */}
      {!selected && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#161B22ee", backdropFilter: "blur(10px)", borderTop: "1px solid #232833", display: "flex", zIndex: 15 }}>
          <NavButton icon={Radar} label="Radar" active={view === "radar"} onClick={() => setView("radar")} />
          <NavButton icon={ListChecks} label="Bids" active={view === "bids"} onClick={() => setView("bids")} badge={stats.submitted || null} />
          <NavButton icon={Settings} label="Setup" active={view === "setup"} onClick={() => setView("setup")} />
        </div>
      )}
    </div>
  );
}

function NavButton({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick} className={`nav-btn press${active ? " active" : ""}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 0 12px", background: "none", border: "none", color: active ? "#E8A33D" : "#5A6270", position: "relative" }}>
      <span className="nav-icon-wrap" style={{ display: "flex" }}><Icon size={19} /></span>
      <span style={{ fontSize: 10.5, fontWeight: 500 }}>{label}</span>
      {badge ? <span style={{ position: "absolute", top: 4, right: "28%", background: "#E8A33D", color: "#12161C", fontSize: 9, fontWeight: 700, borderRadius: 10, padding: "1px 5px" }}>{badge}</span> : null}
    </button>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: "#161B22", border: "1px solid #232833", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
      <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: color || "#E8E6E1" }}>{value}</div>
      <div style={{ fontSize: 10, color: "#8B93A1", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function EmptyState({ title, subtitle }) {
  return (
    <div style={{ textAlign: "center", padding: "50px 20px", color: "#5A6270" }}>
      <TrendingUp size={28} style={{ opacity: 0.4, marginBottom: 10 }} />
      <div style={{ fontSize: 14, fontWeight: 600, color: "#8B93A1" }}>{title}</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>{subtitle}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, color: "#8B93A1", marginBottom: 6 }}>{label}</div>
      {children}
      <div style={{ fontSize: 11, color: "#5A6270", marginTop: 6, lineHeight: 1.5 }}>{hint}</div>
    </div>
  );
}

const inputStyle = { flex: 1, minWidth: 0, background: "#0F1319", border: "1px solid #2A303B", borderRadius: 6, padding: "9px 10px", color: "#E8E6E1", fontSize: 13 };
const saveBtnStyle = { background: "#E8A33D", color: "#12161C", border: "none", borderRadius: 6, padding: "9px 14px", fontSize: 13, fontWeight: 600, flexShrink: 0 };

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
      * { box-sizing: border-box; }
      body { margin: 0; }
      ::selection { background: #E8A33D44; }
      .mono { font-family: 'JetBrains Mono', monospace; }
      .display { font-family: 'Space Grotesk', sans-serif; }
      button { cursor: pointer; font-family: inherit; }
      input, textarea { font-family: inherit; }
      input, textarea, button { transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease, transform 0.1s ease; }
      input:focus, textarea:focus { outline: 1px solid #E8A33D; }
      .spin { animation: spin 1s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }

      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      @keyframes shimmer { 0% { background-position: -200px 0; } 100% { background-position: calc(200px + 100%) 0; } }
      @keyframes popIn { from { opacity: 0; transform: translate(-50%, 8px) scale(0.95); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
      @keyframes toastOut { from { opacity: 1; } to { opacity: 0; transform: translate(-50%, 4px); } }
      @keyframes expandDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 60px; } }

      .view-enter { animation: fadeIn 0.22s ease; }
      .card-item { animation: fadeInUp 0.3s ease backwards; transition: transform 0.12s ease, border-color 0.15s ease; }
      .card-item:active { transform: scale(0.985); border-color: #3A4250 !important; }
      .detail-overlay { animation: slideUp 0.28s cubic-bezier(0.22, 1, 0.36, 1); }
      .toast-pop { animation: popIn 0.25s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
      .sort-panel { animation: expandDown 0.2s ease; overflow: hidden; }
      .press { transition: transform 0.1s ease; }
      .press:active { transform: scale(0.94); }
      .skeleton { background: linear-gradient(90deg, #161B22 25%, #1E2530 37%, #161B22 63%); background-size: 400px 100%; animation: shimmer 1.4s ease infinite; border-radius: 12px; }
      .nav-btn { transition: color 0.2s ease; }
      .nav-icon-wrap { transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1); }
      .nav-btn.active .nav-icon-wrap { transform: translateY(-2px) scale(1.08); }
      .refresh-spin-enter { transition: transform 0.2s ease; }
    `}</style>
  );
}
