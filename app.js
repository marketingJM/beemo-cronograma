(function(){
"use strict";

var MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
var MESES_C = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
var DIAS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];


var state = {
  events: [], source:"demo", fetchedAt:null,
  view:"agenda", month:null, onlyUpcoming:false,
  filters:{mentor:"",tipo:"",q:""},
  loading:false, settled:false,
  plegados: leerPlegados()
};
/* Meses minimizados en la agenda (se recuerdan en este navegador) */
function leerPlegados(){
  try{ return JSON.parse(localStorage.getItem("beemo-plegados") || "null"); }catch(e){ return null; }
}
function guardarPlegados(){
  try{ localStorage.setItem("beemo-plegados", JSON.stringify(state.plegados)); }catch(e){}
}
function mesPlegado(key, d){
  if(state.plegados && key in state.plegados) return state.plegados[key];
  var finMes = new Date(d.getFullYear(), d.getMonth()+1, 0);
  return finMes < TODAY;   // por defecto: los meses que ya pasaron empiezan minimizados
}

/* ---------------- fechas ---------------- */
function d0(dt){ return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()); }
var TODAY = d0(new Date());
function parseDate(s){
  if(!s) return null;
  s = String(s).trim(); if(!s) return null;
  var m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if(m) return new Date(+m[1], +m[2]-1, +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if(m){ var y=+m[3]; if(y<100) y+=2000; return new Date(y, +m[2]-1, +m[1]); }
  var t = Date.parse(s);
  if(!isNaN(t)){ var d=new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  return null;
}
function addDays(d,n){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()+n); }
function dayDiff(a,b){ return Math.round((d0(b)-d0(a))/86400000); }
function monday(d){ var w=(d.getDay()+6)%7; return addDays(d,-w); }
function fmtShort(d){ return d.getDate()+" "+MESES_C[d.getMonth()]; }
function fmtLong(d){ return d.getDate()+" de "+MESES[d.getMonth()]+" de "+d.getFullYear(); }
function fmtRange(a,b){
  if(!b || dayDiff(a,b)===0) return fmtLong(a);
  if(a.getMonth()===b.getMonth() && a.getFullYear()===b.getFullYear())
    return a.getDate()+" al "+b.getDate()+" de "+MESES[b.getMonth()]+" de "+b.getFullYear();
  return fmtShort(a)+" — "+fmtShort(b)+" de "+b.getFullYear();
}
function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
function norm(s){
  return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
}
function parseNum(s){
  if(s === 0) return 0;
  if(!s) return null;
  var t = String(s).trim(); if(!t) return null;
  var pct = /%$/.test(t);
  t = t.replace(/[^\d.,-]/g,"");   // quita US$, $, COP, espacios…
  if(!t) return null;
  if(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g,"").replace(",",".");
  else if(/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g,"");
  else t = t.replace(",",".");
  var n = parseFloat(t);
  if(isNaN(n)) return null;
  return pct ? n/100 : n;
}
function miles(n){ try{ return n.toLocaleString("es-CO"); }catch(e){ return String(n); } }
function usd(n){ return "US$"+miles(Math.round(n)); }
function cop(n){ return "$"+miles(Math.round(n)); }
function ticketTxt(e){
  var p = [];
  if(e.ticketUsd) p.push(usd(e.ticketUsd));
  if(e.ticketCop) p.push(cop(e.ticketCop));
  return p.join(" · ");
}
function ingresoTxt(e){
  var p = [];
  if(e.ingUsd) p.push(usd(e.ingUsd));
  if(e.ingCop) p.push(cop(e.ingCop));
  return p.join(" · ");
}

/* ---------------- color por tipo (paleta validada) ---------------- */
function cssVar(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#666";
}
function tipoColor(t){
  var k = norm(t);
  if(k.indexOf("bootcamp") >= 0) return cssVar("--verde");
  if(k.indexOf("intern") >= 0) return cssVar("--violeta");
  if(k.indexOf("extern") >= 0) return cssVar("--azul");
  if(k.indexOf("lanzamiento") >= 0) return cssVar("--azul");
  return cssVar("--ink-2");
}
function initial(s){
  var w = String(s||"?").trim().split(/\s+/).filter(Boolean);
  if(!w.length) return "?";
  var a = w[0].charAt(0);
  var b = w.length > 1 ? w[1].charAt(0) : "";
  return (a+b).toUpperCase();
}

/* ---------------- columnas ---------------- */
var ALIASES = {
  evento:["evento","nombre del programa","programa","nombre del evento","nombre","lanzamiento"],
  ticketUsd:["ticket usd","ticket (usd)","valor usd","precio usd","ticket us$"],
  ticketCop:["ticket cop","ticket (cop)","valor cop","precio cop","ticket $"],
  ticket:["ticket","valor","precio","valor del ticket"],
  ventas:["ventas","ventas estimadas","cantidad de ventas","ventas (est.)"],
  tipo:["tipo de evento","tipo","categoria"],
  mentor:["mentor","mentora","cuenta","account"],
  inicio:["fecha inicio","inicio","fecha de inicio","start","desde"],
  fin:["fecha fin","fin","fecha de fin","fecha final","end","hasta"],
  registros:["registros","cantidad de registros","inscritos","leads"],
  asistentes:["asistentes","asistencia","cantidad de asistentes"],
  pct:["% asistencia","porcentaje de asistencia","% de asistencia","pct asistencia"],
  responsable:["responsable","owner","encargado"],
  notas:["notas","nota","observaciones","comentarios","detalle"],
  activacion:["fecha de activacion","fecha activacion","activacion","fecha de la activacion"],
  moneda:["moneda transaccion","moneda de transaccion","moneda de la transaccion","moneda"],
  ingresoReal:["ingreso usd","ingresos usd","ingreso en usd","ingresos en usd","ingreso real usd"]
};
/* Para estas columnas basta con que el título contenga la palabra */
var CONTIENE = { activacion:"activacion", moneda:"moneda" };
var ALIAS_SET = {};
Object.keys(ALIASES).forEach(function(k){ ALIASES[k].forEach(function(a){ ALIAS_SET[a] = true; }); });
function findCols(header){
  var idx={};
  Object.keys(ALIASES).forEach(function(key){
    idx[key] = -1;
    for(var i=0;i<header.length;i++){
      if(ALIASES[key].indexOf(norm(header[i])) >= 0){ idx[key]=i; return; }
    }
    if(CONTIENE[key]){
      for(var k=0;k<header.length;k++){
        if(norm(header[k]).indexOf(CONTIENE[key]) >= 0){ idx[key]=k; return; }
      }
    }
    if(key === "ingresoReal"){
      for(var j=0;j<header.length;j++){
        var h = norm(header[j]);
        if(h.indexOf("ingreso") >= 0 && h.indexOf("usd") >= 0){ idx[key]=j; return; }
      }
    }
  });
  return idx;
}
/* Columnas que siempre se muestran (la página las necesita para funcionar) */
var FIJAS = ["evento","mentor","tipo","inicio","fin"];
function headerRow(rows){
  for(var i=0;i<Math.min(rows.length,6);i++){
    if(rows[i].some(function(c){ return norm(c)==="evento" || ALIASES.inicio.indexOf(norm(c))>=0; })) return i;
  }
  return 0;
}
/* Lista de columnas del Sheet para el panel «Columnas» */
function listarColumnas(rows){
  if(!rows.length) return [];
  var head = rows[headerRow(rows)], idx = findCols(head), fijas = {};
  FIJAS.forEach(function(k){ if(idx[k]>=0) fijas[idx[k]] = true; });
  var out = [];
  head.forEach(function(h,i){
    if(String(h).trim()) out.push({ nombre: String(h).trim(), clave: norm(h), fija: !!fijas[i] });
  });
  return out;
}
function buildEvents(rows, ocultas){
  if(!rows.length) return [];
  var oc = {}; (ocultas||[]).forEach(function(h){ oc[norm(h)] = true; });
  var hi = headerRow(rows);
  var head = rows[hi];
  var idx = findCols(head);
  var usadas = {};
  Object.keys(idx).forEach(function(k){
    if(idx[k] < 0) return;
    if(oc[norm(head[idx[k]])] && FIJAS.indexOf(k) < 0) idx[k] = -1;   // columna oculta por el administrador
    else usadas[idx[k]] = true;
  });
  var extras = [];
  head.forEach(function(h,i){
    if(!usadas[i] && String(h).trim() && !oc[norm(h)] && !(norm(h) in ALIAS_SET)) extras.push(i);
  });
  var get = function(r,k){ return idx[k]>=0 ? (r[idx[k]]||"") : ""; };
  var evs=[];
  for(var j=hi+1;j<rows.length;j++){
    var r=rows[j];
    var ini = parseDate(get(r,"inicio"));
    if(!ini) continue;
    var fin = parseDate(get(r,"fin")) || ini;
    if(fin < ini) fin = ini;
    var tUsd = parseNum(get(r,"ticketUsd"));
    var tCop = parseNum(get(r,"ticketCop"));
    var tGen = parseNum(get(r,"ticket"));
    if(tUsd === null && tCop === null && tGen !== null) tUsd = tGen;
    var ventas = parseNum(get(r,"ventas"));
    var reg = parseNum(get(r,"registros"));
    var asi = parseNum(get(r,"asistentes"));
    var pct = parseNum(get(r,"pct"));
    if(pct === null && reg && asi !== null) pct = asi/reg;
    if(pct !== null && pct > 1.5) pct = pct/100;
    evs.push({
      id: j,
      evento: get(r,"evento") || "Sin título",
      tipo: get(r,"tipo") || "Sin tipo",
      mentor: get(r,"mentor") || "Sin mentor",
      ini: ini, fin: fin,
      registros: reg, asistentes: asi, pct: pct,
      ticketUsd: tUsd, ticketCop: tCop, ventas: ventas,
      ingUsd: (ventas !== null && tUsd) ? ventas*tUsd : null,
      ingCop: (ventas !== null && tCop) ? ventas*tCop : null,
      responsable: get(r,"responsable"),
      notas: get(r,"notas"),
      activacion: parseDate(get(r,"activacion")),
      activacionTxt: get(r,"activacion"),
      moneda: get(r,"moneda"),
      ingresoReal: parseNum(get(r,"ingresoReal")),
      extras: extras.map(function(i){ return [String(head[i]).trim(), String(r[i]||"").trim()]; })
                    .filter(function(x){ return x[1]; })
    });
  }
  evs.sort(function(a,b){ return a.ini - b.ini || a.mentor.localeCompare(b.mentor,"es"); });
  return evs;
}

/* ---------------- estado ---------------- */
var elStatus = document.getElementById("status");
var elStatusText = document.getElementById("status-text");
var elStamp = document.getElementById("status-stamp");
function setStatus(kind, html, stamp){
  elStatus.className = "status" + (kind ? " is-"+kind : "");
  elStatusText.innerHTML = html;
  elStamp.textContent = stamp || "";
}
function relTime(ts){
  var s = Math.round((Date.now()-ts)/1000);
  if(s < 60) return "hace un momento";
  if(s < 3600) return "hace "+Math.round(s/60)+" min";
  if(s < 86400) return "hace "+Math.round(s/3600)+" h";
  return "hace "+Math.round(s/86400)+" d";
}

/* CSV con comillas al estilo Google Sheets */
function parseCSV(text){
  text = String(text||"").replace(/^\uFEFF/,"");
  var first = text.split("\n")[0] || "";
  var sep = first.split(";").length > first.split(",").length ? ";" : ",";
  var rows=[], row=[], cur="", q=false, c;
  for(var i=0;i<text.length;i++){
    c = text.charAt(i);
    if(q){
      if(c === '"'){
        if(text.charAt(i+1) === '"'){ cur += '"'; i++; }
        else q = false;
      } else cur += c;
    }else{
      if(c === '"') q = true;
      else if(c === sep){ row.push(cur); cur = ""; }
      else if(c === "\n"){ row.push(cur); rows.push(row); row = []; cur = ""; }
      else if(c !== "\r") cur += c;
    }
  }
  if(cur !== "" || row.length){ row.push(cur); rows.push(row); }
  return rows.map(function(r){ return r.map(function(x){ return String(x).trim(); }); })
             .filter(function(r){ return r.join("") !== ""; });
}

function load(opts){
  opts = opts || {};
  if(state.loading || !window.BeemoData) return;
  state.loading = true;
  setStatus("", "Cargando eventos…");
  window.BeemoData.get().then(function(res){
    state.loading = false;
    state.settled = true;
    var evs = buildEvents(parseCSV(res && res.csv || ""), res && res.ocultas);
    state.events = evs;
    state.source = "sheet";
    state.fetchedAt = Date.now();
    state.month = defaultMonth();
    var nota = res && res.nota || "";
    if(evs.length){
      setStatus("live", "<strong>"+evs.length+"</strong> "+(evs.length===1?"evento":"eventos")+" · "+
        uniq(evs.map(function(e){return e.mentor;})).length+" mentores", nota);
    }else{
      setStatus("live", "Todavía no hay eventos cargados", nota);
    }
    renderAll();
  }).catch(function(){
    state.loading = false;
    state.settled = true;
    state.source = "error";
    setStatus("error","No pude cargar los eventos. Revisa tu conexión y dale «Actualizar».");
    renderView();
  });
}

function defaultMonth(){
  var evs = state.events;
  var now = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
  if(!evs.length) return now;
  var upcoming = evs.filter(function(e){ return e.fin >= TODAY; });
  if(!upcoming.length){
    var last = evs[evs.length-1].ini;
    return new Date(last.getFullYear(), last.getMonth(), 1);
  }
  var inThis = upcoming.some(function(e){
    return (e.ini.getMonth()===TODAY.getMonth() && e.ini.getFullYear()===TODAY.getFullYear()) || (e.ini <= TODAY && e.fin >= TODAY);
  });
  if(inThis) return now;
  var first = upcoming[0].ini;
  return new Date(first.getFullYear(), first.getMonth(), 1);
}

/* ---------------- filtros ---------------- */
function filtered(){
  var f = state.filters;
  return state.events.filter(function(e){
    if(f.mentor && e.mentor !== f.mentor) return false;
    if(f.tipo && norm(e.tipo) !== norm(f.tipo)) return false;
    if(f.q){
      var hay = norm(e.evento+" "+e.mentor+" "+e.tipo+" "+e.notas+" "+e.responsable);
      if(hay.indexOf(norm(f.q)) < 0) return false;
    }
    return true;
  });
}
function uniq(arr){
  var seen={}, out=[];
  arr.forEach(function(v){ var k=norm(v); if(v && !seen[k]){ seen[k]=1; out.push(v); } });
  return out.sort(function(a,b){ return a.localeCompare(b,"es"); });
}
function fillSelect(id, label, values, current){
  document.getElementById(id).innerHTML =
    '<option value="">'+label+'</option>' +
    values.map(function(v){ return '<option value="'+esc(v)+'"'+(v===current?" selected":"")+">"+esc(v)+"</option>"; }).join("");
}
function renderFilters(){
  fillSelect("f-mentor","Todos los mentores", uniq(state.events.map(function(e){return e.mentor;})), state.filters.mentor);
  fillSelect("f-tipo","Todos los tipos", uniq(state.events.map(function(e){return e.tipo;})), state.filters.tipo);
}

/* ---------------- resumen ---------------- */
function renderStats(){
  var evs = filtered();
  var mStart = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
  var mEnd = new Date(TODAY.getFullYear(), TODAY.getMonth()+1, 0);
  var esteMes = evs.filter(function(e){ return e.ini <= mEnd && e.fin >= mStart; }).length;
  var hoy = evs.filter(function(e){ return e.ini <= TODAY && e.fin >= TODAY; }).length;
  var in30 = evs.filter(function(e){ return e.ini > TODAY && dayDiff(TODAY, e.ini) <= 30; }).length;

  var sumR=0, sumA=0, n=0, iUsd=0, iCop=0, nv=0;
  evs.forEach(function(e){
    if(e.registros && e.asistentes !== null){ sumR += e.registros; sumA += e.asistentes; n++; }
    if(e.ingUsd){ iUsd += e.ingUsd; nv++; }
    if(e.ingCop){ iCop += e.ingCop; nv++; }
  });
  var ingVal = iUsd ? usd(iUsd) : iCop ? cop(iCop) : "—";
  var ingNota = (iUsd && iCop) ? "más "+cop(iCop) : nv ? "ventas × ticket" : "sin ventas cargadas";

  var cards = [
    ["Eventos este mes", esteMes, cap(MESES[TODAY.getMonth()])+" "+TODAY.getFullYear()],
    ["Corriendo hoy", hoy, hoy ? "en vivo ahora mismo" : "nada en curso"],
    ["Arrancan en 30 días", in30, "próximos por empezar"],
    ["Asistencia promedio", n ? Math.round(sumA/sumR*100)+"%" : "—",
       n ? miles(sumA)+" de "+miles(sumR)+" registros" : "sin datos aún"],
    ["Ingreso estimado", ingVal, ingNota]
  ];
  document.getElementById("stats").innerHTML = cards.map(function(c){
    return '<div class="stat"><div class="k">'+c[0]+'</div><div class="v">'+c[1]+'</div><div class="n">'+esc(c[2])+"</div></div>";
  }).join("");
}

/* ---------------- agenda ---------------- */
function meterHtml(e, color){
  if(e.pct === null) return "";
  var w = Math.max(2, Math.min(100, Math.round(e.pct*100)));
  var cap = (e.asistentes !== null && e.registros)
    ? miles(e.asistentes)+" asistentes de "+miles(e.registros)+" registros"
    : "asistencia registrada";
  return '<div class="meter"><div class="meter-track"><div class="meter-fill" style="width:'+w+'%;background:'+color+'"></div></div>'+
         '<span class="meter-n">'+Math.round(e.pct*100)+'% asistencia</span></div>'+
         '<div class="meter-cap">'+esc(cap)+"</div>";
}
function ventasHtml(e){
  if(e.ventas === null) return "";   // el ticket ya aparece en la línea de arriba
  var bits = [];
  if(e.ventas !== null) bits.push("<b>"+miles(e.ventas)+"</b> "+(e.ventas===1?"venta":"ventas"));
  var ing = ingresoTxt(e);
  if(ing) bits.push("<b>"+esc(ing)+"</b> estimados");
  else if(ticketTxt(e)) bits.push("ticket "+esc(ticketTxt(e)));
  return '<div class="ventas">'+bits.join(" · ")+"</div>";
}
/* Ingresos USD: la columna del Sheet si existe; si no, el cálculo ticket × ventas */
function ingresoUsdTxt(e){
  if(e.ingresoReal !== null && e.ingresoReal !== undefined) return usd(e.ingresoReal);
  return e.ingUsd ? usd(e.ingUsd)+" (estimado)" : "";
}
function activacionTxt(e){ return e.activacion ? fmtLong(e.activacion) : (e.activacionTxt || ""); }
function extraHtml(e){
  var bits = [];
  if(activacionTxt(e)) bits.push("Activación: <b>"+esc(activacionTxt(e))+"</b>");
  if(e.moneda) bits.push("Moneda: <b>"+esc(e.moneda)+"</b>");
  return bits.length ? '<span class="ev-extra">'+bits.join(" · ")+"</span>" : "";
}
function renderAgenda(){
  var evs = filtered().slice().sort(function(a,b){ return a.ini-b.ini; });
  if(!state.events.length){
    document.getElementById("view-title").textContent = "Agenda";
    document.getElementById("view-nav").innerHTML = "";
    empty(); return;
  }
  document.getElementById("view-nav").innerHTML =
    '<button type="button" id="nav-scope">'+(state.onlyUpcoming ? "Ver todo" : "Solo lo que viene")+"</button>";
  document.getElementById("nav-scope").onclick = function(){ state.onlyUpcoming = !state.onlyUpcoming; renderView(); };

  if(state.onlyUpcoming) evs = evs.filter(function(e){ return e.fin >= TODAY; });
  document.getElementById("view-title").textContent = evs.length + (evs.length===1?" evento":" eventos");
  if(!evs.length){ empty(); return; }

  var order = [], byMonth = {};
  evs.forEach(function(e){
    var key = e.ini.getFullYear()+"-"+e.ini.getMonth();
    if(!byMonth[key]){ byMonth[key] = {d:e.ini, items:[]}; order.push(key); }
    byMonth[key].items.push(e);
  });

  var html = "";
  order.forEach(function(key){
    var g = byMonth[key];
    var plegado = mesPlegado(key, g.d);
    html += '<button class="mo-h" type="button" data-mes="'+key+'" aria-expanded="'+(!plegado)+'">'+
            '<b><span class="mo-flecha" aria-hidden="true">'+(plegado ? "▸" : "▾")+"</span>"+
            cap(MESES[g.d.getMonth()])+" "+g.d.getFullYear()+"</b><em>"+
            g.items.length+(g.items.length===1?" evento":" eventos")+"</em></button>";
    if(plegado) return;
    g.items.forEach(function(e){
      var color = tipoColor(e.tipo);
      var days = dayDiff(e.ini, e.fin)+1;
      html += '<button class="ev" type="button" data-ev="'+e.id+'">'+
        '<span class="datebox" style="--c:'+color+'"><b>'+e.ini.getDate()+"</b><span>"+MESES_C[e.ini.getMonth()]+"</span></span>"+
        '<span class="ev-body">'+
          '<span class="ev-top"><h3>'+esc(e.mentor)+"</h3>"+
            '<span class="pill tipo" style="background:'+color+'">'+esc(e.tipo)+"</span></span>"+
          '<span class="ev-sub">'+esc(e.evento)+"</span>"+
          '<span class="ev-datos">'+
            (ingresoUsdTxt(e) ? '<span>Ingresos USD: <b>'+esc(ingresoUsdTxt(e))+"</b></span>" : "")+
            '<span>Inicio: <b>'+esc(fmtLong(e.ini))+"</b></span>"+
          "</span>"+
        "</span></button>";
    });
  });
  document.getElementById("view").innerHTML = html;
}

/* ---------------- calendario ---------------- */
function renderCal(){
  var evs = filtered();
  if(!state.events.length){
    var m0 = state.month || defaultMonth();
    document.getElementById("view-title").textContent = cap(MESES[m0.getMonth()])+" "+m0.getFullYear();
    document.getElementById("view-nav").innerHTML = "";
    empty(); return;
  }
  var m = state.month || defaultMonth();
  state.month = m;
  document.getElementById("view-title").textContent = cap(MESES[m.getMonth()])+" "+m.getFullYear();
  document.getElementById("view-nav").innerHTML =
    '<button type="button" id="nav-prev" aria-label="Mes anterior">‹</button>'+
    '<button type="button" id="nav-today">Hoy</button>'+
    '<button type="button" id="nav-next" aria-label="Mes siguiente">›</button>';
  document.getElementById("nav-prev").onclick = function(){ state.month = new Date(m.getFullYear(), m.getMonth()-1, 1); renderView(); };
  document.getElementById("nav-next").onclick = function(){ state.month = new Date(m.getFullYear(), m.getMonth()+1, 1); renderView(); };
  document.getElementById("nav-today").onclick = function(){ state.month = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1); renderView(); };

  var start = monday(m);
  var end = addDays(monday(new Date(m.getFullYear(), m.getMonth()+1, 0)), 6);
  var total = dayDiff(start, end) + 1;

  var html = '<div class="cal-head">'+DIAS.map(function(d){return "<div>"+d+"</div>";}).join("")+"</div><div class='cal-grid'>";
  for(var i=0;i<total;i++){
    var day = addDays(start, i);
    var out = day.getMonth() !== m.getMonth();
    var we = day.getDay()===0 || day.getDay()===6;
    var isToday = dayDiff(day, TODAY)===0;
    var dayEvs = evs.filter(function(e){ return e.ini <= day && e.fin >= day; });
    html += '<div class="cell'+(out?" out":"")+(we?" we":"")+(isToday?" today":"")+'"><div class="d">'+day.getDate()+"</div>";
    dayEvs.slice(0,4).forEach(function(e){
      var isStart = dayDiff(e.ini, day)===0, isEnd = dayDiff(e.fin, day)===0;
      var cls = isStart && isEnd ? "" : isStart ? "start" : isEnd ? "end" : "mid";
      var label = esc(e.evento);
      html += '<button class="chip '+cls+'" type="button" data-ev="'+e.id+'" style="background:'+tipoColor(e.tipo)+'" title="'+esc(e.evento+" · "+e.mentor+" · "+e.tipo+" · "+fmtRange(e.ini,e.fin))+'">'+label+"</button>";
    });
    if(dayEvs.length > 4) html += '<button class="more" type="button" data-day="'+i+'">+'+(dayEvs.length-4)+" más</button>";
    html += "</div>";
  }
  document.getElementById("view").innerHTML = html + "</div>";

  document.getElementById("view").querySelectorAll("[data-day]").forEach(function(btn){
    btn.onclick = function(){
      var day = addDays(start, +btn.getAttribute("data-day"));
      openDayList(day, evs.filter(function(e){ return e.ini <= day && e.fin >= day; }));
    };
  });
}

