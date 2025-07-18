'use client';

import React, { useRef, useEffect, useState } from "react";
import { Spreadsheet, Worksheet } from "@jspreadsheet-ce/react";
import * as ExcelJS from 'exceljs';
import "jspreadsheet-ce/dist/jspreadsheet.css";
import "jsuites/dist/jsuites.css";

// Estilos CSS para efeito de fade e blur sutil
const fadeStyles = `
  .planilha-fade {
    animation: planilhaFade 3s ease-in-out infinite alternate;
    backdrop-filter: blur(1px);
    position: relative;
  }
  
  .planilha-fade::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(45deg, 
      rgba(255, 255, 255, 0.1) 0%, 
      rgba(240, 240, 240, 0.05) 25%, 
      rgba(255, 255, 255, 0.1) 50%, 
      rgba(240, 240, 240, 0.05) 75%, 
      rgba(255, 255, 255, 0.1) 100%);
    animation: fadeGradient 4s ease-in-out infinite;
    pointer-events: none;
    z-index: 1;
  }
  
  .planilha-fade > * {
    position: relative;
    z-index: 2;
  }
  
  @keyframes planilhaFade {
    0% { 
      opacity: 0.85;
      transform: translateY(0px);
    }
    50% { 
      opacity: 0.95;
      transform: translateY(-2px);
    }
    100% { 
      opacity: 0.85;
      transform: translateY(0px);
    }
  }
  
  @keyframes fadeGradient {
    0% { 
      background-position: 0% 50%;
      opacity: 0.3;
    }
    50% { 
      background-position: 100% 50%;
      opacity: 0.1;
    }
    100% { 
      background-position: 0% 50%;
      opacity: 0.3;
    }
  }
  
  /* Efeito de pulsação sutil no modal */
  .modal-manutencao {
    animation: modalPulse 2s ease-in-out infinite alternate;
    box-shadow: 0 0 30px rgba(255, 193, 7, 0.3);
  }
  
  @keyframes modalPulse {
    0% { 
      box-shadow: 0 0 30px rgba(255, 193, 7, 0.3);
    }
    100% { 
      box-shadow: 0 0 40px rgba(255, 193, 7, 0.5);
    }
  }
`;

interface ExcelViewerProps {
  filePath: string;
  fileName: string;
}

interface WorksheetData {
  name: string;
  data: any[][];
  style: any;
  originalStyle: any;
  detranStyle: any;
  colWidths: number[];
  rowHeights: number[];
}

