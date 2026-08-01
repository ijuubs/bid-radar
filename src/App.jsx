import React, { useState, useEffect, useCallback } from "react";
import { Anchor, Radar, Send, Settings, RefreshCw, ExternalLink, Check, Clock, X, Loader2, Gauge } from "lucide-react";

const TOKEN_KEY = "fl_oauth_token";
const SKILLS_KEY = "fl_skill_keywords";
const BIDS_KEY = "fl_tracked_bids";
const DEMO_KEY = "fl_demo_mode";
const PROXY_KEY = "fl_proxy_url";
const ANTHROPIC_KEY = "fl_anthropic_key";
const DEFAULT_API_BASE = "https://www.freelancer.com/api";

const DEMO_PROJECTS = [
  { id: "d1", title: "React dashboard for logistics tracking", description: "Need a full-stack developer to build a React + Node dashboard that tracks shipment status across three warehouses. Should include charts, CSV export, and role-based auth.", budget: "$750 - $1500", bids: 12, skills: ["React", "Node.js", "PostgreSQL"], time: "2h ago", currency: "USD" },
  { id: "d2", title: "SEO audit + Astro site migration", description: "Migrating a content site from WordPress to Astro. Need someone who understands SEO-safe redirects, JSON-LD structured data, and Core Web Vitals.", budget: "$400 - $800", bids: 6, skills: ["Astro", "SEO", "JavaScript"], time: "5h ago", currency: "USD" },
  { id: "d3", title: "Vite + Tailwind calculator tool build-out", description: "Looking for 10 additional unit converter tools added to an existing Vite/Tailwind SEO site. Must match existing component patterns.", budget: "$300 - $600", bids: 4, skills: ["React", "Vite", "Tailwind CSS"], time: "1d ago", currency: "USD" },
];

const STATUS_META = {
  drafted: { label: "Drafted", color: "#8B93A1", icon: Clock },
  submitted: { label: "Submitted", color: "#E8A33D", icon: Send },
  won: { label: "Won", color: "#4FAE7E", icon: Check },
  lost: { label: "Lost", color: "#C15B5B", icon: X },
};

function scoreProject(project, keywords) {
  if (!keywords.length) return 50;
  const haystack = (project.title + " " + project.description + " " + (project.skills || []).join(" ")).toLowerCase();
  const hits = keywords.filter(k => haystack.includes(k.toLowerCase())).length;
  return Math.min(100, Math.round((hits / keywords.length) * 100));
}