/* ---------------- timeline ---------------- */
var DAY_W = 34;
function renderTimeline(){
  var evs = filtered();
  document.getElementById("view-nav").innerHTML = '<span style="font-size:.86rem;color:var(--muted)">Desliza en horizontal →</span>';
  if(!evs.length){ document.getElementById("view-title").textContent = "Timeline"; empty(); return; }

  var min = evs[0].ini, max = evs[0].fin;
  evs.forEach(function(e){ if(e.ini<min) min=e.ini; if(e.fin>max) max=e.fin; });
  var start = monday(min), end = addDays(monday(max), 6);
  var days = dayDiff(start, end) + 1;
  var W = days * DAY_W;
  document.getElementById("view-title").textContent = fmtShort(start)+" — "+fmtShort(end)+" de "+end.getFullYear();

  var order = [], groups = {};
  evs.forEach(function(e){
    if(!groups[e.mentor]){ groups[e.mentor]=[]; order.push(e.mentor); }
    groups[e.mentor].push(e);
  });
  order.sort(function(a,b){ return a.localeCompare(b,"es"); });

  var months = [], cur = null;
  for(var i=0;i<days;i++){
    var d = addDays(start,i), key = d.getFullYear()+"-"+d.getMonth();
    if(!cur || cur.key !== key){ cur = {key:key, label: MESES[d.getMonth()]+" "+d.getFullYear(), n:0}; months.push(cur); }
    cur.n++;
  }
  var monthsHtml = months.map(function(mo){ return '<div style="width:'+(mo.n*DAY_W)+'px">'+esc(mo.label)+"</div>"; }).join("");

  var daysHtml = "", weCols = "";
  for(var j=0;j<days;j++){
    var dd = addDays(start,j);
    var we = dd.getDay()===0||dd.getDay()===6;
    var td = dayDiff(dd,TODAY)===0;
    daysHtml += '<div class="'+(td?"td":we?"we":"")+'" style="width:'+DAY_W+'px">'+dd.getDate()+"</div>";
    if(we) weCols += '<div class="we-col" style="left:'+(j*DAY_W)+'px;width:'+DAY_W+'px"></div>';
  }

  var sideHtml = '<div class="sp"></div>', rowsHtml = "";
  order.forEach(function(mentor){
    var items = groups[mentor].slice().sort(function(a,b){ return a.ini-b.ini; });
    var lanes = [];
    items.forEach(function(e){
      var placed = false;
      for(var li=0; li<lanes.length; li++){
        if(lanes[li] < e.ini.getTime()){ lanes[li] = e.fin.getTime(); e._lane = li; placed = true; break; }
      }
      if(!placed){ e._lane = lanes.length; lanes.push(e.fin.getTime()); }
    });
    var h = Math.max(lanes.length*40 + 18, 60);
    sideHtml += '<div class="tl-lbl" style="height:'+h+'px">'+
      '<span class="tl-ini">'+esc(initial(mentor))+"</span>"+
      '<span class="tl-txt"><b title="'+esc(mentor)+'">'+esc(mentor)+"</b><span>"+
        items.length+(items.length===1?" evento":" eventos")+"</span></span></div>";
    var bars = "";
    items.forEach(function(e){
      var left = dayDiff(start, e.ini) * DAY_W;
      var w = (dayDiff(e.ini, e.fin)+1) * DAY_W - 4;
      var top = 9 + e._lane*40;
      var label = w > 92 ? esc(e.evento) : "";
      bars += '<button class="bar" type="button" data-ev="'+e.id+'" style="left:'+left+'px;width:'+Math.max(w,12)+'px;top:'+top+'px;background:'+tipoColor(e.tipo)+'" title="'+esc(e.evento+" · "+fmtRange(e.ini,e.fin)+" · "+e.tipo)+'">'+label+"</button>";
    });
    rowsHtml += '<div class="tl-row" style="height:'+h+'px">'+weCols+bars+"</div>";
  });

  var nowLine = (TODAY >= start && TODAY <= end)
    ? '<div class="tl-now" style="left:'+(dayDiff(start,TODAY)*DAY_W + DAY_W/2)+'px"></div>' : "";

  document.getElementById("view").innerHTML =
    '<div class="tl"><div class="tl-side">'+sideHtml+"</div>"+
    '<div class="tl-scroll" id="tl-scroll"><div class="tl-canvas" style="width:'+W+'px">'+
    '<div class="tl-months">'+monthsHtml+"</div>"+
    '<div class="tl-days">'+daysHtml+"</div>"+ rowsHtml + nowLine + "</div></div></div>";

  var sc = document.getElementById("tl-scroll");
  if(sc && TODAY >= start && TODAY <= end){
    sc.scrollLeft = Math.max(0, dayDiff(start,TODAY)*DAY_W - sc.clientWidth/3);
  }
}

