/**
 * Componente SearchBox
 * 
 * Componente memoizado para busca de membros
 * com otimizações de performance e acessibilidade.
 */

import React, { memo, useCallback } from 'react';
import { Search } from 'lucide-react';
import type { SearchBoxProps } from '../types';
import styles from '../GerenciarMembrosModal.module.css';

export const SearchBox = memo<SearchBoxProps>(({ searchTerm, onSearchChange }) => {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  }, [onSearchChange]);

  return (
    <div className={styles.searchBox}>
      <Search size={20} />
      <input
        type="text"
        placeholder="Buscar por nome ou matrícula (opcional)"
        value={searchTerm}
        onChange={handleChange}
        aria-label="Buscar membros por nome ou matrícula"
      />
    </div>
  );
});

SearchBox.displayName = 'SearchBox';