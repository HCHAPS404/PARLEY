/**
 * Animated slides — real HTML/CSS motion graphics rendered at 1920×1080 and
 * captured with the same screencast recorder as the app takes, so slides and
 * product footage share one look, one resolution and one frame cadence.
 * Every animation starts when <body> gets `.go` (i.e. once recording runs).
 */
const MARK = (size, a = "#2dd4bf", b = "#2dd4bf") => `
<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none">
  <path d="M4 6h12a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-5l-5 4v-4H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" fill="${a}"/>
  <path d="M28 12h-8a3 3 0 0 0-3 3v3a3 3 0 0 0 3 3h3l4 3v-3h1a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2Z" fill="${b}" opacity=".45"/>
</svg>`;

const CHECK = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

const BASE = (T) => `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500&display=block" rel="stylesheet">
<style>
  :root { --T: ${T}s; --teal:#2dd4bf; --teal2:#5eead4; --ink:#eef4f2; --mute:#8fa39d; --line:rgba(255,255,255,.08); }
  * { box-sizing:border-box; margin:0; padding:0 }
  html,body { width:1920px; height:1080px; overflow:hidden; background:#05090a; color:var(--ink);
    font-family:Inter,system-ui,sans-serif; -webkit-font-smoothing:antialiased }
  .stage { position:absolute; inset:0; overflow:hidden }
  .cam { position:absolute; inset:0; transform-origin:50% 50% }
  .go .cam { animation: drift var(--T) linear forwards }
  @keyframes drift { from { transform: scale(1) } to { transform: scale(1.035) } }
  .bg::before, .bg::after { content:""; position:absolute; border-radius:50%; filter:blur(110px); opacity:.55 }
  .bg::before { width:900px; height:900px; left:58%; top:-30%; background:radial-gradient(circle, rgba(45,212,191,.33), transparent 65%) }
  .bg::after  { width:800px; height:800px; left:-12%; top:52%; background:radial-gradient(circle, rgba(20,184,166,.22), transparent 65%) }
  .go .bg::before { animation: orbA var(--T) ease-in-out forwards }
  .go .bg::after  { animation: orbB var(--T) ease-in-out forwards }
  @keyframes orbA { to { transform: translate(-120px, 80px) } }
  @keyframes orbB { to { transform: translate(140px, -60px) } }
  .grid { position:absolute; inset:0; background-image:
      linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px);
    background-size: 64px 64px; mask-image: radial-gradient(ellipse 70% 60% at 50% 45%, #000 20%, transparent 75%); opacity:.55 }
  .grain { position:absolute; inset:-50%; opacity:.06; pointer-events:none;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>") }
  .content { position:absolute; inset:0; padding:0 150px; display:flex; flex-direction:column; justify-content:center }
  .in { opacity:0; transform: translateY(26px); filter: blur(10px) }
  .go .in { animation: rise .95s cubic-bezier(.2,.85,.2,1) forwards; animation-delay: var(--d, 0s) }
  @keyframes rise { to { opacity:1; transform:none; filter:none } }
  .pop { opacity:0; transform: scale(.86) }
  .go .pop { animation: pop .7s cubic-bezier(.2,1.25,.3,1) forwards; animation-delay: var(--d, 0s) }
  @keyframes pop { to { opacity:1; transform:none } }
  .eyebrow { font: 600 20px/1 "JetBrains Mono", monospace; letter-spacing:.22em; color:var(--teal); text-transform:uppercase }
  h1 { font-family:"Space Grotesk"; font-weight:700; letter-spacing:-.035em; line-height:1.02; font-size:118px; margin-top:26px }
  h1 em { font-style:normal; color:var(--teal) }
  .sub { margin-top:30px; font-size:34px; color:var(--mute); line-height:1.4; font-weight:500 }
  .bar { position:absolute; left:150px; bottom:84px; height:6px; width:0; border-radius:4px; background:var(--teal) }
  .go .bar { animation: barw 1.1s .5s cubic-bezier(.2,.8,.2,1) forwards }
  @keyframes barw { to { width:92px } }
  .brand { position:absolute; left:150px; top:70px; display:flex; align-items:center; gap:14px; font:600 26px "Space Grotesk"; color:#cfe9e3 }
  .card { background:linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.025)); border:1px solid rgba(255,255,255,.09);
    border-radius:22px; backdrop-filter: blur(6px); box-shadow: 0 30px 80px rgba(0,0,0,.35) }
</style>`;

const shell = (T, body, brand = true) => `<!doctype html><html><head><meta charset="utf-8">${BASE(T)}</head>
<body><div class="stage"><div class="cam"><div class="bg" style="position:absolute;inset:0"></div><div class="grid"></div>
${body}</div><div class="grain"></div>
${brand ? `<div class="brand in" style="--d:.1s">${MARK(34)} Parley</div>` : ""}
<div class="bar"></div></div></body></html>`;