function empty(){
  var hayDatos = state.events.length > 0;
  var el = document.getElementById("view");
  if(hayDatos){
    el.innerHTML = '<div class="empty">Nada por aquí con estos filtros. Prueba quitando alguno.</div>';
    return;
  }
  var cargando = !state.settled;
  var sinLectura = state.settled && state.source !== "sheet";
  el.innerHTML =
    '<div class="blank">'+
      '<div class="blank-ico" aria-hidden="true">'+
        '<span></span><span></span><span></span><span></span><span></span><span></span>'+
      "</div>"+
      "<h3>"+(cargando ? "Cargando eventos…"
              : sinLectura ? "No pude cargar los eventos"
              : "Todavía no hay eventos")+"</h3>"+
      "<p>"+(cargando
        ? "Un segundo."
        : sinLectura
        ? "Revisa tu conexión e inténtalo de nuevo. Si sigue pasando, avísale al administrador."
        : "El administrador todavía no ha cargado el cronograma. Lo mínimo por evento: <strong>Evento</strong>, <strong>Mentor</strong> y <strong>Fecha inicio</strong>.")+"</p>"+
      (cargando ? "" : sinLectura
        ? '<p class="blank-cta"><button class="btn" type="button" id="blank-refresh">Reintentar</button></p>'
        : '<p class="blank-cta">'+(window.BeemoAuth && window.BeemoAuth.isAdmin ? '<button class="btn btn-primary" type="button" id="blank-connect">Cargar eventos</button>' : '')+
          '<button class="btn" type="button" id="blank-refresh">Actualizar</button></p>')+
    "</div>";
  var b = document.getElementById("blank-refresh");
  if(b) b.onclick = function(){ load({force:true}); };
  var cbtn = document.getElementById("blank-connect");
  if(cbtn) cbtn.onclick = function(){ document.getElementById("btn-admin").click(); };
}

