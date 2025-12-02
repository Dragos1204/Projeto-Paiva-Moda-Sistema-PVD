
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
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || '');
  const [password, setPassword] = useState('');
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
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-purple-600 p-8 text-center relative overflow-hidden">
          <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm relative z-10">
            <ShoppingBag className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2 relative z-10">{STORE_NAME}</h1>
          <p className="text-purple-100 relative z-10">{view === 'LOGIN' ? 'Selecione seu usuário' : 'Recuperação Offline'}</p>
        </div>

        <div className="p-8">
          {view === 'LOGIN' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Usuário</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <select 
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.username} {u.role === 'ADMIN' ? '(Admin)' : '(Func)'}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-700">Senha</label>
                  <button type="button" onClick={() => { setView('RECOVERY'); setError(''); }} className="text-xs text-purple-600 font-medium">Esqueci a senha</button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input type="password" className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg">
                {loading ? 'Carregando...' : 'ENTRAR'}
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              {step === 'KEY' ? (
                <form onSubmit={handleMasterKeyCheck} className="space-y-6">
                  {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center">{error}</div>}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Usuário a recuperar</label>
                    <select className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50 font-bold" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                        {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Chave Mestra</label>
                    <input type="password" required className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Chave de Recuperação" value={masterKey} onChange={(e) => setMasterKey(e.target.value)} />
                  </div>
                  <button type="submit" className="w-full bg-gray-800 hover:bg-black text-white font-bold py-3 rounded-lg">VALIDAR CHAVE</button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-6">
                   <div className="text-center"><h3 className="font-bold text-gray-800">Definir Nova Senha</h3></div>
                   <input type="text" required className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 text-center text-lg font-bold" placeholder="Nova Senha" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                   <button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg">SALVAR NOVA SENHA</button>
                </form>
              )}
              <button onClick={() => { setView('LOGIN'); setError(''); setStep('KEY'); setMasterKey(''); }} className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-800 font-medium">
                <ArrowLeft size={18} /> Voltar
              </button>
            </div>
          )}
          <div className="mt-8 text-center border-t border-gray-100 pt-6">
             <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-purple-600">
                <Code2 size={14} /> <span>Desenvolvido por Ericles Silva</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
