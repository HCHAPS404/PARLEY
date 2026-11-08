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
