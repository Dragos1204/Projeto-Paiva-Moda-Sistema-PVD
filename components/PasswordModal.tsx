import React, { useState } from 'react';
import { Lock, X, AlertTriangle } from 'lucide-react';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentPasswordHash: string;
  actionTitle: string;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentPasswordHash,
  actionTitle
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === currentPasswordHash) {
      onConfirm();
      setPassword('');
      setError('');
      onClose();
    } else {
      setError('Senha incorreta.');
      setPassword('');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-red-50 p-6 flex flex-col items-center text-center border-b border-red-100">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-3">
            <Lock size={24} />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Permissão Necessária</h3>
          <p className="text-sm text-gray-500 mt-1">
            Digite a senha de administrador para: <br/>
            <span className="font-bold text-red-600">{actionTitle}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              className="w-full text-center text-2xl tracking-widest p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
              placeholder="••••"
            />
            {error && (
              <p className="text-red-500 text-xs text-center mt-2 font-medium flex items-center justify-center gap-1">
                <AlertTriangle size={12} /> {error}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-transform active:scale-95"
            >
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};