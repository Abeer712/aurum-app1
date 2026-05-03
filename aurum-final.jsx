
/*
-- ═══════════════════════════════════════════════════════════════
-- AURUM PRO — SUPABASE SQL SCHEMA
-- Run this entire block in your Supabase SQL Editor before use
-- ═══════════════════════════════════════════════════════════════
-- create table if not exists trades (
--   id           bigint primary key,
--   user_id      uuid references auth.users on delete cascade,
--   date         text, pair text, direction text,
--   entry float, exit float, lots float, sl float, tp float,
--   pips int, pnl int, rr text, session text, strategy text,
--   emotions text, notes text, tags text[], screenshots jsonb,
--   created_at timestamptz default now()
-- );
-- create table if not exists strategies (
--   id bigserial primary key,
--   user_id uuid references auth.users on delete cascade,
--   name text
-- );
-- create table if not exists user_settings (
--   user_id uuid primary key references auth.users on delete cascade,
--   start_bal float default 10000,
--   updated_at timestamptz default now()
-- );
-- alter table trades        enable row level security;
-- alter table strategies    enable row level security;
-- alter table user_settings enable row level security;
-- create policy "own trades"   on trades        for all using (auth.uid() = user_id);
-- create policy "own strats"   on strategies    for all using (auth.uid() = user_id);
-- create policy "own settings" on user_settings for all using (auth.uid() = user_id);
*/

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
  'https://blksierhtsgqpnjoktip.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsa3NpZXJodHNncXBuam9rdGlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MTQyOTYsImV4cCI6MjA5MzI5MDI5Nn0.Mset7J2UmkTjB5_thwLK874S8RHBEIUXygGPGQk5U8E'
);

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie
} from "recharts";

/* ─── CONSTANTS ─────────────────────────────────────────────── */
const PAIRS     = ["EUR/USD","GBP/USD","USD/JPY","XAU/USD","USD/CAD","AUD/USD","NZD/USD","EUR/GBP","GBP/JPY","BTC/USD","ETH/USD","USD/CHF"];
const SESSIONS  = ["London","New York","Tokyo","Sydney","Overlap"];
const EMOTIONS  = ["Confident","Calm","Disciplined","Focused","Impatient","Frustrated","Anxious","Greedy","Fearful","Revenge"];
const DEF_STRATS= ["Breakout","Trend Follow","Scalp","Reversal","Support/Resistance","ICT","SMC","Price Action","EMA Cross","Fibonacci"];
/* EQ is now derived dynamically from trades — see equityCurve useMemo below */

/* ─── HELPERS ────────────────────────────────────────────────── */
const pC  = v => v >= 0 ? "#22d46a" : "#f5607a";
const fP  = v => `${v >= 0 ? "+" : ""}$${Math.abs(v).toLocaleString()}`;
const fPi = v => `${v >= 0 ? "+" : ""}${v}`;

/* ─── CSV EXPORT ─────────────────────────────────────────────── */
const exportCSV = (trades) => {
  const headers = ["Date","Pair","Type","Entry","SL","TP","Lots","Result","P&L","Pips","R:R","Session","Strategy","Emotion","Notes"];
  const escape  = v => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = trades.map(t => [
    t.date, t.pair, t.direction,
    t.entry, t.sl ?? "", t.tp ?? "", t.lots,
    t.pnl > 0 ? "WIN" : t.pnl < 0 ? "LOSS" : "BE",
    t.pnl, t.pips, t.rr,
    t.session, t.strategy, t.emotions,
    t.notes || ""
  ].map(escape).join(","));
  const csv  = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url; a.download = "aurum-trades.csv"; a.click();
  URL.revokeObjectURL(url);
};

/* ─── CSS ────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800&family=DM+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  /* Background layers */
  --bg:   #060809;
  --s1:   #0b0f12;
  --s2:   #10151a;
  --s3:   #161d24;
  --s4:   #1d2730;

  /* Borders */
  --b1: rgba(255,255,255,0.045);
  --b2: rgba(255,255,255,0.08);
  --b3: rgba(255,255,255,0.14);

  /* Brand gold */
  --gold:  #b8963e;
  --gold2: #d4af5a;
  --gold3: #ecc96e;
  --goldg: linear-gradient(135deg, #b8963e 0%, #ecc96e 100%);
  --goldb: linear-gradient(135deg, rgba(184,150,62,0.15) 0%, rgba(236,201,110,0.04) 100%);

  /* Semantic colours */
  --green:  #15a854;
  --green2: #22d46a;
  --red:    #c93347;
  --red2:   #f5607a;
  --blue:   #2060e8;
  --blue2:  #4d8fff;
  --cyan:   #00bba3;
  --cyan2:  #00d4bc;

  /* Text */
  --text: #d4cfc4;
  --t2:   rgba(212,207,196,0.82);
  --t3:   rgba(212,207,196,0.62);
  --t4:   rgba(212,207,196,0.50);

  /* Typography */
  --font-ui:   'DM Sans', -apple-system, sans-serif;
  --font-num:  'DM Mono', 'Fira Mono', monospace;
  --font-head: 'Playfair Display', Georgia, serif;

  /* Type scale — consistent sizing throughout */
  --text-xs:   0.68rem;   /* labels, badges, meta */
  --text-sm:   0.76rem;   /* secondary body, table cells */
  --text-base: 0.88rem;   /* primary body */
  --text-lg:   1.0rem;    /* card titles */
  --text-xl:   1.15rem;   /* stat sub-values */
  --text-2xl:  1.45rem;   /* stat primary values */

  /* Radii */
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 16px;
  --r-xl: 20px;
}

html, body {
  height: 100%;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.app-bg {
  position: absolute;
  inset: 0;
  pointer-events: none !important;
  z-index: 0;
  background:
    radial-gradient(ellipse 60% 40% at 10% 0%, rgba(184,150,62,0.06) 0%, transparent 70%),
    radial-gradient(ellipse 50% 35% at 90% 100%, rgba(32,96,232,0.05) 0%, transparent 70%),
    radial-gradient(ellipse 40% 30% at 80% 10%, rgba(0,187,163,0.035) 0%, transparent 60%);
}

::selection { background: rgba(184,150,62,0.25); color: var(--gold3); }

/* ── SCROLLBAR ── */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(184,150,62,0.2); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: rgba(184,150,62,0.4); }

/* ── FORM ELEMENTS ── */
input, select, textarea {
  background: var(--s2);
  border: 1px solid var(--b2);
  border-radius: var(--r-sm);
  color: var(--text);
  font-family: var(--font-ui);
  font-size: 0.82rem;
  padding: 10px 13px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  width: 100%;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--gold);
  background: var(--s3);
  box-shadow: 0 0 0 3px rgba(184,150,62,0.12), 0 0 12px rgba(184,150,62,0.08) inset;
}
input::placeholder, textarea::placeholder { color: var(--t4); }
select option { background: var(--s2); color: var(--text); }

/* ── BUTTONS ── */
.btn {
  border: none;
  border-radius: var(--r-sm);
  font-family: var(--font-ui);
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.4,0,0.2,1);
  font-size: 0.76rem;
  letter-spacing: 0.02em;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.btn-gold {
  background: var(--goldg);
  color: #05080b;
  padding: 11px 26px;
  box-shadow: 0 2px 16px rgba(184,150,62,0.22);
  position: relative;
  overflow: hidden;
}
.btn-gold::after {
  content: '';
  position: absolute;
  top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
  transform: skewX(-20deg);
  transition: left 0.5s ease;
}
.btn-gold:hover::after { left: 160%; }
.btn-gold:hover {
  opacity: 0.92;
  transform: translateY(-1px);
  box-shadow: 0 8px 28px rgba(184,150,62,0.4);
}
.btn-gold:active { transform: translateY(0); }
.btn-gold:disabled { opacity: 0.38; cursor: not-allowed; transform: none; box-shadow: none; }

.btn-ghost {
  background: transparent;
  color: var(--t2);
  border: 1px solid var(--b2);
  padding: 9px 18px;
}
.btn-ghost:hover { border-color: var(--b3); color: var(--text); background: rgba(255,255,255,0.03); }

.btn-red {
  background: rgba(201,51,71,0.1);
  color: var(--red2);
  border: 1px solid rgba(201,51,71,0.2);
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 0.66rem;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-red:hover { background: rgba(201,51,71,0.22); }

/* ── AUTH SCREEN ── */
.auth-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(ellipse 70% 50% at 50% -5%, rgba(184,150,62,0.14), transparent),
    radial-gradient(ellipse 40% 30% at 80% 80%, rgba(36,114,245,0.05), transparent),
    var(--bg);
}
.auth-card {
  width: 100%;
  max-width: 428px;
  background: var(--s1);
  border: 1px solid var(--b2);
  border-radius: var(--r-xl);
  overflow: hidden;
  box-shadow: 0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(184,150,62,0.06);
}
.auth-tab {
  flex: 1;
  padding: 13px;
  border: none;
  background: transparent;
  font-family: var(--font-ui);
  font-size: 0.79rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s;
  color: var(--t3);
  border-bottom: 2px solid transparent;
  letter-spacing: 0.01em;
}
.auth-tab.on { color: var(--gold3); border-bottom-color: var(--gold); }

.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.field label { font-size: 0.64rem; color: var(--t3); letter-spacing: 0.12em; text-transform: uppercase; font-weight: 500; }

.auth-divider {
  display: flex; align-items: center; gap: 10px;
  margin: 18px 0; color: var(--t4); font-size: 0.7rem;
}
.auth-divider::before, .auth-divider::after {
  content: ''; flex: 1; height: 1px; background: var(--b2);
}

.google-btn {
  width: 100%;
  padding: 11px;
  background: var(--s2);
  border: 1px solid var(--b2);
  border-radius: var(--r-sm);
  color: var(--text);
  font-family: var(--font-ui);
  font-size: 0.81rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: all 0.18s;
}
.google-btn:hover { border-color: var(--b3); background: var(--s3); }

.err-msg {
  background: rgba(201,51,71,0.09);
  border: 1px solid rgba(201,51,71,0.24);
  border-radius: var(--r-sm);
  padding: 10px 13px;
  font-size: 0.75rem;
  color: var(--red2);
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 7px;
}
.ok-msg {
  background: rgba(21,168,84,0.09);
  border: 1px solid rgba(21,168,84,0.22);
  border-radius: var(--r-sm);
  padding: 10px 13px;
  font-size: 0.75rem;
  color: var(--green2);
  margin-bottom: 14px;
}

/* ── APP LAYOUT ── */
.app { display: flex; height: 100vh; overflow: hidden; position: relative; z-index: 1; }

.sidebar {
  width: 228px;
  flex-shrink: 0;
  background: var(--s1);
  border-right: 1px solid var(--b1);
  display: flex;
  flex-direction: column;
  transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
  z-index: 300;
  position: relative;
}
.sidebar::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(184,150,62,0.5), transparent);
  pointer-events: none;
}

.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

.topbar {
  height: 56px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--b1);
  display: flex;
  align-items: center;
  padding: 0 22px;
  gap: 14px;
  background: rgba(6,8,9,0.88);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  position: relative;
}
.topbar::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(184,150,62,0.25) 30%, rgba(184,150,62,0.45) 50%, rgba(184,150,62,0.25) 70%, transparent 100%);
  pointer-events: none;
}

.page {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

/* ── NAV ── */
.nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: var(--r-sm);
  color: var(--t2);
  cursor: pointer;
  font-size: 0.75rem;
  border: 1px solid transparent;
  background: transparent;
  width: 100%;
  text-align: left;
  transition: all 0.15s;
  margin: 1px 0;
  font-family: var(--font-ui);
  font-weight: 500;
  letter-spacing: 0.01em;
}
.nav-link:hover { background: var(--s2); color: var(--text); }
.nav-link.on {
  background: rgba(184,150,62,0.1);
  color: var(--gold3);
  border-color: rgba(184,150,62,0.22);
  box-shadow: inset 3px 0 0 var(--gold), 0 0 12px rgba(184,150,62,0.06);
}
.nav-link .nav-ic {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  flex-shrink: 0;
  opacity: 0.75;
}
.nav-link.on .nav-ic { opacity: 1; }
.nav-sep { height: 1px; background: var(--b1); margin: 10px 0; }

/* ── CARDS ── */
.card {
  background: var(--s1);
  border: 1px solid var(--b1);
  border-radius: var(--r-md);
  transition: border-color 0.25s, box-shadow 0.25s;
}
.card:hover {
  border-color: var(--b2);
  box-shadow: 0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03);
}
.card-gold { border-color: rgba(184,150,62,0.22); box-shadow: 0 0 0 1px rgba(184,150,62,0.04) inset; }
.card-gold:hover { border-color: rgba(184,150,62,0.38); box-shadow: 0 4px 24px rgba(184,150,62,0.08), inset 0 1px 0 rgba(184,150,62,0.06); }

.ch {
  padding: 15px 18px;
  border-bottom: 1px solid var(--b1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

/* stat card with top accent */
.sc {
  position: relative;
  overflow: hidden;
  padding: 16px 18px 18px;
  border-radius: var(--r-md);
  transition: transform 0.22s cubic-bezier(0.4,0,0.2,1), box-shadow 0.22s;
  background: linear-gradient(160deg, var(--s2) 0%, var(--s1) 100%);
}
.sc:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04);
}
.sc::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: var(--accent, var(--gold));
  border-radius: var(--r-md) var(--r-md) 0 0;
}
.sc::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 40%;
  background: linear-gradient(180deg, rgba(255,255,255,0.025) 0%, transparent 100%);
  border-radius: var(--r-md) var(--r-md) 0 0;
  pointer-events: none;
}

.lbl {
  display: block;
  font-size: var(--text-xs);
  color: var(--t3);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 6px;
  font-weight: 600;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  border-radius: 20px;
  font-size: 0.62rem;
  font-weight: 600;
  flex-shrink: 0;
  letter-spacing: 0.04em;
}
.bl { background: rgba(21,168,84,0.12); color: var(--green2); border: 1px solid rgba(21,168,84,0.22); }
.bs { background: rgba(201,51,71,0.12); color: var(--red2);   border: 1px solid rgba(201,51,71,0.22); }

.tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(184,150,62,0.08);
  border: 1px solid rgba(184,150,62,0.2);
  border-radius: 20px;
  color: var(--gold2);
  font-size: 0.62rem;
  padding: 3px 9px;
  font-weight: 500;
}