export default function FreelancerCopilot() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [demoMode, setDemoMode] = useState(true);
  const [skillsInput, setSkillsInput] = useState("React, Node.js, SEO, Astro, Tailwind");
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [bidStatuses, setBidStatuses] = useState({});
  const [fetchError, setFetchError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [ready, setReady] = useState(false);
  const [proxyUrl, setProxyUrl] = useState("");
  const [proxyInput, setProxyInput] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [anthropicKeyInput, setAnthropicKeyInput] = useState("");

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) { setToken(t); setTokenInput(t); }
    const s = localStorage.getItem(SKILLS_KEY);
    if (s) setSkillsInput(s);
    const b = localStorage.getItem(BIDS_KEY);
    if (b) { try { setBidStatuses(JSON.parse(b)); } catch (e) {} }
    const d = localStorage.getItem(DEMO_KEY);
    if (d) setDemoMode(d === "true");
    const p = localStorage.getItem(PROXY_KEY);
    if (p) { setProxyUrl(p); setProxyInput(p); }
    const a = localStorage.getItem(ANTHROPIC_KEY);
    if (a) { setAnthropicKey(a); setAnthropicKeyInput(a); }
    setReady(true);
  }, []);

  const persistBidStatuses = (next) => {
    setBidStatuses(next);
    localStorage.setItem(BIDS_KEY, JSON.stringify(next));
  };

  const saveToken = () => {
    setToken(tokenInput);
    localStorage.setItem(TOKEN_KEY, tokenInput);
    if (tokenInput) setDemoMode(false);
    localStorage.setItem(DEMO_KEY, tokenInput ? "false" : "true");
  };

  const saveSkills = (val) => {
    setSkillsInput(val);
    localStorage.setItem(SKILLS_KEY, val);
  };

  const saveProxy = () => {
    const trimmed = proxyInput.trim().replace(/\/$/, "");
    setProxyUrl(trimmed);
    localStorage.setItem(PROXY_KEY, trimmed);
  };

  const saveAnthropicKey = () => {
    setAnthropicKey(anthropicKeyInput.trim());
    localStorage.setItem(ANTHROPIC_KEY, anthropicKeyInput.trim());
  };

  // If a proxy is configured, route calls through it: {proxy}/api/... instead of https://www.freelancer.com/api/...
  const apiBase = proxyUrl ? `${proxyUrl}/api` : DEFAULT_API_BASE;

  const keywords = skillsInput.split(",").map(s => s.trim()).filter(Boolean);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    if (demoMode || !token) {
      setTimeout(() => {
        setProjects(DEMO_PROJECTS.map(p => ({ ...p, score: scoreProject(p, keywords) })).sort((a, b) => b.score - a.score));
        setLoading(false);
      }, 500);
      return;
    }
    try {
      const query = keywords.join(" ");
      const res = await fetch(
        `${apiBase}/projects/0.1/projects/active/?query=${encodeURIComponent(query)}&full_description=true&job_details=true&limit=20`,
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
        description: (p.description || p.preview_description || "").slice(0, 600),
        budget: p.budget ? `${p.budget.minimum ?? "?"} - ${p.budget.maximum ?? "?"} ${p.currency?.code || ""}` : "Not specified",
        bids: p.bid_stats?.bid_count ?? 0,
        skills: (p.jobs || []).map(j => j.name),
        time: new Date((p.time_submitted || 0) * 1000).toLocaleString(),
        currency: p.currency?.code || "",
      }));
      setProjects(mapped.map(p => ({ ...p, score: scoreProject(p, keywords) })).sort((a, b) => b.score - a.score));
    } catch (e) {
      const usingProxy = !!proxyUrl;
      setFetchError(
        usingProxy
          ? `Request through your proxy failed: "${e.message}". Showing demo data. Check the worker is deployed and the URL is exactly right (no trailing slash issues), and that your OAuth token is valid.`
          : "Couldn't reach Freelancer.com's API directly from the browser (likely blocked by CORS on their end). Showing demo data instead — set up a proxy in Setup and try again."
      );
      setProjects(DEMO_PROJECTS.map(p => ({ ...p, score: scoreProject(p, keywords) })).sort((a, b) => b.score - a.score));
    }
    setLoading(false);
  }, [token, demoMode, skillsInput, proxyUrl]);

  useEffect(() => { if (ready) fetchProjects(); }, [ready]);

  const openProject = (p) => {
    setSelected(p);
    setDraft("");
    const mid = p.budget?.match(/\d+/g);
    setBidAmount(mid ? mid[0] : "");
  };

  const generateDraft = async () => {
    if (!selected) return;
    if (!anthropicKey) {
      setDraft("");
      setFetchError("Add an Anthropic API key in Setup to generate drafts (get one at console.anthropic.com).");
      return;
    }
    setDrafting(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          messages: [{
            role: "user",
            content: `Write a short, specific, non-generic freelance proposal (120-180 words) for this project. No AI-sounding filler like "I was excited to see your posting" or "synergize". Sound like a real developer who actually read the brief. End with a concrete next step or question.\n\nProject title: ${selected.title}\nDescription: ${selected.description}\nSkills needed: ${(selected.skills || []).join(", ")}\nMy relevant background: full-stack React/Vite/Tailwind developer, experience with SEO-driven content sites, AdSense monetization, and structured data (JSON-LD).`
          }]
        })
      });
      const data = await response.json();
      const text = data.content?.find(b => b.type === "text")?.text || `Could not generate draft: ${JSON.stringify(data).slice(0, 200)}`;
      setDraft(text);
    } catch (e) {
      setDraft("Draft generation failed: " + e.message);
    }
    setDrafting(false);
  };

  const submitBid = async () => {
    if (!selected) return;
    const next = { ...bidStatuses, [selected.id]: { status: "submitted", amount: bidAmount, at: Date.now() } };
    if (demoMode || !token) {
      persistBidStatuses(next);
      return;
    }
    try {
      const res = await fetch(`${apiBase}/projects/0.1/bids/`, {
        method: "POST",
        headers: { "freelancer-oauth-v1": token, "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: selected.id,
          bidder_id: null,
          amount: Number(bidAmount),
          period: 7,
          milestone_percentage: 100,
          description: draft,
        })
      });
      if (!res.ok) throw new Error();
      persistBidStatuses(next);
    } catch (e) {
      setFetchError("Bid submission failed — check your token/CORS proxy setup. Nothing was sent.");
    }
  };

  const markStatus = (id, status) => {
    const cur = bidStatuses[id] || {};
    persistBidStatuses({ ...bidStatuses, [id]: { ...cur, status } });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#12161C", color: "#E8E6E1", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: #E8A33D44; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .display { font-family: 'Space Grotesk', sans-serif; }
        button { cursor: pointer; font-family: inherit; }
        input, textarea { font-family: inherit; }
        .scrollpane::-webkit-scrollbar { width: 6px; }
        .scrollpane::-webkit-scrollbar-thumb { background: #2A303B; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #232833", padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#12161Cee", backdropFilter: "blur(8px)", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Anchor size={22} color="#E8A33D" />
          <div>
            <div className="display" style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>Bid Radar</div>
            <div className="mono" style={{ fontSize: 11, color: "#5A6270" }}>{demoMode ? "DEMO MODE" : "LIVE · freelancer.com"}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={fetchProjects} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1A1F27", border: "1px solid #2A303B", color: "#E8E6E1", borderRadius: 8, padding: "8px 14px", fontSize: 13 }}>
            {loading ? <Loader2 size={14} className="spin" style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={14} />}
            Refresh
          </button>
          <button onClick={() => setShowSettings(s => !s)} style={{ display: "flex", alignItems: "center", gap: 6, background: showSettings ? "#E8A33D" : "#1A1F27", border: "1px solid #2A303B", color: showSettings ? "#12161C" : "#E8E6E1", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 500 }}>
            <Settings size={14} /> Setup
          </button>
        </div>
      </div>

      {showSettings && (
        <div style={{ borderBottom: "1px solid #232833", padding: "20px 28px", background: "#161B22", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: "#8B93A1", marginBottom: 6 }}>Freelancer.com OAuth token (personal, stored only on this device)</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={tokenInput} onChange={e => setTokenInput(e.target.value)} placeholder="Paste your API token" type="password" style={{ flex: 1, background: "#0F1319", border: "1px solid #2A303B", borderRadius: 6, padding: "8px 10px", color: "#E8E6E1", fontSize: 13 }} />
              <button onClick={saveToken} style={{ background: "#E8A33D", color: "#12161C", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>Save</button>
            </div>
            <div style={{ fontSize: 11, color: "#5A6270", marginTop: 6, lineHeight: 1.5 }}>
              Generate a token at freelancer.com → Settings → API. Without one, this stays in demo mode with sample jobs so you can try the workflow.
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#8B93A1", marginBottom: 6 }}>Skills / keywords to match against jobs</div>
            <input value={skillsInput} onChange={e => saveSkills(e.target.value)} style={{ width: "100%", background: "#0F1319", border: "1px solid #2A303B", borderRadius: 6, padding: "8px 10px", color: "#E8E6E1", fontSize: 13 }} />
            <div style={{ fontSize: 11, color: "#5A6270", marginTop: 6 }}>Comma-separated. Drives the match score on each job.</div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 12, color: "#8B93A1", marginBottom: 6 }}>Proxy URL (only needed if direct calls get CORS-blocked)</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={proxyInput} onChange={e => setProxyInput(e.target.value)} placeholder="https://your-worker.workers.dev" style={{ flex: 1, background: "#0F1319", border: "1px solid #2A303B", borderRadius: 6, padding: "8px 10px", color: "#E8E6E1", fontSize: 13 }} />
              <button onClick={saveProxy} style={{ background: "#1A1F27", border: "1px solid #2A303B", color: "#E8E6E1", borderRadius: 6, padding: "8px 14px", fontSize: 13 }}>Save</button>
            </div>
            <div style={{ fontSize: 11, color: "#5A6270", marginTop: 6 }}>Leave blank to call freelancer.com directly. Deploy the Cloudflare Worker proxy (provided separately) and paste its URL here if you hit a CORS error.</div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 12, color: "#8B93A1", marginBottom: 6 }}>Anthropic API key (for drafting proposals)</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={anthropicKeyInput} onChange={e => setAnthropicKeyInput(e.target.value)} placeholder="sk-ant-..." type="password" style={{ flex: 1, background: "#0F1319", border: "1px solid #2A303B", borderRadius: 6, padding: "8px 10px", color: "#E8E6E1", fontSize: 13 }} />
              <button onClick={saveAnthropicKey} style={{ background: "#1A1F27", border: "1px solid #2A303B", color: "#E8E6E1", borderRadius: 6, padding: "8px 14px", fontSize: 13 }}>Save</button>
            </div>
            <div style={{ fontSize: 11, color: "#5A6270", marginTop: 6 }}>Get one at console.anthropic.com → API Keys. Stored only in this browser's local storage, never sent anywhere but Anthropic's API.</div>
          </div>
        </div>
      )}

      {fetchError && (
        <div style={{ margin: "16px 28px 0", padding: "12px 16px", background: "#2A1F1A", border: "1px solid #4A3324", borderRadius: 8, fontSize: 13, color: "#E0B98F" }}>
          {fetchError}
        </div>
      )}

      {/* Main */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "420px 1fr" : "1fr", gap: 0, minHeight: "calc(100vh - 73px)" }}>
        {/* Job list */}
        <div className="scrollpane" style={{ borderRight: selected ? "1px solid #232833" : "none", padding: "20px 20px 40px", overflowY: "auto", maxHeight: "calc(100vh - 73px)" }}>
          <div style={{ fontSize: 12, color: "#5A6270", marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
            <span>{projects.length} matching projects</span>
            <span className="mono">sorted by fit</span>
          </div>
          {projects.map(p => {
            const status = bidStatuses[p.id]?.status;
            const meta = status ? STATUS_META[status] : null;
            return (
              <div key={p.id} onClick={() => openProject(p)}
                style={{ padding: "14px 16px", marginBottom: 10, borderRadius: 10, border: `1px solid ${selected?.id === p.id ? "#E8A33D" : "#232833"}`, background: selected?.id === p.id ? "#1D1912" : "#161B22", transition: "all 0.15s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{p.title}</div>
                  <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: p.score >= 70 ? "#4FAE7E" : p.score >= 40 ? "#E8A33D" : "#5A6270", flexShrink: 0 }}>{p.score}%</div>
                </div>
                <div style={{ fontSize: 12, color: "#8B93A1", marginTop: 6, display: "flex", gap: 12 }}>
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

        {/* Detail panel */}
        {selected && (
          <div className="scrollpane" style={{ padding: "24px 32px 60px", overflowY: "auto", maxHeight: "calc(100vh - 73px)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h2 className="display" style={{ fontSize: 22, fontWeight: 600, margin: 0, maxWidth: 500 }}>{selected.title}</h2>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "#5A6270" }}><X size={18} /></button>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 13, color: "#8B93A1" }}>
              <span className="mono">{selected.budget}</span>
              <span>{selected.bids} bids so far</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
              {(selected.skills || []).map(s => (
                <span key={s} style={{ fontSize: 11, background: "#1A1F27", border: "1px solid #2A303B", borderRadius: 20, padding: "3px 10px", color: "#8B93A1" }}>{s}</span>
              ))}
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "#C7CBD1", marginTop: 18, whiteSpace: "pre-wrap" }}>{selected.description}</p>

            <div style={{ marginTop: 28, borderTop: "1px solid #232833", paddingTop: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div className="display" style={{ fontSize: 15, fontWeight: 600 }}>Proposal draft</div>
                <button onClick={generateDraft} disabled={drafting} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1A1F27", border: "1px solid #2A303B", color: "#E8E6E1", borderRadius: 8, padding: "7px 12px", fontSize: 12 }}>
                  {drafting ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Radar size={13} />}
                  {draft ? "Regenerate" : "Generate draft"}
                </button>
              </div>
              <textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Generate a draft, then edit it in your own voice before sending — nothing here submits automatically."
                style={{ width: "100%", minHeight: 160, background: "#0F1319", border: "1px solid #2A303B", borderRadius: 8, padding: 14, color: "#E8E6E1", fontSize: 13, lineHeight: 1.6, resize: "vertical" }} />

              <div style={{ display: "flex", gap: 12, marginTop: 14, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#8B93A1" }}>Bid amount</span>
                  <input value={bidAmount} onChange={e => setBidAmount(e.target.value)} className="mono" style={{ width: 90, background: "#0F1319", border: "1px solid #2A303B", borderRadius: 6, padding: "6px 10px", color: "#E8E6E1", fontSize: 13 }} />
                </div>
                <button onClick={submitBid} disabled={!draft} style={{ display: "flex", alignItems: "center", gap: 7, background: draft ? "#E8A33D" : "#2A303B", color: draft ? "#12161C" : "#5A6270", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, marginLeft: "auto" }}>
                  <Send size={14} /> Submit bid
                </button>
              </div>

              {bidStatuses[selected.id] && (
                <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#8B93A1", alignSelf: "center" }}>Update status:</span>
                  {["submitted", "won", "lost"].map(s => (
                    <button key={s} onClick={() => markStatus(selected.id, s)} style={{ fontSize: 11, background: bidStatuses[selected.id].status === s ? STATUS_META[s].color + "33" : "#1A1F27", color: bidStatuses[selected.id].status === s ? STATUS_META[s].color : "#8B93A1", border: `1px solid ${bidStatuses[selected.id].status === s ? STATUS_META[s].color : "#2A303B"}`, borderRadius: 20, padding: "4px 10px" }}>
                      {STATUS_META[s].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
