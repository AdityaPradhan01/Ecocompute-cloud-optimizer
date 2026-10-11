import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COLOR } from '../theme';
import LeadCaptureModal from '../components/LeadCaptureModal';

const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const seg = (p, a, b) => ease(clamp((p - a) / (b - a)));
const inr = (v) => Math.round(v).toLocaleString('en-IN');

const QUEUE = [
  { name: 'legacy-report-01', cpu: 4, action: 'Shut down' },
  { name: 'dev-sandbox-05', cpu: 6, action: 'Shut down' },
  { name: 'qa-runner-02', cpu: 12, action: 'Rightsize' },
  { name: 'stage-web-02', cpu: 22, action: 'Off-hours' },
  { name: 'stage-web-01', cpu: 27, action: 'Off-hours' },
  { name: 'prod-api-01', cpu: 62, action: 'Hold' }
];
const CELL_SEED = [3, 7, 11, 18, 22, 29, 31, 40, 44, 51, 58, 63];
const CELLS = Array.from({ length: 72 }, (_, i) => {
  const idle = CELL_SEED.includes(i);
  const busy = !idle && (i * 7 + 3) % 5 < 3;
  return { bg: busy ? COLOR.ink : '#ffffff', anim: idle ? `ec-pulse ${(1.8 + (i % 5) * 0.35).toFixed(2)}s ease-in-out infinite` : 'none' };
});

