import React, { useState } from 'react';
import { 
  ShoppingBag, Lock, User as UserIcon, ShieldCheck, KeyRound, ArrowLeft, 
  Crown, CheckCircle2, AlertCircle, Mail, Sparkles, Check 
} from 'lucide-react';
import { STORE_NAME, MASTER_RECOVERY_KEY } from '../constants';
import { User } from '../types';
import { db } from '../database';

interface LoginProps {
  users: User[];
  onLogin: (user: User) => void;
  onRecoverPassword: (userId: string, newPass: string) => void;
  onInitialOwnerSetup?: (owner: User) => void;
  onCompleteEmployeeProfile?: (updatedUser: User) => void;
}

export const Login: React.FC<LoginProps> = ({ 
  users, 
  onLogin, 
  onRecoverPassword, 
  onInitialOwnerSetup,
  onCompleteEmployeeProfile
}) => {
  // GATILHO DO PRIMEIRO ACESSO (Setup do Dono Principal)
  // Ativado se a lista estiver vazia ou nenhum usuário for OWNER
  const isInitialSetup = users.length === 0 || !users.some(u => u.isOwner === true || u.role === 'OWNER');

  // Estados do Setup do Dono (Primeiro Acesso)
  const [ownerFirstName, setOwnerFirstName] = useState('João');
  const [ownerLastName, setOwnerLastName] = useState('Neto');
  const [ownerBirthDate, setOwnerBirthDate] = useState('1990-01-01');
  const [ownerEmail, setOwnerEmail] = useState('netocardoso06@gmail.com');
  const [ownerCpf, setOwnerCpf] = useState('029.549.012-84');
  const [ownerPassword, setOwnerPassword] = useState('1234');
  const [ownerPasswordConfirm, setOwnerPasswordConfirm] = useState('1234');

  // Estados da Tela de Login Normal (E-mail ou CPF)
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'LOGIN' | 'RECOVERY'>('LOGIN');
  const [error, setError] = useState('');
  const [identifier, setIdentifier] = useState(''); // Campo único: E-mail ou CPF
  const [password, setPassword] = useState('');

  // Estado do Modal Obrigatório de Redefinição de Senha (Primeiro Login / Reset)
  const [mustChangeUser, setMustChangeUser] = useState<User | null>(null);
  const [mustChangeNewPass, setMustChangeNewPass] = useState('');
  const [mustChangeConfirmPass, setMustChangeConfirmPass] = useState('');
  const [mustChangeError, setMustChangeError] = useState('');
  const [isSavingNewPassword, setIsSavingNewPassword] = useState(false);

  // Estados da Recuperação com Chave Mestra
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [masterKey, setMasterKey] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [step, setStep] = useState<'KEY' | 'RESET'>('KEY');
  const [matchedUserId, setMatchedUserId] = useState<string | null>(null);

  // Máscara automática de CPF: 000.000.000-00
  const applyCpfMask = (val: string) => {
    const d = val.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
  };

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digitsOnly = raw.replace(/\D/g, '');

    // Se contiver @ ou letras, trata como e-mail
    if (raw.includes('@') || /[a-zA-Z]/.test(raw)) {
      setIdentifier(raw);
    } else if (digitsOnly.length > 2 && raw.length <= 14) {
      setIdentifier(applyCpfMask(raw));
    } else {
      setIdentifier(raw);
    }
  };

  // --- 1. Submissão do Setup do Dono Principal (Primeiro Acesso) ---
  const handleOwnerSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!ownerFirstName.trim() || !ownerLastName.trim()) {
      setError('Por favor, informe Nome e Sobrenome completos.');
      return;
    }
    if (!ownerEmail.trim() || !ownerEmail.includes('@')) {
      setError('Por favor, informe um E-mail válido.');
      return;
    }
    const cleanCpf = ownerCpf.replace(/\D/g, '');
    if (cleanCpf.length < 11) {
      setError('Por favor, informe um CPF válido com 11 dígitos.');
      return;
    }
    if (ownerPassword.length < 4) {
      setError('A senha deve ter no mínimo 4 caracteres.');
      return;
    }
    if (ownerPassword !== ownerPasswordConfirm) {
      setError('A confirmação da senha não confere.');
      return;
    }

    const fullName = `${ownerFirstName.trim()} ${ownerLastName.trim()}`;

    const newOwner: User = {
      id: 'joao_master',
      username: cleanCpf || '02954901284',
      firstName: ownerFirstName.trim(),
      lastName: ownerLastName.trim(),
      name: fullName,
      birthDate: ownerBirthDate || '1990-01-01',
      email: ownerEmail.trim().toLowerCase(),
      cpf: applyCpfMask(cleanCpf),
      password: ownerPassword,
      role: 'OWNER',
      isOwner: true,
      isActive: true,
      isProfileComplete: true,
      mustChangePassword: false,
      createdAt: new Date().toISOString()
    };

    await db.save('users', newOwner);

    if (onInitialOwnerSetup) {
      onInitialOwnerSetup(newOwner);
    } else {
      onLogin(newOwner);
    }
  };

  // --- 2. Lógica de Autenticação Segura (E-mail ou CPF) ---
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const rawInput = identifier.trim();
    const inputDigits = rawInput.replace(/\D/g, '');
    const inputEmail = rawInput.toLowerCase();

    // Localizar o usuário na lista onde:
    // (user.email.toLowerCase() === input.toLowerCase()) OU (user.cpf.replace(/\D/g, '') === input.replace(/\D/g, ''))
    const targetUser = users.find(u => {
      if (!u) return false;
      const uEmail = (u.email || '').trim().toLowerCase();
      const uCpfDigits = (u.cpf || '').replace(/\D/g, '');
      const uCpfFormatted = (u.cpf || '').trim().toLowerCase();

      const matchEmail = uEmail.length > 0 && uEmail === inputEmail;
      const matchCpfDigits = inputDigits.length >= 10 && uCpfDigits === inputDigits;
      const matchCpfFormatted = uCpfFormatted.length > 0 && uCpfFormatted === rawInput.toLowerCase();

      return matchEmail || matchCpfDigits || matchCpfFormatted;
    });

    setTimeout(() => {
      if (targetUser && targetUser.password === password) {
        // Bloqueio por Soft Delete (Usuário Desativado)
        if (targetUser.isActive === false) {
          setError('Acesso bloqueado: Esta conta de colaborador foi desativada pela administração.');
          setLoading(false);
          return;
        }

        // Se a senha foi resetada ou é primeiro acesso com senha padrão (mustChangePassword === true),
        // abre o modal obrigatório de redefinição de senha
        if (targetUser.mustChangePassword === true) {
          setMustChangeUser(targetUser);
          setMustChangeNewPass('');
          setMustChangeConfirmPass('');
          setMustChangeError('');
          setLoading(false);
          return;
        }

        onLogin(targetUser);
      } else {
        setError('E-mail/CPF ou senha incorretos. Verifique os dados digitados.');
        setLoading(false);
      }
    }, 250);
  };

  // --- 3. Submissão da Troca de Senha Obrigatória (Primeiro Login / Reset) ---
  const handleMustChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMustChangeError('');

    if (mustChangeNewPass.length < 4) {
      setMustChangeError('A nova senha deve ter no mínimo 4 caracteres.');
      return;
    }
    if (mustChangeNewPass === '1234') {
      setMustChangeError('Por favor, escolha uma senha diferente da padrão inicial (1234).');
      return;
    }
    if (mustChangeNewPass !== mustChangeConfirmPass) {
      setMustChangeError('A confirmação da nova senha não coincide.');
      return;
    }

    if (mustChangeUser) {
      try {
        setIsSavingNewPassword(true);
        const updatedUser: User = {
          ...mustChangeUser,
          password: mustChangeNewPass,
          mustChangePassword: false,
          isProfileComplete: true
        };

        // Persiste a nova senha no Firestore
        await db.save('users', updatedUser);

        if (onCompleteEmployeeProfile) {
          onCompleteEmployeeProfile(updatedUser);
        } else {
          onLogin(updatedUser);
        }
        setMustChangeUser(null);
      } catch (err) {
        console.error("Erro ao atualizar senha:", err);
        setMustChangeError('Erro ao gravar nova senha no banco. Tente novamente.');
      } finally {
        setIsSavingNewPassword(false);
      }
    }
  };

  // --- 4. Recuperação de Acesso com Chave Mestra ---
  const handleMasterKeyCheck = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanInput = recoveryIdentifier.trim().toLowerCase();
    const cleanDigits = recoveryIdentifier.replace(/\D/g, '');

    const userToRecover = users.find(u => {
      const uCpfDigits = (u.cpf || '').replace(/\D/g, '');
      const uEmail = (u.email || '').toLowerCase().trim();
      return (cleanDigits.length >= 10 && uCpfDigits === cleanDigits) || (uEmail.length > 0 && uEmail === cleanInput);
    });

    if (!userToRecover) {
      setError('Nenhuma conta localizada para o E-mail ou CPF informado.');
      return;
    }

    if (masterKey.trim() !== MASTER_RECOVERY_KEY) {
      setError('Chave Mestra de Segurança inválida.');
      return;
    }

    setMatchedUserId(userToRecover.id);
    setStep('RESET');
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPassword.length < 4) {
      setError('A nova senha deve ter no mínimo 4 caracteres.');
      return;
    }
    if (!matchedUserId) return;

    setLoading(true);
    setTimeout(() => {
      onRecoverPassword(matchedUserId, resetPassword);
      setView('LOGIN');
      setStep('KEY');
      setPassword('');
      setMasterKey('');
      setResetPassword('');
      setRecoveryIdentifier('');
      setMatchedUserId(null);
      setLoading(false);
      setError('');
      alert('Senha redefinida com sucesso! Você já pode entrar com sua nova senha.');
    }, 400);
  };

  // =========================================================================
  // SETUP INICIAL: PRIMEIRO ACESSO DO DONO
  // =========================================================================
  if (isInitialSetup) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950 p-4 font-sans">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-purple-200 animate-in fade-in zoom-in-95">
          <div className="bg-gradient-to-r from-purple-700 to-pink-600 p-7 text-center text-white relative">
            <div className="mx-auto bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mb-3 backdrop-blur-md shadow-inner">
              <Crown className="text-amber-300" size={32} />
            </div>
            <span className="text-[11px] uppercase tracking-widest font-black bg-white/20 px-3 py-1 rounded-full inline-block mb-2">
              Setup da Loja • Primeiro Acesso do Dono
            </span>
            <h1 className="text-2xl font-black">{STORE_NAME}</h1>
            <p className="text-purple-100 text-xs mt-1">Preencha o cadastro do Administrador Principal para ativar o sistema</p>
          </div>

          <div className="p-7">
            <div className="mb-4 p-3.5 bg-purple-50 border border-purple-200 rounded-2xl text-xs text-purple-900 leading-relaxed">
              👋 <strong>Bem-vindo ao Paiva Moda!</strong> Este é o <strong>primeiro acesso</strong> à sua loja. Confirme os dados do Administrador Dono (Admin Master) com plenos poderes gerenciais e de equipe.
            </div>

            <form onSubmit={handleOwnerSetupSubmit} className="space-y-3.5">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl font-semibold border border-red-200 flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Nome e Sobrenome */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Nome</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ex: João" 
                    value={ownerFirstName} 
                    onChange={e => setOwnerFirstName(e.target.value)} 
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500 font-medium" 
                    autoFocus 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Sobrenome</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ex: Neto" 
                    value={ownerLastName} 
                    onChange={e => setOwnerLastName(e.target.value)} 
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500 font-medium" 
                  />
                </div>
              </div>

              {/* Data de Nascimento e CPF */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Data de Nascimento</label>
                  <input 
                    type="date" 
                    required 
                    value={ownerBirthDate} 
                    onChange={e => setOwnerBirthDate(e.target.value)} 
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500 font-mono" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">CPF (com máscara)</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="000.000.000-00" 
                    value={ownerCpf} 
                    onChange={e => setOwnerCpf(applyCpfMask(e.target.value))} 
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
              </div>

              {/* E-mail */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">E-mail para Acesso</label>
                <input 
                  type="email" 
                  required 
                  placeholder="netocardoso06@gmail.com" 
                  value={ownerEmail} 
                  onChange={e => setOwnerEmail(e.target.value)} 
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500 font-medium" 
                />
              </div>

              {/* Senha e Confirmação */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Senha Padrão</label>
                  <input 
                    type="password" 
                    required 
                    placeholder="••••••••" 
                    value={ownerPassword} 
                    onChange={e => setOwnerPassword(e.target.value)} 
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Confirmar Senha</label>
                  <input 
                    type="password" 
                    required 
                    placeholder="••••••••" 
                    value={ownerPasswordConfirm} 
                    onChange={e => setOwnerPasswordConfirm(e.target.value)} 
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full mt-3 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                <CheckCircle2 size={18} /> SALVAR CADASTRO E ATIVAR LOJA
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // TELA DE LOGIN PRINCIPAL (CAMPO ÚNICO: "E-MAIL OU CPF")
  // =========================================================================
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950 p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in">
        {/* Banner Superior */}
        <div className="bg-gradient-to-r from-purple-700 to-pink-600 p-8 text-center text-white relative">
          <div className="mx-auto bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mb-3 backdrop-blur-md shadow-inner">
            <ShoppingBag className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-black">{STORE_NAME}</h1>
          <p className="text-purple-100 text-xs mt-1">
            {view === 'LOGIN' ? 'Autenticação Segura • Terminal da Loja' : 'Recuperação de Acesso'}
          </p>
        </div>

        <div className="p-7 lg:p-8">
          {view === 'LOGIN' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl font-semibold border border-red-200 flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Campo Único de Identificação: "E-mail ou CPF" */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  E-mail ou CPF
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text"
                    required
                    placeholder="E-mail ou CPF"
                    value={identifier}
                    onChange={handleIdentifierChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium text-gray-800 transition"
                    autoFocus
                  />
                </div>
              </div>

              {/* Campo Senha */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-gray-700">Senha</label>
                  <button 
                    type="button" 
                    onClick={() => { setView('RECOVERY'); setError(''); setRecoveryIdentifier(identifier); }} 
                    className="text-[11px] text-purple-600 font-semibold hover:underline cursor-pointer"
                  >
                    Esqueci a senha
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="password" 
                    required
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm transition"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full mt-2 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                {loading ? 'Validando Acesso...' : 'ENTRAR NO SISTEMA'}
              </button>
            </form>
          ) : (
            /* Fluxo Recuperação com E-mail ou CPF + Chave Mestra */
            <div className="space-y-4">
              <button 
                type="button"
                onClick={() => { setView('LOGIN'); setError(''); setStep('KEY'); }} 
                className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 font-semibold mb-2 cursor-pointer"
              >
                <ArrowLeft size={14} /> Voltar ao login
              </button>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl font-semibold border border-red-200 flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              {step === 'KEY' ? (
                <form onSubmit={handleMasterKeyCheck} className="space-y-3">
                  <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl text-xs text-purple-800 leading-relaxed">
                    Insira o seu <strong>E-mail ou CPF</strong> e a <strong>Chave Mestra</strong> autorizada pelo Dono da loja para desbloquear e redefinir a sua senha.
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Seu E-mail ou CPF</label>
                    <input 
                      type="text" 
                      required
                      placeholder="E-mail ou CPF" 
                      value={recoveryIdentifier} 
                      onChange={e => setRecoveryIdentifier(e.target.value)} 
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500" 
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Chave Mestra de Segurança</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="password" 
                        required
                        placeholder="Chave Mestra..." 
                        value={masterKey} 
                        onChange={(e) => setMasterKey(e.target.value)} 
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-purple-500" 
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow transition mt-1 cursor-pointer"
                  >
                    Validar Acesso
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Digite a Nova Senha</label>
                    <input 
                      type="password" 
                      required
                      placeholder="Mínimo 4 dígitos" 
                      value={resetPassword} 
                      onChange={(e) => setResetPassword(e.target.value)} 
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500" 
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow transition mt-1 cursor-pointer"
                  >
                    {loading ? 'Salvando...' : 'Salvar Nova Senha'}
                  </button>
                </form>
              )}
            </div>
          )}

          <div className="mt-7 pt-4 border-t border-gray-100 flex items-center justify-center gap-1.5 text-xs text-gray-400">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Sistema Seguro • Autenticação Privada</span>
          </div>
        </div>
      </div>

      {/* MODAL OBRIGATÓRIO: REDEFINIÇÃO DE SENHA NO PRIMEIRO LOGIN OU APÓS RESET */}
      {mustChangeUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 lg:p-7 space-y-5 animate-in zoom-in-95 border border-purple-100">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-2xl mx-auto flex items-center justify-center shadow-inner">
                <KeyRound size={28} />
              </div>
              <h3 className="text-lg font-black text-gray-900">Defina sua Nova Senha</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Olá, <strong>{mustChangeUser.name || mustChangeUser.firstName || 'Colaborador'}</strong>! Para sua segurança, defina uma nova senha pessoal definitiva para acessar o sistema.
              </p>
            </div>

            {mustChangeError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl font-semibold border border-red-200 flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-red-500" />
                <span>{mustChangeError}</span>
              </div>
            )}

            <form onSubmit={handleMustChangePasswordSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Nova Senha Pessoal</label>
                <input 
                  type="password"
                  required
                  autoFocus
                  placeholder="Mínimo 4 caracteres (diferente de 1234)"
                  value={mustChangeNewPass}
                  onChange={e => setMustChangeNewPass(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Confirmar Nova Senha</label>
                <input 
                  type="password"
                  required
                  placeholder="Repita a nova senha"
                  value={mustChangeConfirmPass}
                  onChange={e => setMustChangeConfirmPass(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingNewPassword}
                  className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-black rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 size={18} /> {isSavingNewPassword ? 'Salvando...' : 'Salvar Nova Senha & Entrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
