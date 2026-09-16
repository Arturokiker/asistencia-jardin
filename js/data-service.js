// Capa de Datos: Firestore + LocalStorage + Parser e Importador Masivo de CSV
import { db, isOnlineDB, CONGREGATION_ID } from "./firebase-config.js";
import { masterMembersSeed, masterHogaresSeed } from "./seed-data.js";
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const KEY_MEMBERS = `asistencia_${CONGREGATION_ID}_members`;
const KEY_HOGARES = `asistencia_${CONGREGATION_ID}_hogares`;
const KEY_SESSION = `asistencia_${CONGREGATION_ID}_session`;
const KEY_HISTORY = `asistencia_${CONGREGATION_ID}_history`;

export const DataService = {
  // Cargar Integrantes con inicialización automática de semilla
  async getMembers() {
    if (isOnlineDB) {
      try {
        const snap = await getDocs(collection(db, "congregaciones", CONGREGATION_ID, "integrantes"));
        if (!snap.empty) {
          const list = [];
          snap.forEach(d => list.push(d.data()));
          localStorage.setItem(KEY_MEMBERS, JSON.stringify(list));
          return list;
        } else {
          // Si Firestore está recién creado y vacío, puebla con los 75 integrantes semilla
          const initialList = JSON.parse(JSON.stringify(masterMembersSeed));
          for (const m of initialList) {
            await setDoc(doc(db, "congregaciones", CONGREGATION_ID, "integrantes", m.id), m);
          }
          localStorage.setItem(KEY_MEMBERS, JSON.stringify(initialList));
          return initialList;
        }
      } catch (err) {
        console.warn("Lectura offline o Firestore pendiente de inicializar:", err);
      }
    }

    const local = localStorage.getItem(KEY_MEMBERS);
    if (local) {
      try { return JSON.parse(local); } catch(e) {}
    }
    const seed = JSON.parse(JSON.stringify(masterMembersSeed));
    localStorage.setItem(KEY_MEMBERS, JSON.stringify(seed));
    return seed;
  },

  async saveMember(member) {
    const list = await this.getMembers();
    const idx = list.findIndex(m => m.id === member.id);
    if (idx >= 0) list[idx] = member;
    else list.push(member);

    localStorage.setItem(KEY_MEMBERS, JSON.stringify(list));

    if (isOnlineDB) {
      try {
        await setDoc(doc(db, "congregaciones", CONGREGATION_ID, "integrantes", member.id), member);
      } catch (err) {
        console.warn("Escritura offline encolada en Firestore:", err);
      }
    }
    return list;
  },

  async deleteMember(memberId) {
    const list = await this.getMembers();
    const updated = list.filter(m => m.id !== memberId);
    localStorage.setItem(KEY_MEMBERS, JSON.stringify(updated));

    if (isOnlineDB) {
      try {
        await deleteDoc(doc(db, "congregaciones", CONGREGATION_ID, "integrantes", memberId));
      } catch (err) {
        console.warn("Borrado offline encolado en Firestore:", err);
      }
    }
    return updated;
  },

  // Cargar Hogares
  async getHogares() {
    if (isOnlineDB) {
      try {
        const snap = await getDocs(collection(db, "congregaciones", CONGREGATION_ID, "hogares"));
        if (!snap.empty) {
          const list = [];
          snap.forEach(d => list.push(d.data()));
          localStorage.setItem(KEY_HOGARES, JSON.stringify(list));
          return list;
        } else {
          const initialHogares = JSON.parse(JSON.stringify(masterHogaresSeed));
          for (const h of initialHogares) {
            await setDoc(doc(db, "congregaciones", CONGREGATION_ID, "hogares", h.id), h);
          }
          localStorage.setItem(KEY_HOGARES, JSON.stringify(initialHogares));
          return initialHogares;
        }
      } catch (err) {
        console.warn("Error leyendo hogares de Firestore:", err);
      }
    }
    const local = localStorage.getItem(KEY_HOGARES);
    if (local) {
      try { return JSON.parse(local); } catch(e) {}
    }
    const seed = JSON.parse(JSON.stringify(masterHogaresSeed));
    localStorage.setItem(KEY_HOGARES, JSON.stringify(seed));
    return seed;
  },

  async saveHogar(hogar) {
    const list = await this.getHogares();
    const idx = list.findIndex(h => h.id === hogar.id);
    if (idx >= 0) list[idx] = hogar;
    else list.push(hogar);

    localStorage.setItem(KEY_HOGARES, JSON.stringify(list));

    if (isOnlineDB) {
      try {
        await setDoc(doc(db, "congregaciones", CONGREGATION_ID, "hogares", hogar.id), hogar);
      } catch (err) {
        console.warn("Guardado offline encolado:", err);
      }
    }
    return list;
  },

  async deleteHogar(hogarId) {
    const list = await this.getHogares();
    const updated = list.filter(h => h.id !== hogarId);
    localStorage.setItem(KEY_HOGARES, JSON.stringify(updated));

    if (isOnlineDB) {
      try {
        await deleteDoc(doc(db, "congregaciones", CONGREGATION_ID, "hogares", hogarId));
      } catch (err) {
        console.warn("Borrado offline encolado:", err);
      }
    }
    return updated;
  },

  // Sesión Activa
  async getActiveSession() {
    if (isOnlineDB) {
      try {
        const snap = await getDoc(doc(db, "congregaciones", CONGREGATION_ID, "sesion_activa", "actual"));
        if (snap.exists()) {
          const data = snap.data();
          localStorage.setItem(KEY_SESSION, JSON.stringify(data));
          return data;
        }
      } catch (err) {
        console.warn("Lectura offline sesión:", err);
      }
    }
    const local = localStorage.getItem(KEY_SESSION);
    return local ? JSON.parse(local) : null;
  },

  async saveActiveSession(sessionData) {
    localStorage.setItem(KEY_SESSION, JSON.stringify(sessionData));
    if (isOnlineDB) {
      try {
        await setDoc(doc(db, "congregaciones", CONGREGATION_ID, "sesion_activa", "actual"), sessionData);
      } catch (err) {
        console.warn("Sesión activa guardada offline:", err);
      }
    }
  },

  // Historial
  async getHistory() {
    const local = localStorage.getItem(KEY_HISTORY);
    return local ? JSON.parse(local) : [];
  },

  async saveHistory(historyList) {
    localStorage.setItem(KEY_HISTORY, JSON.stringify(historyList));
    if (isOnlineDB && historyList.length > 0) {
      try {
        const latest = historyList[0];
        if (latest && latest.id) {
          await setDoc(doc(db, "congregaciones", CONGREGATION_ID, "historial", latest.id), latest);
        }
      } catch (err) {
        console.warn("Historial encolado offline:", err);
      }
    }
  },

  // Importador Masivo de CSV Oficial
  async importCSVFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target.result;
          const lines = text.split("\n");
          if (lines.length < 2) return resolve(0);

          const membersList = await this.getMembers();
          const hogaresList = await this.getHogares();
          let count = 0;

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = [];
            let inQuotes = false;
            let token = "";
            for (let c = 0; c < line.length; c++) {
              const char = line[c];
              if (char === '"') inQuotes = !inQuotes;
              else if (char === ',' && !inQuotes) {
                cols.push(token.trim());
                token = "";
              } else {
                token += char;
              }
            }
            cols.push(token.trim());

            if (cols.length >= 4 && cols[3]) {
              const pId = cols[0] || ("P" + String(Date.now()).slice(-4));
              const hId = cols[1] || "H001";
              const fam = cols[2] || "General";
              const name = cols[3].replace(/^"|"$/g, "").trim();
              const famRole = cols[4] || "Otro";
              const role = cols[5] || "PUB";
              const group = (cols[6] && cols[6] !== '-') ? cols[6] : "Grupo 1";
              const aliasZoom = cols[9] || "";
              const aliasWhatsApp = cols[10] || "";
              const device = cols[11] || "";

              if (!hogaresList.some(h => h.id === hId)) {
                hogaresList.push({ id: hId, name: fam, membersCount: 1, group });
              }

              const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/);
              let shortName = parts[0];
              if (name.includes("Jamer Arturo")) shortName = "Jamer Arturo Hernandez";
              else if (name.includes("Jamer Joaquin") || name.includes("Jamer Hernandez")) shortName = "Jamer Hernandez";
              else if (name.includes("Michael Andres")) shortName = "Michael Martinez";
              else if (name.includes("Luis Miguel")) shortName = "Luis Miguel Saumeth";
              else if (name.includes("Luis Alberto")) shortName = "Luis Saumeth";
              else if (fam && fam !== "General") shortName = `${parts[0]} ${fam.split(/\s+/)[0]}`;
              else if (parts.length > 1) shortName = `${parts[0]} ${parts[1]}`;

              const memberObj = {
                id: pId,
                name,
                shortName,
                hogarId: hId,
                family: fam,
                familyRole: famRole,
                role,
                group,
                aliasZoom,
                aliasWhatsApp,
                device
              };

              const existingIdx = membersList.findIndex(m => m.id === pId || m.name === name);
              if (existingIdx >= 0) membersList[existingIdx] = memberObj;
              else membersList.push(memberObj);

              if (isOnlineDB) {
                await setDoc(doc(db, "congregaciones", CONGREGATION_ID, "integrantes", pId), memberObj);
              }
              count++;
            }
          }

          localStorage.setItem(KEY_MEMBERS, JSON.stringify(membersList));
          localStorage.setItem(KEY_HOGARES, JSON.stringify(hogaresList));
          resolve(count);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }
};
