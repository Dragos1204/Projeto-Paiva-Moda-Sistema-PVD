import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Flashlight, RefreshCw, ScanLine, AlertCircle } from 'lucide-react';

interface CameraBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
}

export const CameraBarcodeScanner: React.FC<CameraBarcodeScannerProps> = ({
  isOpen,
  onClose,
  onScan,
  title = "Bipar Código de Barras"
}) => {
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "reader-camera-scanner";

  // Emite som de beep e vibração (se suportado pelo celular) ao bipar com sucesso
  const playScanFeedback = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, audioCtx.currentTime); // Tom agudo agradável de leitor
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      }
      if (navigator.vibrate) {
        navigator.vibrate(70);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    setErrorMessage(null);
    let isSubscribed = true;

    Html5Qrcode.getCameras()
      .then(devices => {
        if (!isSubscribed) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefere câmera traseira ("back", "rear" ou "environment") em smartphones
          const backCam = devices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('rear') || 
            d.label.toLowerCase().includes('traseira') ||
            d.label.toLowerCase().includes('ambiente')
          );
          const defaultCamId = backCam ? backCam.id : devices[devices.length - 1].id;
          setSelectedCameraId(defaultCamId);
          startScanning(defaultCamId);
        } else {
          setErrorMessage("Nenhuma câmera encontrada no dispositivo.");
        }
      })
      .catch(err => {
        if (!isSubscribed) return;
        console.error("Erro ao listar câmeras:", err);
        setErrorMessage("Não foi possível acessar a câmera. Verifique se concedeu permissão ao navegador.");
      });

    return () => {
      isSubscribed = false;
      stopScanner();
    };
  }, [isOpen]);

  const startScanning = async (cameraId: string) => {
    try {
      if (html5QrCodeRef.current && isScanning) {
        await html5QrCodeRef.current.stop();
      }

      const html5QrCode = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE
        ],
        verbose: false
      });

      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 180 },
        aspectRatio: 1.333
      };

      await html5QrCode.start(
        cameraId,
        config,
        (decodedText) => {
          // Bipou com sucesso!
          playScanFeedback();
          onScan(decodedText.trim());
        },
        () => {
          // Frame sem leitura (ignorado)
        }
      );

      setIsScanning(true);
      setErrorMessage(null);

      // Checa suporte a lanterna (torch)
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        if ((capabilities as any)?.torch) {
          setHasTorch(true);
        }
      } catch (_) {
        setHasTorch(false);
      }

    } catch (err: any) {
      console.error("Erro ao iniciar câmera:", err);
      setIsScanning(false);
      setErrorMessage("Erro ao iniciar câmera: " + (err.message || 'Permissão negada.'));
    }
  };

  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
      }
    } catch (e) {
      console.warn("Erro ao finalizar scanner:", e);
    } finally {
      setIsScanning(false);
      setIsTorchOn(false);
    }
  };

  const handleSwitchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex(c => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    setSelectedCameraId(nextCamera.id);
    startScanning(nextCamera.id);
  };

  const handleToggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorch) return;
    try {
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: !isTorchOn } as any]
      });
      setIsTorchOn(!isTorchOn);
    } catch (e) {
      console.warn("Lanterna não suportada:", e);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      playScanFeedback();
      onScan(manualCode.trim());
      setManualCode('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-gray-900 text-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-gray-800 flex flex-col">
        {/* Cabeçalho */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-gray-800 bg-gray-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-purple-600/30 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <Camera size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-gray-100">{title}</h3>
              <p className="text-[11px] text-gray-400">Celular, Tablet ou Computador</p>
            </div>
          </div>
          <button 
            onClick={() => { stopScanner(); onClose(); }}
            className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewport da Câmera */}
        <div className="relative bg-black flex flex-col items-center justify-center min-h-[300px] overflow-hidden">
          <div id={scannerContainerId} className="w-full h-full min-h-[300px]" />

          {/* Mira / Moldura Animada de Leitura */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
              <div className="w-64 h-40 border-2 border-purple-400/80 rounded-2xl relative shadow-lg shadow-purple-500/20">
                {/* Linha Laser Animada */}
                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-pink-500 via-purple-400 to-pink-500 shadow-md shadow-pink-500/50 animate-pulse" style={{ top: '50%' }} />
                {/* Cantoneiras Estilizadas */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-purple-500 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-purple-500 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-purple-500 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-purple-500 rounded-br-lg" />
              </div>
              <span className="text-[11px] text-purple-200 bg-black/60 px-3 py-1 rounded-full mt-3 font-semibold backdrop-blur-sm border border-purple-500/20">
                Posicione o código de barras ou QR Code no centro
              </span>
            </div>
          )}

          {/* Mensagem de Erro se houver */}
          {errorMessage && (
            <div className="absolute inset-0 bg-gray-950/90 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <AlertCircle size={36} className="text-rose-500" />
              <p className="text-xs text-rose-300 max-w-xs">{errorMessage}</p>
              <button 
                onClick={() => selectedCameraId && startScanning(selectedCameraId)}
                className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold shadow hover:bg-purple-700 transition"
              >
                Tentar Novamente
              </button>
            </div>
          )}
        </div>

        {/* Controles de Câmera (Trocar Câmera & Lanterna) */}
        <div className="p-3 bg-gray-950 border-t border-gray-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {cameras.length > 1 && (
              <button
                type="button"
                onClick={handleSwitchCamera}
                className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <RefreshCw size={14} /> Trocar Câmera ({cameras.length})
              </button>
            )}

            {hasTorch && (
              <button
                type="button"
                onClick={handleToggleTorch}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                  isTorchOn ? 'bg-amber-400 text-amber-950' : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                }`}
              >
                <Flashlight size={14} /> {isTorchOn ? 'Lanterna Ligada' : 'Ligar Lanterna'}
              </button>
            )}
          </div>

          <span className="text-[10px] text-gray-400 hidden sm:inline">
            Leitor Contínuo Ativo
          </span>
        </div>

        {/* Fallback de Entrada Manual */}
        <div className="p-4 bg-gray-900 border-t border-gray-800">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input 
              type="text" 
              placeholder="Ou digite o código de barras / SKU..."
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              className="flex-1 px-3.5 py-2 bg-gray-800 border border-gray-700 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
            >
              <ScanLine size={14} /> Bipar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
