'use client';

import React from 'react';
import { CalendarioSimplesComponent } from './CalendarioSimplesComponent';
import styles from './CalendarioMembro.module.css';

// Componente principal que agora usa a versão refatorada
export const CalendarioMembro: React.FC = () => {
  return (
    <div className={styles.calendarioWrapper}>
      <CalendarioSimplesComponent />
      {/* Div condicional que aparece apenas em resoluções verticalizadas onde há espaço em branco */}
      <div className={styles.mobileSpaceDiv}>
        <div className={styles.mobileSpaceContent}>
          <p>Espaço disponível detectado em resolução mobile</p>
        </div>
      </div>
    </div>
  );
};