// Motor de Análisis de Asistencia: Reglas 1 a 10
export const RulesEngine = {
  // Exclusiones obligatorias de Cabina / Salón (Regla 2)
  isTechnicalAccount(nameOrDevice) {
    const raw = (nameOrDevice || "").toLowerCase();
    const technicalKeywords = [
      "cabina", "anfitrión", "host", "coanfitrión", "cohost", 
      "audio", "sonido", "acomodador", "salon del reino", "salón del reino"
    ];
    return technicalKeywords.some(kw => raw.includes(kw));
  },

  // Normalización y corrección ortográfica (Regla 6)
  normalizeText(term) {
    let clean = (term || "").toLowerCase().trim();
    if (clean.includes("rñus") || clean.includes("rous")) return "rose";
    return clean;
  },

  // Cruce de Zoom contra la Base de Datos (Regla 4 y Regla 5)
  matchPerson(searchTerm, members) {
    const clean = this.normalizeText(searchTerm);
    if (!clean || clean.length < 3) return null;

    return members.find(m => {
      const name = (m.name || "").toLowerCase();
      const short = (m.shortName || "").toLowerCase();
      const aliasZ = (m.aliasZoom || "").toLowerCase();
      const aliasW = (m.aliasWhatsApp || "").toLowerCase();
      const dev = (m.device || "").toLowerCase();
      const first = name.split(" ")[0];

      return name.includes(clean) || 
             short.includes(clean) || 
             (aliasZ && aliasZ.includes(clean)) || 
             (aliasW && aliasW.includes(clean)) || 
             (dev && dev.includes(clean)) ||
             (first.length > 3 && clean.includes(first));
    }) || null;
  },

  // Desglose de familias mixtas y cálculo de cifras (Regla 8)
  resolveZoomCounts(zoomConnections, members) {
    let pubsCount = 0;
    let minorsCount = 0;
    let visitorsCount = 0;

    zoomConnections.forEach(conn => {
      conn.memberIds.forEach(mid => {
        const m = members.find(a => a.id === mid && a.location === 'zoom');
        if (m && m.isCountable !== false) {
          if (m.role === 'Menor') minorsCount++;
          else if (m.role === 'Visitante') visitorsCount++;
          else pubsCount++;
        }
      });
    });

    return { pubsCount, minorsCount, visitorsCount, total: pubsCount + minorsCount + visitorsCount };
  }
};
