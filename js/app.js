// Controlador Central: Coordinación de Vistas, Eventos y Persistencia
import { DataService } from "./data-service.js";
import { RulesEngine } from "./rules-engine.js";
import { Reports } from "./reports.js";
import { isOnlineDB } from "./firebase-config.js";

let members = [];
let hogares = [];
let zoomConnections = [];
let currentFilterGroup = "TODOS";
let currentFilterStatus = "ALL";
let currentSearchTerm = "";
let selectedSeatId = null;
let selectedSeatType = "main";
let currentZoomDisplay = "grouped";
let generatedReports = { r1: "", r2: "", r3: "" };

let hallLayout = {
  rows: [
    { left: 4, right: 4, disabled: [] },
    { left: 4, right: 4, disabled: [] },
    { left: 4, right: 4, disabled: [] },
    { left: 4, right: 4, disabled: [] },
    { left: 4, right: 4, disabled: [] },
    { left: 4, right: 4, disabled: [] },
    { left: 4, right: 4, disabled: [] }
  ],
  secondHallSeats: 14,
  disabledSecSeats: []
};

let hallZoomScale = 1.0;
let isDesignModeActive = false;

async function init() {
  const dateInput = document.getElementById("meeting-date-input");
  const typeSelect = document.getElementById("meeting-type-select");
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  dateInput.value = `${yyyy}-${mm}-${dd}`;
  typeSelect.value = (today.getDay() === 0 || today.getDay() === 6) ? "Fin de semana" : "Entre semana";

  const netDot = document.getElementById("net-status-dot");
  const netTxt = document.getElementById("net-status-txt");
  if (isOnlineDB) {
    netDot.className = "inline-block w-2 h-2 rounded-full bg-emerald-400";
    netTxt.innerText = "Firebase Conectado";
  } else {
    netDot.className = "inline-block w-2 h-2 rounded-full bg-amber-400";
    netTxt.innerText = "Modo Local Autónomo";
  }

  // Cargar datos
  hogares = await DataService.getHogares();
  members = await DataService.getMembers();

  const activeSession = await DataService.getActiveSession();
  if (activeSession) {
    if (activeSession.meetingDate) dateInput.value = activeSession.meetingDate;
    if (activeSession.meetingType) typeSelect.value = activeSession.meetingType;
    if (activeSession.zoomConnections) zoomConnections = activeSession.zoomConnections;
    if (activeSession.attendees) {
      members.forEach(m => {
        const match = activeSession.attendees.find(s => s.id === m.id);
        if (match) {
          m.location = match.location;
          m.seatId = match.seatId;
          m.zoomConnId = match.zoomConnId;
          m.lapChildren = match.lapChildren || [];
        }
      });
    }
  }

  setupEventListeners();
  populateHogarSelect();
  refreshAll();

  if (window.innerWidth < 1024) switchMobileView("hall");
}

function refreshAll() {
  renderHall();
  renderDirectoryList();
  renderZoomCards();
  renderDatabaseTable();
  updateLiveCounters();
}

function saveState() {
  const sessionData = {
    meetingDate: document.getElementById("meeting-date-input").value,
    meetingType: document.getElementById("meeting-type-select").value,
    zoomConnections,
    attendees: members
  };
  DataService.saveActiveSession(sessionData);
  updateLiveCounters();
}

// Renderizado del Salón
function renderHall() {
  const leftBox = document.getElementById("grid-hall-left");
  const rightBox = document.getElementById("grid-hall-right");
  if (!leftBox || !rightBox) return;
  leftBox.innerHTML = "";
  rightBox.innerHTML = "";

  hallLayout.rows.forEach((row, rIdx) => {
    const rNum = rIdx + 1;
    const rowL = document.createElement("div");
    rowL.className = "flex items-center gap-1";

    const lblL = document.createElement("span");
    lblL.className = "w-3 text-[9px] font-bold text-slate-500 text-right";
    lblL.innerText = `F${rNum}`;
    rowL.appendChild(lblL);

    for (let s = 1; s <= row.left; s++) {
      const sid = `MAIN-L-R${rNum}-S${s}`;
      const isDis = (row.disabled || []).includes(sid);
      rowL.appendChild(createChairElement(sid, `I${s}`, "main", isDis));
    }
    leftBox.appendChild(rowL);

    const rowR = document.createElement("div");
    rowR.className = "flex items-center gap-1";
    for (let s = 1; s <= row.right; s++) {
      const sid = `MAIN-R-R${rNum}-S${s}`;
      const isDis = (row.disabled || []).includes(sid);
      rowR.appendChild(createChairElement(sid, `D${s}`, "main", isDis));
    }

    const lblR = document.createElement("span");
    lblR.className = "w-3 text-[9px] font-bold text-slate-500 text-left";
    lblR.innerText = `F${rNum}`;
    rowR.appendChild(lblR);
    rightBox.appendChild(rowR);
  });

  document.getElementById("chair-mic-1").innerHTML = "";
  document.getElementById("chair-mic-2").innerHTML = "";
  document.getElementById("chair-mic-1").appendChild(createChairElement("MIC-1", "Mic1", "mic", false));
  document.getElementById("chair-mic-2").appendChild(createChairElement("MIC-2", "Mic2", "mic", false));

  document.getElementById("chairs-ushers-box").innerHTML = "";
  document.getElementById("chairs-ushers-box").appendChild(createChairElement("USHER-1", "Acom1", "usher", false));
  document.getElementById("chairs-ushers-box").appendChild(createChairElement("USHER-2", "Acom2", "usher", false));

  document.getElementById("chairs-sound-box").innerHTML = "";
  document.getElementById("chairs-sound-box").appendChild(createChairElement("BOOTH-1", "Son1", "booth", false));
  document.getElementById("chairs-sound-box").appendChild(createChairElement("BOOTH-2", "Son2", "booth", false));

  const secBox = document.getElementById("grid-hall-second");
  secBox.innerHTML = "";
  document.getElementById("max-sec-hall").innerText = hallLayout.secondHallSeats;
  for (let s = 1; s <= hallLayout.secondHallSeats; s++) {
    const sid = `SEC-S${s}`;
    const isDis = (hallLayout.disabledSecSeats || []).includes(sid);
    secBox.appendChild(createChairElement(sid, `S${s}`, "sec", isDis));
  }
}

