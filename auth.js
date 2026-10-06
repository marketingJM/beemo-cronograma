// Acceso al cronograma: Google o correo+contraseña, solo para correos autorizados por un administrador.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  sendPasswordResetEmail, sendEmailVerification, createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const gate = $("gate"), gForm = $("g-form"), gMsg = $("g-msg");

function msg(html, kind = "", acciones = []) {
  gMsg.className = "gmsg" + (kind ? " is-" + kind : "");
  gMsg.innerHTML = html;
  if (acciones.length) {
    const box = document.createElement("div");
    box.className = "acts";
    acciones.forEach(([texto, fn]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn"; b.textContent = texto; b.onclick = fn;
      box.appendChild(b);
    });
    gMsg.appendChild(box);
  }
  gMsg.hidden = false;
}
function limpiarMsg() { gMsg.hidden = true; gMsg.innerHTML = ""; }
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

if (!firebaseConfig || !firebaseConfig.apiKey || /PEGA/.test(firebaseConfig.apiKey)) {
  gForm.hidden = true;
  msg("Falta conectar Firebase: pega los datos de tu proyecto en <b>firebase-config.js</b>.", "err");
  throw new Error("firebase-config.js sin configurar");
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
auth.languageCode = "es";

let perfil = null;
let correoActual = "";

// ---------- datos para la página ----------
// Vista pública: el enlace lleva ?ver=CLAVE y lee la copia pública sin iniciar sesión.
const VISTA = new URLSearchParams(location.search).get("ver");
window.BeemoData = {
  async get() {
    const ref = VISTA ? doc(db, "publico", VISTA) : doc(db, "datos", "cronograma");
    const s = await getDoc(ref);
    if (!s.exists()) return { csv: "" };
    const d = s.data();
    let nota = "";
    if (d.actualizado && d.actualizado.toDate) {
      nota = "cargado el " + d.actualizado.toDate().toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
    }
    return { csv: d.csv || "", nota };
  }
};

// ---------- inicio de sesión ----------
const errores = {
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/wrong-password": "Correo o contraseña incorrectos.",
  "auth/user-not-found": "Correo o contraseña incorrectos.",
  "auth/invalid-email": "Ese correo no es válido.",
  "auth/too-many-requests": "Demasiados intentos. Espera unos minutos o restablece tu contraseña.",
  "auth/popup-closed-by-user": "Cerraste la ventana de Google antes de terminar.",
  "auth/popup-blocked": "El navegador bloqueó la ventana de Google. Permite ventanas emergentes para esta página.",
  "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).",
  "auth/network-request-failed": "Sin conexión. Revisa tu internet."
};
const textoError = (e) => errores[e && e.code] || "No se pudo completar. (" + (e && e.code || "error") + ")";

$("g-google").onclick = async () => {
  limpiarMsg();
  try {
    const p = new GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, p);
  } catch (e) { msg(textoError(e), "err"); }
};

async function entrarConClave() {
  limpiarMsg();
  const correo = $("g-mail").value.trim(), clave = $("g-pass").value;
  if (!correo || !clave) { msg("Escribe tu correo y tu contraseña.", "err"); return; }
  try { await signInWithEmailAndPassword(auth, correo, clave); }
  catch (e) { msg(textoError(e), "err"); }
}
$("g-entrar").onclick = entrarConClave;
$("g-pass").addEventListener("keydown", (e) => { if (e.key === "Enter") entrarConClave(); });

$("g-olvide").onclick = async () => {
  const correo = $("g-mail").value.trim();
  if (!correo) { msg("Escribe tu correo arriba y vuelve a tocar «Olvidé mi contraseña».", "err"); return; }
  try {
    await sendPasswordResetEmail(auth, correo);
    msg("Si ese correo tiene acceso, te llegará un enlace para crear una contraseña nueva. Revisa también spam.", "ok");
  } catch (e) { msg(textoError(e), "err"); }
};

$("btn-salir").onclick = () => signOut(auth);

function modoVista() {
  window.BeemoAuth = { isAdmin: false };
  limpiarMsg();
  gate.hidden = true;
  $("who").textContent = "Vista pública";
  $("btn-admin").hidden = true;
  $("btn-salir").hidden = true;
  if (window.BeemoApp) window.BeemoApp.load();
}

