export default function MembroLoading() {
  return (
    <div className="elegant-page-loader">
      <div className="elegant-loader-container">
        {/* Logo/Ícone */}
        <div className="elegant-loader-icon">
          👤
        </div>

        {/* Spinner Elegante */}
        <div className="elegant-loader-spinner"></div>

        {/* Texto */}
        <div className="elegant-loader-text">
          <h3>Portal do Membro</h3>
          <p>Carregando...</p>
        </div>
      </div>
    </div>
  );
} 