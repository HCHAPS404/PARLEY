export type Lang = "en" | "es";
export const LANGS: Lang[] = ["en", "es"];
export const LANG_COOKIE = "parley_lang";
export const DEFAULT_LANG: Lang = "en";

const en = {
  "app.tagline": "procurement that negotiates",
  "app.flow": "find · negotiate · escrow · audit",

  "nav.agent": "Agent",
  "nav.analytics": "Analytics",
  "nav.pipeline": "Pipeline",
  "nav.settings": "Settings",
  "nav.signOut": "Sign out",

  "sidebar.escrow": "Agentic escrow — held until delivery",
  "sidebar.sandbox": "PayPal sandbox — no real money",
  "sidebar.audit": "Every action audited",
  "sidebar.sandboxBadge": "sandbox",

  "chat.placeholder":
    'Try "find a USB microphone under $80" or "negotiate the second one"',
  "chat.footer":
    "Funds are authorized, never auto-captured — every purchase ends with your approval on PayPal.",
  "chat.send": "Send",
  "chat.thinking": "Working…",
  "chat.ready": "ready",
  "chat.working": "working",
  "chat.bannerAuthorized":
    "Payment approved — funds held in escrow for order {order}. Ask the agent to confirm delivery.",
  "chat.bannerCancelled": "PayPal approval cancelled — nothing was held.",
  "chat.bannerError": "Something went wrong during approval ({error}).",
  "chat.dismiss": "Dismiss",

  "empty.title": "What should we buy?",
  "empty.subtitle":
    "I search real products, negotiate with merchant agents, and hold payment in escrow until you confirm delivery.",
  "empty.chip1": "Find a mechanical keyboard under $120",
  "empty.chip2": "Compare standing desks for my studio",
  "empty.chip3": "Show my open orders",
  "empty.chip4": "What can you do?",

  "login.title": "Sign in to Parley",
  "login.subtitle": "Procurement that negotiates — and holds your money until goods arrive.",
  "login.email": "Email",
  "login.username": "Username",
  "login.password": "Password",
  "login.signIn": "Sign in",
  "login.createAccount": "Create account",
  "login.noAccount": "New here? Create an account",
  "login.hasAccount": "Already have an account? Sign in",
  "login.demoNote":
    "Public accounts are demo users — they can search and negotiate, but cannot move funds.",
  "login.working": "Working…",

  "settings.title": "Settings",
  "settings.subtitle": "Your account, preferences, and spending controls.",
  "settings.profile": "Profile",
  "settings.profile.user": "Signed in as {user}",
  "settings.profile.role": "Role",
  "settings.language": "Language",
  "settings.language.note": "Interface language. English is the reference language.",
  "settings.appearance": "Appearance",
  "settings.appearance.light": "Light",
  "settings.appearance.dark": "Dark",
  "settings.appearance.system": "System",
  "settings.policy": "Spend policy",
  "settings.policy.note":
    "Deterministic controls the agent can never bypass — the agent proposes, this policy disposes.",
  "settings.policy.maxPerTx": "Max per transaction",
  "settings.policy.daily": "Daily cap",
  "settings.policy.monthly": "Monthly cap",
  "settings.policy.autonomous": "Autonomous limit",
  "settings.policy.autonomousHint":
    "Above this amount a human must always approve on PayPal.",
  "settings.policy.vendors": "Allowed vendors",
  "settings.policy.vendorsHint": "Comma-separated. Empty means all vendors allowed.",
  "settings.policy.active": "Policy active",
  "settings.policy.adminOnly": "Only admin accounts can edit the spend policy.",
  "settings.save": "Save changes",
  "settings.saved": "Saved",
  "settings.saving": "Saving…",
  "settings.session": "Session",
  "settings.session.signOut": "Sign out of this device",
  "settings.session.signOutBtn": "Sign out",

  "land.nav.product": "How it works",
  "land.nav.security": "Security",
  "land.nav.stack": "Stack",
  "land.nav.signIn": "Sign in",
  "land.nav.getStarted": "Get started",
  "land.nav.openApp": "Open app",

  "land.hero.kicker": "Agentic procurement · PayPal AI Hackathon",
  "land.hero.title": "Procurement that negotiates. Payment that waits.",
  "land.hero.sub":
    "Parley is the procurement department solopreneurs can't afford: an AI agent that finds real products, haggles with merchant agents, and pays through PayPal escrow — your money only moves when the goods arrive.",
  "land.hero.cta": "Start procuring",
  "land.hero.ctaSecondary": "See how it works",
  "land.hero.escrowCaption": "Live escrow lifecycle — authorize, hold, release",

  "land.steps.created": "Order created",
  "land.steps.createdSub": "policy-checked",
  "land.steps.authorized": "Funds authorized",
  "land.steps.authorizedSub": "held, not charged",
  "land.steps.held": "Escrow hold",
  "land.steps.heldSub": "watchdog monitoring",
  "land.steps.captured": "Captured",
  "land.steps.capturedSub": "delivery confirmed",
  "land.steps.voided": "Voided",
  "land.steps.voidedSub": "funds returned",

  "land.trust": "Built on production-grade rails",

  "land.how.title": "How Parley works",
  "land.how.sub": "Four stages, one guarantee: money never moves on a promise.",
  "land.how.discover.t": "Discover",
  "land.how.discover.d":
    "Searches a live catalog of 100M+ real products via Channel3 — prices, merchants and offers, ranked by learned vendor reputation.",
  "land.how.negotiate.t": "Negotiate",
  "land.how.negotiate.d":
    "Agent-to-agent bargaining with the merchant's agent — up to 4 rounds. Accepts, counters, or walks away, and the transcript is yours.",
  "land.how.escrow.t": "Escrow",
  "land.how.escrow.d":
    "Creates a PayPal AUTHORIZE order — funds held, never captured. You approve on PayPal; the agent never touches credentials.",
  "land.how.watch.t": "Watch",
  "land.how.watch.d":
    "A watchdog runs every 15 minutes: reconciles PayPal state, flags authorizations nearing expiry, and surfaces delivery problems.",

  "land.sec.title": "An agent allowed to touch money",
  "land.sec.sub":
    "The model proposes — deterministic code disposes. These guarantees live in code, not in the prompt.",
  "land.sec.policy.t": "Deterministic spend policy",
  "land.sec.policy.d":
    "Per-transaction, daily and monthly caps plus vendor allowlists gate every order — editable live in Settings, unbypassable by the agent.",
  "land.sec.human.t": "Human approves every payment",
  "land.sec.human.d":
    "Every purchase ends with your manual approval on PayPal. The agent holds no cards, no credentials, no way to skip you.",
  "land.sec.price.t": "Prices resolved server-side",
  "land.sec.price.d":
    "The model selects product ids — it can never invent an amount. Order totals come from verified catalog and negotiation state.",
  "land.sec.audit.t": "Append-only audit trail",
  "land.sec.audit.d":
    "Every search, quote, order, capture and void lands in an immutable log with actor, rationale and token cost — inspectable in real time.",
  "land.sec.roles.t": "Admin / demo isolation",
  "land.sec.roles.d":
    "Public signups become demo users: search and negotiate freely, but fund movement is disabled at the tool level — audited as demo_spend_blocked.",
  "land.sec.watch.t": "Escrow watchdog",
  "land.sec.watch.d":
    "Holds don't silently expire: a scheduled job reconciles PayPal truth into local state and alerts before any authorization lapses.",

  "land.split.title": "AUTHORIZE today, CAPTURE on delivery",
  "land.split.p1":
    "Every checkout uses intent=AUTHORIZE — PayPal holds the funds without charging you. Two exits exist, and only you choose:",
  "land.split.capture.t": "Goods arrive → capture",
  "land.split.capture.d":
    "Delivery confirmed — the hold releases to the seller and vendor reputation rises.",
  "land.split.void.t": "Goods never arrive → void",
  "land.split.void.d":
    "The authorization is voided — funds return untouched and the vendor's score drops.",
  "land.split.note":
    "Verified end-to-end on the PayPal sandbox — real API calls, real holds, zero real money.",

  "land.footer.built": "Built for the PayPal AI Hackathon",
  "land.footer.tagline": "Procurement that negotiates — money that waits.",

  "common.loading": "Loading…",
  "common.error": "Something went wrong",
  "common.cancel": "Cancel",
  "common.back": "Back",
  "common.admin": "admin",
  "common.demo": "demo",
} as const;

