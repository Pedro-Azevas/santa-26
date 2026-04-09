import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, ZoomIn, ZoomOut, X } from 'lucide-react';

const JSON_URL =
  'https://script.google.com/macros/s/AKfycbwBhHiWH7MTVLpRHQZ2pr48bo9n6C3V9IGcnQ2K0bZ3V-Zp5ewHgMJznE1yU-ns9I84/exec';

const MAPA_URL = '/mapa-festa.jpeg';
const HERO_URL = '/hero-festa-pb.jpg';

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function toNumber(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function sortHorario(a, b) {
  return String(a.horario).localeCompare(String(b.horario), 'pt-BR');
}

function getStatus(remanescentes) {
  if (remanescentes <= 0) {
    return { texto: 'ESGOTADO', classe: 'chip chip-off', disponivel: false };
  }
  if (remanescentes === 1) {
    return { texto: 'ÚLTIMA VAGA', classe: 'chip chip-warn', disponivel: true };
  }
  return { texto: `${remanescentes} vagas`, classe: 'chip chip-on', disponivel: true };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getMaxOffset(zoom) {
  return ((zoom - 1) / zoom) * 50;
}

function clampOffset(x, y, zoom) {
  const maxOffset = getMaxOffset(zoom);
  return {
    x: clamp(x, -maxOffset, maxOffset),
    y: clamp(y, -maxOffset, maxOffset),
  };
}

function BarracaMarker({ active }) {
  return (
    <motion.div
      animate={{ scale: active ? 1.06 : 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className="marker-wrap"
    >
      <span className={`marker-glow ${active ? 'is-active' : ''}`} />
      <span className={`marker-highlight ${active ? 'is-active' : ''}`} />
      <div className="marker-hitbox" />
    </motion.div>
  );
}

function PopupBarraca({ barraca, isMobile = false, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      className={isMobile ? 'popup popup-mobile' : 'popup'}
    >
      <div className="popup-head">
        <div>
          <div className="popup-type">{barraca.tipo || ''}</div>
          <div className="popup-title">{barraca.nome}</div>
          <div className="popup-local">{barraca.local}</div>
        </div>

        {isMobile ? (
          <button type="button" className="popup-close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        ) : null}
      </div>

      <div className="popup-list">
        {barraca.horarios.length === 0 && <div className="popup-empty">Sem horários</div>}

        {barraca.horarios.map((item) => {
          const status = getStatus(item.remanescentes);

          if (!status.disponivel || !item.link) {
            return (
              <div key={`${barraca.key}-${item.horario}`} className={`${status.classe} popup-pill disabled`}>
                <span>{item.horario}</span>
                <span>{status.texto}</span>
              </div>
            );
          }

          return (
            <a
              key={`${barraca.key}-${item.horario}`}
              href={item.link}
              target="_blank"
              rel="noreferrer"
              className={`${status.classe} popup-pill`}
            >
              <span>{item.horario}</span>
              <span className="popup-pill-right">
                {status.texto}
                <ExternalLink size={14} />
              </span>
            </a>
          );
        })}
      </div>
    </motion.div>
  );
}

export default function App() {
  const [data, setData] = useState([]);
  const [hoveredKey, setHoveredKey] = useState(null);
  const [lockedKey, setLockedKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mapZoom, setMapZoom] = useState(1);
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [isMobilePopupOpen, setIsMobilePopupOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(JSON_URL);
        if (!res.ok) throw new Error('Não foi possível carregar a planilha do site.');
        const json = await res.json();
        setData(Array.isArray(json) ? json : []);
      } catch (err) {
        setError(err.message || 'Erro ao carregar dados.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const barracas = useMemo(() => {
    const grouped = new Map();

    for (const row of data) {
      const id = Number(row.ID_BARRACA);
      const nome = String(row.NOME ?? '').trim();
      const local = String(row.LOCAL ?? '').trim();
      const tipo = String(row.TIPO ?? '').trim();
      const horario = String(row['HORÁRIO'] ?? row.HORARIO ?? '').trim();
      const link = String(row.LINK_FORMS ?? '').trim();

      if (!nome || !local) continue;
      if (!id || Number.isNaN(id)) continue;

      const key = `${id}-${normalize(nome)}-${normalize(local)}`;
      const x = toNumber(row.X);
      const y = toNumber(row.Y);

      if (!grouped.has(key)) {
        grouped.set(key, {
          id,
          key,
          nome,
          local,
          tipo,
          x,
          y,
          horarios: [],
        });
      }

      if (horario) {
        grouped.get(key).horarios.push({
          horario,
          solicitados: toNumber(row.VAGAS_TOTAL ?? row.SOLICITADOS),
          inscritos: toNumber(row.INSCRITOS),
          remanescentes: toNumber(row.REMANESCENTES),
          link,
        });
      }
    }

    return [...grouped.values()]
      .filter((item) => item.id && item.nome && item.local)
      .map((item) => ({
        ...item,
        horarios: item.horarios.sort(sortHorario),
        remanescentesTotal: item.horarios.reduce((acc, h) => acc + h.remanescentes, 0),
      }))
      .sort((a, b) => {
        const tipoA = a.tipo || 'zzz';
        const tipoB = b.tipo || 'zzz';
        const tipoDiff = normalize(tipoA).localeCompare(normalize(tipoB));
        if (tipoDiff !== 0) return tipoDiff;

        const nameDiff = normalize(a.nome).localeCompare(normalize(b.nome));
        if (nameDiff !== 0) return nameDiff;

        return normalize(a.local).localeCompare(normalize(b.local));
      });
  }, [data]);

  const tiposDisponiveis = useMemo(() => {
    return [...new Set(barracas.map((item) => item.tipo).filter((tipo) => String(tipo).trim() !== ''))];
  }, [barracas]);

  const barracasFiltradas = useMemo(() => {
    if (tipoFiltro === 'todos') return barracas;
    return barracas.filter((item) => normalize(item.tipo) === normalize(tipoFiltro));
  }, [barracas, tipoFiltro]);

  const activeKey =
    barracasFiltradas.some((item) => item.key === (lockedKey || hoveredKey))
      ? lockedKey || hoveredKey
      : null;

  const activeBarraca =
    barracasFiltradas.find((item) => item.key === activeKey) ||
    barracas.find((item) => item.key === activeKey) ||
    null;

  function focusBarraca(barraca, zoom = 1.32) {
    const maxOffset = getMaxOffset(zoom);
    const nextX = clamp(50 - barraca.x, -maxOffset, maxOffset);
    const nextY = clamp(50 - barraca.y, -maxOffset, maxOffset);

    setMapZoom(zoom);
    setMapOffset({ x: nextX, y: nextY });
  }

  function resetMapa() {
    setMapZoom(1);
    setMapOffset({ x: 0, y: 0 });
  }

  function handleMarkerClick(barraca) {
    if (lockedKey === barraca.key) {
      setLockedKey(null);
      setHoveredKey(null);
      setIsMobilePopupOpen(false);
      resetMapa();
      return;
    }

    setLockedKey(barraca.key);
    setHoveredKey(barraca.key);
    setIsMobilePopupOpen(true);
    focusBarraca(barraca);
  }

  function handleRowEnter(barraca) {
    if (!lockedKey) {
      setHoveredKey(barraca.key);
      focusBarraca(barraca);
    }
  }

  function handleRowLeave() {
    if (!lockedKey && !isDragging) {
      setHoveredKey(null);
      resetMapa();
    }
  }

  function handleZoomIn() {
    setMapZoom((prev) => {
      const next = Math.min(1.9, Number((prev + 0.12).toFixed(2)));
      setMapOffset((current) => clampOffset(current.x, current.y, next));
      return next;
    });
  }

  function handleZoomOut() {
    setMapZoom((prev) => {
      const next = Math.max(1, Number((prev - 0.12).toFixed(2)));
      if (next === 1) {
        setMapOffset({ x: 0, y: 0 });
      } else {
        setMapOffset((current) => clampOffset(current.x, current.y, next));
      }
      return next;
    });
  }

  function handleMouseDown(e) {
    if (mapZoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragOrigin({ x: mapOffset.x, y: mapOffset.y });
  }

  function handleMouseMove(e) {
    if (!isDragging) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const sensitivity = 0.08;

    const nextX = dragOrigin.x + dx * sensitivity;
    const nextY = dragOrigin.y + dy * sensitivity;

    setMapOffset(clampOffset(nextX, nextY, mapZoom));
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  function closeMobilePopup() {
    setLockedKey(null);
    setHoveredKey(null);
    setIsMobilePopupOpen(false);
    resetMapa();
  }

  function handleChangeFiltro(tipo) {
    setTipoFiltro(tipo);
    setLockedKey(null);
    setHoveredKey(null);
    setIsMobilePopupOpen(false);
    resetMapa();
  }

  return (
    <div className="page">
      <main className="shell">
        <section className="hero">
          <div className="hero-left">
            <div>
              <h1 className="hero-title">Festa Junina do Santa 2026</h1>
              <div className="hero-copy">
                <h2>Venha ser voluntário!</h2>
                <p>
                  Escolha, na lista ou no mapa, a barraca onde gostaria de trabalhar. Após clicar nela,
                  você verá os horários disponíveis. Ao selecionar o horário desejado, você será direcionado
                  a um formulário para inserir seus dados e confirmar sua participação.
                </p>
              </div>
            </div>

            <div className="section-title">MAPA</div>
          </div>

          <div className="hero-right">
            <img src={HERO_URL} alt="Foto da festa junina" className="hero-photo-image" />
          </div>
        </section>

        <div className="flags" />

        <section className="map-section">
          <div className="controls-bar">
            <div className="filtros-wrap">
              <button
                type="button"
                className={`filter-pill ${tipoFiltro === 'todos' ? 'is-active' : ''}`}
                onClick={() => handleChangeFiltro('todos')}
              >
                Todos
              </button>

              {tiposDisponiveis.map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  className={`filter-pill ${normalize(tipoFiltro) === normalize(tipo) ? 'is-active' : ''}`}
                  onClick={() => handleChangeFiltro(tipo)}
                >
                  {tipo}
                </button>
              ))}
            </div>

            <div className="map-toolbar">
              <button type="button" className="map-tool" onClick={handleZoomIn} aria-label="Aumentar zoom">
                <ZoomIn size={16} />
              </button>
              <button type="button" className="map-tool" onClick={handleZoomOut} aria-label="Diminuir zoom">
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                className="map-tool reset"
                onClick={() => {
                  setLockedKey(null);
                  setHoveredKey(null);
                  setIsDragging(false);
                  setIsMobilePopupOpen(false);
                  resetMapa();
                }}
              >
                Resetar mapa
              </button>
            </div>
          </div>

          <div className="map-frame">
            <motion.div
              className={`map-zoom-layer ${isDragging ? 'dragging' : ''}`}
              animate={{
                scale: mapZoom,
                x: `${mapOffset.x}%`,
                y: `${mapOffset.y}%`,
              }}
              transition={isDragging ? { duration: 0 } : { type: 'spring', stiffness: 180, damping: 24 }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img src={MAPA_URL} alt="Mapa da Festa Junina" className="map-image" />

              {barracasFiltradas
                .filter((barraca) => barraca.x > 0 && barraca.y > 0)
                .map((barraca) => {
                  const isActive = barraca.key === activeKey;

                  return (
                    <div
                      key={barraca.key}
                      className="marker-anchor"
                      style={{ left: `${barraca.x}%`, top: `${barraca.y}%` }}
                      onMouseEnter={() => !lockedKey && setHoveredKey(barraca.key)}
                      onMouseLeave={() => !lockedKey && setHoveredKey(null)}
                    >
                      <motion.button
                        type="button"
                        className="marker-btn"
                        aria-label={`${barraca.nome} ${barraca.local}`}
                        onClick={() => handleMarkerClick(barraca)}
                        whileTap={{ scale: 0.96 }}
                      >
                        <BarracaMarker active={isActive} />
                      </motion.button>

                      <div className="desktop-popup">
                        <AnimatePresence>{isActive && <PopupBarraca barraca={barraca} />}</AnimatePresence>
                      </div>
                    </div>
                  );
                })}
            </motion.div>
          </div>
        </section>

        <section className="list-header">
          <div className="section-title">LISTA</div>
        </section>

        <div className="flags" />

        <section className="list-section">
          {loading && <div className="row-message">Carregando dados da planilha...</div>}
          {error && <div className="row-message error">{error}</div>}

          {!loading &&
            !error &&
            barracasFiltradas.map((barraca) => (
              <div
                key={barraca.key}
                className={`list-row ${barraca.key === activeKey ? 'is-active' : ''}`}
                onMouseEnter={() => handleRowEnter(barraca)}
                onMouseLeave={handleRowLeave}
                onClick={() => handleMarkerClick(barraca)}
              >
                <div className="list-meta">{barraca.tipo || ''}</div>

                <div className="list-name-block">
                  <div className="list-name">{barraca.nome}</div>
                  <div className="list-local">{barraca.local}</div>
                </div>

                <div className="chips-wrap">
                  {barraca.horarios.length > 0 ? (
                    barraca.horarios.map((item) => {
                      const status = getStatus(item.remanescentes);

                      if (!status.disponivel || !item.link) {
                        return (
                          <div key={`${barraca.key}-${item.horario}`} className="list-slot slot-off">
                            <div className="list-slot-time">{item.horario}</div>
                            <div className="list-slot-meta">{status.texto}</div>
                          </div>
                        );
                      }

                      return (
                        <a
                          key={`${barraca.key}-${item.horario}`}
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          className={`list-slot ${item.remanescentes === 1 ? 'slot-warn' : 'slot-on'}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="list-slot-time">{item.horario}</div>
                          <div className="list-slot-meta">{status.texto}</div>
                        </a>
                      );
                    })
                  ) : (
                    <div className="list-slot slot-off">
                      <div className="list-slot-time">Sem horários</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
        </section>

        <footer className="footer">
          <div className="footer-title">Santa'26</div>
          <a
            href="https://www.julianazevedo.com/"
            target="_blank"
            rel="noreferrer"
            className="footer-link"
          >
            julianazevedo.com
          </a>
        </footer>
      </main>

      <AnimatePresence>
        {isMobilePopupOpen && activeBarraca ? (
          <div className="mobile-sheet-backdrop" onClick={closeMobilePopup}>
            <div onClick={(e) => e.stopPropagation()}>
              <PopupBarraca barraca={activeBarraca} isMobile onClose={closeMobilePopup} />
            </div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