/* ---------------- detalle ---------------- */
function openDetail(ev){
  var color = tipoColor(ev.tipo);
  document.getElementById("d-title").textContent = ev.mentor;
  document.getElementById("d-sub").textContent = ev.evento;
  var dias = dayDiff(ev.ini, ev.fin)+1;
  var rows = [
    ["Tipo", '<span class="pill tipo" style="background:'+color+'">'+esc(ev.tipo)+"</span>"],
    ["Fechas", esc(fmtRange(ev.ini, ev.fin))+(dias>1 ? " · "+dias+" días" : "")],
    ["Fecha de activación", esc(activacionTxt(ev))],
    ["Moneda transacción", esc(ev.moneda)],
    ["Registros", ev.registros !== null ? esc(miles(ev.registros)) : ""],
    ["Asistentes", ev.asistentes !== null ? esc(miles(ev.asistentes)) : ""],
    ["Asistencia", ev.pct !== null ? meterHtml(ev, color) : ""],
    ["Ticket", esc(ticketTxt(ev))],
    ["Ventas", ev.ventas !== null ? esc(miles(ev.ventas)) : ""],
    ["Ingresos USD", ev.ingresoReal !== null ? esc(usd(ev.ingresoReal)) : ""],
    ["Ingreso estimado", ev.ingresoReal === null ? esc(ingresoTxt(ev)) : (ev.ingCop ? esc(cop(ev.ingCop)) : "")],
    ["Responsable", esc(ev.responsable)],
    ["Notas", esc(ev.notas)]
  ].concat((ev.extras||[]).map(function(x){ return [esc(x[0]), esc(x[1])]; }))
   .filter(function(r){ return r[1]; });
  document.getElementById("d-body").innerHTML = rows.map(function(r){ return "<dt>"+r[0]+"</dt><dd>"+r[1]+"</dd>"; }).join("");
  show("ov-detail");
}
function openDayList(day, list){
  document.getElementById("d-title").textContent = fmtLong(day);
  document.getElementById("d-sub").textContent = list.length+(list.length===1?" evento":" eventos");
  document.getElementById("d-body").innerHTML = list.map(function(e){
    return "<dt>"+esc(e.mentor)+"</dt><dd><b>"+esc(e.evento)+"</b><br>"+
      '<span class="pill tipo" style="background:'+tipoColor(e.tipo)+'">'+esc(e.tipo)+"</span></dd>";
  }).join("");
  show("ov-detail");
}
function show(id){ document.getElementById(id).hidden = false; }
function hide(id){ document.getElementById(id).hidden = true; }