onAuthStateChanged(auth, async (user) => {
  if (VISTA) { modoVista(); return; }
  perfil = null;
  window.BeemoAuth = { isAdmin: false };
  if (!user) {
    gate.hidden = false; gForm.hidden = false;
    $("g-pass").value = "";
    if (window.BeemoApp) window.BeemoApp.reset();
    return;
  }
  correoActual = (user.email || "").toLowerCase();

  if (!user.emailVerified) {
    gate.hidden = false; gForm.hidden = true;
    msg("Antes de entrar, confirma tu correo con el enlace que enviamos a <b>" + esc(correoActual) + "</b>.", "", [
      ["Ya lo confirmé", async () => { await user.reload(); await user.getIdToken(true); location.reload(); }],
      ["Reenviar enlace", async () => {
        try { await sendEmailVerification(user); msg("Enlace reenviado a <b>" + esc(correoActual) + "</b>. Revisa también spam.", "ok", [["Ya lo confirmé", () => location.reload()]]); }
        catch (e) { msg(textoError(e), "err"); }
      }],
      ["Usar otra cuenta", () => signOut(auth)]
    ]);
    return;
  }

  try {
    const s = await getDoc(doc(db, "usuarios", correoActual));
    if (!s.exists() || s.data().activo !== true) throw new Error("sin-acceso");
    perfil = s.data();
  } catch (e) {
    await signOut(auth);
    msg("<b>" + esc(correoActual) + "</b> no tiene acceso. Pídele al administrador que agregue tu correo.", "err");
    return;
  }

  window.BeemoAuth = { isAdmin: perfil.rol === "admin" };
  limpiarMsg();
  gate.hidden = true;
  $("who").textContent = perfil.nombre || correoActual;
  $("btn-admin").hidden = perfil.rol !== "admin";
  if (window.BeemoApp) window.BeemoApp.load();
});

// ---------- panel de administración ----------
$("btn-admin").onclick = async () => {
  if (!perfil || perfil.rol !== "admin") return;
  $("ov-admin").hidden = false;
  await pintarUsuarios();
  try {
    const s = await getDoc(doc(db, "datos", "cronograma"));
    if (s.exists() && s.data().actualizado) {
      const d = s.data();
      $("a-estado").textContent = "Última carga: " + d.actualizado.toDate().toLocaleString("es-CO") +
        (d.por ? " por " + d.por : "") + (d.eventos != null ? " · " + d.eventos + " eventos" : "") +
        ". Al subir un CSV nuevo se reemplazan los eventos actuales.";
    }
  } catch (e) { /* sin datos aún */ }
};

// Eventos: importar CSV
let csvPendiente = null;
$("a-file").onchange = async (ev) => {
  const f = ev.target.files[0];
  $("a-file-err").hidden = true; $("a-file-ok").hidden = true;
  $("a-guardar").disabled = true; csvPendiente = null;
  if (!f) return;
  const texto = await f.text();
  if (texto.length > 900000) { mostrar("a-file-err", "El archivo es muy grande (máximo ~900 KB)."); return; }
  const n = window.BeemoApp.contar(texto);
  if (!n) {
    mostrar("a-file-err", "No encontré eventos. La primera fila debe tener los títulos (Fecha inicio, Mentor, Nombre del programa…) y las fechas deben ir como 2026-09-21 o 21/09/2026.");
    return;
  }
  csvPendiente = { texto, n };
  mostrar("a-file-ok", "Encontré " + n + (n === 1 ? " evento" : " eventos") + " en «" + f.name + "». Dale «Guardar cronograma» para publicarlos.");
  $("a-guardar").disabled = false;
};
$("a-guardar").onclick = async () => {
  if (!csvPendiente) return;
  const b = $("a-guardar"); b.disabled = true; b.textContent = "Guardando…";
  try {
    await setDoc(doc(db, "datos", "cronograma"), {
      csv: csvPendiente.texto, eventos: csvPendiente.n, actualizado: serverTimestamp(), por: correoActual
    });
    mostrar("a-file-ok", "Cronograma guardado: " + csvPendiente.n + " eventos. Todo el equipo ya los ve.");
    csvPendiente = null; $("a-file").value = "";
    window.BeemoApp.load();
  } catch (e) {
    mostrar("a-file-err", "No se pudo guardar. Revisa que las reglas de Firestore estén publicadas. (" + (e.code || e.message) + ")");
  } finally { b.textContent = "Guardar cronograma"; }
};

function mostrar(id, texto) {
  const otro = { "a-file-err": "a-file-ok", "a-file-ok": "a-file-err", "n-err": "n-ok", "n-ok": "n-err" }[id];
  if (otro) $(otro).hidden = true;
  $(id).textContent = texto; $(id).hidden = false;
}

