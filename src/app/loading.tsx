export default function Loading() {
  return (
    <div className="elegant-page-loader">
      <div className="elegant-loader-container">
        {/* Logo/Ícone */}
        <div className="elegant-loader-icon">
          🚔
        </div>

        {/* Spinner Elegante */}
        <div className="elegant-loader-spinner"></div>

        {/* Texto */}
        <div className="elegant-loader-text">
          <h3>Sistema RADAR</h3>
          <p>Processando...</p>
        </div>
      </div>
    </div>
  );
} 