.stitle {
  font-family: var(--font-ui);
  font-size: var(--text-base);
  color: var(--text);
  font-weight: 700;
  letter-spacing: -0.01em;
}
.stitle-section {
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  color: var(--gold3);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.sdesc { font-size: var(--text-xs); color: var(--t3); margin-top: 3px; line-height: 1.5; }

/* ── GRIDS ── */
.g-stats {
  display: grid;
  grid-template-columns: repeat(2,1fr);
  gap: 10px;
}
@media(min-width:600px)  { .g-stats { grid-template-columns: repeat(3,1fr); } }
@media(min-width:1100px) { .g-stats { grid-template-columns: repeat(6,1fr); } }

.g2 { display: grid; grid-template-columns: 1fr; gap: 14px; }
@media(min-width:840px) { .g2 { grid-template-columns: 1fr 1fr; } }

.g3 { display: grid; grid-template-columns: 1fr; gap: 12px; }
@media(min-width:960px) { .g3 { grid-template-columns: 1fr 1fr 1fr; } }

.g-charts { display: grid; grid-template-columns: 1fr; gap: 14px; }
@media(min-width:900px) { .g-charts { grid-template-columns: 3fr 2fr; } }

.g-form { display: grid; grid-template-columns: 1fr; gap: 12px; }
@media(min-width:520px) { .g-form { grid-template-columns: 1fr 1fr; } }
@media(min-width:860px) { .g-form { grid-template-columns: 1fr 1fr 1fr; } }

/* ── SCREENSHOT DROP ZONE ── */
.drop {
  border: 2px dashed var(--b2);
  border-radius: var(--r-md);
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
  min-height: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 20px;
  position: relative;
}
.drop:hover, .drop.drag {
  border-color: var(--gold);
  background: rgba(184,150,62,0.04);
}
.drop.has-img { padding: 0; border-style: solid; border-color: var(--b2); }
.drop-img { width: 100%; height: 220px; object-fit: cover; display: block; }
.drop-overlay {
  position: absolute; inset: 0;
  background: rgba(6,8,9,0.78);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}
.drop:hover .drop-overlay { opacity: 1; }
.drop-caption {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: rgba(6,8,9,0.9);
  backdrop-filter: blur(8px);
  padding: 8px 13px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* ── MODAL ── */
.overlay {
  position: fixed; inset: 0;
  background: rgba(6,8,9,0.88);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  z-index: 400;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: fadeIn 0.2s ease;
}
.modal {
  background: var(--s1);
  border: 1px solid var(--b2);
  border-radius: var(--r-lg);
  width: 100%;
  max-width: 640px;
  max-height: 92vh;
  overflow-y: auto;
  animation: slideUp 0.25s cubic-bezier(0.4,0,0.2,1);
}

/* ── INSIGHT ROWS ── */
.irow {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 0;
  border-bottom: 1px solid var(--b1);
}
.irow:last-child { border-bottom: none; }
.ibar {
  flex: 1;
  height: 4px;
  background: var(--s3);
  border-radius: 4px;
  overflow: hidden;
}
.ifill {
  height: 100%;
  border-radius: 4px;
  transition: width 1s cubic-bezier(0.4,0,0.2,1);
}

/* ── TABLE ── */
.tbl { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
.tbl th {
  padding: 13px 15px;
  text-align: left;
  color: var(--t3);
  font-size: var(--text-xs);
  letter-spacing: 0.11em;
  text-transform: uppercase;
  white-space: nowrap;
  border-bottom: 1px solid var(--b2);
  font-weight: 600;
}
.tbl td {
  padding: 13px 15px;
  border-bottom: 1px solid var(--b1);
  white-space: nowrap;
  vertical-align: middle;
  font-size: var(--text-sm);
}
.tbl tbody tr { cursor: pointer; transition: background 0.12s; }
.tbl tbody tr:hover td { background: rgba(184,150,62,0.06); }
.tbl tbody tr:hover td:first-child { box-shadow: inset 3px 0 0 rgba(184,150,62,0.6); }
.tbl tbody tr:last-child td { border-bottom: none; }

/* ── SWITCH ── */
.sw {
  display: flex;
  background: var(--s2);
  border: 1px solid var(--b1);
  border-radius: var(--r-sm);
  padding: 3px;
  gap: 2px;
}
.swb {
  flex: 1;
  padding: 5px 11px;
  border: none;
  border-radius: 6px;
  font-family: var(--font-ui);
  font-size: 0.64rem;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.15s;
  background: transparent;
  color: var(--t2);
  text-transform: uppercase;
  font-weight: 600;
}
.swb.on { background: var(--s3); color: var(--text); }

/* ── EMOTION PILLS ── */
.em-pill {
  background: transparent;
  border: 1px solid var(--b2);
  border-radius: 20px;
  color: var(--t2);
  font-size: 0.69rem;
  padding: 6px 13px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: var(--font-ui);
  font-weight: 500;
}
.em-pill:hover { border-color: var(--b3); color: var(--text); }
.em-pill.on {
  background: rgba(184,150,62,0.12);
  border-color: rgba(184,150,62,0.45);
  color: var(--gold3);
}

/* ── TOOLTIP ── */
.tip {
  background: var(--s3);
  border: 1px solid var(--b3);
  border-radius: var(--r-sm);
  padding: 10px 14px;
  font-size: 0.71rem;
  font-family: var(--font-ui);
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}

/* ── MOBILE ── */
@media(max-width:700px){
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    transform: translateX(-100%);
    z-index: 300;
  }
  .sidebar.open {
    transform: translateX(0);
    box-shadow: 8px 0 48px rgba(0,0,0,0.7);
  }
  .page { padding: 16px; }
  .hide-sm { display: none !important; }
}
.mob-card {
  background: var(--s2);
  border: 1px solid var(--b1);
  border-radius: var(--r-md);
  padding: 14px 15px;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;
}
.mob-card:hover { border-color: var(--b3); transform: translateY(-1px); }
.show-sm { display: none; }
@media(max-width:700px){ .show-sm { display: block; } }

/* ── RESPONSIVE TABLE COLUMNS ── */
.hide-md { display: none; }
@media(min-width:1051px) { .hide-md { display: table-cell; } }

/* ── ANIMATIONS ── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
@keyframes shimmer {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}

.fu  { animation: fadeUp  0.38s cubic-bezier(0.4,0,0.2,1) both; }
.fi  { animation: fadeIn  0.3s  ease both; }
.pulse { animation: pulse 2s ease-in-out infinite; }
.spin  { animation: spin  0.85s linear infinite; display: inline-block; }

/* ── LOADING SCREEN ── */
.loading-screen {
  position: fixed; inset: 0;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  z-index: 999;
}

/* ── CONFIRM DIALOG ── */
.confirm-dialog {
  background: var(--s2);
  border: 1px solid rgba(201,51,71,0.3);
  border-radius: var(--r-lg);
  padding: 24px 28px;
  max-width: 360px;
  width: 100%;
  animation: slideUp 0.2s cubic-bezier(0.4,0,0.2,1);
  box-shadow: 0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,51,71,0.1);
}

/* ── AI RESPONSE FORMATTING ── */
.ai-response { font-size: 0.8rem; line-height: 1.9; color: var(--t2); white-space: pre-wrap; }
.ai-response h2 { font-family: var(--font-ui); font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gold3); font-weight: 700; margin: 14px 0 8px; }
.ai-response ul { padding-left: 16px; }
.ai-response li { margin-bottom: 4px; }

/* ── METRIC CARD HOVER ── */
.metric-card {
  background: var(--s2);
  border: 1px solid var(--b1);
  border-radius: var(--r-md);
  padding: 14px 16px;
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s, transform 0.2s;
}
.metric-card:hover { border-color: rgba(184,150,62,0.2); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.25); }

/* ── INSIGHT CARD ── */
.insight-card {
  display: flex;
  gap: 14px;
  background: var(--s2);
  border: 1px solid var(--b1);
  border-radius: var(--r-md);
  padding: 15px 16px;
  transition: border-color 0.2s;
}
.insight-card:hover { border-color: var(--b3); }
.insight-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(184,150,62,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
}

/* ── RECENT TRADE ROW ── */
.trade-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 15px;
  background: var(--s2);
  border: 1px solid var(--b1);
  border-radius: var(--r-md);
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;
  gap: 8px;
  flex-wrap: wrap;
}
.trade-row:hover { border-color: rgba(184,150,62,0.25); transform: translateX(2px); background: rgba(184,150,62,0.03); }

