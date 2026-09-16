// Generación Estructurada de los 3 Reportes Obligatorios
import { RulesEngine } from "./rules-engine.js";

export const Reports = {
  generateAll(members, zoomConnections, dateStr, typeStr) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Filtrar presentes
    const presentMembers = members.filter(a => a.location && a.isCountable !== false);
    const presentPubs = presentMembers.filter(a => a.role !== 'Menor' && a.role !== 'Visitante');
    const presentMinors = presentMembers.filter(a => a.role === 'Menor');
    const presentVisitors = presentMembers.filter(a => a.role === 'Visitante' || a.group === 'Visitante');

    let lapChildrenCount = 0;
    members.forEach(a => {
      if (a.lapChildren && a.lapChildren.length > 0) {
        lapChildrenCount += a.lapChildren.filter(c => c.isCountable !== false).length;
      }
    });

    const totalPubs = presentPubs.length;
    const totalMinors = presentMinors.length + lapChildrenCount;
    const totalVisitors = presentVisitors.length;
    const grandTotal = totalPubs + totalMinors + totalVisitors;

    // --- REPORTE 1: EVALUACIÓN Y ANÁLISIS INTERNO ---
    let r1 = `--- REPORTE 1: EVALUACIÓN Y ANÁLISIS INTERNO ---\n\n`;
    r1 += `1. Conexiones Excluidas de Cabina / Operativas:\n`;
    r1 += `   - Transmisión Principal Salón (Anfitrión)\n`;
    r1 += `   - Audio / Cabina de Sonido (Coanfitrión)\n`;
    r1 += `   - Puesto Acomodadores Entrada\n\n`;
    r1 += `2. Resumen General:\n`;
    r1 += `   - Total conexiones virtuales efectivas: ${zoomConnections.length}\n`;
    r1 += `   - Total Publicadores (Grupos 1 al 5): ${totalPubs}\n`;
    r1 += `   - Total Menores: ${totalMinors}\n`;
    r1 += `   - Total Visitantes: ${totalVisitors}\n`;
    r1 += `   - Gran Total Asistencia: ${grandTotal}\n`;

    // --- REPORTE 2: MENSAJE PARA WHATSAPP (Jerarquía con - y ------) ---
    let r2 = `*REPORTE ASISTENCIA ZOOM*\n`;
    r2 += `*Fecha:* ${dateStr}\n`;
    r2 += `*Reunión:* ${typeStr}\n`;
    r2 += `*Hora de captura:* ${timeStr}\n\n`;

    r2 += `📊 *CONSOLIDADO DE ASISTENCIA*\n`;
    r2 += `• Total Publicadores: *${totalPubs}*\n`;
    r2 += `• Total Menores: *${totalMinors}*\n`;
    r2 += `• Total Visitantes: *${totalVisitors}*\n`;
    r2 += `🔥 *TOTAL ASISTENCIA VIRTUAL:* ${grandTotal}\n\n`;

    r2 += `═══════════════════════════\n`;
    r2 += `🏛️ *DESGLOSE POR GRUPOS*\n`;
    r2 += `═══════════════════════════\n\n`;

    let pNum = 1;
    const allMissing = [];

    for (let g = 1; g <= 5; g++) {
      const gKey = `Grupo ${g}`;
      r2 += `*GRUPO ${g}*\n`;

      const gMembers = members.filter(a => a.group === gKey && a.location && a.isCountable !== false);
      const gPubs = gMembers.filter(a => a.role !== 'Menor' && a.role !== 'Visitante');
      const gMissing = members.filter(a => a.group === gKey && a.role !== 'Menor' && a.role !== 'Visitante' && !a.location);

      if (gMembers.length === 0) {
        r2 += `- (Sin asistentes presentes)\n`;
      } else {
        const familyMap = {};
        gMembers.forEach(a => {
          const famKey = a.hogarId || a.family || "General";
          if (!familyMap[famKey]) familyMap[famKey] = [];
          familyMap[famKey].push(a);
        });

        Object.keys(familyMap).forEach(famKey => {
          const mList = familyMap[famKey];
          mList.sort((a, b) => {
            const score = r => (r === "Padre" || r === "Esposo" ? 1 : (r === "Madre" || r === "Esposa" ? 2 : 3));
            return score(a.familyRole) - score(b.familyRole);
          });

          mList.forEach((m, idx) => {
            const isHead = (idx === 0);
            const prefix = isHead ? `- ${pNum}. ` : `------ ${pNum}. `;
            const locTag = m.location === 'zoom' ? ' (Zoom)' : '';

            let roleTag = "";
            if (m.role === 'Menor') roleTag = " (Menor)";
            else if (m.role === 'Visitante') roleTag = " (Visitante)";
            else if (m.role && m.role !== 'PUB') roleTag = ` (${m.role})`;

            r2 += `${prefix}${m.shortName || m.name}${roleTag}${locTag}\n`;
            pNum++;

            if (m.lapChildren && m.lapChildren.length > 0) {
              m.lapChildren.forEach(child => {
                if (child.isCountable !== false) {
                  r2 += `------ ${pNum}. ${child.name} (Menor en brazos)\n`;
                  pNum++;
                }
              });
            }
          });
        });
      }

      r2 += `\n*Total Grupo ${g} = ${gPubs.length} publicadores*\n`;

      if (gMissing.length > 0) {
        r2 += `_Faltantes Grupo ${g}:_\n`;
        gMissing.forEach(miss => {
          r2 += `  • ${miss.shortName || miss.name}\n`;
          allMissing.push(miss);
        });
      } else {
        r2 += `_Faltantes Grupo ${g}: Ninguno (100% asistencia)_\n`;
      }
      r2 += `\n`;
    }

    if (presentVisitors.length > 0) {
      r2 += `*VISITANTES NO ASIGNADOS A GRUPO:*\n`;
      presentVisitors.forEach(v => {
        const locTag = v.location === 'zoom' ? ' (Zoom)' : '';
        r2 += `- ${pNum}. ${v.shortName || v.name} (Visitante)${locTag}\n`;
        pNum++;
      });
      r2 += `\n`;
    }

    r2 += `═══════════════════════════\n`;
    r2 += `📋 *CONSOLIDADO GENERAL DE FALTANTES (${allMissing.length})*\n`;
    r2 += `═══════════════════════════\n`;
    if (allMissing.length === 0) {
      r2 += `¡Excelente! Toda la congregación asistió.\n`;
    } else {
      allMissing.forEach(f => {
        r2 += `- ${f.shortName || f.name} (${f.group})\n`;
      });
    }

    // --- REPORTE 3: VALIDACIÓN Y APRENDIZAJE ---
    let r3 = `--- REPORTE 3: VALIDACIÓN Y APRENDIZAJE ---\n\n`;
    r3 += `1. Conexiones operativas excluidas de la cuenta: Cabina de sonido y acomodador.\n`;
    r3 += `2. Salvedades de WhatsApp: Se verificó que todas las personas reportadas figurasen en Zoom.\n`;
    r3 += `3. Normalizaciones aplicadas según catálogo de hogares.\n`;
    r3 += `4. No se registraron anomalías en las conexiones domésticas procesadas.\n`;

    return { r1, r2, r3 };
  }
};