/* ---------------- render ---------------- */
function renderLegend(){
  var el = document.getElementById("legend");
  var tipos = uniq(filtered().map(function(e){ return e.tipo; }));
  if(tipos.length < 2){ el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  el.innerHTML = tipos.map(function(t){
    return '<span><i style="background:'+tipoColor(t)+'"></i>'+esc(t)+"</span>";
  }).join("");
}
function renderView(){
  if(state.view === "cal") renderCal();
  else if(state.view === "tl") renderTimeline();
  else renderAgenda();
  renderLegend();
}
function renderAll(){
  renderFilters();
  renderStats();
  renderView();
}

/* ---------------- UI ---------------- */
document.addEventListener("click", function(ev){
  var t = ev.target.closest ? ev.target.closest("[data-ev]") : null;
  if(t){
    var id = +t.getAttribute("data-ev");
    var e = state.events.filter(function(x){ return x.id === id; })[0];
    if(e) openDetail(e);
    return;
  }
  var mes = ev.target.closest ? ev.target.closest("[data-mes]") : null;
  if(mes){
    var k = mes.getAttribute("data-mes");
    var p = k.split("-");
    var actual = mesPlegado(k, new Date(+p[0], +p[1], 1));
    state.plegados = state.plegados || {};
    state.plegados[k] = !actual;
    guardarPlegados();
    renderView();
    return;
  }
  var c = ev.target.closest ? ev.target.closest("[data-close]") : null;
  if(c){ hide(c.getAttribute("data-close")); return; }
  if(ev.target.classList && ev.target.classList.contains("ov")) ev.target.hidden = true;
});
document.addEventListener("keydown", function(ev){
  if(ev.key === "Escape"){ hide("ov-detail"); hide("ov-admin"); }
});

["agenda","cal","tl"].forEach(function(v){
  document.getElementById("tab-"+v).onclick = function(){
    state.view = v;
    ["agenda","cal","tl"].forEach(function(o){
      document.getElementById("tab-"+o).setAttribute("aria-selected", o===v ? "true" : "false");
    });
    renderView();
  };
});
document.getElementById("f-mentor").onchange = function(){ state.filters.mentor = this.value; renderStats(); renderView(); };
document.getElementById("f-tipo").onchange   = function(){ state.filters.tipo   = this.value; renderStats(); renderView(); };
var qT;
document.getElementById("f-q").oninput = function(){
  var v = this.value;
  clearTimeout(qT);
  qT = setTimeout(function(){ state.filters.q = v; renderStats(); renderView(); }, 180);
};
document.getElementById("btn-refresh").onclick = function(){ load({force:true}); };
function esc(s){
  return String(s==null?"":s).replace(/[&<>"']/g, function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  });
}

/* ---------------- arranque ---------------- */
state.events = [];
state.month = defaultMonth();
renderAll();
window.BeemoApp = {
  load: function(){ load({force:true}); },
  reset: function(){ state.events = []; state.settled = false; state.source = "demo"; renderAll(); },
  contar: function(text){ return buildEvents(parseCSV(text)).length; },
  columnas: function(text){ return listarColumnas(parseCSV(text)); }
};

setInterval(function(){ if(!document.hidden) load({force:true}); }, 600000);

})();