const Landing = () => {
  const navigate = useNavigate();
  const ref1 = useRef(null);
  const ref2 = useRef(null);
  const ref3 = useRef(null);
  const [p, setP] = useState({ p1: 0, p2: 0, p3: 0, viewH: typeof window !== 'undefined' ? window.innerHeight : 800 });
  const rafRef = useRef(null);
  const [leadModalOpen, setLeadModalOpen] = useState(false);

  useEffect(() => {
    const progressOf = (el, viewH) => {
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const span = el.offsetHeight - viewH;
      return span > 0 ? clamp(-rect.top / span) : 0;
    };
    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const viewH = window.innerHeight;
        setP({ p1: progressOf(ref1.current, viewH), p2: progressOf(ref2.current, viewH), p3: progressOf(ref3.current, viewH), viewH });
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      // Reset the mutex, not just cancel the frame — React StrictMode runs
      // this cleanup once immediately after the first mount (dev only), and
      // without resetting to null here, the next mount's onScroll would see
      // a stale non-null id and permanently skip scheduling a new frame.
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const vh = p.viewH;
  const p1 = p.p1, p2 = p.p2, p3 = p.p3;

  // section 1: rack splits
  const split = seg(p1, 0.08, 0.55);
  const unitH = Math.max(70, Math.min(88, vh * 0.11));
  const gapMax = Math.max(30, Math.min(78, (vh - 150 - unitH * 3) / 2));
  const gap = gapMax * split;
  const c1 = seg(p1, 0.30, 0.52), c2 = seg(p1, 0.42, 0.64), c3 = seg(p1, 0.54, 0.76);
  const cta1p = seg(p1, 0.78, 0.95);
  const unit = (i, c) => ({ dy: Math.round((i - 1) * gap), o: c, tx: Math.round(34 * (1 - c)), led: 0.25 + 0.75 * c });
  const u1 = unit(0, c1), u2 = unit(1, c2), u3 = unit(2, c3);
  const phase1 = split < 0.15 ? 'One rack · one line item' : (split < 0.9 ? 'Separating' : 'Three distinct problems');

  // section 2: grid arbitrage — illustrative global grid-intensity fact
  // (Mumbai vs. Stockholm), not a claim about any specific fleet's regions
  const fill = seg(p2, 0.10, 0.72);
  const bricksA = [], bricksB = [];
  for (let i = 0; i < 18; i++) {
    const t = clamp(fill * 18 - i);
    bricksA.push({ o: t, dy: Math.round(-16 * (1 - t)) });
    const tb = i === 0 ? clamp(fill * 4) : 0;
    bricksB.push({ o: tb, dy: Math.round(-16 * (1 - tb)) });
  }
  const ratioP = seg(p2, 0.55, 0.85);
  const phase2 = fill < 0.2 ? 'Same workload, two grids' : (ratioP < 0.6 ? 'Counting emissions' : '708 g against 8 g');

  // section 3: the queue
  const queue = QUEUE.map((q, i) => {
    const t = q.action === 'Hold' ? 0 : seg(p3, 0.12 + i * 0.11, 0.30 + i * 0.11);
    return { idx: '0' + (i + 1), name: q.name, cpu: q.cpu, action: q.action, strike: Math.round(t * 100), o: 1 - 0.30 * t };
  });
  const counted = seg(p3, 0.14, 0.82);
  const cta3p = seg(p3, 0.72, 0.92);
  const phase3 = counted < 0.2 ? 'Six instances, ranked' : (counted < 0.9 ? 'Applying policies' : 'Five actions, one hold');

  const openProduct = (e) => { e.preventDefault(); navigate('/app'); };

  return (
    <div style={{ maxWidth: '100%', overflowX: 'clip' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: '#ffffff', borderBottom: `2px solid ${COLOR.ink}` }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
          <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none', textDecoration: 'none' }}>
            <span style={{ width: 20, height: 20, background: COLOR.ink, display: 'block' }} />
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '0.06em', color: COLOR.ink }}>ECOCOMPUTE</span>
          </a>
          <nav style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginLeft: 'auto' }}>
            <a href="#problem" style={{ fontSize: 13, fontWeight: 600, color: COLOR.ink, textDecoration: 'none' }}>The problem</a>
            <a href="#grid" style={{ fontSize: 13, fontWeight: 600, color: COLOR.ink, textDecoration: 'none' }}>Where it burns</a>
            <a href="#queue" style={{ fontSize: 13, fontWeight: 600, color: COLOR.ink, textDecoration: 'none' }}>What we do</a>
          </nav>
          <button onClick={openProduct} style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 16px', border: `2px solid ${COLOR.ink}`, background: COLOR.ink, color: '#ffffff', fontSize: 13, fontWeight: 800, flex: 'none', cursor: 'pointer' }}>Open the product</button>
        </div>
      </header>

      <section id="top" style={{ borderBottom: `2px solid ${COLOR.ink}` }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
          <div style={{ padding: '58px 28px 50px', borderRight: `2px solid ${COLOR.ink}` }}>
            <span style={{ display: 'inline-block', padding: '5px 10px', background: COLOR.ink, color: '#ffffff', fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 26 }}>Cloud carbon operations</span>
            <h1 style={{ margin: '0 0 22px', fontSize: 'clamp(38px, 5vw, 68px)', lineHeight: 0.96, letterSpacing: '-0.04em', fontWeight: 800, maxWidth: '18ch' }}>Your idle servers have a rupee price and a carbon price.</h1>
            <p style={{ margin: '0 0 32px', maxWidth: '44ch', fontSize: 17, color: COLOR.body }}>We read your fleet's utilization, price it against the real AWS region it runs in, and rank what to switch off.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={openProduct} style={{ display: 'inline-flex', alignItems: 'center', padding: '15px 24px', background: COLOR.ink, color: '#ffffff', border: `2px solid ${COLOR.ink}`, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>Open the product</button>
              <a href="#problem" style={{ display: 'inline-flex', alignItems: 'center', padding: '15px 24px', background: '#ffffff', border: `2px solid ${COLOR.ink}`, fontSize: 14, fontWeight: 800, color: COLOR.ink, textDecoration: 'none' }}>See the problem</a>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', background: COLOR.canvas }}>
            <div style={{ flex: 1, minHeight: 320, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ font: '700 9px ui-monospace, Menlo, monospace', letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted }}>Illustrative example · pilot fleet</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, font: '700 9px ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: COLOR.ink }}>
                  <span style={{ width: 7, height: 7, background: COLOR.ink, display: 'block', animation: 'ec-blink 1.6s ease-in-out infinite' }} />12 idle
                </span>
              </div>
              <div style={{ position: 'relative', flex: 1, minHeight: 250, border: `2px solid ${COLOR.ink}`, background: '#ffffff', padding: 14, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 6, height: '100%' }}>
                  {CELLS.map((c, i) => (
                    <span key={i} style={{ display: 'block', width: '100%', height: '100%', minHeight: 10, border: `1.5px solid ${COLOR.ink}`, background: c.bg, animation: c.anim }} />
                  ))}
                </div>
                <span style={{ position: 'absolute', left: 0, top: -2, width: '100%', height: 2, background: COLOR.ink, animation: 'ec-scan 5s linear infinite' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', borderTop: `2px solid ${COLOR.ink}` }}>
              <div style={{ padding: '18px 22px', borderRight: `2px solid ${COLOR.ink}` }}>
                <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 6 }}>Waste found</span>
                <span style={{ display: 'block', fontSize: 'clamp(24px, 2.4vw, 34px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>31%</span>
              </div>
              <div style={{ padding: '18px 22px', borderRight: `2px solid ${COLOR.ink}`, background: COLOR.ink }}>
                <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.mutedDark, marginBottom: 6 }}>First report</span>
                <span style={{ display: 'block', fontSize: 'clamp(24px, 2.4vw, 34px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: '#ffffff' }}>9 min</span>
              </div>
              <div style={{ padding: '18px 22px' }}>
                <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 6 }}>CO₂ abated</span>
                <span style={{ display: 'block', fontSize: 'clamp(24px, 2.4vw, 34px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>1.4 t</span>
              </div>
            </div>
            <div style={{ padding: '8px 22px', borderTop: `1px solid ${COLOR.hairline2}` }}>
              <span style={{ fontSize: 10, color: COLOR.muted }}>Illustrative figures from a twelve-instance pilot fleet — not live product output.</span>
            </div>
          </div>
        </div>
      </section>

      <section id="problem" ref={ref1} style={{ position: 'relative', height: '360vh', borderBottom: `2px solid ${COLOR.ink}`, background: COLOR.canvas }}>
        <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 'none', maxWidth: 1280, width: '100%', margin: '0 auto', padding: '18px 28px 0' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 8 }}>
              <span style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: COLOR.muted }}>The problem</span>
              <span style={{ width: 22, height: 2, background: COLOR.ink, display: 'block' }} />
              <span style={{ font: '700 10px ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: COLOR.ink }}>{phase1}</span>
            </div>
            <h2 style={{ margin: 0, fontSize: 'clamp(19px, 2.2vw, 30px)', letterSpacing: '-0.025em', maxWidth: '32ch' }}>One rack, one line item. Pull it apart and each unit is a different problem.</h2>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', maxWidth: 1280, width: '100%', margin: '0 auto', padding: '10px 28px' }}>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
              {[
                { u: u1, node: 'NODE 01', stat: '4% CPU', idx: '01', big: '1 in 3', desc: 'instances sit under 40% CPU all month — invoiced at the full rate.', ledIdx: 0 },
                { u: u2, node: 'NODE 02', stat: '708 g', idx: '02', big: '88× apart', desc: 'carbon per kilowatt-hour between one grid and another. Same watts, different sky.', ledIdx: 1 },
                { u: u3, node: 'NODE 03', stat: '₹ / kg ?', idx: '03', big: 'Zero views', desc: 'put rupees and kilograms on the same row, ranked by what to do next.', ledIdx: 2 }
              ].map((row, ri) => (
                <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 26, flexWrap: 'wrap', marginTop: ri ? -2 : 0, transform: `translateY(${row.u.dy}px)` }}>
                  <div style={{ flex: 'none', position: 'relative', width: 'min(340px, 100%)', height: 'clamp(70px, 11vh, 88px)', border: `2px solid ${COLOR.ink}`, background: '#ffffff', display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px' }}>
                    <span style={{ position: 'absolute', left: -2, top: -2, width: 6, height: 'calc(100% + 4px)', background: COLOR.ink, display: 'block' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginLeft: 10 }}>
                      {[0, 1, 2].map((led) => led === row.ledIdx
                        ? <span key={led} style={{ width: 9, height: 9, background: COLOR.ink, display: 'block', opacity: row.u.led }} />
                        : <span key={led} style={{ width: 9, height: 9, border: `1.5px solid ${COLOR.ink}`, display: 'block' }} />)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
                      <span style={{ height: 16, border: `1.5px solid ${COLOR.ink}`, background: `repeating-linear-gradient(90deg,${COLOR.ink} 0 2px,transparent 2px 7px)`, display: 'block' }} />
                      <span style={{ height: 16, border: `1.5px solid ${COLOR.ink}`, background: `repeating-linear-gradient(90deg,${COLOR.ink} 0 2px,transparent 2px 7px)`, display: 'block' }} />
                    </div>
                    <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                      <span style={{ font: '700 9px ui-monospace, Menlo, monospace', letterSpacing: '0.1em', color: COLOR.muted }}>{row.node}</span>
                      <span style={{ font: '800 15px Archivo, sans-serif', letterSpacing: '-0.02em' }}>{row.stat}</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, maxWidth: 400, opacity: row.u.o, transform: `translateX(${row.u.tx}px)` }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                      <span style={{ font: '800 11px ui-monospace, Menlo, monospace', letterSpacing: '0.12em', color: COLOR.muted }}>{row.idx}</span>
                      <span style={{ fontSize: 'clamp(20px, 2vw, 28px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{row.big}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13.5, color: COLOR.body }}>{row.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 'none', borderTop: `2px solid ${COLOR.ink}`, background: '#ffffff' }}>
            <div style={{ maxWidth: 1280, margin: '0 auto', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ font: '700 9px ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: COLOR.muted, flex: 'none' }}>Scroll</span>
                <div style={{ flex: 1, height: 6, background: COLOR.hairline, border: `1px solid ${COLOR.hairline2}` }}><div style={{ height: '100%', width: `${Math.round(p1 * 100)}%`, background: COLOR.ink }} /></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: cta1p, transform: `translateY(${Math.round(14 * (1 - cta1p))}px)` }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>All three are one query away.</span>
                <button onClick={openProduct} style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 18px', background: COLOR.ink, color: '#ffffff', border: `2px solid ${COLOR.ink}`, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Open the product</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="grid" ref={ref2} style={{ position: 'relative', height: '320vh', borderBottom: `2px solid ${COLOR.ink}`, background: COLOR.ink, color: '#ffffff' }}>
        <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 'none', maxWidth: 1280, width: '100%', margin: '0 auto', padding: '18px 28px 0' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 8 }}>
              <span style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: COLOR.mutedDark }}>Where it burns</span>
              <span style={{ width: 22, height: 2, background: '#ffffff', display: 'block' }} />
              <span style={{ font: '700 10px ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#ffffff' }}>{phase2}</span>
            </div>
            <h2 style={{ margin: 0, fontSize: 'clamp(19px, 2.2vw, 30px)', letterSpacing: '-0.025em', maxWidth: '30ch', color: '#ffffff' }}>The same thousand kilowatt-hours, billed by two different skies.</h2>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 'clamp(30px, 8vw, 110px)', maxWidth: 1280, width: '100%', margin: '0 auto', padding: '16px 28px' }}>
            <div style={{ flex: 1, maxWidth: 260, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 4, minHeight: 0 }}>
                {bricksA.map((b, i) => <span key={i} style={{ display: 'block', height: 'clamp(8px, 1.5vh, 14px)', background: '#ffffff', opacity: b.o, transform: `translateY(${b.dy}px)` }} />)}
              </div>
              <div style={{ borderTop: '2px solid #ffffff', paddingTop: 10 }}>
                <span style={{ display: 'block', font: '700 9px ui-monospace, Menlo, monospace', letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.mutedDark, marginBottom: 4 }}>Mumbai grid</span>
                <span style={{ display: 'block', fontSize: 'clamp(26px, 3.4vw, 46px)', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1, color: '#ffffff' }}>{inr(850 * fill)}</span>
                <span style={{ display: 'block', fontSize: 11, color: COLOR.mutedDark, marginTop: 4 }}>kg CO₂ per 1,000 kWh</span>
              </div>
            </div>

            <div style={{ flex: 'none', alignSelf: 'center', textAlign: 'center', opacity: ratioP, transform: `scale(${(0.72 + 0.28 * ratioP).toFixed(3)})` }}>
              <span style={{ display: 'block', fontSize: 'clamp(34px, 6vw, 84px)', fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 0.9, color: '#ffffff' }}>88×</span>
              <span style={{ display: 'block', font: '700 9px ui-monospace, Menlo, monospace', letterSpacing: '0.16em', textTransform: 'uppercase', color: COLOR.mutedDark, marginTop: 8 }}>Apart</span>
            </div>

            <div style={{ flex: 1, maxWidth: 260, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 4, minHeight: 0 }}>
                {bricksB.map((b, i) => <span key={i} style={{ display: 'block', height: 'clamp(8px, 1.5vh, 14px)', background: '#ffffff', opacity: b.o, transform: `translateY(${b.dy}px)` }} />)}
              </div>
              <div style={{ borderTop: '2px solid #ffffff', paddingTop: 10 }}>
                <span style={{ display: 'block', font: '700 9px ui-monospace, Menlo, monospace', letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.mutedDark, marginBottom: 4 }}>Stockholm grid</span>
                <span style={{ display: 'block', fontSize: 'clamp(26px, 3.4vw, 46px)', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1, color: '#ffffff' }}>{inr(10 * clamp(fill * 1.2))}</span>
                <span style={{ display: 'block', fontSize: 11, color: COLOR.mutedDark, marginTop: 4 }}>kg CO₂ per 1,000 kWh</span>
              </div>
            </div>
          </div>

          <div style={{ flex: 'none', borderTop: `2px solid ${COLOR.inkSoft}` }}>
            <div style={{ maxWidth: 1280, margin: '0 auto', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ font: '700 9px ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: COLOR.mutedDark, flex: 'none' }}>Scroll</span>
                <div style={{ flex: 1, height: 6, background: COLOR.inkSoft }}><div style={{ height: '100%', width: `${Math.round(p2 * 100)}%`, background: '#ffffff' }} /></div>
              </div>
              <span style={{ fontSize: 12.5, color: COLOR.copyDark, opacity: ratioP }}>Move the workload, not the invoice.</span>
            </div>
          </div>
        </div>
      </section>

      <section id="queue" ref={ref3} style={{ position: 'relative', height: '340vh', borderBottom: `2px solid ${COLOR.ink}`, background: '#ffffff' }}>
        <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 'none', maxWidth: 1280, width: '100%', margin: '0 auto', padding: '18px 28px 0' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 8 }}>
              <span style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: COLOR.muted }}>What we do</span>
              <span style={{ width: 22, height: 2, background: COLOR.ink, display: 'block' }} />
              <span style={{ font: '700 10px ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: COLOR.ink }}>{phase3}</span>
            </div>
            <h2 style={{ margin: 0, fontSize: 'clamp(19px, 2.2vw, 30px)', letterSpacing: '-0.025em', maxWidth: '30ch' }}>A ranked queue. Scroll it and watch the waste strike itself out.</h2>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', maxWidth: 1280, width: '100%', margin: '0 auto', padding: '12px 28px' }}>
            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'clamp(20px, 4vw, 60px)', alignItems: 'center' }}>
              <div style={{ border: `2px solid ${COLOR.ink}`, minWidth: 0 }}>
                {queue.map((q) => (
                  <div key={q.idx} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: `1.5px solid ${COLOR.hairline}`, opacity: q.o }}>
                    <span style={{ flex: 'none', font: '700 9px ui-monospace, Menlo, monospace', letterSpacing: '0.1em', color: COLOR.muted }}>{q.idx}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.name}</span>
                    <span style={{ flex: 'none', fontSize: 12, color: COLOR.muted }}>{q.cpu}%</span>
                    <span style={{ flex: 'none', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{q.action}</span>
                    <span style={{ position: 'absolute', left: 0, top: '50%', height: 2, background: COLOR.ink, width: `${q.strike}%`, display: 'block' }} />
                  </div>
                ))}
              </div>

              <div style={{ minWidth: 0 }}>
                <span style={{ display: 'block', font: '700 9px ui-monospace, Menlo, monospace', letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 8 }}>Recovered, monthly — illustrative example</span>
                <span style={{ display: 'block', fontSize: 'clamp(34px, 4.6vw, 64px)', fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 0.95 }}>₹{inr(186420 * counted)}</span>
                <div style={{ height: 2, background: COLOR.ink, margin: '16px 0', width: `${Math.round(counted * 100)}%` }} />
                <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 4 }}>Spend</span>
                    <span style={{ display: 'block', fontSize: 'clamp(20px, 2vw, 28px)', fontWeight: 800, letterSpacing: '-0.03em' }}>−{Math.round(34 * counted)}%</span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.muted, marginBottom: 4 }}>Emissions</span>
                    <span style={{ display: 'block', fontSize: 'clamp(20px, 2vw, 28px)', fontWeight: 800, letterSpacing: '-0.03em' }}>−{Math.round(42 * counted)}%</span>
                  </div>
                </div>
                <p style={{ margin: '18px 0 0', fontSize: 13, color: COLOR.body, maxWidth: '34ch', opacity: cta3p }}>Nothing is applied until you approve it. Every action writes a log entry.</p>
              </div>
            </div>
          </div>

          <div style={{ flex: 'none', borderTop: `2px solid ${COLOR.ink}`, background: COLOR.canvas }}>
            <div style={{ maxWidth: 1280, margin: '0 auto', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ font: '700 9px ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: COLOR.muted, flex: 'none' }}>Scroll</span>
                <div style={{ flex: 1, height: 6, background: COLOR.hairline, border: `1px solid ${COLOR.hairline2}` }}><div style={{ height: '100%', width: `${Math.round(p3 * 100)}%`, background: COLOR.ink }} /></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: cta3p, transform: `translateY(${Math.round(12 * (1 - cta3p))}px)` }}>
                <button onClick={openProduct} style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 18px', background: COLOR.ink, color: '#ffffff', border: `2px solid ${COLOR.ink}`, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Run this on my fleet</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ background: COLOR.ink, color: '#ffffff', borderBottom: `2px solid ${COLOR.ink}` }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '60px 28px' }}>
          <h2 style={{ margin: '0 0 22px', fontSize: 'clamp(32px, 5vw, 62px)', lineHeight: 0.98, letterSpacing: '-0.04em', maxWidth: '20ch', color: '#ffffff' }}>Find the waste this month, not at the annual audit.</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={openProduct} style={{ display: 'inline-flex', alignItems: 'center', padding: '16px 26px', background: '#ffffff', color: COLOR.ink, border: '2px solid #ffffff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>Open the product</button>
            <button onClick={() => setLeadModalOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', padding: '16px 26px', background: 'transparent', color: '#ffffff', border: '2px solid #4a4a45', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>Book a walkthrough</button>
          </div>
        </div>
      </section>

      <footer style={{ background: COLOR.ink, color: '#ffffff', borderTop: `1px solid ${COLOR.inkSoft}` }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '22px 28px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <span style={{ width: 16, height: 16, background: '#ffffff', display: 'block', flex: 'none' }} />
          <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '0.06em' }}>ECOCOMPUTE</span>
          <span style={{ fontSize: 11.5, color: COLOR.mutedDark, marginLeft: 'auto' }}>Figures from a twelve-instance sample fleet across real AWS regions · grid factors are approximate country-level averages</span>
        </div>
      </footer>

      <LeadCaptureModal open={leadModalOpen} onClose={() => setLeadModalOpen(false)} />
    </div>
  );
};

export default Landing;
