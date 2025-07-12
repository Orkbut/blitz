export default function SupervisorLoading() {
  return (
    <div className="elegant-page-loader">
      <div className="elegant-loader-container">
        {/* Logo/Ícone */}
        <div className="elegant-loader-icon">
          👮‍♂️
        </div>

        {/* Spinner Elegante */}
        <div className="elegant-loader-spinner"></div>

        {/* Texto */}
        <div className="elegant-loader-text">
          <h3>Painel do Supervisor</h3>
          <p>Salvando alterações...</p>
        </div>
      </div>
    </div>
  );
} 