// Equipo: alta de cuentas con correo y contraseña sin cerrar la sesión del administrador
let appAltas = null;
function authAltas() {
  if (!appAltas) appAltas = initializeApp(firebaseConfig, "altas");
  const a = getAuth(appAltas); a.languageCode = "es"; return a;
}
function claveTemporal() {
  const b = new Uint8Array(24); crypto.getRandomValues(b);
  return Array.from(b, (x) => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!#$%"[x % 61]).join("");
}
async function crearCuentaConClave(correo) {
  const a = authAltas();
  try {
    const cred = await createUserWithEmailAndPassword(a, correo, claveTemporal());
    await sendEmailVerification(cred.user);
  } catch (e) {
    if (e.code !== "auth/email-already-in-use") throw e;
  }
  await sendPasswordResetEmail(a, correo);
  await signOut(a);
}

$("n-add").onclick = async () => {
  const correo = $("n-mail").value.trim().toLowerCase();
  const nombre = $("n-nombre").value.trim();
  const rol = $("n-rol").value, metodo = $("n-metodo").value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { mostrar("n-err", "Escribe un correo válido."); return; }
  const b = $("n-add"); b.disabled = true; b.textContent = "Agregando…";
  try {
    await setDoc(doc(db, "usuarios", correo), {
      nombre, rol, metodo, activo: true, creado: serverTimestamp(), creadoPor: correoActual
    }, { merge: true });
    if (metodo === "password") {
      await crearCuentaConClave(correo);
      mostrar("n-ok", "Listo. A " + correo + " le llegan dos correos: uno para confirmar su dirección y otro para crear su contraseña.");
    } else {
      mostrar("n-ok", "Listo. " + correo + " ya puede entrar con «Entrar con Google».");
    }
    $("n-mail").value = ""; $("n-nombre").value = "";
    await pintarUsuarios();
  } catch (e) {
    mostrar("n-err", "No se pudo agregar. (" + (e.code || e.message) + ")");
  } finally { b.disabled = false; b.textContent = "Agregar"; }
};

async function pintarUsuarios() {
  const box = $("users");
  box.innerHTML = '<div class="u"><span class="hint" style="margin:0">Cargando equipo…</span></div>';
  try {
    const snap = await getDocs(collection(db, "usuarios"));
    const lista = snap.docs.map((d) => ({ correo: d.id, ...d.data() }))
      .sort((a, b) => (a.nombre || a.correo).localeCompare(b.nombre || b.correo, "es"));
    box.innerHTML = lista.map((u) => {
      const yo = u.correo === correoActual;
      const tags = [
        u.rol === "admin" ? '<span class="tag admin">Administrador</span>' : '<span class="tag">Miembro</span>',
        '<span class="tag">' + (u.metodo === "password" ? "Correo y contraseña" : "Google") + "</span>",
        u.activo ? "" : '<span class="tag off">Sin acceso</span>'
      ].join("");
      const acts = yo ? '<span class="hint" style="margin:0">Tu cuenta</span>' : [
        `<button class="btn" data-u="activo" data-c="${esc(u.correo)}" type="button">${u.activo ? "Quitar acceso" : "Dar acceso"}</button>`,
        `<button class="btn" data-u="rol" data-c="${esc(u.correo)}" type="button">${u.rol === "admin" ? "Hacer miembro" : "Hacer admin"}</button>`,
        u.metodo === "password" ? `<button class="btn" data-u="clave" data-c="${esc(u.correo)}" type="button">Reenviar acceso</button>` : "",
        `<button class="btn" data-u="borrar" data-c="${esc(u.correo)}" type="button">Eliminar</button>`
      ].join("");
      return `<div class="u"><div><div class="u-name">${esc(u.nombre || u.correo)}</div>` +
        `<div class="u-mail">${esc(u.correo)}</div><div class="u-tags">${tags}</div></div>` +
        `<div class="u-acts">${acts}</div></div>`;
    }).join("") || '<div class="u"><span class="hint" style="margin:0">Aún no hay nadie en el equipo.</span></div>';
    box._lista = lista;
  } catch (e) {
    box.innerHTML = '<div class="u"><span class="err" style="margin:0">No pude leer el equipo. (' + esc(e.code || e.message) + ")</span></div>";
  }
}

$("users").addEventListener("click", async (ev) => {
  const b = ev.target.closest("[data-u]"); if (!b) return;
  const correo = b.dataset.c, accion = b.dataset.u;
  const u = ($("users")._lista || []).find((x) => x.correo === correo); if (!u) return;
  try {
    if (accion === "activo") await updateDoc(doc(db, "usuarios", correo), { activo: !u.activo });
    if (accion === "rol") await updateDoc(doc(db, "usuarios", correo), { rol: u.rol === "admin" ? "miembro" : "admin" });
    if (accion === "clave") {
      await sendPasswordResetEmail(auth, correo);
      mostrar("n-ok", "Enviamos a " + correo + " un enlace para crear su contraseña.");
      return;
    }
    if (accion === "borrar") {
      if (!confirm("¿Eliminar a " + correo + " del equipo? Ya no podrá entrar.")) return;
      await deleteDoc(doc(db, "usuarios", correo));
    }
    await pintarUsuarios();
  } catch (e) { mostrar("n-err", "No se pudo completar. (" + (e.code || e.message) + ")"); }
});
