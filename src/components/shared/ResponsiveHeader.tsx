'use client';

import React, { useState } from 'react';
import { ChevronDown, User } from 'lucide-react';
import styles from './ResponsiveHeader.module.css';

interface ResponsiveHeaderProps {
  userName?: string;
  userCode?: string;
  regional?: string;
}

export const ResponsiveHeader: React.FC<ResponsiveHeaderProps> = ({
  userName = "IDIONY GONÇALVES DOS SANT...",
  userCode = "3006362",
  regional = "5"
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleUserClick = () => {
    // Por enquanto, apenas toggle visual do chevron
    setIsDropdownOpen(!isDropdownOpen);
    // Aqui você pode adicionar lógica de dropdown no futuro se necessário
  };

  return (
    <div className={styles.headerContainer}>
      <div className={styles.headerContent}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>
            <h1 className={styles.logoText}>EU VOU • DETRAN/CE</h1>
          </div>
        </div>
        
        <div className={styles.headerRight}>
          <div className={styles.regionalInfo}>
            <span className={styles.regionalLabel}>Regional:</span>
            <span className={styles.regionalValue}>{regional}</span>
          </div>
          
          <div className={styles.userSection}>
            <button 
              className={styles.userButton}
              onClick={handleUserClick}
              aria-label="Menu do usuário"
            >
              <div className={styles.userAvatar}>
                <User className={styles.userIcon} />
              </div>
              <div className={styles.userInfo}>
                <div className={styles.userName}>{userName}</div>
                <div className={styles.userDetails}>{userCode} • Membro</div>
              </div>
              <ChevronDown 
                className={`${styles.chevronIcon} ${isDropdownOpen ? styles.rotated : ''}`} 
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};