// Componente do ícone do cone (inline SVG)
const ConeIcon = () => (
  <svg 
    width="120" 
    height="120" 
    viewBox="0 0 2122 2122" 
    className="mx-auto mb-6"
  >
    <g>
      <path 
        style={{fill:"#ECB842"}} 
        d="M1936.538,1352.14l-420.486-200.64l-53.809-129.52l0.004-0.002l-0.004-0.009
        c0,0,0.001-0.001,0.003-0.002l-61.383-147.766c-0.004,0.002-0.006,0.003-0.01,0.005l-0.002-0.006
        c-0.001,0.001-0.001,0.001-0.003,0.002l-97.181-233.914l0.001,0l-49.103-118.19l-103.451-249.007
        c-22.285-53.644-80.345-71.634-126.575-53.847c-23.176,8.913-43.394,26.822-54.617,53.726l-366.68,879.505l-418.46,199.668
        c-28.929,13.776-43.354,31.847-43.354,49.917v68.069c0,18.071,14.465,36.142,43.354,49.917l771.203,367.976
        c57.818,27.592,151.533,27.592,209.351,0l403.429-192.497l367.774-175.479c28.889-13.776,43.354-31.847,43.354-49.917v-68.069
        C1979.893,1383.987,1965.428,1365.916,1936.538,1352.14z"
      />
      <path 
        style={{fill:"#F0CD43"}} 
        d="M1592.479,1329.192c-0.212-0.689-0.43-1.377-0.653-2.064c-0.017-0.049-0.033-0.099-0.05-0.149
        c-0.208-0.64-0.422-1.279-0.64-1.918c-0.018-0.055-0.037-0.111-0.057-0.166c-0.221-0.644-0.446-1.286-0.676-1.929
        c-0.011-0.031-0.022-0.062-0.034-0.094c-2.76-7.682-6.208-15.249-10.324-22.681c-0.074-0.132-0.149-0.265-0.222-0.398
        c-0.224-0.401-0.451-0.801-0.677-1.201c-0.226-0.398-0.455-0.796-0.687-1.194c-0.119-0.208-0.24-0.416-0.362-0.623
        c-0.077-0.131-0.154-0.261-0.23-0.392c-0.068-0.116-0.137-0.233-0.206-0.349c0,0,0-0.001-0.001-0.001
        c-0.339-0.574-0.678-1.148-1.026-1.72c-0.173-0.283-0.348-0.566-0.524-0.849c-0.051-0.083-0.102-0.167-0.153-0.25
        c-0.039-0.063-0.078-0.125-0.117-0.188c-0.329-0.531-0.66-1.063-0.996-1.593c-0.021-0.032-0.04-0.064-0.061-0.096
        c-0.024-0.039-0.05-0.078-0.074-0.118c-0.062-0.098-0.123-0.195-0.185-0.293c-0.206-0.323-0.414-0.646-0.623-0.968l-0.387-0.596
        c-0.166-0.253-0.328-0.508-0.494-0.761l-21.711-52.26l-10.166-24.469c-0.001,0.002-0.002,0.003-0.004,0.005
        c0,0.001,0,0.001-0.001,0.001l-0.005-0.012c-0.277,0.4-0.558,0.799-0.839,1.197c-1.398,1.957-2.831,3.913-4.379,5.87
        c-0.016,0.021-0.033,0.042-0.05,0.063c-0.038,0.048-0.077,0.096-0.114,0.144c-1.848,2.334-3.793,4.666-5.832,6.995
        c-5.127,5.855-10.853,11.684-17.156,17.449c-7.31,6.686-15.397,13.286-24.228,19.74c-0.031,0.023-0.064,0.047-0.097,0.071
        c-0.017,0.013-0.037,0.026-0.055,0.04c-7.069,5.159-14.613,10.223-22.613,15.162c-40.557,25.121-92.663,46.96-152.79,63.207
        c0.002,0.007,0.004,0.014,0.005,0.021c-0.001,0-0.002,0.001-0.005,0.001c-15.964-61.61-32.34-124.847-48.841-188.617
        c-5.292-20.45-10.597-40.954-15.905-61.477c-0.203-0.787-0.407-1.575-0.61-2.363c9.908-1.721,19.693-3.575,29.348-5.559
        c22.161-4.556,43.635-9.796,64.333-15.68c14.354-4.081,28.336-8.47,41.91-13.16c0.029-0.01,0.06-0.02,0.089-0.03
        c0.003-0.001,0.006-0.002,0.009-0.003c11.054-3.816,21.839-7.827,32.339-12.029c7.109-2.854,14.079-5.802,20.912-8.836
        c8.788-3.891,17.351-7.925,25.681-12.099l0.004-0.002l-0.004-0.009c0,0,0.001-0.001,0.003-0.002l-61.383-147.766
        c-0.004,0.002-0.006,0.003-0.01,0.005l-0.002-0.006c-0.001,0.001-0.001,0.001-0.003,0.002c-30,12.727-63.445,23.935-99.628,33.128
        c-3.164,0.803-6.347,1.593-9.551,2.365c-27.349,6.604-56.157,12.074-86.221,16.287c0.001,0.007,0.004,0.013,0.005,0.019
        c-0.005,0.001-0.011,0.002-0.016,0.003c-23.13-89.58-45.829-177.647-67.293-261.133c48.452-3.291,94.982-9.629,138.828-18.639
        c4.069-0.837,8.106-1.706,12.119-2.597c4.889-1.083,9.743-2.204,14.57-3.339l-0.004-0.007c0.004-0.001,0.007-0.002,0.01-0.002
        l0.001,0l-49.103-118.19l-16.161-38.897c-25.774,4.55-52.562,8.146-80.158,10.688c-0.357,0.032-0.715,0.065-1.072,0.097
        c-1.269,0.115-2.541,0.228-3.814,0.339c-0.629,0.054-1.257,0.11-1.885,0.164c-0.893,0.076-1.787,0.15-2.681,0.224
        c-17.539,1.448-35.393,2.474-53.513,3.045c0.001,0.006,0.002,0.01,0.005,0.016c-0.005,0-0.01,0-0.015,0
        c-28.243-110.351-52.656-206.377-70.732-278.531c-23.176,8.913-43.394,26.822-54.617,53.726l-366.68,879.505l-418.46,199.668
        c-28.929,13.776-43.354,31.847-43.354,49.917c0,18.071,14.425,36.182,43.354,49.958l771.203,367.977
        c57.818,27.592,151.533,27.592,209.351,0l241.767-115.353c-5.156-19.899-10.489-40.429-15.969-61.524
        c-93.303,32.434-207.343,51.502-330.479,51.502c-315.636,0-571.509-125.284-571.509-279.831c0-42.728,19.56-83.219,54.532-119.443
        l-0.861,2.066c-2.41,4.16-4.609,8.363-6.596,12.605c-0.052,0.112-0.106,0.224-0.16,0.337c-0.24,0.517-0.477,1.034-0.711,1.552
        c-0.202,0.448-0.402,0.896-0.599,1.344c-0.19,0.429-0.375,0.859-0.56,1.289c-0.174,0.406-0.347,0.812-0.518,1.219
        c-7.162,17.004-10.935,34.611-10.935,52.633c0,144.363,240.834,261.376,537.905,261.376c117.338,0,225.882-18.232,314.25-49.228
        c-6.644-25.592-13.46-51.855-20.418-78.676c9.234-2.793,18.303-5.718,27.199-8.77c0.138-0.047,0.274-0.094,0.412-0.141
        c0.928-0.319,1.854-0.64,2.779-0.962c0.578-0.201,1.152-0.401,1.729-0.603c0.538-0.189,1.077-0.379,1.614-0.569
        c1.044-0.368,2.085-0.738,3.124-1.11c0.12-0.043,0.242-0.087,0.364-0.13c8.139-2.919,16.127-5.944,23.957-9.075
        c12.074-4.848,23.772-9.954,35.068-15.308c18.163-8.597,35.282-17.837,51.247-27.706c27.074-16.764,50.901-35.315,70.695-55.821
        c8.581-8.885,16.408-18.14,23.414-27.78c0.106-0.154,0.212-0.308,0.317-0.462c0.348-0.494,0.687-0.993,1.038-1.487
        C1596.443,1344.26,1594.784,1336.674,1592.479,1329.192z"
      />
      <path 
        style={{fill:"#343432"}} 
        d="M1592.479,1329.192c-0.212-0.689-0.43-1.377-0.653-2.064c-0.017-0.049-0.033-0.099-0.05-0.149
        c-0.208-0.64-0.422-1.279-0.64-1.918c-0.018-0.055-0.037-0.111-0.057-0.166c-0.221-0.644-0.446-1.286-0.676-1.929
        c-0.011-0.031-0.022-0.062-0.034-0.094c-2.76-7.682-6.208-15.249-10.324-22.681c-0.074-0.132-0.149-0.265-0.222-0.398
        c-0.224-0.401-0.451-0.801-0.677-1.201c-0.226-0.398-0.455-0.796-0.687-1.194c-0.119-0.208-0.24-0.416-0.362-0.623
        c-0.077-0.131-0.154-0.261-0.23-0.392c-0.068-0.116-0.137-0.233-0.206-0.349c0,0,0-0.001-0.001-0.001
        c-0.339-0.574-0.678-1.148-1.026-1.72c-0.173-0.283-0.348-0.566-0.524-0.849c-0.051-0.083-0.102-0.167-0.153-0.25
        c-0.039-0.063-0.078-0.125-0.117-0.188c-0.329-0.531-0.66-1.063-0.996-1.593c-0.021-0.032-0.04-0.064-0.061-0.096
        c-0.024-0.039-0.05-0.078-0.074-0.118c-0.062-0.098-0.123-0.195-0.185-0.293c-0.206-0.323-0.414-0.646-0.623-0.968l-0.387-0.596
        c-0.166-0.253-0.328-0.508-0.494-0.761l-21.711-52.26l-10.166-24.469c-0.001,0.002-0.002,0.003-0.004,0.005
        c0,0.001,0,0.001-0.001,0.001l-0.005-0.012c-0.277,0.4-0.558,0.799-0.839,1.197c-1.398,1.957-2.831,3.913-4.379,5.87
        c-0.016,0.021-0.033,0.042-0.05,0.063c-0.038,0.048-0.077,0.096-0.114,0.144c-1.848,2.334-3.793,4.666-5.832,6.995
        c-5.127,5.855-10.853,11.684-17.156,17.449c-7.31,6.686-15.397,13.286-24.228,19.74c-0.031,0.023-0.064,0.047-0.097,0.071
        c-0.017,0.013-0.037,0.026-0.055,0.04c-7.069,5.159-14.613,10.223-22.613,15.162c-40.557,25.121-92.663,46.96-152.79,63.207
        c0.002,0.007,0.004,0.014,0.005,0.021c-0.001,0-0.002,0.001-0.005,0.001c-6.995,1.892-14.097,3.71-21.303,5.448
        c-69.158,16.708-147.759,26.22-231.037,26.213c-63.442,0.001-124.166-5.512-180.074-15.535
        c-83.854-14.994-156.895-40.299-211.708-71.462c-23.698-13.444-43.959-27.953-60.308-42.909c-2.562-2.344-5.031-4.699-7.399-7.063
        c-3.464-3.453-6.71-6.92-9.75-10.394c-4.573-5.228-8.673-10.472-12.304-15.711c-0.002-0.004-0.006-0.008-0.009-0.011l-11.24,26.96
        l-24.172,57.977l-0.861,2.066c-2.41,4.16-4.609,8.363-6.596,12.605c-0.052,0.112-0.106,0.224-0.16,0.337
        c-0.24,0.517-0.477,1.034-0.711,1.552c-0.202,0.448-0.402,0.896-0.599,1.344c-5.543,12.57-9.223,25.476-10.913,38.645
        c2.999,4.23,6.156,8.39,9.47,12.473c22.816,28.074,52.762,52.775,88.211,74.45c53.206,32.461,118.991,58.182,193.497,76.066
        c74.501,17.85,157.734,27.765,245.628,27.771c76.541-0.003,149.551-7.527,216.332-21.25c26.9-5.53,52.787-12.067,77.5-19.541
        c9.234-2.793,18.303-5.718,27.199-8.77c0.138-0.047,0.274-0.094,0.412-0.141c0.928-0.319,1.854-0.64,2.779-0.962
        c0.578-0.201,1.152-0.401,1.729-0.603c0.538-0.189,1.077-0.379,1.614-0.569c1.044-0.368,2.085-0.738,3.124-1.11
        c0.12-0.043,0.242-0.087,0.364-0.13c8.139-2.919,16.127-5.944,23.957-9.075c12.074-4.848,23.772-9.954,35.068-15.308
        c18.163-8.597,35.282-17.837,51.247-27.706c27.074-16.764,50.901-35.315,70.695-55.821c8.581-8.885,16.408-18.14,23.414-27.78
        c0.106-0.154,0.212-0.308,0.317-0.462c0.348-0.494,0.687-0.993,1.038-1.487C1596.443,1344.26,1594.784,1336.674,1592.479,1329.192z"
      />
      <path 
        style={{fill:"#171814"}} 
        d="M1276.961,646.211c4.074-0.822,8.115-1.687,12.13-2.577c4.889-1.083,9.743-2.204,14.57-3.339
        l-0.004-0.007l-65.268-157.078c-25.769,4.55-52.55,8.14-80.142,10.676c-0.357,0.032-0.715,0.065-1.072,0.097
        c-1.269,0.115-2.541,0.228-3.814,0.339c-0.629,0.054-1.257,0.11-1.885,0.164c-0.893,0.076-1.787,0.15-2.681,0.224
        c-17.539,1.448-35.393,2.474-53.513,3.045c0.001,0.006,0.002,0.01,0.005,0.016c13.491,52.749,27.873,108.818,42.863,167.076
        C1186.607,661.567,1233.121,655.246,1276.961,646.211z"
      />
      <path 
        style={{fill:"#171814"}} 
        d="M1301.22,907.329c-3.164,0.803-6.347,1.593-9.551,2.365c-27.349,6.604-56.157,12.074-86.221,16.287
        c0.001,0.007,0.004,0.013,0.005,0.019c7.536,29.288,15.151,58.697,22.766,88.187c6.443,24.999,12.926,50.12,19.408,75.159
        c9.927-1.701,19.692-3.565,29.335-5.551c22.156-4.553,43.629-9.789,64.326-15.668c14.36-4.078,28.346-8.466,41.927-13.151
        c0.029-0.01,0.06-0.02,0.089-0.03c0.003-0.001,0.006-0.002,0.009-0.003c11.054-3.816,21.839-7.827,32.339-12.029
        c7.109-2.854,14.079-5.802,20.912-8.836c8.781-3.899,17.337-7.94,25.676-12.109c0.003,0,0.004-0.001,0.005-0.001
        c0,0,0.001-0.001,0.003-0.002l-61.383-147.766c-0.004,0.002-0.006,0.003-0.01,0.005c0,0-0.002,0-0.002,0.001
        C1370.859,886.946,1337.406,898.144,1301.22,907.329z"
      />
    </g>
  </svg>
);

