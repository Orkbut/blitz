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
  const [modalidadeFiltro, setModalidadeFiltro] = useState<'EXCLUDE_BALANCA' | 'BALANCA_ONLY' | 'ALL'>('EXCLUDE_BALANCA');
  const cacheRef = React.useRef<Map<string, ServidorCoordenacoes[]>>(new Map());
  const inFlightRef = React.useRef<Record<string, AbortController>>({});
  const reportListRef = React.useRef<HTMLDivElement | null>(null);
  const reportPanelRef = React.useRef<HTMLDivElement | null>(null);
  const autoScrollRef = React.useRef<boolean>(false);

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

  const buildQuery = (override?: 'EXCLUDE_BALANCA' | 'BALANCA_ONLY' | 'ALL') => {
    let query = '/api/unified/coordenacoes?status=ativas&fields=summary';
    if (filtroAtivo && dataInicioFiltro && dataFimFiltro) {
      query += `&startDate=${dataInicioFiltro}&endDate=${dataFimFiltro}`;
    } else {
      const periodo = obterPeriodoRelatorio(displayedDate);
      console.log('[Coordenações] buildQuery periodo', periodo);
      query += `&startDate=${periodo.startDate}&endDate=${periodo.endDate}`;
    }
    const mod = override ?? modalidadeFiltro;
    query += `&modalidade=${mod}`;
    console.log('[Coordenações] buildQuery modalidade', mod, 'query', query);
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
      console.log('[Coordenações] abrirRelatorio fecharPainel');
      setServidorDestacadoId(undefined);
      setMostrarCoordenacoes(false);
      return;
    }
    console.log('[Coordenações] abrirRelatorio abrirPainel');
    setMostrarCoordenacoes(true);
    autoScrollRef.current = true;
    const key = buildQuery();
    const cached = cacheRef.current.get(key) || readSessionCache(key);
    if (cached && cached.length >= 0) {
      console.log('[Coordenações] cache hit ao abrir', { itens: cached.length });
      setDadosCoordenacoes(cached);
    }
    if (!loadingCoordenacoes) {
      console.log('[Coordenações] carregarRelatorio após abrir');
      await carregarRelatorio();
    }
  };

  const carregarRelatorio = async (override?: 'EXCLUDE_BALANCA' | 'BALANCA_ONLY' | 'ALL') => {
    try {
      setLoadingCoordenacoes(true);
      setErroCoordenacoes(null);
      const query = buildQuery(override);
      const cached = cacheRef.current.get(query) || readSessionCache(query);
      if (cached && cached.length >= 0) {
        console.log('[Coordenações] cache hit no carregar', { itens: cached.length });
        setDadosCoordenacoes(cached);
      }
      if (inFlightRef.current[query]) {
        console.log('[Coordenações] abortando requisição anterior');
        inFlightRef.current[query].abort();
      }
      const ac = new AbortController();
      inFlightRef.current[query] = ac;
      console.log('[Coordenações] fetch iniciada', query);
      const resp = await fetch(query, { signal: ac.signal, cache: 'no-store' });
      console.log('[Coordenações] resposta recebida', {
        status: resp.status,
        xcache: resp.headers.get('x-cache'),
        cacheControl: resp.headers.get('cache-control')
      });
      const json = await resp.json();
      if (json?.success) {
        const lista = json.data as ServidorCoordenacoes[];
        console.log('[Coordenações] sucesso', { itens: Array.isArray(lista) ? lista.length : 0 });
        try {
          const sumAtivas = Array.isArray(lista) ? lista.reduce((a, s) => a + (s.ativa_count || 0), 0) : 0;
          const sumTotal = Array.isArray(lista) ? lista.reduce((a, s) => a + (s.total_count || 0), 0) : 0;
          console.log('[Coordenações] contagens', { sumAtivas, sumTotal, modalidadeFiltro });
          const moda: Record<string, number> = { BALANCA: 0, BLITZ: 0, RADAR: 0, EXCLUSIVA: 0, OUTROS: 0 };
          if (Array.isArray(lista)) {
            for (const s of lista) {
              const cs = (s as any).coordenacoes;
              if (Array.isArray(cs)) {
                for (const c of cs) {
                  const m = (c?.modalidade as string) || 'OUTROS';
                  moda[m] = (moda[m] || 0) + 1;
                }
              }
            }
          }
          console.log('[Coordenações] modalidades', moda);
        } catch {}
        setDadosCoordenacoes(lista);
        cacheRef.current.set(query, lista);
        writeSessionCache(query, lista);
      } else {
        setErroCoordenacoes(json?.error || 'Erro ao carregar coordenações');
        console.log('[Coordenações] erro', json?.error);
      }
    } catch {
      setErroCoordenacoes('Erro de comunicação');
      console.log('[Coordenações] erro de comunicação');
    } finally {
      setLoadingCoordenacoes(false);
      console.log('[Coordenações] fim carregarRelatorio');
    }
  };

  const aplicarFiltro = async () => {
    if (!dataInicioFiltro || !dataFimFiltro) return;
    setFiltroAtivo(true);
    setDadosCoordenacoes(null);
    setErroCoordenacoes(null);
    if (mostrarCoordenacoes) {
      autoScrollRef.current = true;
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
      autoScrollRef.current = true;
      await carregarRelatorio();
    }
  };

  const aplicarModalidade = async (m: 'EXCLUDE_BALANCA' | 'BALANCA_ONLY' | 'ALL') => {
    setModalidadeFiltro(m);
    console.log('[Coordenações] aplicarModalidade', m);
    setDadosCoordenacoes(null);
    setErroCoordenacoes(null);
    if (mostrarCoordenacoes) {
      console.log('[Coordenações] recarregar após aplicar modalidade');
      autoScrollRef.current = true;
      await carregarRelatorio(m);
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
        console.log('[Coordenações] prefetch', key);
        const resp = await fetch(key, { cache: 'force-cache' });
        const json = await resp.json();
        if (json?.success && Array.isArray(json.data)) {
          cacheRef.current.set(key, json.data as ServidorCoordenacoes[]);
          writeSessionCache(key, json.data as ServidorCoordenacoes[]);
          console.log('[Coordenações] prefetch sucesso', { itens: json.data.length });
        }
      } catch {}
    });
  }, [displayedDate, filtroAtivo, dataInicioFiltro, dataFimFiltro]);

  React.useEffect(() => {
    if (Array.isArray(dadosCoordenacoes)) {
      console.log('[Coordenações] listaAtualizada', {
        itens: dadosCoordenacoes.length,
        modalidadeFiltro,
        filtroAtivo,
        dataInicioFiltro,
        dataFimFiltro
      });
      try {
        console.table(dadosCoordenacoes.map(s => ({ servidor_id: s.servidor_id, nome: s.nome, ativa_count: s.ativa_count, total_count: s.total_count })));
      } catch {}
      try {
        if (autoScrollRef.current) {
          autoScrollRef.current = false;
          (reportListRef.current || reportPanelRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } catch {}
    }
  }, [dadosCoordenacoes, modalidadeFiltro, filtroAtivo, dataInicioFiltro, dataFimFiltro]);

  

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

          <button
            className={styles.reportButtonGreen}
            onClick={() => { window.location.href = '/relatorio-diarias'; }}
          >
            Relatório de Diárias confirmadas
          </button>

          {mostrarCoordenacoes && (
            <div className={styles.reportPanel} ref={reportPanelRef}>
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

              <div className={styles.iconFilterRow} aria-label="Filtros por modalidade">
                <button
                  className={`${styles.iconButton} ${modalidadeFiltro === 'BALANCA_ONLY' ? styles.iconButtonActive : ''}`}
                  onClick={() => { console.log('[Coordenações] filtro modalidade','BALANCA_ONLY'); aplicarModalidade('BALANCA_ONLY'); }}
                  aria-pressed={modalidadeFiltro === 'BALANCA_ONLY'}
                  aria-label="Mostrar apenas Balança"
                  title="Mostrar apenas Balança"
                >
                  <img src="/caminhao.png" alt="Balança" className={styles.iconImage} />
                </button>
                <button
                  className={`${styles.iconButton} ${modalidadeFiltro === 'EXCLUDE_BALANCA' ? styles.iconButtonActive : ''}`}
                  onClick={() => { console.log('[Coordenações] filtro modalidade','EXCLUDE_BALANCA'); aplicarModalidade('EXCLUDE_BALANCA'); }}
                  aria-pressed={modalidadeFiltro === 'EXCLUDE_BALANCA'}
                  aria-label="Mostrar BLITZ, RADAR e EXCLUSIVA"
                  title="Mostrar BLITZ, RADAR e EXCLUSIVA"
                >
                  <img src="/icons/radar.ico" alt="Padrão" className={styles.iconImage} />
                </button>
                <button
                  className={`${styles.iconButton} ${modalidadeFiltro === 'ALL' ? styles.iconButtonActive : ''}`}
                  onClick={() => { console.log('[Coordenações] filtro modalidade','ALL'); aplicarModalidade('ALL'); }}
                  aria-pressed={modalidadeFiltro === 'ALL'}
                  aria-label="Mostrar todas as coordenações"
                  title="Mostrar todas as coordenações"
                >
                  <img src="/globe.svg" alt="Todas" className={styles.iconImage} />
                </button>
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
                  <div className={styles.reportList} ref={reportListRef}>
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