export type I18nKey = keyof typeof en;

const es: Record<I18nKey, string> = {
  "app.tagline": "procurement que negocia",
  "app.flow": "busca · negocia · escrow · audita",

  "nav.agent": "Agente",
  "nav.analytics": "Analítica",
  "nav.pipeline": "Pipeline",
  "nav.settings": "Ajustes",
  "nav.signOut": "Cerrar sesión",

  "sidebar.escrow": "Escrow agéntico — retenido hasta la entrega",
  "sidebar.sandbox": "PayPal sandbox — sin dinero real",
  "sidebar.audit": "Cada acción queda auditada",
  "sidebar.sandboxBadge": "sandbox",

  "chat.placeholder":
    'Prueba "busca un micrófono USB por menos de $80" o "negocia el segundo"',
  "chat.footer":
    "Los fondos se autorizan, nunca se capturan solos — cada compra termina con tu aprobación en PayPal.",
  "chat.send": "Enviar",
  "chat.thinking": "Trabajando…",
  "chat.ready": "listo",
  "chat.working": "trabajando",
  "chat.bannerAuthorized":
    "Pago aprobado — fondos retenidos en escrow para la orden {order}. Pídele al agente confirmar la entrega.",
  "chat.bannerCancelled": "Aprobación de PayPal cancelada — no se retuvo nada.",
  "chat.bannerError": "Algo falló durante la aprobación ({error}).",
  "chat.dismiss": "Descartar",

  "empty.title": "¿Qué compramos hoy?",
  "empty.subtitle":
    "Busco productos reales, negocio con agentes vendedores y retengo el pago en escrow hasta que confirmes la entrega.",
  "empty.chip1": "Busca un teclado mecánico por menos de $120",
  "empty.chip2": "Compara escritorios ajustables para mi estudio",
  "empty.chip3": "Muéstrame mis órdenes abiertas",
  "empty.chip4": "¿Qué puedes hacer?",

  "login.title": "Entra a Parley",
  "login.subtitle": "Procurement que negocia — y retiene tu dinero hasta que llegue la mercancía.",
  "login.email": "Correo",
  "login.username": "Usuario",
  "login.password": "Contraseña",
  "login.signIn": "Entrar",
  "login.createAccount": "Crear cuenta",
  "login.noAccount": "¿Nuevo aquí? Crea una cuenta",
  "login.hasAccount": "¿Ya tienes cuenta? Entra",
  "login.demoNote":
    "Las cuentas públicas son demo — pueden buscar y negociar, pero no mueven fondos.",
  "login.working": "Un momento…",

  "settings.title": "Ajustes",
  "settings.subtitle": "Tu cuenta, preferencias y controles de gasto.",
  "settings.profile": "Perfil",
  "settings.profile.user": "Sesión como {user}",
  "settings.profile.role": "Rol",
  "settings.language": "Idioma",
  "settings.language.note": "Idioma de la interfaz. El inglés es el idioma de referencia.",
  "settings.appearance": "Apariencia",
  "settings.appearance.light": "Claro",
  "settings.appearance.dark": "Oscuro",
  "settings.appearance.system": "Sistema",
  "settings.policy": "Política de gasto",
  "settings.policy.note":
    "Controles deterministas que el agente jamás puede saltarse — el agente propone, esta política dispone.",
  "settings.policy.maxPerTx": "Máximo por transacción",
  "settings.policy.daily": "Tope diario",
  "settings.policy.monthly": "Tope mensual",
  "settings.policy.autonomous": "Límite autónomo",
  "settings.policy.autonomousHint":
    "Por encima de este monto un humano siempre debe aprobar en PayPal.",
  "settings.policy.vendors": "Vendedores permitidos",
  "settings.policy.vendorsHint": "Separados por coma. Vacío permite todos.",
  "settings.policy.active": "Política activa",
  "settings.policy.adminOnly": "Solo cuentas admin pueden editar la política de gasto.",
  "settings.save": "Guardar cambios",
  "settings.saved": "Guardado",
  "settings.saving": "Guardando…",
  "settings.session": "Sesión",
  "settings.session.signOut": "Cerrar sesión en este dispositivo",
  "settings.session.signOutBtn": "Cerrar sesión",

  "land.nav.product": "Cómo funciona",
  "land.nav.security": "Seguridad",
  "land.nav.stack": "Stack",
  "land.nav.signIn": "Entrar",
  "land.nav.getStarted": "Crear cuenta",
  "land.nav.openApp": "Abrir la app",

  "land.hero.kicker": "Procurement agéntico · PayPal AI Hackathon",
  "land.hero.title": "Procurement que negocia. Dinero que espera.",
  "land.hero.sub":
    "Parley es el departamento de compras que un solopreneur no puede pagar: un agente de IA que encuentra productos reales, regatea con agentes vendedores y paga por escrow en PayPal — tu dinero solo se mueve cuando llega la mercancía.",
  "land.hero.cta": "Empezar a comprar",
  "land.hero.ctaSecondary": "Ver cómo funciona",
  "land.hero.escrowCaption": "Ciclo de escrow en vivo — autoriza, retiene, libera",

  "land.steps.created": "Orden creada",
  "land.steps.createdSub": "aprobada por política",
  "land.steps.authorized": "Fondos autorizados",
  "land.steps.authorizedSub": "retenidos, no cobrados",
  "land.steps.held": "Escrow activo",
  "land.steps.heldSub": "watchdog vigilando",
  "land.steps.captured": "Capturado",
  "land.steps.capturedSub": "entrega confirmada",
  "land.steps.voided": "Anulado",
  "land.steps.voidedSub": "fondos devueltos",

  "land.trust": "Construido sobre raíles de producción",

  "land.how.title": "Cómo funciona Parley",
  "land.how.sub": "Cuatro etapas, una garantía: el dinero nunca se mueve sobre una promesa.",
  "land.how.discover.t": "Descubre",
  "land.how.discover.d":
    "Busca en un catálogo vivo de más de 100M productos reales vía Channel3 — precios, vendedores y ofertas, ordenados por reputación aprendida.",
  "land.how.negotiate.t": "Negocia",
  "land.how.negotiate.d":
    "Regateo agente-a-agente con el agente del vendedor — hasta 4 rondas. Acepta, contraoferta o se retira, y la transcripción es tuya.",
  "land.how.escrow.t": "Escrow",
  "land.how.escrow.d":
    "Crea una orden PayPal tipo AUTHORIZE — fondos retenidos, nunca cobrados. Tú apruebas en PayPal; el agente jamás toca credenciales.",
  "land.how.watch.t": "Vigila",
  "land.how.watch.d":
    "Un watchdog corre cada 15 minutos: reconcilia el estado de PayPal, marca autorizaciones por expirar y saca a la luz problemas de entrega.",

  "land.sec.title": "Un agente con permiso de tocar dinero",
  "land.sec.sub":
    "El modelo propone — el código determinista dispone. Estas garantías viven en código, no en el prompt.",
  "land.sec.policy.t": "Política de gasto determinista",
  "land.sec.policy.d":
    "Topes por transacción, día y mes, más listas de vendedores permitidos — editables en vivo en Ajustes, insaltables para el agente.",
  "land.sec.human.t": "Un humano aprueba cada pago",
  "land.sec.human.d":
    "Cada compra termina con tu aprobación manual en PayPal. El agente no guarda tarjetas ni credenciales ni modo de saltarte.",
  "land.sec.price.t": "Precios resueltos en el servidor",
  "land.sec.price.d":
    "El modelo selecciona ids de producto — jamás puede inventar un monto. Los totales salen del catálogo y la negociación verificados.",
  "land.sec.audit.t": "Auditoría append-only",
  "land.sec.audit.d":
    "Cada búsqueda, cotización, orden, capture y void cae en un log inmutable con actor, razón y costo de tokens — inspeccionable en vivo.",
  "land.sec.roles.t": "Aislamiento admin / demo",
  "land.sec.roles.d":
    "Los registros públicos son demo: buscan y negocian libre, pero el movimiento de fondos está apagado a nivel de herramienta — auditado como demo_spend_blocked.",
  "land.sec.watch.t": "Watchdog de escrow",
  "land.sec.watch.d":
    "Los holds no expiran en silencio: un trabajo programado reconcilia la verdad de PayPal al estado local y alerta antes de que una autorización caduque.",

  "land.split.title": "AUTHORIZE hoy, CAPTURE al entregar",
  "land.split.p1":
    "Cada checkout usa intent=AUTHORIZE — PayPal retiene los fondos sin cobrarte. Existen dos salidas, y solo tú eliges:",
  "land.split.capture.t": "Llegó → capture",
  "land.split.capture.d":
    "Entrega confirmada — el hold se libera al vendedor y su reputación sube.",
  "land.split.void.t": "No llegó → void",
  "land.split.void.d":
    "Se anula la autorización — los fondos vuelven intactos y el score del vendedor baja.",
  "land.split.note":
    "Verificado end-to-end en el sandbox de PayPal — llamadas reales, holds reales, cero dinero real.",

  "land.footer.built": "Construido para el PayPal AI Hackathon",
  "land.footer.tagline": "Procurement que negocia — dinero que espera.",

  "common.loading": "Cargando…",
  "common.error": "Algo salió mal",
  "common.cancel": "Cancelar",
  "common.back": "Volver",
  "common.admin": "admin",
  "common.demo": "demo",
};

export const DICTS: Record<Lang, Record<I18nKey, string>> = { en, es };

export function translate(lang: Lang, key: I18nKey, vars?: Record<string, string>) {
  let s: string = DICTS[lang][key] ?? en[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}