const SLIDES = {
  hook: (T) => shell(T, `
  <div class="content" style="flex-direction:row;align-items:center;gap:90px">
    <div style="flex:1.15">
      <div class="eyebrow in" style="--d:.15s">The problem</div>
      <h1 class="in" style="--d:.35s">Every supply order<br><em>leaks margin.</em></h1>
      <div class="sub in" style="--d:1.0s">No time to compare vendors.<br>No leverage to negotiate.</div>
    </div>
    <div style="flex:.85;position:relative;height:560px">
      ${[
        ["Vendor A", "$44.00", 0, 1.3, ""],
        ["Vendor B", "$42.00", 1, 1.6, ""],
        ["Vendor C", "$46.50", 2, 1.9, ""],
      ].map(([v, p, i, d]) => `
        <div class="card pop" style="--d:${d}s;position:absolute;left:${i * 34}px;top:${60 + i * 150}px;width:560px;padding:30px 34px;display:flex;align-items:center;gap:24px">
          <div style="width:62px;height:62px;border-radius:14px;background:rgba(45,212,191,.12);display:grid;place-items:center;font:600 26px 'Space Grotesk';color:var(--teal)">${String.fromCharCode(65 + i)}</div>
          <div style="flex:1"><div style="font:600 26px 'Space Grotesk'">Kraft mailer box ×50</div><div style="font-size:20px;color:var(--mute);margin-top:4px">${v} · list price</div></div>
          <div style="font:700 34px 'Space Grotesk'">${p}</div>
        </div>`).join("")}
      <div class="pop" style="--d:2.6s;position:absolute;right:10px;top:0;padding:12px 20px;border-radius:999px;background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.35);color:#fbbf24;font:600 20px Inter">You pay list. Every time.</div>
    </div>
  </div>`),

  intro: (T) => shell(T, `
  <div class="content" style="align-items:center;text-align:center">
    <div class="pop" style="--d:.15s;filter:drop-shadow(0 0 60px rgba(45,212,191,.45))">${MARK(150)}</div>
    <h1 class="in" style="--d:.45s;font-size:150px;margin-top:30px">Parley</h1>
    <div class="sub in" style="--d:.85s;margin-top:14px;font-size:36px">procurement that negotiates</div>
    <div style="display:flex;gap:26px;margin-top:70px;align-items:center">
      ${[["01", "Finds real products"], ["02", "Negotiates agent-to-agent"], ["03", "Pays through PayPal escrow"]]
        .map(([n, s], i) => `${i ? `<div class="in" style="--d:${1.5 + i * 0.75}s;width:46px;height:2px;background:linear-gradient(90deg,transparent,var(--teal))"></div>` : ""}
        <div class="card pop" style="--d:${1.6 + i * 0.75}s;padding:22px 30px;display:flex;align-items:center;gap:16px">
          <span style="font:600 18px 'JetBrains Mono';color:var(--teal)">${n}</span>
          <span style="font:600 27px 'Space Grotesk'">${s}</span></div>`).join("")}
    </div>
  </div>`, false),

  trust: (T) => shell(T, `
  <div class="content" style="flex-direction:row;align-items:center;gap:80px">
    <div style="flex:1">
      <div class="eyebrow in" style="--d:.15s">Security by design</div>
      <h1 class="in" style="--d:.35s">The model never<br><em>sets the price.</em></h1>
      <div class="card in" style="--d:1.0s;margin-top:44px;padding:26px 30px;font:500 21px/1.7 'JetBrains Mono';color:#a7c4bd">
        <span style="color:#64748b">// create_escrow_order — server side</span><br>
        price = <span style="color:var(--teal2)">negotiations</span>[id].agreedCents<br>
        <span style="color:#64748b">// the LLM only selects ids</span><br>
        <span style="color:#f472b6">await</span> checkPolicy(order) <span style="color:#64748b">// cannot be bypassed</span>
      </div>
    </div>
    <div style="flex:.95;display:grid;gap:20px">
      ${[
        ["Prices resolved server-side", "Never typed by the model"],
        ["Seller floor enforced in code", "The merchant agent can't go below it"],
        ["Your spend policy gates every order", "Per-order, daily and monthly caps"],
        ["You approve every payment", "On PayPal — the agent never sees credentials"],
      ].map(([a, b], i) => `
        <div class="card in" style="--d:${1.3 + i * 0.45}s;padding:26px 30px;display:flex;gap:20px;align-items:center">
          <div style="width:46px;height:46px;border-radius:12px;background:rgba(45,212,191,.12);display:grid;place-items:center;flex:none">${CHECK}</div>
          <div><div style="font:600 27px 'Space Grotesk'">${a}</div><div style="font-size:20px;color:var(--mute);margin-top:3px">${b}</div></div>
        </div>`).join("")}
    </div>
  </div>`),

  escrow: (T) => shell(T, `
  <style>
    .rail { position:absolute; left:0; top:59px; height:4px; width:0; background:linear-gradient(90deg,var(--teal),var(--teal2)); border-radius:4px; box-shadow:0 0 24px rgba(45,212,191,.6) }
    .go .rail { animation: railw calc(var(--T) * .62) 1.2s cubic-bezier(.45,.05,.3,1) forwards }
    @keyframes railw { to { width:100% } }
    .node { width:122px; height:122px; border-radius:50%; display:grid; place-items:center; margin:0 auto;
      background:#0b1413; border:3px solid rgba(255,255,255,.12); font:700 40px 'Space Grotesk'; color:#55706a; transition:none }
    .go .node { animation: lit .5s forwards; animation-delay: var(--d) }
    @keyframes lit { to { border-color:var(--teal); color:#05090a; background:var(--teal); box-shadow:0 0 50px rgba(45,212,191,.55) } }
  </style>
  <div class="content">
    <div class="eyebrow in" style="--d:.15s">Agentic escrow · PayPal Orders v2</div>
    <h1 class="in" style="--d:.35s">Authorized. <em>Not captured.</em></h1>
    <div style="position:relative;margin-top:90px;width:100%">
      <div style="position:absolute;left:8%;right:8%;top:0;height:122px">
        <div style="position:absolute;left:0;right:0;top:59px;height:4px;background:rgba(255,255,255,.08);border-radius:4px"></div>
        <div class="rail"></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);position:relative">
        ${[
          ["1", "Authorize", "Buyer approves on PayPal —<br>funds are held, not moved"],
          ["2", "Ship", "Tracking syncs into<br>the pipeline automatically"],
          ["3", "Deliver", "Delivery is confirmed<br>by carrier or buyer"],
          ["4", "Capture", "Only now is the<br>seller paid"],
        ].map(([n, a, b], i) => `
          <div style="text-align:center">
            <div class="node" style="--d:calc(1.2s + var(--T) * .62 * ${i / 3})">${n}</div>
            <div class="in" style="--d:${0.9 + i * 0.25}s;font:600 34px 'Space Grotesk';margin-top:28px">${a}</div>
            <div class="in" style="--d:${1.0 + i * 0.25}s;font-size:21px;color:var(--mute);margin-top:10px;line-height:1.45">${b}</div>
          </div>`).join("")}
      </div>
      <div class="pop" style="--d:calc(var(--T) * .7);margin:56px auto 0;width:fit-content;padding:16px 28px;border-radius:999px;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.35);color:#fcd34d;font:600 23px Inter">
        Something wrong? &nbsp;→&nbsp; the authorization is voided and the funds go back
      </div>
    </div>
  </div>`),

  seller: (T) => shell(T, `
  <div class="content" style="align-items:center;text-align:center">
    <div class="eyebrow in" style="--d:.05s">The other side of the deal</div>
    <h1 class="in" style="--d:.2s;font-size:136px">Sellers get <em>an agent too.</em></h1>
    <div style="display:flex;gap:18px;margin-top:64px;justify-content:center">
      ${["Price floors", "Campaigns", "CRM & targeted offers", "Negotiates 24/7"].map((s, i) => `
        <div class="card pop" style="--d:${0.55 + i * 0.18}s;padding:18px 28px;font:600 26px 'Space Grotesk'">${s}</div>`).join("")}
    </div>
  </div>`),

  close: (T) => shell(T, `
  <div class="content" style="align-items:center;text-align:center">
    <div class="pop" style="--d:.1s;filter:drop-shadow(0 0 70px rgba(45,212,191,.5))">${MARK(132)}</div>
    <h1 class="in" style="--d:.35s;font-size:160px;margin-top:22px">Parley</h1>
    <div class="sub in" style="--d:.75s;margin-top:10px;font-size:38px;color:#cfe9e3">Your agent negotiates. PayPal protects the money.<br>You stay in control.</div>
    <div class="pop" style="--d:1.5s;margin-top:56px;padding:18px 34px;border-radius:999px;background:rgba(45,212,191,.12);border:1px solid rgba(45,212,191,.4);font:600 30px 'JetBrains Mono';color:var(--teal2)">parley-wt1k.onrender.com/demo</div>
    <div class="in" style="--d:2.0s;margin-top:28px;font-size:22px;color:var(--mute)">Try it now — buyer <b style="color:#cfe9e3">buyer1</b> · seller <b style="color:#cfe9e3">seller1</b> · password <b style="color:#cfe9e3">ParleyJudgeDemo26</b></div>
    <div class="in" style="--d:2.5s;position:absolute;bottom:70px;left:0;right:0;font:500 19px 'JetBrains Mono';letter-spacing:.08em;color:#5b7570">
      PAYPAL ORDERS V2 · PAYPAL AGENT TOOLKIT · VERCEL AI SDK · CHANNEL3 · NEON POSTGRES</div>
  </div>`, false),
};

export function slideHtml(id, seconds) {
  const f = SLIDES[id];
  if (!f) throw new Error(`unknown slide ${id}`);
  return f(seconds);
}