function createChairElement(seatId, label, type, isDisabled) {
  const el = document.createElement("div");
  el.id = seatId;

  if (isDisabled) {
    if (isDesignModeActive) {
      el.className = "chair-seat w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-amber-950/40 border border-dashed border-amber-600 text-amber-300 text-xs font-black cursor-pointer";
      el.innerHTML = "+";
      el.onclick = () => toggleDisableChair(seatId);
    } else {
      el.className = "w-9 h-9 sm:w-10 sm:h-10 opacity-0 pointer-events-none";
    }
    return el;
  }

  const occupant = members.find(a => a.seatId === seatId);
  const colorMap = {
    "Grupo 1": "bg-sky-600 border-sky-400 text-white",
    "Grupo 2": "bg-emerald-600 border-emerald-400 text-white",
    "Grupo 3": "bg-amber-600 border-amber-300 text-white",
    "Grupo 4": "bg-purple-600 border-purple-400 text-white",
    "Grupo 5": "bg-pink-600 border-pink-400 text-white",
    "Visitante": "bg-slate-600 border-slate-400 text-white",
    "Menor": "bg-teal-600 border-teal-300 text-white"
  };

  if (occupant) {
    const bg = colorMap[occupant.group] || "bg-indigo-600 border-indigo-400 text-white";
    el.className = `chair-seat relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex flex-col items-center justify-center p-0.5 cursor-pointer border text-center shadow font-sans ${bg}`;
    const shortName = (occupant.shortName || occupant.name).split(" ")[0];
    const lapCount = occupant.lapChildren ? occupant.lapChildren.length : 0;

    el.innerHTML = `
      <span class="text-[8.5px] font-bold truncate max-w-full leading-tight">${shortName}</span>
      <span class="text-[7px] opacity-85 leading-none mt-0.5 uppercase">${occupant.role.split(',')[0]}</span>
      ${lapCount > 0 ? `<span class="absolute -bottom-1 -left-1 bg-amber-400 text-slate-950 text-[7.5px] font-black px-1 rounded-full shadow">👶${lapCount}</span>` : ''}
      ${isDesignModeActive ? `<button class="absolute -top-1 -right-1 bg-amber-500 text-slate-950 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black">✕</button>` : ''}
    `;
  } else {
    el.className = `chair-seat relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex flex-col items-center justify-center bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-500 cursor-pointer ${isDesignModeActive ? 'border-amber-500/50 hover:border-amber-400' : ''}`;
    el.innerHTML = `
      <span class="text-[11px] opacity-40">🪑</span>
      <span class="text-[7px] font-mono opacity-50">${label}</span>
      ${isDesignModeActive ? `<button class="absolute -top-1 -right-1 bg-rose-600 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8.5px] font-bold shadow">✕</button>` : ''}
    `;
  }

  el.onclick = (e) => {
    e.stopPropagation();
    if (isDesignModeActive) toggleDisableChair(seatId);
    else openSeatAssignModal(seatId, label, type, occupant);
  };

  return el;
}

function toggleDisableChair(seatId) {
  hallLayout.rows.forEach(r => {
    if (!r.disabled) r.disabled = [];
    if (r.disabled.includes(seatId)) r.disabled = r.disabled.filter(id => id !== seatId);
    else {
      const p = members.find(a => a.seatId === seatId);
      if (p) window.unseatPerson(p.id);
      r.disabled.push(seatId);
    }
  });
  saveState();
  renderHall();
}