// Modal de Manutenção
const ModalManutencao = ({ onVoltar }: { onVoltar: () => void }) => (
  <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-auto">
    {/* Modal sem overlay escuro */}
    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 text-center border-2 border-yellow-300 backdrop-blur-sm modal-manutencao">
      <ConeIcon />
      
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        🚧 Sistema em Manutenção
      </h2>
      
      <p className="text-gray-600 mb-6 leading-relaxed">
        Planilha de diárias temporariamente indisponível para manutenção.
      </p>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ Importante:</strong> Implementação de planilha em curso/manutenção.
        </p>
      </div>
      
      <button
        onClick={onVoltar}
        className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center gap-2"
      >
        ← Voltar para Diretoria
      </button>
      
      <p className="text-xs text-gray-500 mt-4">
        Obrigado pela compreensão • Douglas
      </p>
    </div>
  </div>
);

export default function ExcelViewer({ filePath, fileName }: ExcelViewerProps) {
  const spreadsheetRef = useRef<any>(null);
  const [worksheetsData, setWorksheetsData] = useState<WorksheetData[]>([]);
  const [currentWorksheet, setCurrentWorksheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileStats, setFileStats] = useState<{ size: number; sheets: number } | null>(null);
  const [useDetranStyle, setUseDetranStyle] = useState(false);
  const [originalStyle, setOriginalStyle] = useState<any>({});
  const [showModalManutencao, setShowModalManutencao] = useState(true);

  useEffect(() => {
    loadExcelFile();
  }, [filePath]);

  const handleVoltar = () => {
    window.location.href = '/supervisor/diretoria';
  };

  const rgbToHex = (rgb: any): string => {
    if (!rgb) return '#000000';
    if (typeof rgb === 'string') return rgb;
    
    // Diferentes formatos de cor do ExcelJS
    if (rgb.argb) {
      const hex = `#${rgb.argb.substring(2)}`;
      console.log('🎨 Cor ARGB extraída:', rgb.argb, '->', hex);
      return hex;
    }
    if (rgb.rgb) {
      const hex = `#${rgb.rgb}`;
      console.log('🎨 Cor RGB extraída:', rgb.rgb, '->', hex);
      return hex;
    }
    if (rgb.theme !== undefined) {
      // Cores de tema do Excel - mapear para cores aproximadas
      const themeColors = {
        0: '#FFFFFF', // Branco
        1: '#000000', // Preto
        2: '#EE1111', // Vermelho
        3: '#00AA00', // Verde
        4: '#0000FF', // Azul
        5: '#FFFF00', // Amarelo
        6: '#FF00FF', // Magenta
        7: '#00FFFF', // Ciano
        8: '#800000', // Marrom
        9: '#008000', // Verde escuro
      };
      const themeColor = themeColors[rgb.theme] || '#000000';
      console.log('🎨 Cor de tema extraída:', rgb.theme, '->', themeColor);
      return themeColor;
    }
    
    console.log('🎨 Cor não reconhecida:', rgb);
    return '#000000';
  };

  const loadExcelFile = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 Carregando arquivo Excel com formatação completa:', filePath);

      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Arquivo não encontrado: ${filePath} (Status: ${response.status})`);
      }

      const arrayBuffer = await response.arrayBuffer();
      console.log('✅ Arquivo carregado:', arrayBuffer.byteLength, 'bytes');

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      
      console.log('📊 Processando', workbook.worksheets.length, 'planilhas com formatação');

      if (!workbook.worksheets.length) {
        throw new Error('Nenhuma planilha encontrada no arquivo Excel');
      }

      const worksheets: WorksheetData[] = workbook.worksheets.map(worksheet => {
        const data: any[][] = [];
        const style: any = {};
        const colWidths: number[] = [];
        const rowHeights: number[] = [];

        // Extrair larguras das colunas
        worksheet.columns.forEach((col, index) => {
          colWidths[index] = (col as any).width ? (col as any).width * 8 : 100; // Converter para pixels
        });

        // Percorrer todas as linhas da planilha
        worksheet.eachRow((row, rowNumber) => {
          const rowData: any[] = [];
          
          // Extrair altura da linha
          rowHeights[rowNumber - 1] = (row as any).height ? (row as any).height * 1.5 : 25;
          
          // Percorrer todas as células da linha
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            let cellValue = cell.value;
            
            // Processar valor da célula
            if (cellValue === null || cellValue === undefined) {
              cellValue = '';
            } else if (typeof cellValue === 'object') {
              if (cellValue instanceof Date) {
                cellValue = cellValue.toLocaleDateString('pt-BR');
              } else if (typeof cellValue === 'object' && 'result' in cellValue) {
                cellValue = (cellValue as any).result || '';
              } else {
                cellValue = String(cellValue);
              }
            }
            
            rowData[colNumber - 1] = cellValue;

            // Extrair formatação da célula
            const cellKey = `${colNumber-1}:${rowNumber-1}`;
            if (cell.style) {
              style[cellKey] = {};
              

              
              // Cor de fundo
              if (cell.style.fill) {
                console.log('🎨 Fill encontrado:', cell.style.fill);
                if (cell.style.fill.type === 'pattern' && (cell.style.fill as any).fgColor) {
                  const bgColor = rgbToHex((cell.style.fill as any).fgColor);
                  style[cellKey]['background-color'] = bgColor;
                  console.log('✅ Background aplicado:', bgColor);
                } else if (cell.style.fill.type === 'pattern' && (cell.style.fill as any).bgColor) {
                  const bgColor = rgbToHex((cell.style.fill as any).bgColor);
                  style[cellKey]['background-color'] = bgColor;
                  console.log('✅ Background (bgColor) aplicado:', bgColor);
                }
              }
              
              // Cor do texto
              if (cell.style.font) {
                console.log('🔤 Font encontrado:', cell.style.font);
                if ((cell.style.font as any).color) {
                  const textColor = rgbToHex((cell.style.font as any).color);
                  style[cellKey]['color'] = textColor;
                  console.log('✅ Cor do texto aplicada:', textColor);
                }
                if ((cell.style.font as any).bold) {
                  style[cellKey]['font-weight'] = 'bold';
                  console.log('✅ Negrito aplicado');
                }
                if ((cell.style.font as any).italic) {
                  style[cellKey]['font-style'] = 'italic';
                  console.log('✅ Itálico aplicado');
                }
                if ((cell.style.font as any).size) {
                  style[cellKey]['font-size'] = `${(cell.style.font as any).size}px`;
                  console.log('✅ Tamanho da fonte aplicado:', `${(cell.style.font as any).size}px`);
                }
              }
              
              // Alinhamento
              if (cell.style.alignment) {
                console.log('📐 Alinhamento encontrado:', cell.style.alignment);
                if ((cell.style.alignment as any).horizontal) {
                  style[cellKey]['text-align'] = (cell.style.alignment as any).horizontal;
                  console.log('✅ Alinhamento horizontal aplicado:', (cell.style.alignment as any).horizontal);
                }
                if ((cell.style.alignment as any).vertical) {
                  style[cellKey]['vertical-align'] = (cell.style.alignment as any).vertical;
                  console.log('✅ Alinhamento vertical aplicado:', (cell.style.alignment as any).vertical);
                }
              }
              
              // Bordas
              if (cell.style.border) {
                console.log('🔲 Bordas encontradas:', cell.style.border);
                const borders = cell.style.border;
                if (borders.top) {
                  const borderColor = rgbToHex((borders.top as any).color) || '#000';
                  style[cellKey]['border-top'] = `1px solid ${borderColor}`;
                  console.log('✅ Borda superior aplicada:', borderColor);
                }
                if (borders.bottom) {
                  const borderColor = rgbToHex((borders.bottom as any).color) || '#000';
                  style[cellKey]['border-bottom'] = `1px solid ${borderColor}`;
                  console.log('✅ Borda inferior aplicada:', borderColor);
                }
                if (borders.left) {
                  const borderColor = rgbToHex((borders.left as any).color) || '#000';
                  style[cellKey]['border-left'] = `1px solid ${borderColor}`;
                  console.log('✅ Borda esquerda aplicada:', borderColor);
                }
                if (borders.right) {
                  const borderColor = rgbToHex((borders.right as any).color) || '#000';
                  style[cellKey]['border-right'] = `1px solid ${borderColor}`;
                  console.log('✅ Borda direita aplicada:', borderColor);
                }
              }
              
              console.log('🎨 Estilo final aplicado:', style[cellKey]);
            }
          });
          
          data[rowNumber - 1] = rowData;
        });

        console.log(`📋 "${worksheet.name}" processada: ${data.length} linhas com formatação`);
        
        // Função para aplicar estilo DETRAN
        const applyDetranStyle = () => {
          const detranStyle: any = {};
          
          for (let row = 0; row < data.length; row++) {
            for (let col = 0; col < (data[row]?.length || 0); col++) {
              const cellKey = `${col}:${row}`;
              const cellValue = data[row][col];
              
              // Estilo padrão para todas as células
              detranStyle[cellKey] = {
                'background-color': '#000000', // Fundo preto
                'color': '#FFFFFF',            // Texto branco
                'border': '1px solid #FFFFFF', // Borda branca
                'font-family': 'Arial, sans-serif',
                'font-size': '12px',
                'padding': '4px'
              };
              
              // Células com texto amarelo para destaque
              if (cellValue && (
                String(cellValue).includes('Período:') ||
                String(cellValue).includes('Local:') ||
                String(cellValue).includes('Matrícula') ||
                String(cellValue).includes('Servidor') ||
                String(cellValue).includes('N°') ||
                String(cellValue).includes('Conc?') ||
                String(cellValue).includes('Rev?') ||
                String(cellValue).includes('Obs.')
              )) {
                detranStyle[cellKey]['color'] = '#FFFF00'; // Amarelo
                detranStyle[cellKey]['font-weight'] = 'bold';
              }
              
              // Cabeçalhos em amarelo
              if (row <= 2) { // Primeiras 3 linhas
                detranStyle[cellKey]['background-color'] = '#000000';
                detranStyle[cellKey]['color'] = '#FFFF00';
                detranStyle[cellKey]['font-weight'] = 'bold';
                detranStyle[cellKey]['text-align'] = 'center';
              }
            }
          }
          
          return detranStyle;
        };
        
        // Salvar estilo original
        const originalStyleData = { ...style };
        
        // Aplicar estilo padrão DETRAN se não houver formatação ou se solicitado
        if (Object.keys(style).length === 0) {
          console.log('🎨 Aplicando estilo padrão DETRAN (sem formatação original)...');
          Object.assign(style, applyDetranStyle());
        }
        
        return {
          name: worksheet.name || `Planilha ${worksheet.id}`,
          data: data.length > 0 ? data : [['Planilha vazia']],
          style,
          originalStyle: originalStyleData,
          detranStyle: applyDetranStyle(),
          colWidths,
          rowHeights
        };
      });

      setWorksheetsData(worksheets);
      setCurrentWorksheet(0);
      setFileStats({
        size: arrayBuffer.byteLength,
        sheets: worksheets.length
      });
      
      console.log('🎨 Formatação completa aplicada com sucesso!');
      setLoading(false);

    } catch (err: any) {
      console.error('❌ Erro ao carregar arquivo Excel:', err);
      setError(`Erro ao carregar ${fileName}: ${err.message}`);
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">🎨 Processando formatação Excel...</p>
          <p className="text-sm text-gray-500 mt-2">Extraindo cores, estilos e bordas</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 m-4">
        <div className="flex items-center">
          <div className="text-red-600 text-lg font-semibold">❌ Erro</div>
        </div>
        <p className="text-red-700 mt-2">{error}</p>
        <div className="mt-4 space-y-2">
          <button
            onClick={loadExcelFile}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            🔄 Tentar Novamente
          </button>
          <div className="text-sm text-gray-600">
            <p><strong>Dica:</strong> Certifique-se de que o arquivo está no formato Excel (.xlsx ou .xls)</p>
          </div>
        </div>
      </div>
    );
  }

  if (!worksheetsData.length) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 m-4">
        <div className="text-yellow-800">⚠️ Nenhuma planilha encontrada no arquivo</div>
      </div>
    );
  }

  const currentData = worksheetsData[currentWorksheet];
  
  // Obter estilo efetivo baseado na escolha do usuário
  const getEffectiveStyle = () => {
    if (useDetranStyle) {
      return currentData.detranStyle;
    } else {
      return Object.keys(currentData.originalStyle).length > 0 
        ? currentData.originalStyle 
        : currentData.style;
    }
  };

  return (
    <div className="w-full h-full bg-white relative">
      {/* Injeção de estilos CSS */}
      <style>{fadeStyles}</style>
      
      {/* Header com controles */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              📊 {fileName}
              <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                🎨 Com Formatação
              </span>
            </h3>
            {fileStats && (
              <p className="text-sm text-gray-600 mt-1">
                {currentData.data.length} linhas × {currentData.data[0]?.length || 0} colunas
              </p>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Botão para alternar estilo */}
            <button
              onClick={() => setUseDetranStyle(!useDetranStyle)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                useDetranStyle
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {useDetranStyle ? '🎨 Estilo DETRAN' : '📋 Formatação Original'}
            </button>
            
            {/* Tabs para múltiplas planilhas */}
            {worksheetsData.length > 1 && (
              <div className="flex space-x-1">
                {worksheetsData.map((sheet, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentWorksheet(index)}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      currentWorksheet === index
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {sheet.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Planilha com formatação preservada */}
      <div 
        className={`p-4 ${showModalManutencao ? 'planilha-fade' : ''}`}
        style={{ 
          height: 'calc(100vh - 180px)', 
          overflow: 'auto'
        }}
      >
        <Spreadsheet 
          ref={spreadsheetRef}
          toolbar={showModalManutencao ? [] : [
            'undo', 'redo', '|', 
            'font', 'font-size', '|',
            'bold', 'italic', '|',
            'font-color', 'background-color', '|',
            'align-left', 'align-center', 'align-right', '|',
            'border-all', 'border-outside', 'border-inside', '|',
            'save'
          ]}
          search={!showModalManutencao}
          fullscreen={!showModalManutencao}
          lazyLoading={true}
          loadingSpin={true}
        >
          <Worksheet 
            data={currentData.data}
            style={getEffectiveStyle()}
            colWidths={currentData.colWidths}
            rowHeights={currentData.rowHeights}
            minDimensions={[currentData.data[0]?.length || 10, currentData.data.length || 20]}
            tableOverflow={true}
            tableWidth="100%"
            tableHeight="100%"
            freezeColumns={0}
            columnSorting={false}
            columnDrag={false}
            rowDrag={false}
            editable={false}
            allowInsertRow={false}
            allowInsertColumn={false}
            allowDeleteRow={false}
            allowDeleteColumn={false}
            contextMenu={false}
            csvFileName={fileName.replace('.xlsx', '')}
            aboutThisSoftware={false}
            copyCompatibility={false}
            persistance={false}
            parseFormulas={true}
            readOnly={showModalManutencao}
            selection={true}
            selectionCopy={false}
          />
        </Spreadsheet>
      </div>

      {/* Footer com status */}
      <div className="p-3 border-t border-gray-200 bg-gray-50 text-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <span className="text-green-600 font-medium">
              ✅ {useDetranStyle ? 'Estilo DETRAN Aplicado' : 'Formatação Original Preservada'}
            </span>
            <span className="text-gray-600">Sheet: <strong>{currentData.name}</strong></span>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className={`text-xs px-2 py-1 rounded ${
              useDetranStyle 
                ? 'bg-yellow-100 text-yellow-800' 
                : 'bg-blue-100 text-blue-800'
            }`}>
              {useDetranStyle ? '🎨 DETRAN Style' : '📋 Original Style'}
            </span>
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
              📏 Dimensões
            </span>
            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
              🔧 Editável
            </span>
          </div>
        </div>
      </div>

      {/* Modal de Manutenção */}
      {showModalManutencao && (
        <ModalManutencao onVoltar={handleVoltar} />
      )}
    </div>
  );
} 