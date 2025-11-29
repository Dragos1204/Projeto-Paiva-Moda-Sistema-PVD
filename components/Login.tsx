
import React, { useState } from 'react';
import { ShoppingBag, Lock, User, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { STORE_NAME } from '../constants';

interface LoginProps {
  onLogin: () => void;
  validatePassword: (pass: string) => boolean;
}

export const Login: React.FC<LoginProps> = ({ onLogin, validatePassword }) => {
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'LOGIN' | 'RECOVERY'>('LOGIN');
  const [error, setError] = useState('');
  
  // Login Form State
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('1234');

  // Recovery Form State
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulate API call
    setTimeout(() => {
      if (validatePassword(password)) {
        onLogin();
      } else {
        setError('Senha incorreta. Tente novamente.');
        setLoading(false);
      }
    }, 800);
  };

  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate sending email
    setTimeout(() => {
      setRecoverySent(true);
      setLoading(false);
    }, 1500);
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
            {view === 'LOGIN' ? 'Entre para acessar o sistema' : 'Recuperação de Acesso'}
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
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    type="text" 
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
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
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    type="password" 
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
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
              {!recoverySent ? (
                <form onSubmit={handleRecoverySubmit} className="space-y-6">
                  <p className="text-sm text-gray-600 text-center">
                    Digite seu e-mail cadastrado. Enviaremos um link para você redefinir sua senha.
                  </p>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input 
                        type="email" 
                        required
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        placeholder="seu@email.com"
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
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
                      'RECUPERAR SENHA'
                    )}
                  </button>
                </form>
              ) : (
                <div className="text-center py-4 animate-in fade-in zoom-in">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Verifique seu E-mail</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Enviamos um link de recuperação para: <br/>
                    <span className="font-medium text-purple-600">{recoveryEmail}</span>
                  </p>
                </div>
              )}

              <button 
                onClick={() => {
                  setView('LOGIN');
                  setRecoverySent(false);
                  setRecoveryEmail('');
                  setError('');
                }}
                className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-800 font-medium transition-colors"
              >
                <ArrowLeft size={18} />
                Voltar para o Login
              </button>
            </div>
          )}
          
          <div className="mt-6 text-center border-t border-gray-100 pt-6">
             <span className="text-xs text-gray-400">Sistema Versão Web 1.1</span>
          </div>
        </div>
      </div>
    </div>
  );
};
