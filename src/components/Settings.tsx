import React, { useState, useRef } from 'react';
import { 
  Lock, Save, AlertCircle, CheckCircle2, User as UserIcon, Shield, 
  Printer, Database, Download, Upload, AlertTriangle, Monitor, Users, 
  Plus, RefreshCw, KeyRound, Crown, Code2, X, Check, ShieldAlert,
  Power, UserCheck, UserX, HelpCircle, Trash2
} from 'lucide-react';
import { printer } from '../printer';
import { db, clearFirestoreCollection } from '../database';
import { User, UserRole, StoreProfile } from '../types';
import { useToast } from '../context/ToastContext';

interface SettingsProps {
  currentUser: User | null;
  users: User[];
  storeProfile?: StoreProfile;
  onUpdateStoreProfile?: (profile: StoreProfile) => void;
  onPasswordChange: (newPass: string) => void;
  currentScale?: number;
  onScaleChange?: (scale: number) => void;
  onAddUser?: (user: User) => void;
  onDeleteUser?: (id: string) => void;
  onResetUserPassword?: (id: string, newPassword?: string) => void;
  onToggleUserStatus?: (id: string, isActive: boolean) => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  currentUser, 
  users, 
  storeProfile,
  onUpdateStoreProfile,
  onPasswordChange, 
  currentScale = 1, 
  onScaleChange, 
  onAddUser, 
  onDeleteUser,
  onResetUserPassword,
  onToggleUserStatus
}) => {
  const isOwner = currentUser?.role === 'OWNER' || currentUser?.isOwner === true;
  const isManager = currentUser?.role === 'MANAGER';
  const isStaffAdmin = isOwner || isManager || currentUser?.role === 'ADMIN';
  const toast = useToast();

  // Estados dos Dados da Loja no Cupom Térmico
  const [storeNameInput, setStoreNameInput] = useState(storeProfile?.name || 'PAIVA MODA');
  const [storePhoneInput, setStorePhoneInput] = useState(storeProfile?.phone || '');
  const [storeInstagramInput, setStoreInstagramInput] = useState(storeProfile?.instagram || '');
  const [storeAddressInput, setStoreAddressInput] = useState(storeProfile?.address || '');
  const [storeCnpjInput, setStoreCnpjInput] = useState(storeProfile?.cnpj || '');
  const [storeReceiptMessageInput, setStoreReceiptMessageInput] = useState(
    storeProfile?.receiptMessage || '*** NÃO É DOCUMENTO FISCAL ***\nObrigado pela preferência! Volte sempre.'
  );
  const [isSavingStoreProfile, setIsSavingStoreProfile] = useState(false);

  React.useEffect(() => {
    if (storeProfile) {
      setStoreNameInput(storeProfile.name || 'PAIVA MODA');
      setStorePhoneInput(storeProfile.phone || '');
      setStoreInstagramInput(storeProfile.instagram || '');
      setStoreAddressInput(storeProfile.address || '');
      setStoreCnpjInput(storeProfile.cnpj || '');
      setStoreReceiptMessageInput(storeProfile.receiptMessage || '*** NÃO É DOCUMENTO FISCAL ***\nObrigado pela preferência! Volte sempre.');
    }
  }, [storeProfile]);

  const handleSaveStoreProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingStoreProfile(true);
      const updated: StoreProfile = {
        name: storeNameInput.trim() || 'PAIVA MODA',
        phone: storePhoneInput.trim(),
        instagram: storeInstagramInput.trim(),
        address: storeAddressInput.trim(),
        cnpj: storeCnpjInput.trim(),
        receiptMessage: storeReceiptMessageInput.trim() || '*** NÃO É DOCUMENTO FISCAL ***\nObrigado pela preferência! Volte sempre.'
      };

      await db.save('settings', {
        id: 'store_profile',
        key: 'store_profile',
        ...updated
      });

      if (onUpdateStoreProfile) {
        onUpdateStoreProfile(updated);
      }

      toast.success("Dados da Loja Salvos", "As informações do cupom térmico foram salvas com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar dados da loja:", err);
      toast.error("Erro ao Salvar", "Não foi possível gravar as configurações no banco de dados.");
    } finally {
      setIsSavingStoreProfile(false);
    }
  };

  // Estados da Troca de Senha Pessoal
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [message, setMessage] = useState('');

  // Estados de Backup
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backupStatus, setBackupStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');

  // Estados da Zona de Perigo (Zerar Banco para Produção)
  const [resetType, setResetType] = useState<'A' | 'B' | null>(null);
  const [isResetDbModalOpen, setIsResetDbModalOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [isWiping, setIsWiping] = useState(false);
  const [resetDbError, setResetDbError] = useState('');

  // Modal Novo Membro da Equipe (Exigindo Nome, Sobrenome, E-mail, CPF, Cargo, Senha)
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [addFirstName, setAddFirstName] = useState('');
  const [addLastName, setAddLastName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addCpf, setAddCpf] = useState('');
  const [addRole, setAddRole] = useState<UserRole>('SELLER');
  const [addPassword, setAddPassword] = useState('1234');
  const [addError, setAddError] = useState('');

  // Modal de Confirmação de Reset de Senha de Funcionário
  const [userToResetPassword, setUserToResetPassword] = useState<User | null>(null);
  const [tempPasswordInput, setTempPasswordInput] = useState('1234');
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);

  // Modal e Ação de Exclusão de Colaborador (Exclusivo Dono)
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Formatação de CPF: 000.000.000-00
  const formatCPF = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  };

  // 1. Deduplicação e Purga Visual: Garante UMA ÚNICA instância canônica do Dono e nenhum registro duplicado
  const realUsers = React.useMemo(() => {
    const list: User[] = [];
    const seen = new Set<string>();

    (users || []).forEach(u => {
      if (!u || !u.id) return;
      const nameLower = (u.name || '').toLowerCase();
      const uEmail = (u.email || '').trim().toLowerCase();
      const uCpfDigits = (u.cpf || '').replace(/\D/g, '');
      const uId = String(u.id);

      // Remove legados de mock
      if (nameLower.includes('admin geral') || nameLower.includes('vendedor 01') || nameLower.includes('vendedor 02') || uId === 'seller1' || uId === 'seller2') {
        return;
      }

      const isJoao = uId === 'joao_master_owner' || 
                     uId === 'joao_master' || 
                     uEmail === 'netocardoso06@gmail.com' || 
                     uCpfDigits === '02954901284' ||
                     (nameLower.includes('joão') && nameLower.includes('neto'));

      if (isJoao) {
        if (!seen.has('canonical_owner_joao')) {
          seen.add('canonical_owner_joao');
          list.unshift({
            ...u,
            id: 'joao_master_owner',
            name: 'João Neto',
            firstName: 'João',
            lastName: 'Neto',
            email: 'netocardoso06@gmail.com',
            cpf: '029.549.012-84',
            role: 'OWNER',
            isOwner: true,
            isActive: true
          });
        }
        return;
      }

      const key = uCpfDigits.length === 11 ? uCpfDigits : (uEmail || uId);
      if (!seen.has(key)) {
        seen.add(key);
        list.push(u);
      }
    });

    return list;
  }, [users]);

  // Troca de Senha Pessoal do Usuário Logado
  const handleSubmitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPassInput !== currentUser?.password) { 
      setStatus('ERROR'); 
      setMessage('A senha atual informada está incorreta.'); 
      return; 
    }
    if (newPass !== confirmPass) { 
      setStatus('ERROR'); 
      setMessage('A nova senha e a confirmação não coincidem.'); 
      return; 
    }
    if (newPass.length < 4) { 
      setStatus('ERROR'); 
      setMessage('A nova senha deve ter no mínimo 4 caracteres.'); 
      return; 
    }
    onPasswordChange(newPass);
    setStatus('SUCCESS'); 
    setMessage('Sua senha foi alterada com sucesso!');
    setCurrentPassInput(''); 
    setNewPass(''); 
    setConfirmPass('');
    setTimeout(() => { setStatus('IDLE'); setMessage(''); }, 3500);
  };

  // Submissão do Cadastro de Novo Membro
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    if (!addFirstName.trim() || !addLastName.trim()) {
      setAddError('Por favor, informe Nome e Sobrenome obrigatórios.');
      toast.warning("Dados Incompletos", "Por favor, informe Nome e Sobrenome obrigatórios.");
      return;
    }
    const cleanEmail = addEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setAddError('Por favor, informe um E-mail válido para o colaborador.');
      toast.error("Dados Inválidos", "Preencha o CPF e e-mail corretamente antes de salvar o usuário.");
      return;
    }
    const cleanCpfDigits = addCpf.replace(/\D/g, '');
    if (cleanCpfDigits.length !== 11) {
      setAddError('Por favor, informe um CPF completo e válido com 11 dígitos.');
      toast.error("Dados Inválidos", "Preencha o CPF e e-mail corretamente antes de salvar o usuário.");
      return;
    }

    const fullName = `${addFirstName.trim()} ${addLastName.trim()}`;
    const newUserId = `user_${Date.now()}`;

    const novoUsuario: User = { 
      id: newUserId, 
      name: fullName, 
      firstName: addFirstName.trim(),
      lastName: addLastName.trim(),
      username: cleanCpfDigits, 
      cpf: formatCPF(cleanCpfDigits),
      email: cleanEmail,
      password: addPassword.trim() || '1234', 
      role: addRole,
      isActive: true, // Ativo por padrão
      isProfileComplete: false,
      mustChangePassword: true, // Obriga a troca da senha padrão no primeiro login
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Persistência direta e imediata no Firestore
      await db.save('users', novoUsuario);

      // 2. Atualização imediata do estado local no componente pai
      if (onAddUser) {
        onAddUser(novoUsuario);
      }

      toast.success("Colaborador Cadastrado", `Colaborador(a) ${fullName} cadastrado(a) com sucesso!`);
      setResetFeedback(`Colaborador(a) ${fullName} cadastrado(a) com sucesso! Senha inicial: 1234.`);
      setTimeout(() => setResetFeedback(null), 5000);

      // Limpar formulário e fechar modal
      setIsAddUserModalOpen(false);
      setAddFirstName('');
      setAddLastName('');
      setAddEmail('');
      setAddCpf('');
      setAddRole('SELLER');
      setAddPassword('1234');
      setAddError('');
    } catch (err) {
      console.error("Erro ao salvar novo colaborador no Firestore:", err);
      setAddError('Erro ao gravar colaborador no banco de dados. Tente novamente.');
      toast.error("Erro ao Salvar", "Não foi possível cadastrar o colaborador no banco de dados.");
    }
  };

  // Confirmação de Reset de Senha do Funcionário
  const handleConfirmResetPassword = () => {
    if (!userToResetPassword) return;
    if (tempPasswordInput.length < 4) {
      toast.warning("Senha Curta", "A senha temporária deve conter no mínimo 4 caracteres.");
      return;
    }

    if (onResetUserPassword) {
      onResetUserPassword(userToResetPassword.id, tempPasswordInput);
    }
    toast.success("Senha Redefinida", `Senha de ${userToResetPassword.name} resetada com sucesso para "${tempPasswordInput}".`);
    setResetFeedback(`Senha de ${userToResetPassword.name} resetada com sucesso para "${tempPasswordInput}".`);
    setUserToResetPassword(null);
    setTimeout(() => setResetFeedback(null), 5000);
  };

  // Confirmação e Exclusão Definitiva de Colaborador (Exclusivo Dono)
  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    if (userToDelete.isOwner || userToDelete.role === 'OWNER' || userToDelete.id === 'joao_master_owner' || userToDelete.id === 'joao_master') {
      toast.error("Ação Bloqueada", "Não é permitido excluir o Proprietário da loja.");
      setUserToDelete(null);
      return;
    }

    try {
      setIsDeletingUser(true);
      await db.delete('users', userToDelete.id);
      if (onDeleteUser) {
        onDeleteUser(userToDelete.id);
      }
      toast.success("Colaborador Removido", "O acesso do colaborador foi revogado com sucesso.");
      setUserToDelete(null);
    } catch (err) {
      console.error("Erro ao remover colaborador do Firestore:", err);
      toast.error("Erro na Exclusão", "Não foi possível remover o colaborador do banco de dados.");
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Backup e Restauração
  const handleDownloadBackup = async () => {
    try {
      setBackupStatus('LOADING');
      const jsonString = await db.exportAllData();
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_paiva_moda_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setBackupStatus('SUCCESS'); 
      setMessage('Backup gerado e baixado com sucesso!');
      setTimeout(() => setBackupStatus('IDLE'), 3000);
    } catch (error) { 
      console.error(error); 
      setBackupStatus('ERROR'); 
      setMessage('Erro ao gerar backup na nuvem.'); 
    }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm("ATENÇÃO: A restauração substituirá os dados atuais no Firestore. Deseja prosseguir?")) { 
      if (fileInputRef.current) fileInputRef.current.value = ''; 
      return; 
    }
    try {
      setBackupStatus('LOADING');
      const reader = new FileReader();
      reader.onload = async (event) => {
        const jsonContent = event.target?.result as string;
        if (jsonContent && await db.importAllData(jsonContent)) {
          alert('Banco em nuvem restaurado com sucesso! Recarregando sistema...');
          window.location.reload();
        } else { 
          throw new Error("Falha na importação"); 
        }
      };
      reader.readAsText(file);
    } catch (error) { 
      setBackupStatus('ERROR'); 
      setMessage('Erro ao restaurar arquivo de backup.'); 
    }
  };

  // Zerar banco de dados para entrega limpa à loja em produção
  const handleExecuteWipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetType) return;

    const expectedText = resetType === 'A' ? 'ZERAR' : 'RESETA';
    if (confirmationText.trim().toUpperCase() !== expectedText) {
      setResetDbError(`Por favor, digite a palavra ${expectedText} para confirmar.`);
      return;
    }

    setIsWiping(true);
    setResetDbError('');

    const collectionsToClear = resetType === 'A' 
      ? ['sales', 'financials', 'movements', 'credit_bills', 'pre_sales']
      : ['sales', 'financials', 'movements', 'credit_bills', 'pre_sales', 'products', 'customers', 'promotions'];

    try {
      for (const col of collectionsToClear) {
        await clearFirestoreCollection(col);
      }

      // Se for reset total (B), let's clear local caches for those collections too
      const keysToRemove: string[] = [];
      const prefixes = resetType === 'A'
        ? ['sales', 'movements', 'financials', 'pre_sales', 'credit_bills']
        : ['sales', 'movements', 'financials', 'pre_sales', 'credit_bills', 'products', 'customers', 'promotions'];

      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && prefixes.some(pref => k.startsWith(`paiva_moda_cache_${pref}`))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      toast.success(
        "Limpeza Concluída", 
        resetType === 'A' 
          ? "Os registros de teste foram removidos do Firestore."
          : "O sistema foi restaurado para o padrão de fábrica."
      );
      
      alert('Operação de limpeza concluída! O sistema será recarregada.');
      window.location.reload();
    } catch (err: any) {
      console.error("Erro na limpeza:", err);
      setResetDbError(err.message || "Falha ao esvaziar coleções no Firestore.");
      toast.error("Erro na limpeza", err.message || "Falha ao esvaziar coleções.");
    } finally {
      setIsWiping(false);
      setIsResetDbModalOpen(false);
      setConfirmationText('');
    }
  };

  const currentDisplayName = currentUser?.firstName && currentUser?.lastName 
    ? `${currentUser.firstName} ${currentUser.lastName}` 
    : currentUser?.name || currentUser?.username;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-gray-900">
          {isStaffAdmin ? 'Configurações da Loja & Gestão de Equipe' : 'Meu Perfil & Preferências'}
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          {isStaffAdmin ? 'Gestão nominal de colaboradores, segurança operacional e dados em nuvem.' : 'Altere sua senha de acesso e ajuste as preferências visuais.'}
        </p>
      </div>

      {resetFeedback && (
        <div className="p-4 bg-purple-50 text-purple-900 border border-purple-200 rounded-2xl flex items-center justify-between text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-purple-600 shrink-0" />
            <span>{resetFeedback}</span>
          </div>
          <button onClick={() => setResetFeedback(null)} className="text-purple-400 hover:text-purple-700">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Coluna 1: Perfil do Operador e Zoom */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center">
            <div className="w-20 h-20 bg-purple-100 rounded-3xl mx-auto flex items-center justify-center text-purple-700 mb-3 shadow-inner text-2xl font-black">
              {currentUser?.firstName?.charAt(0) || currentUser?.name?.charAt(0) || 'U'}
            </div>
            <h2 className="text-lg font-black text-gray-900">{currentDisplayName}</h2>
            <p className="text-xs text-gray-500 font-mono mt-0.5">CPF: {currentUser?.cpf || 'Não informado'}</p>
            <p className="text-xs text-gray-400 font-medium">{currentUser?.email || ''}</p>
            
            <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              isOwner 
                ? 'bg-amber-50 text-amber-800 border-amber-300' 
                : isManager 
                ? 'bg-blue-50 text-blue-800 border-blue-300' 
                : 'bg-purple-50 text-purple-800 border-purple-200'
            }`}>
              <Shield size={12} /> {isOwner ? '👑 Dono / Super Admin' : isManager ? '💼 Gerente' : '🏷️ Vendedor(a) / Caixa'}
            </div>
          </div>

          {/* Ajuste de Zoom da Interface */}
          {onScaleChange && (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-center gap-2 text-gray-900 font-bold text-sm">
                <Monitor size={18} className="text-purple-600" />
                <h3>Aparência & Zoom de Tela</h3>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Ajuste a escala visual dos botões e textos para telas touch de celulares ou monitores de balcão.
              </p>
              <div className="flex items-center justify-between text-xs text-gray-600 font-bold">
                <span>Escala Visual</span>
                <span className="font-mono bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md">{Math.round(currentScale * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0.8" 
                max="1.25" 
                step="0.05" 
                value={currentScale} 
                onChange={(e) => onScaleChange(parseFloat(e.target.value))} 
                className="w-full accent-purple-600" 
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Compacto (80%)</span>
                <span>Padrão (100%)</span>
                <span>Grande (125%)</span>
              </div>
            </div>
          )}
        </div>

        {/* Coluna 2 e 3: Gestão de Equipe (Admin) ou Troca de Senha */}
        <div className="md:col-span-2 space-y-6">
          {/* Gestão Nominal da Equipe (Exclusivo Dono / Gerente) */}
          {isStaffAdmin && (
            <div className="bg-white p-6 lg:p-7 rounded-3xl shadow-sm border border-gray-100 space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                    <Users size={20} className="text-purple-600" />
                    Gestão Nominal da Equipe (RBAC)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Controle de colaboradores, permissões de acesso e segurança de senhas.
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setAddError('');
                    setIsAddUserModalOpen(true);
                  }}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-900/20 transition"
                >
                  <Plus size={16} /> Cadastrar Membro
                </button>
              </div>

              {/* Tabela Nominal da Equipe */}
              <div className="divide-y divide-gray-100">
                {realUsers.length > 0 ? (
                  realUsers.map((u) => {
                    // Proteção de Segurança: Dono / Master / João não pode ser alterado por terceiros
                    const isMasterOwner = u.isOwner === true || u.role === 'OWNER';
                    const isUserActive = u.isActive !== false;
                    const canResetThisUser = isOwner || (isManager && u.role === 'SELLER');

                    return (
                      <div key={u.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* Identificação Nominal */}
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${
                            isMasterOwner 
                              ? 'bg-amber-100 text-amber-800' 
                              : u.role === 'MANAGER'
                              ? 'bg-blue-100 text-blue-800'
                              : isUserActive 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-gray-100 text-gray-400'
                          }`}>
                            {u.firstName?.charAt(0) || u.name?.charAt(0) || u.username?.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`text-sm font-bold ${isUserActive ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                                {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.name}
                              </p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isMasterOwner 
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                  : u.role === 'MANAGER'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : 'bg-purple-100 text-purple-800 border border-purple-200'
                              }`}>
                                {isMasterOwner ? '👑 Dono / Super Admin' : u.role === 'MANAGER' ? '💼 Gerente' : '🏷️ Vendedor(a) / Caixa'}
                              </span>
                              {/* Status Badge */}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                isUserActive 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isUserActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                                {isUserActive ? 'Ativo' : 'Inativo (Bloqueado)'}
                              </span>
                            </div>

                            <p className="text-xs text-gray-400 font-mono mt-0.5">
                              CPF: <strong>{u.cpf || 'Não cadastrado'}</strong> • E-mail: <span>{u.email || 'Não cadastrado'}</span>
                            </p>
                          </div>
                        </div>

                        {/* Ações de Controle */}
                        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                          {isMasterOwner || u.id === currentUser?.id || (currentUser?.email && u.email && u.email.toLowerCase() === currentUser.email.toLowerCase()) ? (
                            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl flex items-center gap-1">
                              <Crown size={14} /> Sua Conta Principal
                            </span>
                          ) : (
                            <>
                              {/* Botão Resetar Senha com Modal Explicativo */}
                              {onResetUserPassword && canResetThisUser && (
                                <button 
                                  type="button"
                                  onClick={() => {
                                    setUserToResetPassword(u);
                                    setTempPasswordInput('1234');
                                  }}
                                  className="px-3 py-1.5 border border-purple-200 text-purple-700 hover:bg-purple-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                                  title="Resetar senha deste membro da equipe para 1234"
                                >
                                  <Lock size={13} className="text-purple-600" /> Resetar Senha
                                </button>
                              )}

                              {/* Chave Seletora (Switch / Toggle) de Ativo / Inativo (Soft Delete) */}
                              {onToggleUserStatus && isOwner && !isMasterOwner && (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => onToggleUserStatus(u.id, !isUserActive)}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      isUserActive ? 'bg-purple-600' : 'bg-gray-300'
                                    }`}
                                    title={isUserActive ? 'Clique para desativar acesso deste colaborador' : 'Clique para reativar acesso'}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                        isUserActive ? 'translate-x-5' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                  <span className="text-[11px] font-bold text-gray-500 w-16">
                                    {isUserActive ? 'Desativar' : 'Ativar'}
                                  </span>
                                </div>
                              )}

                              {/* Botão de Excluir Colaborador (Exclusivo Dono) */}
                              {isOwner && (
                                <button
                                  type="button"
                                  onClick={() => setUserToDelete(u)}
                                  className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                                  title={`Remover colaborador ${u.name || u.firstName}`}
                                >
                                  <Trash2 size={15} />
                                  <span className="hidden sm:inline">Excluir</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    Nenhum colaborador adicional cadastrado ainda.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Configuração dos Dados da Loja no Cupom Térmico (Exclusivo Dono / Administrador) */}
          {isStaffAdmin && (
            <div className="bg-white p-6 lg:p-7 rounded-3xl shadow-sm border border-gray-100 space-y-5">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <Printer size={20} className="text-purple-600" />
                  Dados da Loja no Cupom Térmico
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Personalize os dados impressos no cabeçalho e rodapé dos cupons não fiscais de atendimento.
                </p>
              </div>

              <form onSubmit={handleSaveStoreProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Nome Fantasia */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Nome Fantasia da Loja <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Ex: PAIVA MODA" 
                      value={storeNameInput} 
                      onChange={e => setStoreNameInput(e.target.value)} 
                      className="w-full px-3.5 py-2.5 border rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none font-medium" 
                    />
                  </div>

                  {/* Telefone / WhatsApp */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Telefone / WhatsApp da Loja
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: (92) 99999-9999" 
                      value={storePhoneInput} 
                      onChange={e => setStorePhoneInput(e.target.value)} 
                      className="w-full px-3.5 py-2.5 border rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none font-medium" 
                    />
                  </div>

                  {/* Instagram / Rede Social */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Instagram / Rede Social (Opcional)
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: @paivamoda" 
                      value={storeInstagramInput} 
                      onChange={e => setStoreInstagramInput(e.target.value)} 
                      className="w-full px-3.5 py-2.5 border rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none font-medium" 
                    />
                  </div>

                  {/* CNPJ ou CPF da Empresa */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      CNPJ ou CPF da Empresa (Opcional)
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: 00.000.000/0001-00" 
                      value={storeCnpjInput} 
                      onChange={e => setStoreCnpjInput(e.target.value)} 
                      className="w-full px-3.5 py-2.5 border rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none font-medium" 
                    />
                  </div>
                </div>

                {/* Endereço Completo */}
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Endereço / Cidade (Opcional)
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ex: Av. Principal, 123 - Centro, Manaus - AM" 
                    value={storeAddressInput} 
                    onChange={e => setStoreAddressInput(e.target.value)} 
                    className="w-full px-3.5 py-2.5 border rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none font-medium" 
                  />
                </div>

                {/* Mensagem de Rodapé */}
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Mensagem de Rodapé do Cupom
                  </label>
                  <textarea 
                    rows={2} 
                    placeholder="Ex: *** NÃO É DOCUMENTO FISCAL *** &#10;Obrigado pela preferência! Volte sempre." 
                    value={storeReceiptMessageInput} 
                    onChange={e => setStoreReceiptMessageInput(e.target.value)} 
                    className="w-full px-3.5 py-2.5 border rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none font-medium" 
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button 
                    type="submit" 
                    disabled={isSavingStoreProfile}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-900/20 transition cursor-pointer"
                  >
                    <Save size={16} /> Salvar Configurações do Cupom
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Zona de Perigo (Exclusivo Dono / Proprietário) */}
          {isOwner && (
            <div className="bg-red-50/60 p-6 lg:p-7 rounded-3xl border border-red-200 space-y-6">
              <div className="flex items-center gap-3 border-b border-red-200/80 pb-4">
                <div className="w-10 h-10 bg-red-100 text-red-700 rounded-2xl flex items-center justify-center shrink-0">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-red-950">Zona de Perigo & Inicialização</h3>
                  <p className="text-xs text-red-800">
                    Ações de administração de banco de dados e controle de histórico da loja.
                  </p>
                </div>
              </div>

              {/* OPÇÃO A: ZERAR VENDAS */}
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 p-4 bg-orange-50/60 rounded-2xl border border-orange-200">
                <div className="text-xs text-orange-950 space-y-1 text-left">
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-800 font-bold rounded text-[9px] uppercase tracking-wider">Ação A</span>
                  <h4 className="font-bold text-sm text-orange-900 mt-1">Zerar Vendas e Reiniciar Operação</h4>
                  <p className="text-[11px] text-orange-800 leading-relaxed">
                    Limpa apenas dados transacionais de teste para iniciar o caixa do zero. 
                    Apaga cupons (`sales`), financeiro (`financials`), movimentações (`movements`), parcelas (`credit_bills`) e pré-vendas (`pre_sales`).
                  </p>
                  <p className="text-[11px] text-emerald-800 font-bold">
                    ✓ PRESERVA: Produtos, Clientes, Campanhas de Promoção e Usuários intactos. Garante Cupom Nº 000001.
                  </p>
                </div>

                <button 
                  type="button"
                  onClick={() => {
                    setResetType('A');
                    setConfirmationText('');
                    setResetDbError('');
                    setIsResetDbModalOpen(true);
                  }}
                  className="px-4.5 py-2.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  <RefreshCw size={14} />
                  <span>Zerar Operação</span>
                </button>
              </div>

              {/* OPÇÃO B: RESET TOTAL */}
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 p-4 bg-red-100/50 rounded-2xl border border-red-200">
                <div className="text-xs text-red-950 space-y-1 text-left">
                  <span className="px-2 py-0.5 bg-red-200 text-red-800 font-bold rounded text-[9px] uppercase tracking-wider">Ação B</span>
                  <h4 className="font-bold text-sm text-red-900 mt-1">Reset Total de Fábrica</h4>
                  <p className="text-[11px] text-red-800 leading-relaxed">
                    Limpeza total bruta de todas as tabelas. Apaga produtos, clientes, vendas, movimentações, despesas, parcelas de crediários e promoções.
                  </p>
                  <p className="text-[11px] text-red-950 font-bold">
                    ⚠️ Preserva EXCLUSIVAMENTE a conta principal do Dono (João Neto).
                  </p>
                </div>

                <button 
                  type="button"
                  onClick={() => {
                    setResetType('B');
                    setConfirmationText('');
                    setResetDbError('');
                    setIsResetDbModalOpen(true);
                  }}
                  className="px-4.5 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  <Trash2 size={14} />
                  <span>Reset Total de Fábrica</span>
                </button>
              </div>
            </div>
          )}

          {/* Troca de Senha Pessoal */}
          <div className="bg-white p-6 lg:p-7 rounded-3xl shadow-sm border border-gray-100 space-y-4">
            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
              <Lock size={18} className="text-purple-600" /> Alterar Minha Senha Pessoal
            </h3>

            {status === 'SUCCESS' && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl font-semibold border border-emerald-200 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" /> {message}
              </div>
            )}
            {status === 'ERROR' && (
              <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl font-semibold border border-red-200 flex items-center gap-2">
                <AlertCircle size={16} className="text-red-600" /> {message}
              </div>
            )}

            <form onSubmit={handleSubmitPassword} className="space-y-3 max-w-md">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Senha Atual</label>
                <input 
                  type="password" 
                  value={currentPassInput} 
                  onChange={e => setCurrentPassInput(e.target.value)} 
                  required 
                  placeholder="Sua senha atual"
                  className="w-full p-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500" 
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Nova Senha</label>
                  <input 
                    type="password" 
                    value={newPass} 
                    onChange={e => setNewPass(e.target.value)} 
                    required 
                    placeholder="Mínimo 4 caracteres"
                    className="w-full p-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Confirmar Senha</label>
                  <input 
                    type="password" 
                    value={confirmPass} 
                    onChange={e => setConfirmPass(e.target.value)} 
                    required 
                    placeholder="Repita a nova senha"
                    className="w-full p-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
              </div>
              <button 
                type="submit" 
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow-md transition"
              >
                Salvar Nova Senha
              </button>
            </form>
          </div>

          {/* Backup e Exportação Nuvem (Exclusivo Dono / Super Administrador) */}
          {isOwner && (
            <div className="bg-white p-6 lg:p-7 rounded-3xl shadow-sm border border-gray-100 space-y-4">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Database size={18} className="text-purple-600" /> Backup e Restauração em Nuvem (Dono)
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Exporte todo o banco de dados em formato JSON criptografado para contingência local ou restaure cópias de segurança.
              </p>

              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={handleDownloadBackup} 
                  disabled={backupStatus === 'LOADING'}
                  className="px-4 py-2.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl text-xs flex items-center gap-2 transition cursor-pointer"
                >
                  <Download size={16} /> Baixar Backup Completo (.JSON)
                </button>

                <label className="px-4 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer transition">
                  <Upload size={16} />
                  <span>Restaurar Backup</span>
                  <input ref={fileInputRef} type="file" accept=".json" onChange={handleRestoreBackup} className="hidden" />
                </label>
              </div>
            </div>
          )}


        </div>
      </div>

      {/* ================================================================= */}
      {/* MODAL 1: CADASTRAR MEMBRO DA EQUIPE (Estrutura Completa de Cadastro) */}
      {/* Exigindo: Nome, Sobrenome, E-mail, CPF, Cargo e Senha Inicial     */}
      {/* ================================================================= */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 lg:p-7 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                  <Users size={18} className="text-purple-600" /> Cadastrar Membro da Equipe
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">Preencha todos os campos obrigatórios do novo colaborador</p>
              </div>
              <button onClick={() => setIsAddUserModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {addError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl font-semibold border border-red-200 flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-red-500" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUserSubmit} className="space-y-3.5">
              {/* Nome e Sobrenome */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: Amanda" 
                    value={addFirstName} 
                    onChange={e => setAddFirstName(e.target.value)} 
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500" 
                    autoFocus 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Sobrenome <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: Nunes" 
                    value={addLastName} 
                    onChange={e => setAddLastName(e.target.value)} 
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
              </div>

              {/* E-mail e CPF */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    E-mail <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="email" 
                    required
                    placeholder="amanda@loja.com" 
                    value={addEmail} 
                    onChange={e => setAddEmail(e.target.value)} 
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    CPF <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="000.000.000-00" 
                    value={addCpf} 
                    onChange={e => setAddCpf(formatCPF(e.target.value))} 
                    className="w-full px-3 py-2 border rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                </div>
              </div>

              {/* Cargo / Nível de Acesso */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Cargo (Nível de Acesso) <span className="text-red-500">*</span>
                </label>
                <select 
                  value={addRole} 
                  onChange={e => setAddRole(e.target.value as UserRole)} 
                  className="w-full px-3 py-2.5 border rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                >
                  <option value="SELLER">Vendedor(a) / Caixa — Frente de caixa, PDV, pré-vendas e consulta de catálogo</option>
                  <option value="MANAGER">Gerente — Operação total, catálogo, relatórios, financeiro e descontos</option>
                  {isOwner && (
                    <option value="OWNER">Dono / Super Admin — Acesso irrestrito a 100% das funções e backups</option>
                  )}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  O vendedor opera o PDV em modo leitura no catálogo e estoque.
                </p>
              </div>

              {/* Senha Inicial */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Senha Inicial Provisória <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ex: 1234" 
                  value={addPassword} 
                  onChange={e => setAddPassword(e.target.value)} 
                  className="w-full px-3 py-2 border rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-purple-500" 
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">
                  O colaborador usará esta senha no primeiro login e poderá redefini-la se desejar.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button 
                  type="button" 
                  onClick={() => setIsAddUserModalOpen(false)} 
                  className="px-4 py-2.5 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
                >
                  <CheckCircle2 size={16} /> Confirmar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 2: CONFIRMAÇÃO DE RESET DE SENHA (Com Ícone de Cadeado)    */}
      {/* Explica a ação com clareza antes de redefinir a credencial        */}
      {/* ================================================================= */}
      {userToResetPassword && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 lg:p-7 space-y-4 shadow-2xl animate-in zoom-in-95 border border-purple-100">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <Lock size={24} />
            </div>

            <div className="text-center">
              <h3 className="font-black text-gray-900 text-base">Redefinir Senha de Acesso</h3>
              <p className="text-xs text-gray-500 mt-1">
                Colaborador: <strong>{userToResetPassword.name}</strong> ({userToResetPassword.cpf || userToResetPassword.username})
              </p>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 leading-relaxed">
              ⚠️ <strong>Atenção:</strong> Isso gerará uma nova senha temporária para o colaborador. A senha anterior deixará de funcionar imediatamente em todos os dispositivos.
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Nova Senha Provisória</label>
              <input 
                type="text" 
                value={tempPasswordInput} 
                onChange={e => setTempPasswordInput(e.target.value)} 
                className="w-full px-3.5 py-2.5 border rounded-xl text-sm font-mono font-bold text-purple-700 outline-none focus:ring-2 focus:ring-purple-500" 
                placeholder="Ex: 1234"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                type="button" 
                onClick={() => setUserToResetPassword(null)} 
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleConfirmResetPassword} 
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={16} /> Confirmar Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 3: CONFIRMAÇÃO DE RESET DO BANCO                            */}
      {/* Exige a digitação estrita da palavra 'ZERAR' ou 'RESETA' pelo Dono */}
      {/* ================================================================= */}
      {isResetDbModalOpen && resetType && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 lg:p-7 space-y-4 shadow-2xl animate-in zoom-in-95 border-2 border-red-200">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
              <div className="w-12 h-12 bg-red-100 text-red-700 rounded-2xl flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-black text-gray-900 text-base">
                  {resetType === 'A' ? 'Confirmar Zerar Operação' : 'Confirmar Reset de Fábrica'}
                </h3>
                <p className="text-xs text-red-600 font-semibold text-left">Esta ação NÃO poderá ser desfeita!</p>
              </div>
              <button 
                onClick={() => setIsResetDbModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 ml-auto cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-2 text-xs text-red-900 text-left">
              <p className="font-bold">⚠️ Coleções que serão esvaziadas no Firestore:</p>
              {resetType === 'A' ? (
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-red-800 font-medium">
                  <li>Histórico de Vendas & Cupons (sales)</li>
                  <li>Lançamentos Financeiros & Fluxo de Caixa (financials)</li>
                  <li>Movimentações de Estoque (movements)</li>
                  <li>Fila de Pré-Vendas / Comandas (pre_sales)</li>
                  <li>Carnês & Contas de Crediários (credit_bills)</li>
                </ul>
              ) : (
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-red-800 font-medium">
                  <li>Catálogo de Produtos & Variações (products)</li>
                  <li>Base de Clientes & Limites (customers)</li>
                  <li>Histórico de Vendas & Cupons (sales)</li>
                  <li>Lançamentos Financeiros & Fluxo de Caixa (financials)</li>
                  <li>Movimentações de Estoque (movements)</li>
                  <li>Fila de Pré-Vendas / Comandas (pre_sales)</li>
                  <li>Carnês & Contas de Crediários (credit_bills)</li>
                  <li>Campanhas & Promoções (promotions)</li>
                </ul>
              )}
              <p className="text-[11px] text-emerald-800 font-bold pt-1 border-t border-red-200">
                {resetType === 'A' 
                  ? '✓ Catálogo de produtos, base de clientes, campanhas de promoção e equipe permanecem intactos.'
                  : '✓ Exclusivo: O perfil do proprietário (João Neto) e equipe permanecem ativos.'}
              </p>
            </div>

            <form onSubmit={handleExecuteWipe} className="space-y-4">
              <div className="text-left">
                <label className="text-xs font-bold text-gray-800 block mb-1">
                  Para confirmar a exclusão, digite <span className="font-mono text-red-600 font-black">{resetType === 'A' ? 'ZERAR' : 'RESETA'}</span> abaixo:
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder={`Digite ${resetType === 'A' ? 'ZERAR' : 'RESETA'}`}
                  value={confirmationText}
                  onChange={e => setConfirmationText(e.target.value)}
                  className="w-full px-3.5 py-2.5 border-2 border-red-300 rounded-xl text-sm font-black font-mono tracking-widest uppercase outline-none focus:ring-2 focus:ring-red-500 text-center"
                />
              </div>

              {resetDbError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-red-500" />
                  <span>{resetDbError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsResetDbModalOpen(false)}
                  className="flex-1 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={confirmationText.trim().toUpperCase() !== (resetType === 'A' ? 'ZERAR' : 'RESETA') || isWiping}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl text-xs shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  {isWiping ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  <span>{isWiping ? 'Limpando...' : 'Confirmar Limpeza'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ================================================================= */}
      {/* MODAL 4: CONFIRMAÇÃO DE EXCLUSÃO DE COLABORADOR                    */}
      {/* ================================================================= */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 lg:p-7 space-y-4 shadow-2xl animate-in zoom-in-95 border border-rose-100">
            <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <Trash2 size={24} />
            </div>

            <div className="text-center">
              <h3 className="font-black text-gray-900 text-base">Remover Colaborador</h3>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                Deseja realmente remover o colaborador <strong>{userToDelete.name || `${userToDelete.firstName} ${userToDelete.lastName}`}</strong>? Ele perderá o acesso ao sistema.
              </p>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 leading-relaxed font-medium">
              ℹ️ O histórico de vendas já realizadas por este colaborador no PDV continuará preservado nos relatórios da loja.
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                type="button" 
                disabled={isDeletingUser}
                onClick={() => setUserToDelete(null)} 
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                disabled={isDeletingUser}
                onClick={handleConfirmDeleteUser} 
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-900/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isDeletingUser ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}
                <span>{isDeletingUser ? 'Removendo...' : 'Sim, Remover'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