/* ── TOAST ── */
@keyframes toastIn {
  from { opacity: 0; transform: translateX(24px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes toastOut {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(24px); }
}
.toast {
  position: fixed;
  bottom: 28px;
  right: 24px;
  z-index: 9999;
  background: var(--s3);
  border: 1px solid var(--b3);
  border-left: 3px solid var(--gold);
  border-radius: var(--r-md);
  padding: 13px 18px;
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  color: var(--text);
  box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(184,150,62,0.08), 0 0 20px rgba(184,150,62,0.06);
  min-width: 220px;
  max-width: min(320px, calc(100vw - 48px));
  pointer-events: auto;
  animation: toastIn 0.25s cubic-bezier(0.4,0,0.2,1) both;
  backdrop-filter: blur(12px);
}
.toast.out {
  animation: toastOut 0.3s cubic-bezier(0.4,0,0.2,1) both;
}
/* Toast type variants */
.toast-success { border-left-color: var(--green2); box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 16px rgba(34,212,106,0.08); }
.toast-error   { border-left-color: var(--red2);   box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 16px rgba(245,96,122,0.08); }
.toast-warning { border-left-color: #f59e0b;       box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 16px rgba(245,158,11,0.08); }
.toast-info    { border-left-color: var(--blue2);  box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 16px rgba(77,143,255,0.08); }
`;

/* ─── NUM STYLE (monospace numerals) ─────────────────────────── */
const N = (size = "1rem", weight = 700, color = "var(--text)", extra = {}) => ({
  fontFamily: "var(--font-num)",
  fontSize: size,
  fontWeight: weight,
  color,
  fontFeatureSettings: "'tnum'",
  letterSpacing: "-0.02em",
  lineHeight: 1,
  ...extra,
});

/* ─── TOOLTIP ────────────────────────────────────────────────── */
const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="tip">
      <div style={{ color: "var(--t3)", marginBottom: 5, fontSize: "0.64rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || "var(--gold3)", fontWeight: 600, fontSize: "0.78rem" }}>
          {p.name}:{" "}
          {typeof p.value === "number"
            ? p.name === "Equity" ? "$" + p.value.toLocaleString()
            : p.name === "Drawdown" ? p.value + "%"
            : (p.value >= 0 ? "+" : "") + p.value
            : p.value}
        </div>
      ))}
    </div>
  );
};

/* ─── DROP ZONE ──────────────────────────────────────────────── */
let _dz = 0;
function DropZone({ label, icon, value, onChange }) {
  const [drag, setDrag] = useState(false);
  const uid = useRef(`dz_${++_dz}`).current;
  const load = f => {
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => onChange(ev.target.result);
    r.readAsDataURL(f);
  };
  return (
    <div>
      <div className="lbl" style={{ marginBottom: 8 }}>{icon} {label}</div>
      <input id={uid} type="file" accept="image/*"
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none", overflow: "hidden" }}
        onChange={e => { load(e.target.files[0]); e.target.value = ""; }}
      />
      <label htmlFor={uid}
        className={`drop${drag ? " drag" : ""}${value ? " has-img" : ""}`}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={e => { e.preventDefault(); setDrag(false); }}
        onDrop={e => { e.preventDefault(); setDrag(false); load(e.dataTransfer.files[0]); }}
      >
        {value ? (
          <>
            <img src={value} alt={label} className="drop-img" />
            <div className="drop-overlay">
              <span style={{ fontSize: "1.8rem" }}>↺</span>
              <span style={{ fontSize: "0.7rem", color: "var(--t2)", marginTop: 6 }}>Click to replace</span>
            </div>
            <div className="drop-caption">
              <span style={{ fontSize: "0.63rem", color: "var(--t2)" }}>{label}</span>
              <span style={{ background: "rgba(201,51,71,0.15)", color: "var(--red2)", border: "1px solid rgba(201,51,71,0.25)", borderRadius: 6, fontSize: "0.6rem", padding: "3px 10px", cursor: "pointer" }}
                onClick={e => { e.preventDefault(); e.stopPropagation(); onChange(""); }}>
                Remove
              </span>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: "2.6rem", marginBottom: 12, opacity: 0.3, lineHeight: 1 }}>{icon}</div>
            <div style={{ fontSize: "0.79rem", color: "var(--t2)", marginBottom: 5, fontWeight: 500 }}>Click to upload screenshot</div>
            <div style={{ fontSize: "0.63rem", color: "var(--t4)" }}>or drag & drop · PNG, JPG, WebP</div>
          </>
        )}
      </label>
    </div>
  );
}

/* ─── STRATEGY MANAGER ───────────────────────────────────────── */
function StratMgr({ strats, setStrats, onClose, showToast }) {
  const [val, setVal] = useState("");
  const [edit, setEdit] = useState(null);
  const [eVal, setEVal] = useState("");
  const add = () => {
    const v = val.trim();
    if (v && !strats.includes(v)) { setStrats(p => [...p, v]); setVal(""); showToast("Strategy added"); }
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 490 }} onClick={e => e.stopPropagation()}>
        <div className="ch">
          <div>
            <div className="stitle">Strategy Manager</div>
            <div className="sdesc">Add, rename, or remove your strategies</div>
          </div>
          <button className="btn btn-ghost" style={{ padding: "5px 12px" }} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={val} onChange={e => setVal(e.target.value)}
              placeholder="New strategy name…"
              onKeyDown={e => e.key === "Enter" && add()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-gold" onClick={add}>+ Add</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 340, overflowY: "auto" }}>
            {strats.map((s, i) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: "var(--r-sm)", padding: "10px 13px" }}>
                <span style={{ fontSize: "0.64rem", color: "var(--t4)", width: 22, flexShrink: 0, fontFamily: "var(--font-num)" }}>{i + 1}.</span>
                {edit === s
                  ? <>
                    <input value={eVal} onChange={e => setEVal(e.target.value)} style={{ flex: 1, padding: "5px 9px" }} autoFocus
                      onKeyDown={e => e.key === "Enter" && (setStrats(p => p.map(x => x === s ? eVal.trim() : x)), setEdit(null))} />
                    <button className="btn btn-gold" style={{ padding: "5px 13px", fontSize: "0.68rem" }} onClick={() => { setStrats(p => p.map(x => x === s ? eVal.trim() : x)); setEdit(null); }}>Save</button>
                    <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: "0.68rem" }} onClick={() => setEdit(null)}>✕</button>
                  </>
                  : <>
                    <span style={{ flex: 1, fontSize: "0.79rem" }}>{s}</span>
                    <button className="btn btn-ghost" style={{ padding: "4px 11px", fontSize: "0.65rem" }} onClick={() => { setEdit(s); setEVal(s); }}>Edit</button>
                    <button className="btn btn-red" onClick={() => { setStrats(p => p.filter(x => x !== s)); showToast("Strategy removed"); }}>✕</button>
                  </>
                }
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── TRADE MODAL ────────────────────────────────────────────── */
function TradeModal({ trade, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!trade) return null;
  const win = trade.pnl > 0;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          background: win ? "rgba(21,168,84,0.07)" : "rgba(201,51,71,0.07)",
          borderBottom: "1px solid var(--b1)",
          padding: "20px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span className={`badge ${trade.direction === "LONG" ? "bl" : "bs"}`}>{trade.direction}</span>
              <span style={N("1.5rem", 800, "var(--gold3)")}>{trade.pair}</span>
              <span style={{ fontSize: "0.66rem", color: "var(--t3)", fontFamily: "var(--font-ui)" }}>{trade.date}</span>
            </div>
            <div style={N("2.6rem", 700, pC(trade.pnl), { letterSpacing: "-0.04em" })}>{fP(trade.pnl)}</div>
            <div style={{ fontSize: "0.71rem", color: "var(--t3)", marginTop: 8, fontFamily: "var(--font-ui)" }}>
              {fPi(trade.pips)} pips &nbsp;·&nbsp; R:R {trade.rr} &nbsp;·&nbsp; {trade.session}
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Detail grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9 }}>
            {[["Date", trade.date], ["Session", trade.session], ["Strategy", trade.strategy],
              ["Entry", trade.entry], ["Exit", trade.exit], ["Lots", trade.lots],
              ["Pips", fPi(trade.pips)], ["R:R", trade.rr], ["Emotion", trade.emotions]
            ].map(([k, v]) => (
              <div key={k} style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: "var(--r-sm)", padding: "11px 13px" }}>
                <div className="lbl" style={{ marginBottom: 4 }}>{k}</div>
                <div style={{ fontSize: "0.83rem", fontWeight: 600, color: k === "Pips" ? pC(trade.pips) : "var(--text)", fontFamily: k === "Entry" || k === "Exit" || k === "Pips" || k === "Lots" ? "var(--font-num)" : "var(--font-ui)" }}>{v}</div>
              </div>
            ))}
          </div>

          {/* SL / TP */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: "rgba(201,51,71,0.07)", border: "1px solid rgba(201,51,71,0.18)", borderRadius: "var(--r-sm)", padding: "13px 15px" }}>
              <div className="lbl" style={{ color: "var(--red2)", marginBottom: 5 }}>Stop Loss</div>
              <div style={N("1.05rem", 700, "var(--red2)")}>{trade.sl || "—"}</div>
            </div>
            <div style={{ background: "rgba(21,168,84,0.07)", border: "1px solid rgba(21,168,84,0.18)", borderRadius: "var(--r-sm)", padding: "13px 15px" }}>
              <div className="lbl" style={{ color: "var(--green2)", marginBottom: 5 }}>Take Profit</div>
              <div style={N("1.05rem", 700, "var(--green2)")}>{trade.tp || "—"}</div>
            </div>
          </div>

          {/* Tags */}
          {trade.tags?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {trade.tags.map(t => <span key={t} className="tag-pill"># {t}</span>)}
            </div>
          )}

          {/* Notes */}
          <div style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: "var(--r-md)", padding: 16 }}>
            <div className="lbl" style={{ marginBottom: 9 }}>Trade Notes</div>
            <div style={{ fontSize: "0.79rem", color: "var(--t2)", lineHeight: 1.8, fontStyle: trade.notes ? "normal" : "italic" }}>
              {trade.notes || "No notes recorded."}
            </div>
          </div>

          {/* Screenshots */}
          <div>
            <div className="lbl" style={{ marginBottom: 11 }}>Chart Screenshots</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[{ k: "before", label: "Before Entry", icon: "📸" }, { k: "after", label: "After Exit", icon: "✅" }].map(({ k, label, icon }) => (
                <div key={k} style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                  <div style={{ padding: "9px 13px", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ color: "var(--gold2)", fontSize: "0.8rem" }}>{icon}</span>
                    <span style={{ fontSize: "0.69rem", color: "var(--t2)", fontWeight: 500 }}>{label}</span>
                  </div>
                  {trade.screenshots?.[k]
                    ? <img src={trade.screenshots[k]} alt={label} style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }} />
                    : <div style={{ height: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7 }}>
                      <span style={{ fontSize: "1.8rem", opacity: 0.2 }}>🖼️</span>
                      <span style={{ fontSize: "0.66rem", color: "var(--t4)" }}>No screenshot</span>
                    </div>
                  }
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── AUTH SCREEN ────────────────────────────────────────────── */
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async () => {
    setErr(""); setOk(""); setLoading(true);
    try {
      if (mode === "register") {
        if (!name.trim()) { setErr("Please enter your name."); setLoading(false); return; }
        if (!email.includes("@")) { setErr("Please enter a valid email address."); setLoading(false); return; }
        if (pw.length < 6) { setErr("Password must be at least 6 characters."); setLoading(false); return; }
        if (pw !== pw2) { setErr("Passwords do not match."); setLoading(false); return; }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password: pw,
          options: { data: { full_name: name.trim() } }
        });
        if (error) { setErr(error.message); setLoading(false); return; }
        if (data?.user) {
          setOk("Account created! Check your email to confirm, then sign in.");
        } else {
          setOk("Account created! Signing you in…");
        }
        setLoading(false);
      } else {
        if (!email.trim() || !pw.trim()) { setErr("Please enter your email and password."); setLoading(false); return; }
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: pw
        });
        if (error) { setErr(error.message); setLoading(false); return; }
        if (data?.session) {
          const u = {
            id: data.session.user.id,
            name: data.session.user.user_metadata?.full_name || data.session.user.email.split("@")[0],
            email: data.session.user.email
          };
          onLogin(u, data.session);
        }
        setLoading(false);
      }
    } catch (e) {
      setErr(e.message || "An error occurred. Please try again.");
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setErr(""); setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) { setErr(error.message); setGoogleLoading(false); }
  };

  return (
    <div className="auth-wrap fi">
      <div style={{ width: "100%", maxWidth: 428 }}>
        {/* Brand mark */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 13, marginBottom: 10 }}>
            <div style={{ width: 44, height: 44, background: "var(--goldg)", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", boxShadow: "0 6px 24px rgba(184,150,62,0.4)", flexShrink: 0 }}>⚡</div>
            <div style={{ fontFamily: "var(--font-head)", fontSize: "2.1rem", fontWeight: 800, color: "var(--gold3)", letterSpacing: "0.08em", lineHeight: 1 }}>AURUM</div>
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--t3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>Professional Trading Journal</div>
        </div>

        <div className="auth-card">
          {/* Tab switcher */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--b1)" }}>
            {[["login", "Sign In"], ["register", "Create Account"]].map(([m, l]) => (
              <button key={m} className={`auth-tab${mode === m ? " on" : ""}`}
                onClick={() => { setMode(m); setErr(""); setOk(""); }}>
                {l}
              </button>
            ))}
          </div>

          <div style={{ padding: "28px 32px 32px" }}>
            {err && <div className="err-msg">⚠ {err}</div>}
            {ok && <div className="ok-msg">✓ {ok}</div>}

            {mode === "register" && (
              <div className="field">
                <label>Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="John Smith"
                  onKeyDown={e => e.key === "Enter" && handleSubmit()} />
              </div>
            )}
            <div className="field">
              <label>Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={pw} onChange={e => setPw(e.target.value)}
                placeholder={mode === "register" ? "Min. 6 characters" : "Your password"}
                onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>
            {mode === "register" && (
              <div className="field">
                <label>Confirm Password</label>
                <input type="password" value={pw2} onChange={e => setPw2(e.target.value)}
                  placeholder="Re-enter password" onKeyDown={e => e.key === "Enter" && handleSubmit()} />
              </div>
            )}

            <button className="btn btn-gold" style={{ width: "100%", marginTop: 6, padding: "13px" }}
              onClick={handleSubmit} disabled={loading}>
              {loading
                ? <><span className="spin" style={{ fontSize: "0.75rem" }}>⟳</span> Please wait…</>
                : mode === "login" ? "Sign In →" : "Create Account →"}
            </button>

            <div className="auth-divider">or</div>

            <button className="google-btn" onClick={handleGoogle} disabled={googleLoading}>
              {googleLoading
                ? <><span className="spin" style={{ fontSize: "0.75rem" }}>⟳</span> Redirecting to Google…</>
                : <>
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </>
              }
            </button>

            <div style={{ textAlign: "center", marginTop: 18, fontSize: "0.71rem", color: "var(--t3)" }}>
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <span style={{ color: "var(--gold2)", cursor: "pointer", fontWeight: 600 }}
                onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); setOk(""); }}>
                {mode === "login" ? "Create one →" : "Sign in →"}
              </span>
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 22, fontSize: "0.64rem", color: "var(--t4)" }}>
          🔒 Your data is encrypted and stored privately · Each account is completely separate
        </div>
      </div>
    </div>
  );
}

/* ─── SECTION HEADER ─────────────────────────────────────────── */
function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
      <div>
        <div style={{ fontSize: "0.72rem", color: "var(--gold2)", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, marginBottom: 3 }}>{title}</div>
        {subtitle && <div style={{ fontSize: "0.67rem", color: "var(--t3)" }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

/* ─── TOAST HOOK ─────────────────────────────────────────────── */
function useToast() {
  const [toast,   setToast]   = useState(null);
  const timerRef              = useRef(null);
  const undoFnRef             = useRef(null);

  const dismiss = useCallback(() => {
    setToast(prev => prev ? { ...prev, out: true } : null);
    setTimeout(() => setToast(null), 320);
    undoFnRef.current = null;
  }, []);

  const showToast = useCallback((msg, opts) => {
    const duration = (typeof opts === "number") ? opts : (opts?.duration ?? 2500);
    const onUndo   = (typeof opts === "object" && opts?.onUndo) ? opts.onUndo : null;
    const type     = (typeof opts === "object" && opts?.type) ? opts.type : "default"; // default | success | error | warning | info
    if (timerRef.current) clearTimeout(timerRef.current);
    undoFnRef.current = onUndo;
    setToast({ msg, out: false, key: Date.now(), hasUndo: !!onUndo, type });
    timerRef.current = setTimeout(dismiss, duration);
  }, [dismiss]);

  const handleUndo = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const fn = undoFnRef.current;
    undoFnRef.current = null;
    if (fn) fn();
    setToast(null);
  }, []);

  const ToastContainer = useCallback(() => {
    if (!toast) return null;
    const typeIcon = { success: "✓", error: "✕", warning: "⚠", info: "ℹ", default: "●" };
    const typeColor = { success: "var(--green2)", error: "var(--red2)", warning: "#f59e0b", info: "var(--blue2)", default: "var(--gold3)" };
    const typeClass = toast.type !== "default" ? ` toast-${toast.type}` : "";
    const icon = typeIcon[toast.type] || typeIcon.default;
    const iconColor = typeColor[toast.type] || typeColor.default;
    return (
      <div className={`toast${toast.out ? " out" : ""}${typeClass}`}
        style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: iconColor, fontWeight: 700, flexShrink: 0, fontSize: "0.85rem" }}>{icon}</span>
          <span style={{ fontSize: "var(--text-sm)" }}>{toast.msg}</span>
        </div>
        {toast.hasUndo && (
          <span onClick={handleUndo}
            style={{ color:"var(--gold3)", fontWeight:700, cursor:"pointer",
              textDecoration:"underline", textUnderlineOffset:3, flexShrink:0, fontSize: "var(--text-xs)" }}>
            Undo
          </span>
        )}
      </div>
    );
  }, [toast, handleUndo]);

  return { showToast, ToastContainer };
}

/* ─── AI MARKDOWN RENDERER ───────────────────────────────────── */
function renderAI(text) {
  const parseBold = (line) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={i} style={{ color: "var(--text)", fontWeight: 700 }}>{p.slice(2, -2)}</strong>
        : p
    );
  };

  return text.split("\n").map((line, i) => {
    if (line.startsWith("## ")) {
      return (
        <div key={i} style={{
          fontFamily: "var(--font-ui)",
          fontSize: "0.72rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--gold3)",
          fontWeight: 700,
          margin: "14px 0 8px",
        }}>
          {parseBold(line.slice(3))}
        </div>
      );
    }
    if (line.startsWith("- ")) {
      return (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          <span style={{ color: "var(--gold)", flexShrink: 0, lineHeight: 1.9 }}>·</span>
          <span>{parseBold(line.slice(2))}</span>
        </div>
      );
    }
    if (line.trim() === "") return <div key={i} style={{ height: 6 }} />;
    return <div key={i} style={{ marginBottom: 2 }}>{parseBold(line)}</div>;
  });
}

/* ─── WINDOW WIDTH HOOK ──────────────────────────────────────── */
function useWindowWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

/* ─── MAIN APP ───────────────────────────────────────────────── */
export default function AurumPro() {
  const [authState, setAuthState] = useState("loading");
  const [user,      setUser]      = useState(null);
  const [tab,       setTab]       = useState("dashboard");
  const [sideOpen,  setSideOpen]  = useState(false);
  const [trades,    setTrades]    = useState([]);
  const [strats,    setStrats]    = useState(DEF_STRATS);
  const [showSM,    setShowSM]    = useState(false);
  const [selTrade,  setSelTrade]  = useState(null);
  const [aiText,    setAiText]    = useState("");
  const [aiLoad,    setAiLoad]    = useState(false);
  const [chartV,    setChartV]    = useState("equity");
  const [fPair,     setFPair]     = useState("All");
  const [fDir,      setFDir]      = useState("All");
  const [fSort,     setFSort]     = useState("date");
  const [fSearch,   setFSearch]   = useState("");
  const [saving,        setSaving]        = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // trade id to confirm delete
  const [inlineEditId,  setInlineEditId]  = useState(null);
  const [inlineForm,    setInlineForm]    = useState(null);
  const [inlineErr,     setInlineErr]     = useState("");
  const [startBal,      setStartBal]      = useState(10000);
  const [startBalEdit,  setStartBalEdit]  = useState(false);
  const [startBalInput, setStartBalInput] = useState("");
  const { showToast, ToastContainer } = useToast();
  const winWidth = useWindowWidth();

  /* ── SESSION LOAD + AUTH STATE CHANGE ── */
  useEffect(() => {
    // On mount: restore session from Supabase
    const init = async () => {
      try {
        const { data: { session } } = await Promise.race([
  supabase.auth.getSession(),
  new Promise(resolve => 
    setTimeout(() => resolve({ data: { session: null } }), 4000)
  )
]);
        if (session) {
          const u = {
            id: session.user.id,
            name: session.user.user_metadata?.full_name || session.user.email.split("@")[0],
            email: session.user.email
          };
          setUser(u);
          await loadUserData(u);
          setAuthState("app");
        } else {
          setAuthState("auth");
        }
      } catch (e) {
        setAuthState("auth");
      }
    };
    init();

    // Listen for OAuth redirects and session changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        const u = {
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email.split("@")[0],
          email: session.user.email
        };
        setUser(u);
        await loadUserData(u);
        setAuthState("app");
      } else if (event === "SIGNED_OUT") {
        setUser(null); setTrades([]); setStrats(DEF_STRATS);
        setStartBal(10000); setStartBalEdit(false);
        setAuthState("auth"); setTab("dashboard");
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const loadUserData = async (u) => {
    setSaving(true);
    try {
      // Load trades
      const { data: tradesData, error: tradesErr } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', u.id)
        .order('date', { ascending: false });
      if (tradesErr) throw tradesErr;
      if (tradesData) setTrades(tradesData);

      // Load strategies
      const { data: stratsData, error: stratsErr } = await supabase
        .from('strategies')
        .select('name')
        .eq('user_id', u.id);
      if (stratsErr) throw stratsErr;
      if (stratsData && stratsData.length > 0) {
        setStrats(stratsData.map(s => s.name));
      } else {
        // Seed default strategies for new user
        const inserts = DEF_STRATS.map(name => ({ name, user_id: u.id }));
        await supabase.from('strategies').insert(inserts);
        setStrats(DEF_STRATS);
      }

      // Load starting balance from user_settings
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('start_bal')
        .eq('user_id', u.id)
        .single();
      if (settingsData?.start_bal) setStartBal(settingsData.start_bal);

    } catch (e) {
      showToast(e.message || "Failed to load data", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogin = async (u, session) => {
    setUser(u);
    await loadUserData(u);
    setAuthState("app");
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    setUser(null); setTrades([]); setStrats(DEF_STRATS);
    setStartBal(10000); setStartBalEdit(false);
    setAuthState("auth"); setTab("dashboard");
  };

  // updateTrades is now a direct state setter; Supabase ops happen in addTrade/deleteTrade/saveInlineEdit
  const updateTrades = (fn) => {
    setTrades(prev => typeof fn === "function" ? fn(prev) : fn);
  };

  const updateStrats = async (fn) => {
    const prev = strats;
    const next = typeof fn === "function" ? fn(prev) : fn;
    setStrats(next);
    if (!user) return;
    // Diff: add new, remove deleted
    const added   = next.filter(n => !prev.includes(n));
    const removed = prev.filter(p => !next.includes(p));
    try {
      if (added.length) {
        await supabase.from('strategies').insert(added.map(name => ({ name, user_id: user.id })));
      }
      if (removed.length) {
        for (const name of removed) {
          await supabase.from('strategies').delete().eq('name', name).eq('user_id', user.id);
        }
      }
    } catch (e) {
      showToast(e.message || "Strategy save failed", { type: "error" });
    }
  };

  /* ── BLANK FORM ── */
  const blankForm = {
    date: new Date().toISOString().split("T")[0],
    pair: "EUR/USD", direction: "LONG",
    entry: "", exit: "", lots: "", sl: "", tp: "",
    session: "London", strategy: strats[0] || "",
    notes: "", emotions: "Calm", tags: [], newTag: "",
    screenshots: { before: "", after: "" }
  };
  const [form, setForm] = useState(blankForm);
  const [fErr, setFErr] = useState("");
  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));

  /* ── STATS ── */
  const S = useMemo(() => {
    const all = trades, wins = all.filter(t => t.pnl > 0), losses = all.filter(t => t.pnl < 0), be = all.filter(t => t.pnl === 0);
    const total = all.length;
    const totalPnl = all.reduce((s, t) => s + t.pnl, 0);
    const winRate = total ? (wins.length / total * 100).toFixed(1) : "0.0";
    const avgWin = wins.length ? Math.round(wins.reduce((s, t) => s + t.pnl, 0) / wins.length) : 0;
    const avgLoss = losses.length ? Math.round(Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length)) : 0;
    const rr = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : "—";
    const profFactor = (avgLoss > 0 && losses.length > 0) ? ((wins.length * avgWin) / (losses.length * avgLoss)).toFixed(2) : "—";
    const avgPips = total ? Math.round(all.reduce((s, t) => s + t.pips, 0) / total) : 0;
    const totalLots = all.reduce((s, t) => s + parseFloat(t.lots || 0), 0).toFixed(1);
    const expectancy = total ? Math.round((wins.length / total * avgWin) - (losses.length / total * avgLoss)) : 0;
    const best = total ? all.reduce((m, t) => t.pnl > m.pnl ? t : m, all[0]) : null;
    const worst = total ? all.reduce((m, t) => t.pnl < m.pnl ? t : m, all[0]) : null;
    let streak = 0, maxStreak = 0, lStreak = 0, maxLStreak = 0;
    [...all].sort((a, b) => a.date.localeCompare(b.date)).forEach(t => {
      if (t.pnl > 0) { streak++; maxStreak = Math.max(maxStreak, streak); lStreak = 0; }
      else { lStreak++; maxLStreak = Math.max(maxLStreak, lStreak); streak = 0; }
    });
    const bySession = SESSIONS.map(s => {
      const st = all.filter(t => t.session === s);
      const sp = st.reduce((a, t) => a + t.pnl, 0);
      return { session: s, pnl: sp, trades: st.length, wr: st.length ? (st.filter(t => t.pnl > 0).length / st.length * 100).toFixed(0) : "0" };
    });
    const mkBreak = key => {
      const m = {};
      all.forEach(t => {
        if (!m[t[key]]) m[t[key]] = { pnl: 0, trades: 0, wins: 0 };
        m[t[key]].pnl += t.pnl; m[t[key]].trades++;
        if (t.pnl > 0) m[t[key]].wins++;
      });
      return Object.entries(m).map(([k, v]) => ({ name: k, pnl: v.pnl, trades: v.trades, wr: (v.wins / v.trades * 100).toFixed(0) })).sort((a, b) => b.pnl - a.pnl);
    };
    const byPair = mkBreak("pair"), byStrategy = mkBreak("strategy"), byEmotion = mkBreak("emotions");
    const pieDdata = [{ name: "Wins", value: wins.length }, { name: "Losses", value: losses.length }, { name: "BE", value: be.length }];
    const radarData = [
      { subject: "Win Rate",    A: Math.min(parseFloat(winRate), 100) },
      { subject: "R:R",         A: Math.min((parseFloat(rr) || 0) * 25, 100) },
      { subject: "Profit F",    A: Math.min((parseFloat(profFactor) || 0) * 20, 100) },
      { subject: "Discipline",  A: Math.min(maxStreak * 12, 100) },
      { subject: "Consistency", A: Math.min(total * 6, 100) },
      { subject: "Expectancy",  A: Math.min(Math.max(expectancy / 4 + 50, 0), 100) },
    ];
    return { total, totalPnl, winRate, avgWin, avgLoss, rr, profFactor, avgPips, totalLots, expectancy, wins: wins.length, losses: losses.length, be: be.length, best, worst, maxStreak, maxLStreak, bySession, byPair, byStrategy, byEmotion, pieDdata, radarData };
  }, [trades]);

  /* ── AVG R:R (derived separately, SL+TP trades only) ── */
  const avgRR = useMemo(() => {
    const valid = trades.reduce((acc, t) => {
      if (t.sl == null || t.tp == null) return acc;
      const entry = parseFloat(t.entry), sl = parseFloat(t.sl), tp = parseFloat(t.tp);
      if (!isFinite(entry) || !isFinite(sl) || !isFinite(tp)) return acc;
      const risk   = t.direction === "SHORT" ? sl - entry : entry - sl;
      const reward = t.direction === "SHORT" ? entry - tp : tp - entry;
      if (risk <= 0 || reward <= 0) return acc;
      acc.push(reward / risk);
      return acc;
    }, []);
    if (!valid.length) return null;
    return (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2);
  }, [trades]);

  /* ── EQUITY CURVE (dynamic, uses user's starting balance) ── */
  const equityCurve = useMemo(() => {
    if (!trades.length) return [];
    const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
    let equity = startBal;
    let peak   = startBal;
    return sorted.map(t => {
      equity += t.pnl;
      peak    = Math.max(peak, equity);
      const dd = peak > 0 ? parseFloat(((equity - peak) / peak * 100).toFixed(1)) : 0;
      return { d: t.date, eq: equity, dd };
    });
  }, [trades, startBal]);

  /* ── ADD TRADE ── */
  const addTrade = async () => {
    if (!form.entry || !form.exit || !form.lots) { setFErr("Entry, exit and lot size are required."); return; }
    setFErr("");
    setSubmitting(true);
    try {
      const dir = form.direction === "SHORT" ? -1 : 1, mult = form.pair.includes("JPY") ? 100 : 10000;
      const pips = Math.round((parseFloat(form.exit) - parseFloat(form.entry)) * dir * mult);
      const pnl  = Math.round(parseFloat(form.lots) * pips * (form.pair.includes("JPY") ? 0.91 : 10));
      const slD  = form.sl ? Math.abs((parseFloat(form.entry) - parseFloat(form.sl)) * mult) : 0;
      const tpD  = form.tp ? Math.abs((parseFloat(form.tp) - parseFloat(form.entry)) * mult) : 0;
      const rr   = slD > 0 ? `1:${(tpD / slD).toFixed(1)}` : "N/A";
      const tradeObj = {
        id: Date.now(),
        user_id: user.id,
        date: form.date, pair: form.pair, direction: form.direction,
        entry: parseFloat(form.entry), exit: parseFloat(form.exit), lots: parseFloat(form.lots),
        sl: form.sl ? parseFloat(form.sl) : null,
        tp: form.tp ? parseFloat(form.tp) : null,
        pips, pnl, rr,
        session: form.session, strategy: form.strategy,
        notes: form.notes, emotions: form.emotions,
        tags: [...form.tags],
        screenshots: { ...form.screenshots }
      };
      const { error } = await supabase.from('trades').insert(tradeObj);
      if (error) throw error;
      setTrades(prev => [tradeObj, ...prev]);
      setForm({ ...blankForm, strategy: form.strategy });
      setTab("trades");
      showToast("Trade recorded successfully", { type: "success" });
    } catch (e) {
      showToast(e.message || "Failed to save trade", { type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  /* ── DELETE WITH CONFIRM ── */
  const deleteTrade = useCallback((id) => {
    setDeleteConfirm(id);
  }, []);

  const confirmDelete = useCallback(async (id) => {
    const trashBin = trades.find(x => x.id === id);
    if (!trashBin) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('trades').delete().eq('id', id);
      if (error) throw error;
      setTrades(prev => prev.filter(x => x.id !== id));
      setDeleteConfirm(null);
      showToast("Trade deleted", {
        duration: 5000,
        type: "warning",
        onUndo: async () => {
          try {
            await supabase.from('trades').insert(trashBin);
            setTrades(prev => {
              if (prev.some(x => x.id === trashBin.id)) return prev;
              return [...prev, trashBin].sort((a, b) => b.date.localeCompare(a.date));
            });
            showToast("Trade restored ✓", { type: "success" });
          } catch (e) {
            showToast(e.message || "Restore failed", { type: "error" });
          }
        }
      });
    } catch (e) {
      showToast(e.message || "Delete failed", { type: "error" });
    } finally {
      setSaving(false);
    }
  }, [trades, showToast]);

  /* ── OPEN INLINE EDIT ── */
  const beginEdit = (t) => {
    setInlineForm({
      date: t.date, pair: t.pair, direction: t.direction,
      entry: String(t.entry), exit: String(t.exit), lots: String(t.lots),
      sl: t.sl != null ? String(t.sl) : "",
      tp: t.tp != null ? String(t.tp) : "",
      session: t.session, strategy: t.strategy,
      notes: t.notes || "", emotions: t.emotions,
      tags: [...(t.tags || [])], newTag: "",
      screenshots: { before: t.screenshots?.before || "", after: t.screenshots?.after || "" }
    });
    setInlineEditId(t.id);
    setInlineErr("");
  };

  const sif = (k, v) => setInlineForm(p => ({ ...p, [k]: v }));

  /* ── SAVE INLINE EDIT ── */
  const saveInlineEdit = async () => {
    if (!inlineForm.entry || !inlineForm.exit || !inlineForm.lots) {
      setInlineErr("Entry, exit and lot size are required."); return;
    }
    setInlineErr("");
    setSaving(true);
    try {
      const dir  = inlineForm.direction === "SHORT" ? -1 : 1;
      const mult = inlineForm.pair.includes("JPY") ? 100 : 10000;
      const pips = Math.round((parseFloat(inlineForm.exit) - parseFloat(inlineForm.entry)) * dir * mult);
      const pnl  = Math.round(parseFloat(inlineForm.lots) * pips * (inlineForm.pair.includes("JPY") ? 0.91 : 10));
      const slD  = inlineForm.sl ? Math.abs((parseFloat(inlineForm.entry) - parseFloat(inlineForm.sl)) * mult) : 0;
      const tpD  = inlineForm.tp ? Math.abs((parseFloat(inlineForm.tp) - parseFloat(inlineForm.entry)) * mult) : 0;
      const rr   = slD > 0 ? `1:${(tpD / slD).toFixed(1)}` : "N/A";
      const updated = {
        ...inlineForm, id: inlineEditId, pips, pnl, rr,
        entry: parseFloat(inlineForm.entry), exit: parseFloat(inlineForm.exit),
        lots: parseFloat(inlineForm.lots),
        sl: inlineForm.sl ? parseFloat(inlineForm.sl) : null,
        tp: inlineForm.tp ? parseFloat(inlineForm.tp) : null,
        tags: [...inlineForm.tags],
        screenshots: { ...inlineForm.screenshots }
      };
      const { newTag, ...dbFields } = updated;
      const { error } = await supabase.from('trades').update(dbFields).eq('id', inlineEditId);
      if (error) throw error;
      setTrades(prev => prev.map(x => x.id === inlineEditId ? updated : x));
      setInlineEditId(null);
      setInlineForm(null);
      showToast("Trade updated ✓", { type: "success" });
    } catch (e) {
      showToast(e.message || "Update failed", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  /* ── AI ANALYSIS ── */
  const getAI = async () => {
    setAiLoad(true); setAiText("");
    const sum = `Trades:${S.total}, WinRate:${S.winRate}%, PnL:$${S.totalPnl}, AvgWin:$${S.avgWin}, AvgLoss:$${S.avgLoss}, R:R:${S.rr}, ProfitFactor:${S.profFactor}, Expectancy:$${S.expectancy}, Pips:${S.avgPips}, WinStreak:${S.maxStreak}, LoseStreak:${S.maxLStreak}. Strategy:${S.byStrategy.map(x => `${x.name}:$${x.pnl}(${x.wr}%)`).join(",")}. Session:${S.bySession.map(x => `${x.session}:$${x.pnl}`).join(",")}. Emotion:${S.byEmotion.map(x => `${x.name}:$${x.pnl}`).join(",")}.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: `You are an elite prop-firm performance analyst. Format response as:\n## Performance Summary\n[2 sentences]\n\n## ✅ Key Strengths\n- [data-backed strength]\n- [data-backed strength]\n- [data-backed strength]\n\n## ⚠️ Weaknesses\n- [specific fix]\n- [specific fix]\n\n## 🎯 Action Plan\n[one clear rule to implement tomorrow]\n\nBe direct, data-driven, and specific.`,
          messages: [{ role: "user", content: `Analyze: ${sum}` }]
        })
      });
      const d = await res.json();
      setAiText(d.content?.[0]?.text || "Unable to generate analysis.");
    } catch {
      setAiText("Connection error. Please try again.");
    }
    setAiLoad(false);
  };

  const filtered = useMemo(() => {
    const q = fSearch.toLowerCase().trim();
    return trades
      .filter(t =>
        (fPair === "All" || t.pair === fPair) &&
        (fDir  === "All" || t.direction === fDir) &&
        (!q || [t.pair, t.strategy, t.session, t.emotions, t.notes || "", ...(t.tags || [])]
          .join(" ").toLowerCase().includes(q))
      )
      .sort((a, b) =>
        fSort === "date" ? b.date.localeCompare(a.date) :
        fSort === "pnl"  ? b.pnl - a.pnl : b.pips - a.pips
      );
  }, [trades, fPair, fDir, fSort, fSearch]);

  const nav = [
    { id: "dashboard", ic: "📊", lb: "Dashboard" },
    { id: "trades",    ic: "📋", lb: "Trade Log" },
    { id: "log",       ic: "✏️", lb: "New Trade" },
    { id: "insights",  ic: "🔍", lb: "Insights" },
    { id: "psychology",ic: "🧠", lb: "Psychology" },
  ];
  const go = t => { setTab(t); setSideOpen(false); };

  /* ── KEYBOARD SHORTCUTS ── */
  useEffect(() => {
    const handler = (e) => {
      // Don't fire if user is typing in an input/textarea
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "n" || e.key === "N") go("log");
      if (e.key === "Escape") {
        setInlineEditId(null);
        setInlineForm(null);
        setSelTrade(null);
        setSideOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ── LOADING SCREEN ── */
  if (authState === "loading") return (
    <>
      <style>{CSS}</style>
      <div className="loading-screen">
        <div style={{ width: 48, height: 48, background: "var(--goldg)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", boxShadow: "0 6px 24px rgba(184,150,62,0.4)" }}>⚡</div>
        <div style={{ fontFamily: "var(--font-head)", fontSize: "1.6rem", fontWeight: 800, color: "var(--gold3)", letterSpacing: "0.1em" }}>AURUM</div>
        <div style={{ width: 26, height: 26, border: "2px solid var(--b2)", borderTopColor: "var(--gold)", borderRadius: "50%" }} className="spin" />
      </div>
    </>
  );

  if (authState === "auth") return (
    <>
      <style>{CSS}</style>
      <AuthScreen onLogin={handleLogin} />
    </>
  );

  /* ── MAIN APP RENDER ── */
  return (
    <>
      <style>{CSS}</style>
      <ToastContainer />

      {showSM && <StratMgr strats={strats} setStrats={updateStrats} onClose={() => setShowSM(false)} showToast={showToast} />}
      {selTrade && <TradeModal trade={selTrade} onClose={() => setSelTrade(null)} />}
      {sideOpen && <div style={{ position: "fixed", inset: 0, zIndex: 200, left: 228 }} onClick={() => setSideOpen(false)} />}

      {/* ── DELETE CONFIRM DIALOG ── */}
      {deleteConfirm && (
        <div className="overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "2rem", marginBottom: 14, textAlign: "center" }}>🗑️</div>
            <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text)", textAlign: "center", marginBottom: 8 }}>Delete this trade?</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--t3)", textAlign: "center", marginBottom: 22, lineHeight: 1.6 }}>
              This will remove the trade from your journal. You can undo within 5 seconds after deletion.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1, padding: "10px" }} onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button
                className="btn"
                style={{ flex: 1, padding: "10px", background: "rgba(201,51,71,0.15)", color: "var(--red2)", border: "1px solid rgba(201,51,71,0.3)", borderRadius: "var(--r-sm)", fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: "var(--text-sm)", cursor: "pointer" }}
                onClick={() => confirmDelete(deleteConfirm)}
              >
                Delete Trade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INLINE TRADE EDIT MODAL ── */}
      {inlineEditId && inlineForm && (
        <div className="overlay" onClick={() => { setInlineEditId(null); setInlineForm(null); setInlineErr(""); }}>
          <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="ch" style={{ background: "rgba(184,150,62,0.05)", borderBottom: "1px solid var(--b2)" }}>
              <div>
                <div className="stitle">Edit Trade</div>
                <div className="sdesc">Update the values — P&L and pips will recalculate automatically</div>
              </div>
              <button className="btn btn-ghost" style={{ padding: "5px 12px" }} onClick={() => { setInlineEditId(null); setInlineForm(null); setInlineErr(""); }}>✕</button>
            </div>

            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
              {/* Core fields grid */}
              <div className="g-form">
                {[
                  { l: "Date",        k: "date",      t: "date" },
                  { l: "Pair",        k: "pair",      t: "sel",    o: PAIRS },
                  { l: "Direction",   k: "direction", t: "sel",    o: ["LONG","SHORT"] },
                  { l: "Entry Price", k: "entry",     t: "number", p: "e.g. 1.08420" },
                  { l: "Exit Price",  k: "exit",      t: "number", p: "e.g. 1.08650" },
                  { l: "Lot Size",    k: "lots",      t: "number", p: "e.g. 0.5" },
                  { l: "Stop Loss",   k: "sl",        t: "number", p: "e.g. 1.08100" },
                  { l: "Take Profit", k: "tp",        t: "number", p: "e.g. 1.09000" },
                  { l: "Session",     k: "session",   t: "sel",    o: SESSIONS },
                ].map(f => (
                  <div key={f.k}>
                    <label className="lbl">{f.l}</label>
                    {f.t === "sel"
                      ? <select value={inlineForm[f.k]} onChange={e => sif(f.k, e.target.value)}>{f.o.map(o => <option key={o}>{o}</option>)}</select>
                      : <input type={f.t} value={inlineForm[f.k]} placeholder={f.p} onChange={e => sif(f.k, e.target.value)} />
                    }
                  </div>
                ))}
                <div>
                  <label className="lbl">Strategy</label>
                  <select value={inlineForm.strategy} onChange={e => sif("strategy", e.target.value)}>
                    {strats.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Emotions */}
              <div>
                <label className="lbl">Emotional State</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 6 }}>
                  {EMOTIONS.map(e => (
                    <button key={e} className={`em-pill${inlineForm.emotions === e ? " on" : ""}`} onClick={() => sif("emotions", e)}>{e}</button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="lbl">Trade Notes</label>
                <textarea rows={3} value={inlineForm.notes}
                  placeholder="What did you see? Why did you enter?"
                  onChange={e => sif("notes", e.target.value)}
                  style={{ resize: "vertical" }} />
              </div>

              {inlineErr && (
                <div style={{ background: "rgba(201,51,71,0.09)", border: "1px solid rgba(201,51,71,0.22)", borderRadius: "var(--r-sm)", padding: "10px 13px", fontSize: "0.75rem", color: "var(--red2)", display: "flex", gap: 7 }}>
                  ⚠ {inlineErr}
                </div>
              )}

              <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", paddingTop: 4 }}>
                <button className="btn btn-ghost" onClick={() => { setInlineEditId(null); setInlineForm(null); setInlineErr(""); }}>Cancel</button>
                <button className="btn btn-gold" onClick={saveInlineEdit}>Save Changes →</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="app">
        <div className="app-bg" />
        {/* ── SIDEBAR ── */}
        <aside className={`sidebar${sideOpen ? " open" : ""}`}>
          {/* Logo */}
          <div style={{ padding: "18px 15px 14px", borderBottom: "1px solid var(--b1)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 34, height: 34, background: "var(--goldg)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.05rem", boxShadow: "0 3px 14px rgba(184,150,62,0.3)", flexShrink: 0 }}>⚡</div>
                <div>
                  <div style={{ fontFamily: "var(--font-head)", fontSize: "1.15rem", fontWeight: 800, color: "var(--gold3)", letterSpacing: "0.08em", lineHeight: 1 }}>AURUM</div>
                  <div style={{ fontSize: "0.52rem", color: "var(--t4)", letterSpacing: "0.22em", textTransform: "uppercase", marginTop: 2 }}>Pro Journal</div>
                </div>
              </div>
              <button className="btn btn-ghost show-sm" style={{ padding: "6px 10px", fontSize: "0.9rem", lineHeight: 1 }} onClick={() => setSideOpen(false)}>✕</button>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
            {nav.map(n => (
              <button key={n.id} className={`nav-link${tab === n.id ? " on" : ""}`} onClick={() => go(n.id)}>
                <span className="nav-ic">{n.ic}</span>
                <span>{n.lb}</span>
              </button>
            ))}
            <div className="nav-sep" />
            <button className="nav-link" onClick={() => setShowSM(true)}>
              <span className="nav-ic">⚙</span>
              <span>Strategies</span>
            </button>
          </nav>

          {/* User panel */}
          <div style={{ padding: "12px 12px 16px", borderTop: "1px solid var(--b1)", flexShrink: 0 }}>
            {/* Starting Balance widget */}
            <div style={{ background: "rgba(184,150,62,0.06)", border: "1px solid rgba(184,150,62,0.16)", borderRadius: "var(--r-md)", padding: "10px 13px", marginBottom: 8 }}>
              <div style={{ fontSize: "0.58rem", color: "var(--t3)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 500, marginBottom: 6 }}>Starting Balance</div>
              {startBalEdit ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="number"
                    value={startBalInput}
                    onChange={e => setStartBalInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        const v = parseFloat(startBalInput);
                        if (v > 0) {
                          setStartBal(v);
                          supabase.from('user_settings').upsert({ user_id: user?.id, start_bal: v }, { onConflict: 'user_id' }).then()
                          showToast("Starting balance updated");
                        }
                        setStartBalEdit(false);
                      }
                      if (e.key === "Escape") setStartBalEdit(false);
                    }}
                    placeholder="e.g. 5000"
                    style={{ flex: 1, padding: "5px 8px", fontSize: "0.76rem" }}
                    autoFocus
                  />
                  <button className="btn btn-gold" style={{ padding: "5px 10px", fontSize: "0.66rem" }}
                    onClick={() => {
                      const v = parseFloat(startBalInput);
                      if (v > 0) {
                        setStartBal(v);
                        supabase.from('user_settings').upsert({ user_id: user?.id, start_bal: v }, { onConflict: 'user_id' }).then()
                        showToast("Starting balance updated");
                      }
                      setStartBalEdit(false);
                    }}>✓</button>
                  <button className="btn btn-ghost" style={{ padding: "5px 8px", fontSize: "0.66rem" }} onClick={() => setStartBalEdit(false)}>✕</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font-num)", fontSize: "0.95rem", fontWeight: 700, color: "var(--gold3)" }}>
                    ${startBal.toLocaleString()}
                  </span>
                  <button className="btn btn-ghost" style={{ padding: "3px 9px", fontSize: "0.62rem" }}
                    onClick={() => { setStartBalInput(String(startBal)); setStartBalEdit(true); }}>
                    Edit
                  </button>
                </div>
              )}
            </div>

            <div style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: "var(--r-md)", padding: "14px 15px", marginBottom: 10 }}>
              {/* User info row */}
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--goldg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", fontWeight: 800, color: "#05080b", flexShrink: 0, boxShadow: "0 2px 10px rgba(184,150,62,0.35)" }}>
                  {user?.name?.[0]?.toUpperCase() || "U"}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name || "Trader"}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--t4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{user?.email}</div>
                </div>
              </div>
              {/* Sync status */}
              <div style={{ borderTop: "1px solid var(--b1)", paddingTop: 10, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                {saving
                  ? <>
                    <span className="spin" style={{ fontSize: "0.65rem", color: "var(--gold2)" }}>⟳</span>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--gold2)" }}>Saving…</span>
                  </>
                  : <>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green2)", display: "inline-block", boxShadow: "0 0 5px var(--green2)" }} />
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)" }}>All changes saved</span>
                  </>
                }
              </div>
              <button className="btn btn-ghost" style={{ width: "100%", padding: "8px", fontSize: "var(--text-xs)", justifyContent: "center", letterSpacing: "0.04em" }} onClick={handleLogout}>
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <div className="main">
          {/* Topbar */}
          <div className="topbar">
            <button className="btn btn-ghost" style={{ padding: "7px 11px", fontSize: "1.05rem", flexShrink: 0 }} onClick={() => setSideOpen(o => !o)}>☰</button>
            <div style={{ flex: 1, fontSize: "var(--text-base)", color: "var(--text)", fontWeight: 600, letterSpacing: "0.01em" }}>
              {nav.find(n => n.id === tab)?.lb || tab}
            </div>
            {/* Mobile compact summary — always visible when trades exist */}
            {S.total > 0 && (
              <div className="show-sm" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-num)", fontSize: "var(--text-sm)", fontWeight: 700, color: S.totalPnl >= 0 ? "var(--green2)" : "var(--red2)" }}>
                  {S.totalPnl >= 0 ? "+" : "−"}${Math.abs(S.totalPnl).toLocaleString()}
                </span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--t3)", background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 20, padding: "2px 8px" }}>{S.winRate}%</span>
              </div>
            )}
            {/* Desktop live stats strip */}
            {S.total > 0 && (
              <div className="hide-sm" style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--font-num)", fontSize: "0.72rem", letterSpacing: "-0.01em" }}>
                <span style={{ color: S.totalPnl >= 0 ? "var(--green2)" : "var(--red2)", fontWeight: 600 }}>
                  {S.totalPnl >= 0 ? "+" : "−"}${Math.abs(S.totalPnl).toLocaleString()}
                </span>
                <span style={{ color: "var(--t4)" }}>·</span>
                <span style={{ color: "var(--t2)" }}>{S.winRate}% WR</span>
                <span style={{ color: "var(--t4)" }}>·</span>
                <span style={{ color: "var(--t3)" }}>{S.total} trade{S.total !== 1 ? "s" : ""}</span>
              </div>
            )}
            {/* Status indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }} className="hide-sm">
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green2)", boxShadow: "0 0 6px var(--green2)" }} className="pulse" />
              <span style={{ fontSize: "0.64rem", color: "var(--t3)" }}>Live · {user?.name?.split(" ")[0]}</span>
            </div>
          </div>

          {/* Page content */}
          <div className="page">
            <div style={{ maxWidth: 1320, margin: "0 auto" }}>

              {/* ══════════════ DASHBOARD ══════════════ */}
              {tab === "dashboard" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }} className="fu">

                  {/* ── BALANCE BAR (always visible on mobile) ── */}
                  <div className="card card-gold" style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(184,150,62,0.12)", border: "1px solid rgba(184,150,62,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>💰</div>
                      <div>
                        <div style={{ fontSize: "0.58rem", color: "var(--t3)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 3 }}>Starting Balance</div>
                        {startBalEdit ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input
                              type="number"
                              value={startBalInput}
                              onChange={e => setStartBalInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  const v = parseFloat(startBalInput);
                                  if (v > 0) { setStartBal(v); supabase.from('user_settings').upsert({ user_id: user?.id, start_bal: v }, { onConflict: 'user_id' }).then(); showToast("Balance updated ✓"); }
                                  setStartBalEdit(false);
                                }
                                if (e.key === "Escape") setStartBalEdit(false);
                              }}
                              placeholder="e.g. 10000"
                              style={{ width: 120, padding: "5px 9px", fontSize: "0.82rem" }}
                              autoFocus
                            />
                            <button className="btn btn-gold" style={{ padding: "5px 12px", fontSize: "0.7rem" }}
                              onClick={() => {
                                const v = parseFloat(startBalInput);
                                if (v > 0) { setStartBal(v); supabase.from('user_settings').upsert({ user_id: user?.id, start_bal: v }, { onConflict: 'user_id' }).then(); showToast("Balance updated ✓"); }
                                setStartBalEdit(false);
                              }}>✓ Save</button>
                            <button className="btn btn-ghost" style={{ padding: "5px 9px", fontSize: "0.7rem" }} onClick={() => setStartBalEdit(false)}>✕</button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontFamily: "var(--font-num)", fontSize: "1.15rem", fontWeight: 700, color: "var(--gold3)" }}>${startBal.toLocaleString()}</span>
                            <button className="btn btn-ghost" style={{ padding: "3px 10px", fontSize: "0.62rem" }}
                              onClick={() => { setStartBalInput(String(startBal)); setStartBalEdit(true); }}>Edit</button>
                          </div>
                        )}
                      </div>
                    </div>
                    {S.total > 0 && (
                      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "0.58rem", color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 3 }}>Current Balance</div>
                          <div style={{ fontFamily: "var(--font-num)", fontSize: "1.05rem", fontWeight: 700, color: pC(S.totalPnl) }}>${(startBal + S.totalPnl).toLocaleString()}</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "0.58rem", color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 3 }}>Total P&L</div>
                          <div style={{ fontFamily: "var(--font-num)", fontSize: "1.05rem", fontWeight: 700, color: pC(S.totalPnl) }}>{fP(S.totalPnl)}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {trades.length === 0 ? (
                    /* Empty state */
                    <div style={{ textAlign: "center", padding: "72px 20px" }}>
                      <div style={{ fontSize: "3.2rem", marginBottom: 18, opacity: 0.6 }}>📊</div>
                      <div style={{ fontFamily: "var(--font-head)", fontSize: "1.4rem", fontWeight: 800, color: "var(--gold3)", marginBottom: 10 }}>
                        Welcome, {user?.name?.split(" ")[0]}
                      </div>
                      <div style={{ fontSize: "0.83rem", color: "var(--t2)", marginBottom: 28, maxWidth: 380, margin: "0 auto 28px", lineHeight: 1.7 }}>
                        Your trading journal is ready. Start logging trades to see your performance dashboard come to life.
                      </div>
                      <button className="btn btn-gold" onClick={() => go("log")}>Log Your First Trade →</button>
                    </div>
                  ) : (
                    <>
                      {/* Stat cards */}
                      <div className="g-stats">
                        {[
                          { l: "Current Balance", v: `$${(startBal + S.totalPnl).toLocaleString()}`, s: `Started at $${startBal.toLocaleString()}`, c: pC(S.totalPnl), d: 0,   icon: "💰", accentVar: pC(S.totalPnl) },
                          { l: "Total P&L",    v: fP(S.totalPnl),       s: `${S.total} trades`,             c: pC(S.totalPnl),  d: 55,  icon: "📈", accentVar: pC(S.totalPnl) },
                          { l: "Win Rate",     v: `${S.winRate}%`,      s: `${S.wins}W · ${S.losses}L`,     c: "var(--green2)", d: 110, icon: "🎯", accentVar: "var(--green2)" },
                          { l: "Risk : Reward",v: S.rr,                 s: `Avg win $${S.avgWin}`,           c: "var(--gold2)",  d: 165, icon: "⚖️", accentVar: "var(--gold2)" },
                          { l: "Profit Factor",v: S.profFactor,         s: "Target > 2.0",                  c: "var(--cyan2)",  d: 220, icon: "📊", accentVar: "var(--cyan2)" },
                          { l: "Expectancy",   v: `$${S.expectancy}`,   s: "per trade avg",                 c: "var(--blue2)",  d: 275, icon: "🔮", accentVar: "var(--blue2)" },
                        ].map(({ l, v, s, c, d, icon, accentVar }) => (
                          <div key={l} className="card sc fu" style={{ "--accent": accentVar, animationDelay: `${d}ms` }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                              <div className="lbl" style={{ marginBottom: 0 }}>{l}</div>
                              <span style={{ fontSize: "1rem", opacity: 0.75, lineHeight: 1 }}>{icon}</span>
                            </div>
                            <div style={N("clamp(1.1rem,2vw,1.5rem)", 700, c, { marginTop: 2 })}>{v}</div>
                            <div style={{ fontSize: "var(--text-xs)", color: "var(--t3)", marginTop: 7, fontFamily: "var(--font-ui)" }}>{s}</div>
                          </div>
                        ))}
                      </div>

                      {/* Charts row */}
                      <div className="g-charts">
                        {/* Equity / Drawdown chart */}
                        <div className="card">
                          <div className="ch">
                            <div>
                              <div className="stitle">Equity Curve</div>
                              <div style={{ fontSize: "0.67rem", color: "var(--t2)", marginTop: 2 }}>Cumulative performance over time</div>
                            </div>
                            <div className="sw">
                              {["equity", "drawdown"].map(v => (
                                <button key={v} className={`swb${chartV === v ? " on" : ""}`} onClick={() => setChartV(v)}>{v}</button>
                              ))}
                            </div>
                          </div>
                          <div style={{ padding: "18px 16px" }}>
                            <ResponsiveContainer width="100%" height={winWidth < 900 ? 180 : 280}>
                              {chartV === "equity"
                                ? <AreaChart data={equityCurve}>
                                  <defs>
                                    <linearGradient id="geq" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#d4af5a" stopOpacity={0.3} />
                                      <stop offset="100%" stopColor="#d4af5a" stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <XAxis dataKey="d" tick={{ fill: "var(--t3)", fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                  <YAxis tick={{ fill: "var(--t3)", fontSize: 9 }} axisLine={false} tickLine={false} width={48} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                                  <Tooltip content={<Tip />} />
                                  <Area type="monotone" dataKey="eq" name="Equity" stroke="#d4af5a" strokeWidth={2} fill="url(#geq)" dot={false} />
                                </AreaChart>
                                : <AreaChart data={equityCurve}>
                                  <defs>
                                    <linearGradient id="gdd" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#c93347" stopOpacity={0.3} />
                                      <stop offset="100%" stopColor="#c93347" stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <XAxis dataKey="d" tick={{ fill: "var(--t3)", fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                  <YAxis tick={{ fill: "var(--t3)", fontSize: 9 }} axisLine={false} tickLine={false} width={36} tickFormatter={v => `${v}%`} />
                                  <Tooltip content={<Tip />} />
                                  <Area type="monotone" dataKey="dd" name="Drawdown" stroke="#c93347" strokeWidth={2} fill="url(#gdd)" dot={false} />
                                </AreaChart>
                              }
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Win / Loss donut */}
                        <div className="card">
                          <div className="ch"><div className="stitle">Win / Loss Split</div></div>
                          <div style={{ padding: "16px" }}>
                            <ResponsiveContainer width="100%" height={120}>
                              <PieChart>
                                <Pie data={S.pieDdata} cx="50%" cy="50%" innerRadius={36} outerRadius={54} paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                                  <Cell fill="#15a854" />
                                  <Cell fill="#c93347" />
                                  <Cell fill="#2060e8" />
                                </Pie>
                                <Tooltip content={<Tip />} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div style={{ display: "flex", justifyContent: "center", gap: 16, margin: "8px 0 14px" }}>
                              {[{ c: "#15a854", l: `Wins (${S.wins})` }, { c: "#c93347", l: `Losses (${S.losses})` }, { c: "#2060e8", l: `BE (${S.be})` }].map(({ c, l }) => (
                                <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: c, flexShrink: 0 }} />
                                  <span style={{ fontSize: "0.63rem", color: "var(--t2)" }}>{l}</span>
                                </div>
                              ))}
                            </div>
                            <div style={{ borderTop: "1px solid var(--b1)", paddingTop: 10 }}>
                              {[
                                { l: "Avg Win",   v: `+$${S.avgWin}`,        c: "var(--green2)" },
                                { l: "Avg Loss",  v: `-$${S.avgLoss}`,       c: "var(--red2)" },
                                { l: "Avg Pips",  v: fPi(S.avgPips),         c: pC(S.avgPips) },
                                { l: "Total Lots",v: S.totalLots + " lots",  c: "var(--t2)" },
                              ].map(({ l, v, c }, i, arr) => (
                                <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 2px", borderBottom: i < arr.length - 1 ? "1px solid var(--b1)" : "none" }}>
                                  <span style={{ fontSize: "0.70rem", color: "var(--t2)" }}>{l}</span>
                                  <span style={N("0.85rem", 700, c)}>{v}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Recent trades */}
                      <div className="card">
                        <div className="ch">
                          <div className="stitle">Recent Trades</div>
                          <button className="btn btn-ghost" style={{ padding: "5px 13px", fontSize: "0.66rem" }} onClick={() => go("trades")}>View All →</button>
                        </div>
                        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
                          {trades.slice(0, 5).map(t => (
                            <div key={t.id} className="trade-row" onClick={() => setSelTrade(t)}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span className={`badge ${t.direction === "LONG" ? "bl" : "bs"}`}>{t.direction}</span>
                                <span style={{ fontWeight: 600, fontSize: "0.83rem" }}>{t.pair}</span>
                                <span style={{ fontSize: "0.68rem", color: "var(--t2)" }} className="hide-sm">{t.strategy} · {t.session}</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                <span style={{ fontSize: "0.67rem", color: "var(--t2)" }}>{t.date}</span>
                                <span style={N("0.94rem", 700, pC(t.pnl), { minWidth: 64, textAlign: "right" })}>{fP(t.pnl)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ══════════════ TRADE LOG ══════════════ */}
              {tab === "trades" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }} className="fu">
                  {/* Filter bar */}
                  <div className="card" style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
                      <input
                        value={fSearch}
                        onChange={e => setFSearch(e.target.value)}
                        placeholder="Search pair, strategy, emotion, notes…"
                        style={{ width: "auto", flex: "1 1 180px", minWidth: 160 }}
                      />
                      <select value={fPair} onChange={e => setFPair(e.target.value)} style={{ width: "auto", minWidth: 118 }}>
                        <option>All</option>
                        {PAIRS.map(p => <option key={p}>{p}</option>)}
                      </select>
                      <select value={fDir} onChange={e => setFDir(e.target.value)} style={{ width: "auto", minWidth: 98 }}>
                        {["All", "LONG", "SHORT"].map(d => <option key={d}>{d}</option>)}
                      </select>
                      <select value={fSort} onChange={e => setFSort(e.target.value)} style={{ width: "auto", minWidth: 110 }}>
                        <option value="date">Date ↓</option>
                        <option value="pnl">P&L ↓</option>
                        <option value="pips">Pips ↓</option>
                      </select>
                      <span style={{ marginLeft: "auto", fontSize: "0.69rem", color: "var(--t3)", whiteSpace: "nowrap" }}>
                        {filtered.length} trade{filtered.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  {filtered.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px 20px" }}>
                      <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(184,150,62,0.07)", border: "1px solid rgba(184,150,62,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto 18px" }}>📋</div>
                      <div style={{ fontFamily: "var(--font-head)", fontSize: "1.3rem", fontWeight: 800, color: "var(--gold3)", marginBottom: 8 }}>No Trades Yet</div>
                      <div style={{ fontSize: "var(--text-sm)", color: "var(--t3)", marginBottom: 24, maxWidth: 300, margin: "0 auto 24px", lineHeight: 1.7 }}>
                        Your journal is ready. Log your first trade to start tracking performance.
                      </div>
                      <button className="btn btn-gold" onClick={() => go("log")}>Log First Trade →</button>
                    </div>
                  ) : (
                    <>
                      {/* Desktop table */}
                      <div className="card hide-sm" style={{ overflow: "hidden" }}>
                        <div style={{ overflowX: "auto" }}>
                          <table className="tbl">
                            <thead>
                              <tr>
                                {["Date","Pair","Dir","Entry","Exit"].map(h => <th key={h}>{h}</th>)}
                                <th className="hide-md">SL</th>
                                <th className="hide-md">TP</th>
                                <th className="hide-md">Lots</th>
                                {["Pips","P&L","R:R","Session","Strategy"].map(h => <th key={h}>{h}</th>)}
                                <th className="hide-md">Emotion</th>
                                {["Tags",""].map(h => <th key={h}>{h}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {filtered.map(t => (
                                <tr key={t.id} onClick={() => setSelTrade(t)} style={{ cursor: "pointer" }}>
                                  <td style={{ color: "var(--t3)", fontFamily: "var(--font-num)", fontSize: "var(--text-xs)" }}>{t.date}</td>
                                  <td style={{ fontWeight: 700, fontSize: "var(--text-sm)" }}>{t.pair}</td>
                                  <td><span className={`badge ${t.direction === "LONG" ? "bl" : "bs"}`}>{t.direction}</span></td>
                                  <td style={{ color: "var(--t2)", fontFamily: "var(--font-num)", fontSize: "var(--text-xs)" }}>{t.entry}</td>
                                  <td style={{ color: "var(--t2)", fontFamily: "var(--font-num)", fontSize: "var(--text-xs)" }}>{t.exit}</td>
                                  <td className="hide-md" style={{ color: "var(--red2)", opacity: 0.9, fontFamily: "var(--font-num)", fontSize: "var(--text-xs)" }}>{t.sl || "—"}</td>
                                  <td className="hide-md" style={{ color: "var(--green2)", opacity: 0.9, fontFamily: "var(--font-num)", fontSize: "var(--text-xs)" }}>{t.tp || "—"}</td>
                                  <td className="hide-md" style={{ color: "var(--t2)", fontFamily: "var(--font-num)", fontSize: "var(--text-xs)" }}>{t.lots}</td>
                                  <td style={N("var(--text-sm)", 600, pC(t.pips))}>{fPi(t.pips)}</td>
                                  <td style={N("var(--text-base)", 700, pC(t.pnl))}>{fP(t.pnl)}</td>
                                  <td style={{ color: "var(--t2)", fontSize: "var(--text-xs)" }}>{t.rr}</td>
                                  <td style={{ color: "var(--t2)", fontSize: "var(--text-xs)" }}>{t.session}</td>
                                  <td style={{ color: "var(--t2)", fontSize: "var(--text-xs)" }}>{t.strategy}</td>
                                  <td className="hide-md" style={{ color: "var(--t2)", fontSize: "var(--text-xs)" }}>{t.emotions}</td>
                                  <td>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, maxWidth: 110 }}>
                                      {t.tags?.slice(0, 2).map(tg => (
                                        <span key={tg} style={{ background: "rgba(184,150,62,0.08)", border: "1px solid rgba(184,150,62,0.18)", borderRadius: 10, color: "var(--gold2)", fontSize: "0.58rem", padding: "2px 7px" }}>{tg}</span>
                                      ))}
                                    </div>
                                  </td>
                                  <td onClick={e => e.stopPropagation()}>
                                    <div style={{ display: "flex", gap: 5 }}>
                                      <button
                                        className="btn btn-ghost"
                                        style={{ padding: "4px 10px", fontSize: "0.7rem" }}
                                        title="Edit trade"
                                        onClick={e => { e.stopPropagation(); beginEdit(t); }}
                                      >✎</button>
                                      <button
                                        className="btn btn-red"
                                        title="Delete trade"
                                        onClick={e => { e.stopPropagation(); deleteTrade(t.id); }}
                                      >✕</button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Mobile cards */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }} className="show-sm">
                        {filtered.map(t => (
                          <div key={t.id} className="mob-card" onClick={() => setSelTrade(t)}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                                <span className={`badge ${t.direction === "LONG" ? "bl" : "bs"}`}>{t.direction}</span>
                                <span style={{ fontWeight: 700, fontSize: "0.86rem" }}>{t.pair}</span>
                              </div>
                              <span style={N("1.05rem", 700, pC(t.pnl))}>{fP(t.pnl)}</span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, fontSize: "0.65rem", color: "var(--t3)", marginBottom: 10 }}>
                              <span>{t.date}</span><span>{t.strategy}</span><span>{t.session}</span>
                              <span style={{ color: pC(t.pips) }}>{fPi(t.pips)} pips</span><span>R:R {t.rr}</span><span>{t.emotions}</span>
                            </div>
                            <div style={{ display: "flex", gap: 7, justifyContent: "flex-end" }} onClick={e => e.stopPropagation()}>
                              <button className="btn btn-ghost" style={{ padding: "5px 12px", fontSize: "0.68rem" }} onClick={e => { e.stopPropagation(); beginEdit(t); }}>✎ Edit</button>
                              <button className="btn btn-red" style={{ padding: "5px 10px", fontSize: "0.68rem" }} onClick={e => { e.stopPropagation(); deleteTrade(t.id); }}>✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ══════════════ LOG TRADE ══════════════ */}
              {tab === "log" && (
                <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }} className="fu">
                  <div className="card">
                    <div className="ch">
                      <div>
                        <div className="stitle">Log New Trade</div>
                        <div className="sdesc">Capture every detail for deeper analysis</div>
                      </div>
                    </div>
                    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>

                      {/* Group 1: Trade identity */}
                      <div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--gold2)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 18, height: 1, background: "var(--gold)", display: "inline-block", opacity: 0.5 }} />
                          Trade Identity
                          <span style={{ flex: 1, height: 1, background: "var(--b1)", display: "inline-block" }} />
                        </div>
                        <div className="g-form">
                          {[
                            { l: "Date",        k: "date",      t: "date" },
                            { l: "Pair",        k: "pair",      t: "sel",    o: PAIRS },
                            { l: "Direction",   k: "direction", t: "sel",    o: ["LONG","SHORT"] },
                            { l: "Session",     k: "session",   t: "sel",    o: SESSIONS },
                          ].map(f => (
                            <div key={f.k}>
                              <label className="lbl">{f.l}</label>
                              {f.t === "sel"
                                ? <select value={form[f.k]} onChange={e => sf(f.k, e.target.value)}>{f.o.map(o => <option key={o}>{o}</option>)}</select>
                                : <input type={f.t} value={form[f.k]} placeholder={f.p} onChange={e => sf(f.k, e.target.value)} />
                              }
                            </div>
                          ))}
                          <div>
                            <label className="lbl">Strategy</label>
                            <div style={{ display: "flex", gap: 7 }}>
                              <select value={form.strategy} onChange={e => sf("strategy", e.target.value)} style={{ flex: 1 }}>
                                {strats.map(s => <option key={s}>{s}</option>)}
                              </select>
                              <button className="btn btn-ghost" title="Manage strategies" onClick={() => setShowSM(true)} style={{ padding: "9px 13px", flexShrink: 0 }}>⚙</button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Group 2: Price data */}
                      <div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--gold2)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 18, height: 1, background: "var(--gold)", display: "inline-block", opacity: 0.5 }} />
                          Execution
                          <span style={{ flex: 1, height: 1, background: "var(--b1)", display: "inline-block" }} />
                        </div>
                        <div className="g-form">
                          {[
                            { l: "Entry Price", k: "entry", t: "number", p: "e.g. 1.08420" },
                            { l: "Exit Price",  k: "exit",  t: "number", p: "e.g. 1.08650" },
                            { l: "Lot Size",    k: "lots",  t: "number", p: "e.g. 0.5" },
                          ].map(f => (
                            <div key={f.k}>
                              <label className="lbl">{f.l}</label>
                              <input type={f.t} value={form[f.k]} placeholder={f.p} onChange={e => sf(f.k, e.target.value)} />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Group 3: Risk */}
                      <div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--gold2)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 18, height: 1, background: "var(--gold)", display: "inline-block", opacity: 0.5 }} />
                          Risk Management
                          <span style={{ flex: 1, height: 1, background: "var(--b1)", display: "inline-block" }} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div style={{ background: "rgba(201,51,71,0.05)", border: "1px solid rgba(201,51,71,0.14)", borderRadius: "var(--r-md)", padding: "14px 15px" }}>
                            <label className="lbl" style={{ color: "var(--red2)" }}>Stop Loss</label>
                            <input type="number" value={form.sl} placeholder="e.g. 1.08100" onChange={e => sf("sl", e.target.value)} style={{ background: "transparent", border: "1px solid rgba(201,51,71,0.2)" }} />
                          </div>
                          <div style={{ background: "rgba(21,168,84,0.05)", border: "1px solid rgba(21,168,84,0.14)", borderRadius: "var(--r-md)", padding: "14px 15px" }}>
                            <label className="lbl" style={{ color: "var(--green2)" }}>Take Profit</label>
                            <input type="number" value={form.tp} placeholder="e.g. 1.09000" onChange={e => sf("tp", e.target.value)} style={{ background: "transparent", border: "1px solid rgba(21,168,84,0.2)" }} />
                          </div>
                        </div>
                      </div>

                      {/* Tags */}
                      <div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--gold2)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 18, height: 1, background: "var(--gold)", display: "inline-block", opacity: 0.5 }} />
                          Psychology & Notes
                          <span style={{ flex: 1, height: 1, background: "var(--b1)", display: "inline-block" }} />
                        </div>

                        {/* Emotions */}
                        <div style={{ marginBottom: 14 }}>
                          <label className="lbl">Emotional State</label>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {EMOTIONS.map(e => (
                              <button key={e} className={`em-pill${form.emotions === e ? " on" : ""}`} onClick={() => sf("emotions", e)}>{e}</button>
                            ))}
                          </div>
                        </div>

                        <label className="lbl">Tags</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                          {form.tags.map(t => (
                            <span key={t} className="tag-pill">
                              {t}
                              <span style={{ cursor: "pointer", opacity: 0.5, marginLeft: 4 }} onClick={() => sf("tags", form.tags.filter(x => x !== t))}>✕</span>
                            </span>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input value={form.newTag} placeholder='Add tag (e.g. "HTF Aligned"), press Enter'
                            onChange={e => sf("newTag", e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && form.newTag.trim()) setForm(p => ({ ...p, tags: [...p.tags, p.newTag.trim()], newTag: "" })); }} />
                          <button className="btn btn-ghost" style={{ whiteSpace: "nowrap" }}
                            onClick={() => { if (form.newTag.trim()) setForm(p => ({ ...p, tags: [...p.tags, p.newTag.trim()], newTag: "" })); }}>
                            + Tag
                          </button>
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="lbl">Trade Notes</label>
                        <textarea rows={3} value={form.notes}
                          placeholder="What did you see? Why did you enter? What would you do differently?"
                          onChange={e => sf("notes", e.target.value)}
                          style={{ resize: "vertical" }} />
                      </div>

                      {fErr && (
                        <div style={{ background: "rgba(201,51,71,0.09)", border: "1px solid rgba(201,51,71,0.22)", borderRadius: "var(--r-sm)", padding: "11px 14px", fontSize: "var(--text-sm)", color: "var(--red2)", display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: "1rem" }}>⚠️</span> {fErr}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", paddingTop: 4 }}>
                        <button className="btn btn-ghost" onClick={() => setForm(blankForm)} disabled={submitting}>Clear Form</button>
                        <button className="btn btn-gold" onClick={addTrade} disabled={submitting}>
                          {submitting
                            ? <><span className="spin" style={{ fontSize: "0.8rem" }}>⏳</span> Saving…</>
                            : "Record & Save Trade →"
                          }
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Screenshots */}
                  <div className="card card-gold">
                    <div className="ch">
                      <div>
                        <div className="stitle">Chart Screenshots</div>
                        <div className="sdesc">Saved permanently with your trade entry</div>
                      </div>
                      {(form.screenshots.before || form.screenshots.after) && (
                        <button className="btn btn-ghost" style={{ fontSize: "0.66rem", padding: "5px 11px" }} onClick={() => sf("screenshots", { before: "", after: "" })}>Clear All</button>
                      )}
                    </div>
                    <div style={{ padding: 20 }}>
                      <div className="g2">
                        <DropZone label="Before Entry — Setup" icon="📸" value={form.screenshots.before} onChange={v => setForm(p => ({ ...p, screenshots: { ...p.screenshots, before: v } }))} />
                        <DropZone label="After Exit — Result"  icon="✅" value={form.screenshots.after}  onChange={v => setForm(p => ({ ...p, screenshots: { ...p.screenshots, after: v } }))} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ══════════════ INSIGHTS ══════════════ */}
              {tab === "insights" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }} className="fu">
                  {S.total === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px 20px" }}>
                      <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(184,150,62,0.08)", border: "1px solid rgba(184,150,62,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.2rem", margin: "0 auto 20px" }}>🔍</div>
                      <div style={{ fontFamily: "var(--font-head)", fontSize: "1.4rem", fontWeight: 800, color: "var(--gold3)", marginBottom: 10 }}>
                        No Data to Analyse
                      </div>
                      <div style={{ fontSize: "var(--text-sm)", color: "var(--t3)", maxWidth: 360, margin: "0 auto 10px", lineHeight: 1.75 }}>
                        Start logging trades to unlock
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginBottom: 28, maxWidth: 380, margin: "0 auto 28px" }}>
                        {["🤖 AI Coaching", "📡 Performance Radar", "⏱️ Session Breakdown", "📐 Advanced Metrics"].map(f => (
                          <span key={f} style={{ background: "rgba(184,150,62,0.07)", border: "1px solid rgba(184,150,62,0.16)", borderRadius: 20, padding: "5px 12px", fontSize: "var(--text-xs)", color: "var(--gold2)", fontWeight: 500 }}>{f}</span>
                        ))}
                      </div>
                      <button className="btn btn-gold" onClick={() => go("log")}>Log Your First Trade →</button>
                    </div>
                  ) : (
                  <>
                  {/* AI Coach card */}
                  <div className="card card-gold" style={{ position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--goldg)" }} />
                    <div className="ch">
                      <div>
                        <div className="stitle">AI Performance Coach</div>
                        <div className="sdesc">Powered by Claude · Real-time analysis of your trading data</div>
                      </div>
                      <button className="btn btn-gold" onClick={getAI} disabled={aiLoad || S.total === 0}>
                        {aiLoad ? <><span className="spin" style={{ fontSize: "0.75rem" }}>⟳</span> Analyzing…</> : "✨ Generate Analysis"}
                      </button>
                    </div>
                    <div style={{ padding: "4px 18px 18px" }}>
                      {S.total === 0
                        ? <div style={{ textAlign: "center", padding: "28px", color: "var(--t3)", fontSize: "var(--text-sm)" }}>Log some trades first to get AI coaching.</div>
                        : aiLoad
                          ? <div style={{ background: "var(--s2)", border: "1px solid var(--b2)", borderRadius: "var(--r-md)", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
                            {[100, 85, 92, 60, 78, 88, 50].map((w, i) => (
                              <div key={i} style={{ height: 10, borderRadius: 6, background: `linear-gradient(90deg, var(--s3) 25%, var(--s4) 50%, var(--s3) 75%)`, backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", width: `${w}%`, animationDelay: `${i * 0.08}s` }} />
                            ))}
                          </div>
                          : aiText
                            ? <div style={{ background: "var(--s2)", border: "1px solid var(--b2)", borderRadius: "var(--r-md)", padding: "18px 20px" }}>
                              <div className="ai-response" style={{ whiteSpace: "normal" }}>{renderAI(aiText)}</div>
                            </div>
                            : <div style={{ textAlign: "center", padding: "28px", color: "var(--t3)", fontSize: "var(--text-sm)" }}>
                              Click <strong style={{ color: "var(--gold2)" }}>Generate Analysis</strong> for a structured AI coaching report
                            </div>
                      }
                    </div>
                  </div>

                  {/* Radar + P&L by pair */}
                  <div className="g2">
                    <div className="card">
                      <div className="ch">
                        <div>
                          <div className="stitle">Performance Radar</div>
                          <div className="sdesc">Multi-dimensional score across 6 key metrics</div>
                        </div>
                      </div>
                      <div style={{ padding: "16px" }}>
                        <ResponsiveContainer width="100%" height={230}>
                          <RadarChart data={S.radarData}>
                            <PolarGrid stroke="var(--b2)" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--t3)", fontSize: 9, fontFamily: "var(--font-ui)" }} />
                            <Radar name="Score" dataKey="A" stroke="#d4af5a" fill="#d4af5a" fillOpacity={0.15} strokeWidth={2} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="card">
                      <div className="ch">
                        <div>
                          <div className="stitle">P&L by Pair</div>
                          <div className="sdesc">Your best and worst performing instruments</div>
                        </div>
                      </div>
                      <div style={{ padding: "16px" }}>
                        <ResponsiveContainer width="100%" height={230}>
                          <BarChart data={S.byPair} layout="vertical">
                            <XAxis type="number" tick={{ fill: "var(--t3)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                            <YAxis type="category" dataKey="name" tick={{ fill: "var(--t2)", fontSize: 9 }} axisLine={false} tickLine={false} width={62} />
                            <Tooltip content={<Tip />} />
                            <Bar dataKey="pnl" name="P&L" radius={4}>
                              {S.byPair.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? "#15a854" : "#c93347"} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Session + Strategy */}
                  <div className="g2">
                    <div className="card">
                      <div className="ch">
                        <div>
                          <div className="stitle">Session Performance</div>
                          <div className="sdesc">P&L breakdown by market session</div>
                        </div>
                      </div>
                      <div style={{ padding: "12px 18px" }}>
                        {S.bySession.map(s => (
                          <div key={s.session} className="irow">
                            <div style={{ width: 84, fontSize: "0.71rem", color: "var(--t2)", flexShrink: 0 }}>{s.session}</div>
                            <div className="ibar">
                              <div className="ifill" style={{ width: `${Math.min(100, Math.abs(s.pnl) / 18)}%`, background: s.pnl >= 0 ? "var(--green)" : "var(--red)" }} />
                            </div>
                            <div style={N("0.75rem", 700, pC(s.pnl), { width: 64, textAlign: "right", flexShrink: 0 })}>{fP(s.pnl)}</div>
                            <div style={{ width: 32, textAlign: "right", fontSize: "0.63rem", color: "var(--t3)", flexShrink: 0 }}>{s.wr}%</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="card">
                      <div className="ch">
                        <div>
                          <div className="stitle">Strategy Breakdown</div>
                          <div className="sdesc">Which setups are actually working</div>
                        </div>
                      </div>
                      <div style={{ padding: "12px 18px" }}>
                        {S.byStrategy.length
                          ? S.byStrategy.map(s => (
                            <div key={s.name} className="irow">
                              <div style={{ width: 100, fontSize: "0.69rem", color: "var(--t2)", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                              <div className="ibar">
                                <div className="ifill" style={{ width: `${Math.min(100, Math.abs(s.pnl) / 12)}%`, background: s.pnl >= 0 ? "var(--blue)" : "var(--red)" }} />
                              </div>
                              <div style={N("0.73rem", 700, pC(s.pnl), { width: 60, textAlign: "right", flexShrink: 0 })}>{fP(s.pnl)}</div>
                              <div style={{ width: 32, textAlign: "right", fontSize: "0.63rem", color: "var(--t3)", flexShrink: 0 }}>{s.wr}%</div>
                            </div>
                          ))
                          : <div style={{ textAlign: "center", padding: "26px", color: "var(--t3)", fontSize: "0.77rem" }}>Log trades to see strategy breakdown</div>
                        }
                      </div>
                    </div>
                  </div>

                  {/* Advanced metrics */}
                  <div className="card">
                    <div className="ch">
                      <div>
                        <div className="stitle">Advanced Metrics</div>
                        <div className="sdesc">Deep-dive statistics for serious analysis</div>
                      </div>
                    </div>
                    <div style={{ padding: 18 }}>
                      <div className="g3" style={{ gap: 10 }}>
                        {[
                          { l: "Profit Factor",  v: S.profFactor,           d: "Target > 2.0",          ok: parseFloat(S.profFactor) >= 2 },
                          { l: "Expectancy",     v: `$${S.expectancy}/trade`, d: "Expected value per trade", ok: S.expectancy > 0 },
                          { l: "Avg Win",        v: `+$${S.avgWin}`,        d: "Average winning trade",  ok: true },
                          { l: "Avg Loss",       v: `-$${S.avgLoss}`,       d: "Average losing trade",   ok: false },
                          { l: "Avg Pips",       v: fPi(S.avgPips),         d: "Pips per trade",         ok: S.avgPips > 0 },
                          { l: "Total Lots",     v: S.totalLots,            d: "Volume traded",          ok: true },
                          { l: "Win Streak",     v: `${S.maxStreak}`,       d: "Consecutive wins",       ok: true },
                          { l: "Loss Streak",    v: `${S.maxLStreak}`,      d: "Consecutive losses",     ok: S.maxLStreak <= 3 },
                          { l: "Total Trades",   v: `${S.total}`,           d: "Journal entries",        ok: true },
                          { l: "Avg R:R",        v: avgRR !== null ? `1:${avgRR}` : "—", d: "Avg risk-reward (SL+TP trades)", ok: avgRR !== null && avgRR >= 1.5 },
                        ].map(({ l, v, d, ok }) => (
                          <div key={l} className="metric-card">
                            <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: ok ? "var(--green2)" : "var(--red2)", borderRadius: "0 3px 3px 0" }} />
                            <div className="lbl" style={{ marginBottom: 5 }}>{l}</div>
                            <div style={N("1.15rem", 700, ok ? "var(--green2)" : "var(--red2)")}>{v}</div>
                            <div style={{ fontSize: "0.66rem", color: "var(--t2)", marginTop: 5, fontFamily: "var(--font-ui)" }}>{d}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  </>
                  )}
                </div>
              )}

              {/* ══════════════ PSYCHOLOGY ══════════════ */}
              {tab === "psychology" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }} className="fu">
                  {/* Header banner */}
                  <div className="card" style={{ background: "linear-gradient(135deg, rgba(0,187,163,0.07), transparent)", border: "1px solid rgba(0,187,163,0.14)", padding: 20 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(0,187,163,0.12)", border: "1px solid rgba(0,187,163,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>🧠</div>
                      <div>
                        <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--cyan2)", marginBottom: 5, fontFamily: "var(--font-ui)" }}>Trading Psychology Dashboard</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--t3)", lineHeight: 1.6 }}>
                          Understanding your emotional patterns is the edge that separates consistent traders from the rest.
                          Track how your mental state impacts your decision-making and P&L.
                        </div>
                      </div>
                    </div>
                  </div>

                  {S.byEmotion.length ? (
                    <>
                      {/* Emotion → P&L grid */}
                      <div className="card">
                        <div className="ch">
                          <div>
                            <div className="stitle">Emotion → P&L Map</div>
                            <div className="sdesc">How each emotional state affects your bottom line</div>
                          </div>
                        </div>
                        <div style={{ padding: 18 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                            {S.byEmotion.map(e => (
                              <div key={e.name} style={{ background: "var(--s2)", border: `1px solid ${e.pnl >= 0 ? "rgba(21,168,84,0.18)" : "rgba(201,51,71,0.16)"}`, borderRadius: "var(--r-md)", padding: "13px 15px", position: "relative", overflow: "hidden", transition: "transform 0.15s", cursor: "default" }}
                                onMouseEnter={el => el.currentTarget.style.transform = "translateY(-2px)"}
                                onMouseLeave={el => el.currentTarget.style.transform = "translateY(0)"}
                              >
                                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: e.pnl >= 0 ? "var(--green)" : "var(--red)" }} />
                                <div style={{ fontSize: "0.71rem", color: "var(--t2)", marginBottom: 6, fontWeight: 500 }}>{e.name}</div>
                                <div style={N("1.15rem", 700, pC(e.pnl))}>{fP(e.pnl)}</div>
                                <div style={{ fontSize: "0.62rem", color: "var(--t3)", marginTop: 5 }}>{e.trades} trade{e.trades > 1 ? "s" : ""} · {e.wr}% WR</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Emotion chart */}
                      <div className="card">
                        <div className="ch">
                          <div>
                            <div className="stitle">P&L by Emotional State</div>
                            <div className="sdesc">Visual comparison across all recorded emotions</div>
                          </div>
                        </div>
                        <div style={{ padding: "16px" }}>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={S.byEmotion}>
                              <XAxis dataKey="name" tick={{ fill: "var(--t3)", fontSize: 9 }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fill: "var(--t3)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                              <Tooltip content={<Tip />} />
                              <Bar dataKey="pnl" name="P&L" radius={[4, 4, 0, 0]}>
                                {S.byEmotion.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? "#15a854" : "#c93347"} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Psychology insights */}
                      <div className="card">
                        <div className="ch">
                          <div>
                            <div className="stitle">Psychology Insights</div>
                            <div className="sdesc">Data-driven observations about your mental game</div>
                          </div>
                        </div>
                        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                          {[
                            { icon: "🏆", title: "Your peak state", body: `You perform best when "${S.byEmotion[0]?.name}" — ${S.byEmotion[0]?.wr}% win rate with ${fP(S.byEmotion[0]?.pnl || 0)} P&L. Build a pre-trade checklist to consistently reach this optimal state.` },
                            { icon: "⛔", title: "Your danger state", body: `Trades placed when "${S.byEmotion[S.byEmotion.length - 1]?.name}" have been costly. Add a rule to your playbook: if you feel this way, do NOT open a new position.` },
                            { icon: "🔥", title: "Streak management", body: `Your longest win streak is ${S.maxStreak} trades. After ${Math.max(Math.ceil(S.maxStreak * 0.6), 2)} consecutive wins, consider reducing position size by 25% to protect gains from overconfidence bias.` },
                            { icon: "🛡️", title: "Loss recovery rule", body: `Max loss streak: ${S.maxLStreak} trades. Implement a daily stop-loss of 2% — after ${Math.min(S.maxLStreak, 3)} consecutive losses, step away and review before placing another trade.` },
                            { icon: "📊", title: "Statistical edge", body: `You have ${S.total} trades journaled. ${S.total >= 30 ? "Your edge is statistically meaningful — trust the system and stay consistent." : `Keep logging — aim for 30+ trades before drawing major conclusions about your edge.`}` },
                          ].map(({ icon, title, body }) => (
                            <div key={title} className="insight-card">
                              <div className="insight-icon">{icon}</div>
                              <div>
                                <div style={{ fontSize: "0.77rem", fontWeight: 700, color: "var(--text)", marginBottom: 5 }}>{title}</div>
                                <div style={{ fontSize: "0.73rem", color: "var(--t2)", lineHeight: 1.75 }}>{body}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: "center", padding: "72px 20px" }}>
                      <div style={{ fontSize: "3rem", marginBottom: 18, opacity: 0.5 }}>🧠</div>
                      <div style={{ fontFamily: "var(--font-head)", fontSize: "1.4rem", fontWeight: 800, color: "var(--gold3)", marginBottom: 10 }}>
                        No Psychology Data Yet
                      </div>
                      <div style={{ fontSize: "0.83rem", color: "var(--t2)", marginBottom: 28, maxWidth: 380, margin: "0 auto 28px", lineHeight: 1.7 }}>
                        Log trades with emotional states to unlock your emotion-to-P&L map, psychology insights, and mental edge analysis.
                      </div>
                      <button className="btn btn-gold" onClick={() => go("log")}>Log Your First Trade →</button>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

    </>
  );
}