function renderDirectoryList() {
  const container = document.getElementById("directory-list-container");
  if (!container) return;
  container.innerHTML = "";

  const term = currentSearchTerm.toLowerCase().trim();
  const filtered = members.filter(a => {
    const matchesGroup = (currentFilterGroup === "TODOS") || (a.group === currentFilterGroup) || (currentFilterGroup === "Menor" && a.role === "Menor");
    let matchesStatus = true;
    if (currentFilterStatus === "PENDING") matchesStatus = !a.location;
    if (currentFilterStatus === "PLACED") matchesStatus = !!a.location;

    const matchesSearch = !term || 
      (a.name && a.name.toLowerCase().includes(term)) || 
      (a.shortName && a.shortName.toLowerCase().includes(term)) || 
      (a.family && a.family.toLowerCase().includes(term));
    return matchesGroup && matchesStatus && matchesSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="py-6 text-center text-slate-500 text-xs">Sin coincidencias</div>`;
    return;
  }

  filtered.forEach(a => {
    const isPlaced = !!a.location;
    const item = document.createElement("div");
    item.className = `p-2 rounded-xl border flex items-center justify-between gap-1 text-xs ${
      isPlaced ? "bg-slate-950/50 border-slate-800/80 opacity-60" : "bg-slate-950 border-slate-800 hover:border-slate-700"
    }`;

    let locBadge = "";
    if (a.location === "main") locBadge = `<span class="text-[8.5px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">Pral</span>`;
    if (a.location === "sec") locBadge = `<span class="text-[8.5px] px-1.5 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800">Sala 2</span>`;
    if (a.location === "zoom") locBadge = `<span class="text-[8.5px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">Zoom</span>`;

    item.innerHTML = `
      <div class="truncate min-w-0 pr-1">
        <div class="font-medium text-slate-100 truncate text-[11.5px]">${a.shortName || a.name}</div>
        <div class="text-[9px] text-slate-400">${a.family} • <span class="text-indigo-300">${a.group}</span></div>
      </div>
      <div class="flex items-center gap-1 flex-shrink-0">
        ${isPlaced ? `
          ${locBadge}
          <button onclick="window.unseatPerson('${a.id}')" class="p-1 text-slate-400 hover:text-rose-400">✕</button>
        ` : `
          <button onclick="window.autoSeatPerson('${a.id}', 'main')" class="px-1.5 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px]">Salón</button>
          <button onclick="window.quickAddZoomPerson('${a.id}')" class="px-1.5 py-0.5 bg-blue-700 hover:bg-blue-600 text-white rounded text-[10px]" title="Conectar en Zoom">📹</button>
        `}
      </div>
    `;
    container.appendChild(item);
  });
}

function renderZoomCards() {
  const container = document.getElementById("zoom-cards-container");
  if (!container) return;
  container.innerHTML = "";

  const zoomMembers = members.filter(a => a.location === "zoom");

  if (zoomMembers.length === 0) {
    container.innerHTML = `
      <div class="py-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl space-y-2">
        <span class="text-sm block">📹 Sin personas en Zoom</span>
        <div class="flex flex-col gap-1.5 max-w-[200px] mx-auto pt-1">
          <button onclick="window.openQuickZoomModal()" class="w-full py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold shadow">
            ➕ Agregar Personas a Zoom
          </button>
        </div>
      </div>
    `;
    return;
  }

  if (currentZoomDisplay === "grouped") {
    zoomConnections.forEach(conn => {
      const card = document.createElement("div");
      card.className = "p-2.5 rounded-xl bg-slate-950 border border-blue-900/50 space-y-2 shadow-sm";
      const groupMembers = conn.memberIds.map(mid => members.find(a => a.id === mid && a.location === 'zoom')).filter(Boolean);

      let membersHtml = "";
      groupMembers.forEach(m => {
        membersHtml += `
          <div class="flex items-center justify-between py-1 px-1.5 bg-slate-900/80 rounded-lg text-xs">
            <span class="text-white">${m.shortName || m.name} <span class="text-[9px] text-slate-400">(${m.role})</span></span>
            <div class="flex items-center gap-1">
              <button onclick="window.autoSeatPerson('${m.id}', 'main')" class="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded text-[9.5px]">🪑 Salón</button>
              <button onclick="window.unseatPerson('${m.id}')" class="p-0.5 text-slate-400 hover:text-rose-400 text-xs">✕</button>
            </div>
          </div>
        `;
      });

      card.innerHTML = `
        <div class="flex items-center justify-between pb-1.5 border-b border-slate-800">
          <span class="font-bold text-white text-xs truncate">💻 ${conn.label}</span>
          <span class="px-1.5 py-0.2 bg-blue-950 text-blue-300 border border-blue-800 rounded text-[9px] font-mono">${groupMembers.length}</span>
        </div>
        <div class="space-y-1">${membersHtml}</div>
      `;
      container.appendChild(card);
    });
  } else {
    zoomMembers.forEach(m => {
      const item = document.createElement("div");
      item.className = "p-2 rounded-xl bg-slate-950 border border-blue-900/40 flex items-center justify-between text-xs";
      item.innerHTML = `
        <div class="truncate pr-1">
          <div class="font-bold text-white truncate">${m.shortName || m.name}</div>
          <div class="text-[9px] text-slate-400">${m.family} • ${m.group} • ${m.role}</div>
        </div>
        <div class="flex items-center gap-1">
          <button onclick="window.autoSeatPerson('${m.id}', 'main')" class="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded text-[10px]">🪑 Salón</button>
          <button onclick="window.unseatPerson('${m.id}')" class="p-1 text-slate-400 hover:text-rose-400">✕</button>
        </div>
      `;
      container.appendChild(item);
    });
  }
}

function renderDatabaseTable() {
  const tbody = document.getElementById("db-members-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  const term = (document.getElementById("db-search-input")?.value || "").toLowerCase().trim();
  const filterGroup = document.getElementById("db-group-select-filter")?.value || "ALL";

  const filtered = members.filter(a => {
    const matchesGroup = (filterGroup === "ALL") || (a.group === filterGroup) || (filterGroup === "Menor" && a.role === "Menor") || (filterGroup === "Visitante" && a.role === "Visitante");
    const matchesSearch = !term || 
      (a.name && a.name.toLowerCase().includes(term)) || 
      (a.shortName && a.shortName.toLowerCase().includes(term)) || 
      (a.family && a.family.toLowerCase().includes(term)) ||
      (a.id && a.id.toLowerCase().includes(term));
    return matchesGroup && matchesSearch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-500 text-xs">Sin registros.</td></tr>`;
    return;
  }

  filtered.forEach(a => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-950/80 transition-colors";
    tr.innerHTML = `
      <td class="p-2.5">
        <div class="font-bold text-white font-sans">${a.name}</div>
        <div class="text-[9.5px] text-slate-500 font-mono">${a.id}</div>
      </td>
      <td class="p-2.5 font-bold text-indigo-300 font-sans">${a.shortName || ''}</td>
      <td class="p-2.5">${a.family}</td>
      <td class="p-2.5 text-center text-slate-400">${a.familyRole || 'Otro'}</td>
      <td class="p-2.5 text-center font-bold text-sky-400">${a.group}</td>
      <td class="p-2.5 text-center">
        <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${a.role==='Menor'?'bg-teal-950 text-teal-300 border border-teal-800':a.role==='Visitante'?'bg-slate-800 text-slate-300':'bg-indigo-950 text-indigo-300 border border-indigo-800'}">${a.role}</span>
      </td>
      <td class="p-2.5 text-slate-400 truncate max-w-[140px]">${a.aliasZoom || '-'}</td>
      <td class="p-2.5 text-right space-x-1 whitespace-nowrap">
        <button onclick="window.editMemberModal('${a.id}')" class="px-2 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded text-[10px] font-bold">Editar</button>
        <button onclick="window.deleteMemberDirect('${a.id}')" class="px-2 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 rounded text-[10px] font-bold" title="Eliminar integrante">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateLiveCounters() {
  const main = members.filter(a => a.location === "main").length;
  const sec = members.filter(a => a.location === "sec").length;
  const tasks = members.filter(a => a.location === "booth" || a.location === "usher" || a.location === "mic").length;
  const zoom = members.filter(a => a.location === "zoom").length;

  let lapTotal = 0;
  members.forEach(a => {
    if (a.lapChildren && a.lapChildren.length > 0) {
      lapTotal += a.lapChildren.filter(c => c.isCountable !== false).length;
    }
  });

  const presential = main + sec + tasks + lapTotal;
  const grand = presential + zoom;

  document.getElementById("stat-main").innerText = main;
  document.getElementById("stat-sec").innerText = sec;
  document.getElementById("stat-tasks").innerText = tasks;
  document.getElementById("stat-presential").innerText = presential;
  document.getElementById("stat-zoom").innerText = zoom;
  document.getElementById("stat-grand").innerText = grand;

  document.getElementById("cnt-sec-hall").innerText = sec;
  document.getElementById("cnt-zoom-devices").innerText = zoomConnections.length;
  document.getElementById("cnt-zoom-people").innerText = zoom;

  document.getElementById("foot-total-members").innerText = members.length;
  document.getElementById("foot-total-placed").innerText = grand;
  document.getElementById("st-cnt-all").innerText = members.length;
  document.getElementById("st-cnt-pen").innerText = members.filter(a => !a.location).length;
  document.getElementById("st-cnt-pla").innerText = members.filter(a => a.location).length;
}

function openSeatAssignModal(seatId, label, type, occupant) {
  selectedSeatId = seatId;
  selectedSeatType = type;
  document.getElementById("modal-seat-title").innerText = `Silla: ${label}`;
  document.getElementById("modal-seat-search").value = "";

  const vacateBtn = document.getElementById("btn-vacate-seat");
  if (occupant) {
    document.getElementById("modal-seat-subtitle").innerText = `Ocupada por: ${occupant.shortName || occupant.name}`;
    vacateBtn.classList.remove("hidden");
  } else {
    document.getElementById("modal-seat-subtitle").innerText = "Silla libre. Toca a quién sentar:";
    vacateBtn.classList.add("hidden");
  }

  renderSeatModalList();
  document.getElementById("modal-seat").classList.remove("hidden");
}

function renderSeatModalList() {
  const container = document.getElementById("modal-seat-people-list");
  container.innerHTML = "";
  const term = document.getElementById("modal-seat-search").value.toLowerCase().trim();

  const filtered = members.filter(a => !term || a.name.toLowerCase().includes(term) || (a.shortName && a.shortName.toLowerCase().includes(term)));
  filtered.forEach(a => {
    const btn = document.createElement("button");
    btn.className = "w-full text-left p-2 rounded-xl flex items-center justify-between text-xs bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800";
    btn.innerHTML = `
      <div>
        <div class="font-medium text-white">${a.shortName || a.name}</div>
        <div class="text-[9px] text-slate-400">${a.family} • ${a.group}</div>
      </div>
      <span class="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded font-bold">Sentar</span>
    `;
    btn.onclick = () => {
      a.location = selectedSeatType;
      a.seatId = selectedSeatId;
      document.getElementById("modal-seat").classList.add("hidden");
      saveState();
      refreshAll();
    };
    container.appendChild(btn);
  });
}

function populateHogarSelect() {
  const sel = document.getElementById("form-member-hogar");
  if (!sel) return;
  sel.innerHTML = "";
  hogares.forEach(h => {
    const opt = document.createElement("option");
    opt.value = h.id;
    opt.innerText = `${h.name} (${h.id})`;
    sel.appendChild(opt);
  });
}

function showToast(txt) {
  const t = document.getElementById("toast");
  document.getElementById("toast-txt").innerText = txt;
  t.className = "fixed bottom-4 right-4 bg-slate-900 border border-slate-700 text-white text-xs px-3.5 py-2 rounded-xl shadow-2xl opacity-100 transform translate-y-0 transition-all duration-200 z-50 pointer-events-none";
  setTimeout(() => {
    t.classList.remove("translate-y-0", "opacity-100");
    t.classList.add("translate-y-10", "opacity-0");
  }, 2000);
}

// Ventana de Editar Integrante
window.editMemberModal = (id) => {
  populateHogarSelect();
  const deleteBtn = document.getElementById("btn-delete-member-form");

  if (id) {
    const member = members.find(a => a.id === id);
    if (!member) return;
    document.getElementById("modal-member-header").innerHTML = `<span>✏️</span> Editar Integrante (${member.id})`;
    document.getElementById("form-member-id").value = member.id;
    document.getElementById("form-member-name").value = member.name;
    document.getElementById("form-member-shortname").value = member.shortName || "";
    document.getElementById("form-member-hogar").value = member.hogarId || (hogares[0]?.id || "");
    document.getElementById("form-member-familyrole").value = member.familyRole || "Otro";
    document.getElementById("form-member-group").value = member.group || "Grupo 1";
    document.getElementById("form-member-role").value = member.role || "PUB";
    document.getElementById("form-member-aliaszoom").value = member.aliasZoom || "";
    deleteBtn.classList.remove("hidden");
  } else {
    document.getElementById("modal-member-header").innerHTML = `<span>👤</span> Registrar Nuevo Integrante`;
    document.getElementById("form-member-id").value = "";
    document.getElementById("form-member-name").value = "";
    document.getElementById("form-member-shortname").value = "";
    document.getElementById("form-member-hogar").value = hogares[0]?.id || "";
    document.getElementById("form-member-familyrole").value = "Otro";
    document.getElementById("form-member-group").value = "Grupo 1";
    document.getElementById("form-member-role").value = "PUB";
    document.getElementById("form-member-aliaszoom").value = "";
    deleteBtn.classList.add("hidden");
  }

  document.getElementById("modal-edit-member").classList.remove("hidden");
};

// Declaraciones Globales
window.unseatPerson = (id) => {
  const p = members.find(a => a.id === id);
  if (p) {
    p.location = null;
    p.seatId = null;
    p.zoomConnId = null;
    saveState();
    refreshAll();
  }
};

window.autoSeatPerson = (id, type) => {
  const p = members.find(a => a.id === id);
  if (p) {
    p.location = type;
    p.seatId = `SEAT_${Date.now()}`;
    saveState();
    refreshAll();
    showToast(`${p.shortName || p.name} ubicado.`);
  }
};

window.quickAddZoomPerson = (id) => {
  const p = members.find(a => a.id === id);
  if (p) {
    p.location = "zoom";
    p.seatId = null;
    saveState();
    refreshAll();
    showToast(`${p.shortName || p.name} en Zoom.`);
  }
};

window.deleteMemberDirect = async (id) => {
  const p = members.find(a => a.id === id);
  if (!p) return;
  if (!confirm(`¿Eliminar definitivamente a "${p.name}"? Esta acción se sincronizará y no se podrá deshacer.`)) return;

  window.unseatPerson(id);
  members = await DataService.deleteMember(id);
  refreshAll();
  showToast(`"${p.name}" eliminado definitivamente.`);
};

window.openQuickZoomModal = () => {
  const box = document.getElementById("quick-zoom-people-results");
  box.innerHTML = "";
  members.forEach(a => {
    const isZ = a.location === "zoom";
    const btn = document.createElement("button");
    btn.className = `w-full text-left p-2 rounded-xl flex items-center justify-between text-xs ${isZ ? 'bg-blue-950/80 border border-blue-500 text-white' : 'bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800'}`;
    btn.innerHTML = `
      <div>
        <div class="font-bold">${a.shortName || a.name}</div>
        <div class="text-[9px] text-slate-400">${a.family} • ${a.group}</div>
      </div>
      <span class="text-[10px] px-2 py-0.5 bg-blue-600 text-white rounded font-bold">${isZ ? '✓ Conectado' : '+ Conectar'}</span>
    `;
    btn.onclick = () => {
      if (isZ) window.unseatPerson(a.id);
      else window.quickAddZoomPerson(a.id);
      window.openQuickZoomModal();
    };
    box.appendChild(btn);
  });
  document.getElementById("modal-quick-zoom").classList.remove("hidden");
};

// Configuración completa de Event Listeners
function setupEventListeners() {
  const bindClick = (id, handler) => {
    const el = document.getElementById(id);
    if (el) el.onclick = handler;
  };

  // Navegación de vistas
  bindClick("btn-tab-salon", () => switchViewMode("salon"));
  bindClick("btn-tab-db", () => switchViewMode("db"));
  bindClick("btn-return-salon", () => switchViewMode("salon"));
  bindClick("btn-switch-to-db-view", () => switchViewMode("db"));

  bindClick("mob-nav-hall", () => switchMobileView("hall"));
  bindClick("mob-nav-list", () => switchMobileView("list"));
  bindClick("mob-nav-zoom", () => switchMobileView("zoom"));
  bindClick("mob-nav-db", () => switchMobileView("db"));

  // Modo diseñador y zoom de sillas
  bindClick("btn-toggle-design", () => {
    isDesignModeActive = !isDesignModeActive;
    const banner = document.getElementById("editor-banner");
    const tools = document.getElementById("editor-row-tools");
    banner?.classList.toggle("hidden", !isDesignModeActive);
    tools?.classList.toggle("hidden", !isDesignModeActive);
    renderHall();
  });

  bindClick("btn-finish-editor", () => {
    isDesignModeActive = false;
    document.getElementById("editor-banner")?.classList.add("hidden");
    document.getElementById("editor-row-tools")?.classList.add("hidden");
    renderHall();
  });

  bindClick("btn-hall-zoom-in", () => {
    hallZoomScale = Math.min(2.0, hallZoomScale + 0.15);
    applyZoom();
  });

  bindClick("btn-hall-zoom-out", () => {
    hallZoomScale = Math.max(0.65, hallZoomScale - 0.15);
    applyZoom();
  });

  bindClick("btn-hall-zoom-reset", () => {
    hallZoomScale = 1.0;
    applyZoom();
  });

  const applyZoom = () => {
    const wrapper = document.getElementById("hall-scalable-wrapper");
    if (wrapper) wrapper.style.transform = `scale(${hallZoomScale})`;
    const txt = document.getElementById("zoom-lvl-txt");
    if (txt) txt.innerText = `${Math.round(hallZoomScale * 100)}%`;
  };

  bindClick("btn-add-hall-row", () => {
    hallLayout.rows.push({ left: 4, right: 4, disabled: [] });
    renderHall();
  });

  bindClick("btn-remove-hall-row", () => {
    if (hallLayout.rows.length > 1) {
      hallLayout.rows.pop();
      renderHall();
    }
  });

  // Nueva Reunión
  const startNewMeeting = () => {
    const d = document.getElementById("meeting-date-input").value;
    const t = document.getElementById("meeting-type-select").value;
    if (!confirm(`¿Archivar la reunión del ${d} e iniciar una NUEVA reunión?\n\nSe vaciarán Salón y Zoom, conservando tu base de datos de integrantes.`)) return;

    members.forEach(a => {
      a.location = null;
      a.seatId = null;
      a.zoomConnId = null;
      a.lapChildren = [];
    });
    zoomConnections = [];
    saveState();
    refreshAll();
    showToast("Salón y Zoom vaciados para la nueva fecha.");
  };

  bindClick("btn-new-meeting", startNewMeeting);
  bindClick("mob-btn-new-meeting", startNewMeeting);

  // Reportes
  const showReport = () => {
    const d = document.getElementById("meeting-date-input").value;
    const t = document.getElementById("meeting-type-select").value;
    generatedReports = Reports.generateAll(members, zoomConnections, d, t);
    document.getElementById("report-output-textarea").value = generatedReports.r2;
    document.getElementById("modal-report-view").classList.remove("hidden");
  };

  bindClick("btn-open-report", showReport);
  bindClick("mob-btn-report", showReport);
  bindClick("btn-close-report-modal", () => document.getElementById("modal-report-view").classList.add("hidden"));
  bindClick("btn-close-report-bottom", () => document.getElementById("modal-report-view").classList.add("hidden"));

  document.querySelectorAll("#report-type-nav button").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll("#report-type-nav button").forEach(b => b.className = "py-1 px-3 rounded-lg text-slate-400");
      btn.className = "py-1 px-3 rounded-lg font-bold bg-emerald-600 text-white";
      const target = btn.dataset.target;
      document.getElementById("report-output-textarea").value = generatedReports[target] || "";
    };
  });

  bindClick("btn-copy-report-clip", () => {
    const area = document.getElementById("report-output-textarea");
    area.select();
    document.execCommand("copy");
    const alert = document.getElementById("toast-copied-alert");
    if (alert) alert.style.opacity = "1";
    setTimeout(() => { if (alert) alert.style.opacity = "0"; }, 2000);
    showToast("Reporte copiado.");
  });

  // Modal Backup e Historial
  bindClick("btn-open-backup", () => document.getElementById("modal-backup").classList.remove("hidden"));
  bindClick("btn-close-backup-modal", () => document.getElementById("modal-backup").classList.add("hidden"));
  bindClick("btn-close-backup-bottom", () => document.getElementById("modal-backup").classList.add("hidden"));

  bindClick("btn-open-history", async () => {
    const records = await DataService.getHistory();
    const tbody = document.getElementById("history-records-table-body");
    tbody.innerHTML = "";
    if (records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-500">Sin historial guardado.</td></tr>`;
    } else {
      records.forEach((r, idx) => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-900/60";
        tr.innerHTML = `
          <td class="p-2"><strong class="text-white">${r.fecha}</strong> <span class="text-[9px] text-indigo-300">(${r.tipo})</span></td>
          <td class="p-2 text-center text-emerald-400 font-bold">${r.totalPresencial || 0}</td>
          <td class="p-2 text-center text-blue-400 font-bold">${r.totalZoom || 0}</td>
          <td class="p-2 text-center text-white font-black">${r.granTotal || 0}</td>
          <td class="p-2 text-right">
            <button onclick="window.restoreHistoryRecord(${idx})" class="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px]">Cargar</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
    document.getElementById("modal-history").classList.remove("hidden");
  });

  bindClick("btn-close-history-modal", () => document.getElementById("modal-history").classList.add("hidden"));
  bindClick("btn-close-history-bottom", () => document.getElementById("modal-history").classList.add("hidden"));

  bindClick("btn-download-session-json", () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ members, hogares, zoomConnections }));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = `sesion_asistencia_${document.getElementById("meeting-date-input").value}.json`;
    a.click();
    showToast("JSON descargado.");
  });

  bindClick("btn-copy-session-json", () => {
    navigator.clipboard.writeText(JSON.stringify({ members, hogares, zoomConnections }));
    showToast("JSON copiado al portapapeles.");
  });

  // Integrantes DB
  bindClick("btn-create-member-db", () => window.editMemberModal(null));
  bindClick("btn-quick-create-person", () => window.editMemberModal(null));
  bindClick("btn-open-register-from-seat", () => {
    document.getElementById("modal-seat").classList.add("hidden");
    window.editMemberModal(null);
  });
  bindClick("btn-close-member-modal", () => document.getElementById("modal-edit-member").classList.add("hidden"));
  bindClick("btn-cancel-member-form", () => document.getElementById("modal-edit-member").classList.add("hidden"));

  bindClick("btn-submit-member-form", async () => {
    const id = document.getElementById("form-member-id").value;
    const name = document.getElementById("form-member-name").value.trim();
    let shortName = document.getElementById("form-member-shortname").value.trim();
    const hogarId = document.getElementById("form-member-hogar").value;
    const familyRole = document.getElementById("form-member-familyrole").value;
    const group = document.getElementById("form-member-group").value;
    const role = document.getElementById("form-member-role").value;
    const aliasZoom = document.getElementById("form-member-aliaszoom").value.trim();

    if (!name) return alert("Por favor ingresa el nombre oficial.");

    const hogarObj = hogares.find(h => h.id === hogarId);
    const familyName = hogarObj ? hogarObj.name : "General";

    if (!shortName) {
      const parts = name.split(/\s+/);
      shortName = `${parts[0]} ${familyName.split(/\s+/)[0]}`;
    }

    const memberObj = {
      id: id || ("P" + String(Date.now()).slice(-4)),
      name,
      shortName,
      hogarId,
      family: familyName,
      familyRole,
      group,
      role,
      aliasZoom,
      aliasWhatsApp: "",
      device: ""
    };

    members = await DataService.saveMember(memberObj);
    document.getElementById("modal-edit-member").classList.add("hidden");
    refreshAll();
    showToast(`Integrante ${shortName} guardado.`);
  });

  bindClick("btn-delete-member-form", async () => {
    const id = document.getElementById("form-member-id").value;
    if (id) {
      await window.deleteMemberDirect(id);
      document.getElementById("modal-edit-member").classList.add("hidden");
    }
  });

  // Hogares
  const openHogaresModal = () => {
    const box = document.getElementById("hogares-table-list");
    box.innerHTML = "";
    hogares.forEach(h => {
      const row = document.createElement("div");
      row.className = "p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs";
      row.innerHTML = `
        <div>
          <strong class="text-white">${h.name}</strong> <span class="text-[10px] text-teal-300 font-mono">(${h.id})</span>
          <span class="text-[9px] text-slate-400 block">${h.group}</span>
        </div>
        <button onclick="window.deleteHogarDirect('${h.id}')" class="text-rose-400 hover:text-rose-300 font-bold px-2">✕</button>
      `;
      box.appendChild(row);
    });
    document.getElementById("modal-hogares").classList.remove("hidden");
  };

  bindClick("btn-open-hogares-catalog", openHogaresModal);
  bindClick("btn-close-hogares-modal", () => document.getElementById("modal-hogares").classList.add("hidden"));
  bindClick("btn-close-hogares-bottom", () => document.getElementById("modal-hogares").classList.add("hidden"));

  bindClick("btn-submit-hogar", async () => {
    const name = document.getElementById("form-hogar-name").value.trim();
    const group = document.getElementById("form-hogar-group").value;
    if (!name) return alert("Ingresa el nombre de familia.");

    const maxNum = hogares.reduce((max, h) => {
      const n = parseInt(h.id.replace("H", "")) || 0;
      return n > max ? n : max;
    }, 0);
    const newId = "H" + String(maxNum + 1).padStart(3, "0");

    const newH = { id: newId, name, membersCount: 1, group };
    hogares = await DataService.saveHogar(newH);
    document.getElementById("form-hogar-name").value = "";
    populateHogarSelect();
    openHogaresModal();
    showToast(`Hogar ${name} creado.`);
  });

  // Carga Masiva de CSV
  const fileInput = document.getElementById("file-upload-csv-db");
  if (fileInput) {
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        showToast("Procesando archivo CSV...");
        const count = await DataService.importCSVFile(file);
        members = await DataService.getMembers();
        hogares = await DataService.getHogares();
        populateHogarSelect();
        refreshAll();
        showToast(`¡Éxito! Se cargaron ${count} integrantes.`);
      } catch (err) {
        alert("Error cargando CSV: " + err.message);
      }
    };
  }

  // Zoom
  bindClick("btn-zoom-view-grouped", () => {
    currentZoomDisplay = "grouped";
    document.getElementById("btn-zoom-view-grouped").className = "py-1 rounded-lg font-bold bg-blue-600 text-white";
    document.getElementById("btn-zoom-view-individual").className = "py-1 rounded-lg text-slate-400";
    renderZoomCards();
  });

  bindClick("btn-zoom-view-individual", () => {
    currentZoomDisplay = "individual";
    document.getElementById("btn-zoom-view-individual").className = "py-1 rounded-lg font-bold bg-blue-600 text-white";
    document.getElementById("btn-zoom-view-grouped").className = "py-1 rounded-lg text-slate-400";
    renderZoomCards();
  });

  bindClick("btn-quick-add-zoom", window.openQuickZoomModal);
  bindClick("btn-close-quick-zoom", () => document.getElementById("modal-quick-zoom").classList.add("hidden"));
  bindClick("btn-close-quick-zoom-bottom", () => document.getElementById("modal-quick-zoom").classList.add("hidden"));

  bindClick("btn-open-paste-zoom", () => document.getElementById("modal-paste-zoom").classList.remove("hidden"));
  bindClick("btn-close-paste-modal", () => document.getElementById("modal-paste-zoom").classList.add("hidden"));
  bindClick("btn-cancel-paste", () => document.getElementById("modal-paste-zoom").classList.add("hidden"));

  bindClick("btn-load-sample-zoom", () => {
    document.getElementById("paste-zoom-textarea").value = 
`[26/8, 6:31 p.m.] Jamer Y Fabiola Hernández: (Jamer, Jamer A, Fabiola=3)
[26/8, 6:34 p.m.] María de Castro: (María, Nalieth=2)
- Karina Salgado
- Esther Mendez
- Jaider
- Ludys Quiroz`;
  });

  bindClick("btn-process-zoom-report", () => {
    const txt = document.getElementById("paste-zoom-textarea").value;
    const lines = txt.split("\n");
    let count = 0;
    lines.forEach(line => {
      const term = line.replace(/[-*•\d\.\s\(\)=]+/g, " ").trim();
      const matched = RulesEngine.matchPerson(term, members);
      if (matched) {
        matched.location = "zoom";
        count++;
      }
    });
    document.getElementById("modal-paste-zoom").classList.add("hidden");
    saveState();
    refreshAll();
    showToast(`${count} personas sincronizadas a Zoom.`);
  });

  bindClick("btn-close-seat-modal", () => document.getElementById("modal-seat").classList.add("hidden"));
  bindClick("btn-vacate-seat", () => {
    if (selectedSeatId) {
      const p = members.find(a => a.seatId === selectedSeatId);
      if (p) window.unseatPerson(p.id);
      document.getElementById("modal-seat").classList.add("hidden");
    }
  });

  // Filtros de búsqueda
  const dirSearch = document.getElementById("dir-search-input");
  if (dirSearch) {
    dirSearch.oninput = (e) => {
      currentSearchTerm = e.target.value;
      renderDirectoryList();
    };
  }

  document.querySelectorAll("#group-filters-wrapper button").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll("#group-filters-wrapper button").forEach(b => b.className = "filter-pill px-2 py-0.5 rounded-lg bg-slate-950 text-slate-400 border border-slate-800 font-medium whitespace-nowrap");
      btn.className = "filter-pill tab-active px-2 py-0.5 rounded-lg bg-indigo-600 text-white font-medium whitespace-nowrap";
      currentFilterGroup = btn.dataset.g;
      renderDirectoryList();
    };
  });

  bindClick("st-filter-all", () => setStatusFilter("ALL"));
  bindClick("st-filter-pen", () => setStatusFilter("PENDING"));
  bindClick("st-filter-pla", () => setStatusFilter("PLACED"));
}

function setStatusFilter(st) {
  currentFilterStatus = st;
  const bAll = document.getElementById("st-filter-all");
  const bPen = document.getElementById("st-filter-pen");
  const bPla = document.getElementById("st-filter-pla");
  [bAll, bPen, bPla].forEach(b => { if (b) b.className = "py-1 rounded-lg text-slate-400"; });
  if (st === "ALL" && bAll) bAll.className = "py-1 rounded-lg font-bold bg-indigo-600 text-white";
  if (st === "PENDING" && bPen) bPen.className = "py-1 rounded-lg font-bold bg-indigo-600 text-white";
  if (st === "PLACED" && bPla) bPla.className = "py-1 rounded-lg font-bold bg-indigo-600 text-white";
  renderDirectoryList();
}

function switchViewMode(mode) {
  const sView = document.getElementById("view-salon-mode");
  const dView = document.getElementById("view-db-mode");
  if (mode === "salon") {
    sView?.classList.remove("hidden");
    dView?.classList.add("hidden");
  } else {
    sView?.classList.add("hidden");
    dView?.classList.remove("hidden");
    renderDatabaseTable();
  }
}

function switchMobileView(view) {
  if (view === "db") {
    switchViewMode("db");
    return;
  }
  switchViewMode("salon");
  const pList = document.getElementById("panel-directory-col");
  const pHall = document.getElementById("panel-hall-col");
  const pZoom = document.getElementById("panel-zoom-col");

  [pList, pHall, pZoom].forEach(p => p?.classList.add("hidden"));
  if (view === "hall") pHall?.classList.remove("hidden");
  if (view === "list") pList?.classList.remove("hidden");
  if (view === "zoom") pZoom?.classList.remove("hidden");
}

window.deleteHogarDirect = async (id) => {
  if (!confirm(`¿Eliminar este hogar? Los integrantes asociados quedarán sin familia asignada.`)) return;
  hogares = await DataService.deleteHogar(id);
  populateHogarSelect();
  refreshAll();
  showToast("Hogar eliminado.");
};

document.addEventListener("DOMContentLoaded", init);
