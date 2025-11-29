
import React, { useState } from 'react';
import { Lock, Save, AlertCircle, CheckCircle2, User, Shield } from 'lucide-react';

interface SettingsProps {
  currentPasswordHash: string;
  onPasswordChange: (newPass: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ currentPasswordHash, onPasswordChange }) => {
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  
  const [status, setStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('IDLE');

    // 1. Verify current password
    if (currentPassInput !== currentPasswordHash) {
      setStatus('ERROR');
      setMessage('A senha atual está incorreta.');
      return;
    }

    // 2. Verify new password match
    if (newPass !== confirmPass) {
      setStatus('ERROR');
      setMessage('As novas senhas não coincidem.');
      return;
    }

    // 3. Verify complexity (simple check)
    if (newPass.length < 4) {
      setStatus('ERROR');
      setMessage('A nova senha deve ter pelo menos 4 caracteres.');
      return;
    }

    // Success
    onPasswordChange(newPass);
    setStatus('SUCCESS');
    setMessage('Senha alterada com sucesso!');
    
    // Cleanup
    setCurrentPassInput('');
    setNewPass('');
    setConfirmPass('');
    
    // Hide success message after 3s
    setTimeout(() => {
        setStatus('IDLE');
        setMessage('');
    }, 3000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Configurações</h1>
        <p className="text-gray-500">Gerencie seu perfil e segurança.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Profile Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center">
             <div className="w-24 h-24 bg-purple-100 rounded-full mx-auto flex items-center justify-center text-purple-600 mb-4">
               <User size={48} />
             </div>
             <h2 className="text-xl font-bold text-gray-800">Administrador</h2>
             <p className="text-sm text-gray-500">admin</p>
             <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-200">
                <Shield size={12} /> Acesso Total
             </div>
          </div>
        </div>

        {/* Password Change Form */}
        <div className="md:col-span-2">
           <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                 <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                    <Lock size={20} />
                 </div>
                 <div>
                    <h3 className="font-bold text-gray-800">Alterar Senha</h3>
                    <p className="text-sm text-gray-500">Atualize sua senha de acesso ao sistema.</p>
                 </div>
              </div>
              
              <div className="p-6">
                 {status !== 'IDLE' && (
                   <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 border ${
                     status === 'SUCCESS' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                   }`}>
                      {status === 'SUCCESS' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                      <span className="font-medium text-sm">{message}</span>
                   </div>
                 )}

                 <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Senha Atual</label>
                       <input 
                         type="password"
                         required
                         value={currentPassInput}
                         onChange={e => setCurrentPassInput(e.target.value)}
                         className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                         placeholder="Digite sua senha atual"
                       />
                    </div>
                    
                    <hr className="border-gray-100 my-2" />

                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
                       <input 
                         type="password"
                         required
                         value={newPass}
                         onChange={e => setNewPass(e.target.value)}
                         className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                         placeholder="Mínimo 4 caracteres"
                       />
                    </div>

                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nova Senha</label>
                       <input 
                         type="password"
                         required
                         value={confirmPass}
                         onChange={e => setConfirmPass(e.target.value)}
                         className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                         placeholder="Repita a nova senha"
                       />
                    </div>

                    <div className="pt-2">
                       <button 
                         type="submit"
                         className="flex items-center gap-2 bg-purple-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 active:scale-95"
                       >
                         <Save size={20} />
                         Salvar Nova Senha
                       </button>
                    </div>
                 </form>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};
