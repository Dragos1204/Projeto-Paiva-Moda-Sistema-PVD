
import React, { useState } from 'react';
import { ShoppingBag, Lock, User as UserIcon, ArrowLeft, KeyRound, ShieldCheck, Code2 } from 'lucide-react';
import { STORE_NAME, MASTER_RECOVERY_KEY } from '../constants';
import { User } from '../types';

interface LoginProps {
  users: User[];
  onLogin: (user: User) => void;
  onRecoverPassword: (userId: string, newPass: string) => void;
}

export const Login: React.FC<LoginProps> = ({ users, onLogin, onRecoverPassword }) => {
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'LOGIN' | 'RECOVERY'>('LOGIN');
  const [error, setError] = useState('');
  
  // Login Form State
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || '');
  const [password, setPassword] = useState('');

  // Recovery Form State
  const [masterKey, setMasterKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'KEY' | 'RESET'>('KEY');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const user = users.find(u => u.id === selectedUserId);

    setTimeout(() => {
      if (user && user.password === password) {
        onLogin(user);
      } else {
        setError('Senha incorreta.');
        setLoading(false);
      }
    }, 600);
  };

  const handleMasterKeyCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (masterKey === MASTER_RECOVERY_KEY) {
      setStep('RESET');
      setError('');
    } else {
      setError('Chave Mestra inválida.');
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 4) {
      setError('A senha deve ter no mínimo 4 caracteres.');
      return;
    }
    
    setLoading(true);
    setTimeout(() => {
        onRecoverPassword(selectedUserId, newPassword);
        setView('LOGIN');
        setStep('KEY');
        setPassword('');
        setMasterKey('');
        setNewPassword('');
        setLoading(false);
        setError('');
        alert('Senha redefinida com sucesso!');
    }, 1000);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-purple-900 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="bg-purple-600 p-8 text-center relative overflow-hidden">
          <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm relative z-10">
            <ShoppingBag className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2 relative z-10">{STORE_NAME}</h1>
          <p className="text-purple-100 relative z-10">
            {view === 'LOGIN' ? 'Selecione seu usuário' : 'Recuperação Offline'}
          </p>
          
          {/* Decorative circles */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full -translate-x-10 -translate-y-10" />
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-white/10 rounded-full translate-x-10 translate-y-10" />
        </div>

        <div className="p-8">
          {view === 'LOGIN' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2 border border-red-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Usuário</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <select 
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white appearance-none cursor-pointer"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.username} {u.role === 'ADMIN' ? '(Admin)' : '(Func)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-700">Senha</label>
                  <button 
                    type="button"
                    onClick={() => {
                      setView('RECOVERY');
                      setError('');
                    }}
                    className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                  >
                    Esqueci a senha
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    type="password" 
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-purple-500/30 flex justify-center items-center"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'ENTRAR'
                )}
              </button>
            </form>
          ) : (
            // RECOVERY VIEW
            <div className="space-y-6">
              {step === 'KEY' ? (
                <form onSubmit={handleMasterKeyCheck} className="space-y-6">
                  <div className="text-center mb-4">
                    <ShieldCheck size={40} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm text-gray-600">
                        Digite a <strong>Chave Mestra</strong> do sistema para redefinir a senha do usuário selecionado.
                    </p>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center">{error}</div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Usuário a recuperar</label>
                    <select 
                        className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50 font-bold"
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                    >
                        {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Chave Mestra</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input 
                        type="password" 
                        required
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        placeholder="Chave de Recuperação"
                        value={masterKey}
                        onChange={(e) => setMasterKey(e.target.value)}
                      />
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-gray-800 hover:bg-black text-white font-bold py-3 rounded-lg">
                    VALIDAR CHAVE
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-6 animate-in fade-in slide-in-from-right">
                   <div className="text-center">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2 text-green-600">
                        <Lock size={24} />
                      </div>
                      <h3 className="font-bold text-gray-800">Definir Nova Senha</h3>
                      <p className="text-sm text-gray-500">Para: {users.find(u => u.id === selectedUserId)?.username}</p>
                   </div>

                   <input 
                      type="text" 
                      required
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 text-center text-lg font-bold"
                      placeholder="Nova Senha"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                   />

                   <button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg">
                      {loading ? 'SALVANDO...' : 'SALVAR NOVA SENHA'}
                   </button>
                </form>
              )}

              <button 
                onClick={() => {
                  setView('LOGIN');
                  setError('');
                  setStep('KEY');
                  setMasterKey('');
                }}
                className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-800 font-medium transition-colors"
              >
                <ArrowLeft size={18} />
                Voltar
              </button>
            </div>
          )}
          
          <div className="mt-8 text-center border-t border-gray-100 pt-6">
             <p className="text-xs text-gray-400 mb-1">Sistema Versão 2.0</p>
             <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-purple-600">
                <Code2 size={14} />
                <span>Desenvolvido por Ericles Silva</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
