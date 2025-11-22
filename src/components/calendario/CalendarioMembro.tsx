'use client';

import React, { useState } from 'react';
import { CalendarioSimplesComponent } from './CalendarioSimplesComponent';
import styles from './CalendarioMembro.module.css';

// Componente principal que agora usa a versão refatorada
export const CalendarioMembro: React.FC = () => {
  const [mostrarCoordenacoes, setMostrarCoordenacoes] = useState(false);
  const [loadingCoordenacoes, setLoadingCoordenacoes] = useState(false);
  const [displayedDate, setDisplayedDate] = useState<Date>(new Date());
  const [servidorDestacadoId, setServidorDestacadoId] = useState<number | undefined>(undefined);
  type ServidorCoordenacoes = {
    servidor_id: number;
    nome: string;
    matricula: string;
    ativa_count: number;
    total_count: number;
  };
  const [dadosCoordenacoes, setDadosCoordenacoes] = useState<ServidorCoordenacoes[] | null>(null);
  const [erroCoordenacoes, setErroCoordenacoes] = useState<string | null>(null);
  const [filtroAtivo, setFiltroAtivo] = useState(false);
  const [dataInicioFiltro, setDataInicioFiltro] = useState<string>('');
  const [dataFimFiltro, setDataFimFiltro] = useState<string>('');
  const cacheRef = React.useRef<Map<string, ServidorCoordenacoes[]>>(new Map());
  const inFlightRef = React.useRef<Record<string, AbortController>>({});

  const obterPeriodoRelatorio = (ref: Date) => {
    const hoje = new Date();
    const mesmoMes = ref.getFullYear() === hoje.getFullYear() && ref.getMonth() === hoje.getMonth();
    const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    const fimCorrente = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const end = mesmoMes ? fimCorrente : fim;
    const toISO = (d: Date) => d.toISOString().split('T')[0];
    return { startDate: toISO(inicio), endDate: toISO(end) };
  };

  const buildQuery = () => {
    let query = '/api/unified/coordenacoes?status=ativas&fields=summary';
    if (filtroAtivo && dataInicioFiltro && dataFimFiltro) {
      query += `&startDate=${dataInicioFiltro}&endDate=${dataFimFiltro}`;
    } else {
      const periodo = obterPeriodoRelatorio(displayedDate);
      query += `&startDate=${periodo.startDate}&endDate=${periodo.endDate}`;
    }
    return query;
  };

  const readSessionCache = (key: string): ServidorCoordenacoes[] | null => {
    try {
      const s = sessionStorage.getItem(`coord:${key}`);
      if (!s) return null;
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed as ServidorCoordenacoes[];
      return null;
    } catch { return null; }
  };

  const writeSessionCache = (key: string, data: ServidorCoordenacoes[]) => {
    try { sessionStorage.setItem(`coord:${key}`, JSON.stringify(data)); } catch {}
  };

  const abrirRelatorio = async () => {
    if (mostrarCoordenacoes) {
      setServidorDestacadoId(undefined);
      setMostrarCoordenacoes(false);
      return;
    }
    setMostrarCoordenacoes(true);
    const key = buildQuery();
    const cached = cacheRef.current.get(key) || readSessionCache(key);
    if (cached && cached.length >= 0) {
      setDadosCoordenacoes(cached);
    }
    if (!loadingCoordenacoes) {
      await carregarRelatorio();
    }
  };

  const carregarRelatorio = async () => {
    try {
      setLoadingCoordenacoes(true);
      setErroCoordenacoes(null);
      const query = buildQuery();
      const cached = cacheRef.current.get(query) || readSessionCache(query);
      if (cached && cached.length >= 0) {
        setDadosCoordenacoes(cached);
      }
      if (inFlightRef.current[query]) {
        inFlightRef.current[query].abort();
      }
      const ac = new AbortController();
      inFlightRef.current[query] = ac;
      const resp = await fetch(query, { signal: ac.signal });
      const json = await resp.json();
      if (json?.success) {
        setDadosCoordenacoes(json.data as ServidorCoordenacoes[]);
        cacheRef.current.set(query, json.data as ServidorCoordenacoes[]);
        writeSessionCache(query, json.data as ServidorCoordenacoes[]);
      } else {
        setErroCoordenacoes(json?.error || 'Erro ao carregar coordenações');
      }
    } catch {
      setErroCoordenacoes('Erro de comunicação');
    } finally {
      setLoadingCoordenacoes(false);
    }
  };

  const aplicarFiltro = async () => {
    if (!dataInicioFiltro || !dataFimFiltro) return;
    setFiltroAtivo(true);
    setDadosCoordenacoes(null);
    setErroCoordenacoes(null);
    if (mostrarCoordenacoes) {
      await carregarRelatorio();
    }
  };

  const limparFiltro = async () => {
    setFiltroAtivo(false);
    setDataInicioFiltro('');
    setDataFimFiltro('');
    setDadosCoordenacoes(null);
    setErroCoordenacoes(null);
    if (mostrarCoordenacoes) {
      await carregarRelatorio();
    }
  };

  const toggleServidorDestacado = (sid: number) => {
    setServidorDestacadoId(prev => (prev === sid ? undefined : sid));
  };

  // Atualizar relatório ao navegar de mês, quando painel estiver aberto e sem filtro
  React.useEffect(() => {
    if (mostrarCoordenacoes && !filtroAtivo) {
      void carregarRelatorio();
    }
  }, [displayedDate]);

  React.useEffect(() => {
    const key = buildQuery();
    const idle = (window as any).requestIdleCallback || ((fn: any) => setTimeout(fn, 250));
    idle(async () => {
      if (cacheRef.current.get(key) || readSessionCache(key)) return;
      try {
        const resp = await fetch(key, { cache: 'force-cache' });
        const json = await resp.json();
        if (json?.success && Array.isArray(json.data)) {
          cacheRef.current.set(key, json.data as ServidorCoordenacoes[]);
          writeSessionCache(key, json.data as ServidorCoordenacoes[]);
        }
      } catch {}
    });
  }, [displayedDate, filtroAtivo, dataInicioFiltro, dataFimFiltro]);

  

  return (
    <div className={styles.calendarioWrapper}>
      <CalendarioSimplesComponent servidorDestacadoId={servidorDestacadoId} onMonthChange={setDisplayedDate} />
      {/* Div condicional que aparece apenas em resoluções verticalizadas onde há espaço em branco */}
      <div className={styles.mobileSpaceDiv}>
        <div className={styles.mobileSpaceContent}>
          <button
            className={styles.reportButtonGold}
            onClick={abrirRelatorio}
            disabled={loadingCoordenacoes}
          >
            {loadingCoordenacoes
              ? 'Carregando…'
              : (() => {
                  const mes = displayedDate.toLocaleDateString('pt-BR', { month: 'long' });
                  const mesCap = mes.charAt(0).toUpperCase() + mes.slice(1);
                  return `Coordenações ${mesCap}`;
                })()}
          </button>

          {mostrarCoordenacoes && (
            <div className={styles.reportPanel}>
              <div className={styles.reportDateRow}>
                <input
                  type="date"
                  className={styles.reportDateInput}
                  value={dataInicioFiltro}
                  onChange={(e) => setDataInicioFiltro(e.target.value)}
                  aria-label="Data inicial"
                />
                <span>—</span>
                <input
                  type="date"
                  className={styles.reportDateInput}
                  value={dataFimFiltro}
                  onChange={(e) => setDataFimFiltro(e.target.value)}
                  aria-label="Data final"
                />
                <div className={styles.reportFilterActions}>
                  <button onClick={aplicarFiltro} disabled={!dataInicioFiltro || !dataFimFiltro}>Aplicar</button>
                  <button onClick={limparFiltro} disabled={!filtroAtivo}>Limpar filtro</button>
                </div>
              </div>

              {!dadosCoordenacoes && !erroCoordenacoes && (
                <div className={styles.reportEmpty}>Preparando relatório…</div>
              )}

              {erroCoordenacoes && (
                <div className={styles.reportEmpty}>{erroCoordenacoes}</div>
              )}

              {Array.isArray(dadosCoordenacoes) && dadosCoordenacoes.length === 0 && (
                <div className={styles.reportEmpty}>Nenhuma coordenação</div>
              )}

              {Array.isArray(dadosCoordenacoes) && dadosCoordenacoes.length > 0 && (
                <>
                  <div className={styles.reportHeader}>
                    <div>
                      Coordenações
                      <div className={styles.reportSubtlePeriod}>
                        {filtroAtivo && dataInicioFiltro && dataFimFiltro
                          ? (() => {
                              const p = (s: string) => {
                                const [y, m, d] = s.split('-').map(Number);
                                return new Date(y, m - 1, d);
                              };
                              return `${p(dataInicioFiltro).toLocaleDateString('pt-BR')} – ${p(dataFimFiltro).toLocaleDateString('pt-BR')}`;
                            })()
                          : (() => {
                              const hoje = new Date();
                              const mesmoMes = displayedDate.getFullYear() === hoje.getFullYear() && displayedDate.getMonth() === hoje.getMonth();
                              const inicio = new Date(displayedDate.getFullYear(), displayedDate.getMonth(), 1);
                              const fim = new Date(displayedDate.getFullYear(), displayedDate.getMonth() + 1, 0);
                              const fimCorrente = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
                              const end = mesmoMes ? fimCorrente : fim;
                              const dd = (d: Date) => String(d.getDate()).padStart(2, '0');
                              const mes = displayedDate.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
                              return `${dd(inicio)}–${dd(end)} ${mes}`;
                            })()
                        }
                      </div>
                    </div>
                    <div className={styles.reportStats}>
                      <span>Total: {dadosCoordenacoes.reduce((a, s) => a + (s.ativa_count || 0), 0)}</span>
                    </div>
                  </div>
                  <div className={styles.reportList}>
                    {dadosCoordenacoes.map((s) => (
                      <div
                        key={s.servidor_id}
                        className={`${styles.reportItem} ${servidorDestacadoId === s.servidor_id ? styles.reportItemActive : ''}`}
                        onClick={() => toggleServidorDestacado(s.servidor_id)}
                      >
                        <img src="/icons/coordenador.png" alt="Coordenador" className={styles.reportItemIcon} />
                        <div className={styles.reportItemName}>
                          <div className={styles.reportItemTitle}>{s.nome}</div>
                          <div className={styles.reportItemSub}>Mat.: {s.matricula}</div>
                        </div>
                        <div className={styles.reportItemCount}>{s.ativa_count}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
