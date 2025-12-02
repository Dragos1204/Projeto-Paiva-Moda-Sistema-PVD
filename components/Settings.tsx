
import React, { useState, useRef } from 'react';
import { Lock, Save, AlertCircle, CheckCircle2, User as UserIcon, Shield, Printer, Database, Download, Upload, AlertTriangle, Monitor, Users, Trash2, Plus, RefreshCw, Code2 } from 'lucide-react';
import { printer } from '../printer';
import { db } from '../database';
import { User } from '../types';

interface SettingsProps {
  currentUser: User | null;
  users: User[];
  onPasswordChange: (newPass: string) => void;
  currentScale?: number;
  onScaleChange?: (scale: number) => void;
  // User Management
  onAddUser?: (user: User) => void;
  onDeleteUser?: (id: string) => void;
  onResetUserPassword?: (id: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  currentUser, 
  users, 
  onPasswordChange, 
  currentScale = 1, 
  onScaleChange,
  onAddUser,
  onDeleteUser,
  onResetUserPassword
}) => {
  const isAdmin = currentUser?.role === 'ADMIN';

  // States
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  
  const [status, setStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [message, setMessage] = useState('');

  // Backup States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backupStatus, setBackupStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');

  // Add User State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', username: '', role: 'EMPLOYEE' as const, password: '1234' });

  const handleSubmitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('IDLE');

    if (currentPassInput !== currentUser?.password) {
      setStatus('ERROR');
      setMessage('A senha atual está incorreta.');
      return;
    }

    if (newPass !== confirmPass) {
      setStatus('ERROR');
      setMessage('As novas senhas não coincidem.');
      return;
    }

    if (newPass.length < 4) {
      setStatus('ERROR');
      setMessage('A nova senha deve ter pelo menos 4 caracteres.');
      return;
    }

    onPasswordChange(newPass);
    setStatus('SUCCESS');
    setMessage('Senha alterada com sucesso!');
    
    setCurrentPassInput('');
    setNewPass('');
    setConfirmPass('');
    
    setTimeout(() => {
        setStatus('IDLE');
        setMessage('');
    }, 3000);
  };

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
      URL.revokeObjectURL(url);
      
      setBackupStatus('SUCCESS');
      setMessage('Backup salvo com sucesso!');
      setTimeout(() => setBackupStatus('IDLE'), 3000);
    } catch (error) {
      console.error(error);
      setBackupStatus('ERROR');
      setMessage('Erro ao gerar backup.');
    }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("ATENÇÃO: Restaurar um backup irá APAGAR todos os dados atuais e substituí-los pelos dados do arquivo. Deseja continuar?")) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setBackupStatus('LOADING');
      const reader = new FileReader();
      reader.onload = async (event) => {
        const jsonContent = event.target?.result as string;
        if (jsonContent) {
          const success = await db.importAllData(jsonContent);
          if (success) {
            alert('Sistema restaurado com sucesso! A página será recarregada.');
            window.location.reload();
          } else {
            throw new Error("Falha na importação");
          }
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error(error);
      setBackupStatus('ERROR');
      setMessage('Erro ao restaurar arquivo. Verifique se é um backup válido.');
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (onAddUser) {
        onAddUser({
            id: newUser.username.toLowerCase().replace(/\s/g, ''),
            name: newUser.name,
            username: newUser.username,
            password: newUser.password,
            role: newUser.role
        });
        setIsAddUserModalOpen(false);
        setNewUser({ name: '', username: '', role: 'EMPLOYEE', password: '1234' });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Configurações</h1>
        <p className="text-gray-500">Gerencie seu perfil, segurança e dados.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Profile & Scale Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center">
             <div className="w-24 h-24 bg-purple-100 rounded-full mx-auto flex items-center justify-center text-purple-600 mb-4">
               <UserIcon size={48} />
             </div>
             <h2 className="text-xl font-bold text-gray-800">{currentUser?.name}</h2>
             <p className="text-sm text-gray-500">@{currentUser?.username}</p>
             <div className={`mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${isAdmin ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                <Shield size={12} /> {isAdmin ? 'Acesso Total' : 'Acesso Restrito'}
             </div>
          </div>

          {/* ZOOM / SCALE CONTROL */}
          {onScaleChange && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 mb-4 text-gray-800 font-bold">
                    <Monitor size={20} className="text-blue-600" />
                    <h3>Aparência / Zoom</h3>
                </div>
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>Tamanho da Tela</span>
                        <span className="font-bold">{(currentScale * 100).toFixed(0)}%</span>
                    </div>
                    <input 
                        type="range" 
                        min="0.7" 
                        max="1.3" 
                        step="0.05"
                        value={currentScale}
                        onChange={(e) => onScaleChange(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between gap-2">
                        <button onClick={() => onScaleChange(0.8)} className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">Pequeno</button>
                        <button onClick={() => onScaleChange(1)} className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">Normal</button>
                        <button onClick={() => onScaleChange(1.1)} className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">Grande</button>
                    </div>
                </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
             <div className="flex items-center gap-2 mb-4 text-gray-800 font-bold">
               <Printer size={20} className="text-purple-600" />
               <h3>Impressora</h3>
             </div>
             <button 
               onClick={printer.printTest}
               className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors border border-gray-200"
             >
               Imprimir Teste
             </button>
          </div>

          {/* DEVELOPER CARD */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 rounded-2xl shadow-lg text-white">
             <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/10 rounded-lg">
                   <Code2 size={20} className="text-purple-300" />
                </div>
                <h3 className="font-bold text-lg">Sobre o Sistema</h3>
             </div>
             <p className="text-sm text-slate-300 mb-4 leading-relaxed">
                Este sistema foi desenvolvido e configurado para gestão exclusiva da Paiva Moda.
             </p>
             <div className="pt-4 border-t border-white/10">
                <p className="text-xs text-slate-400 uppercase font-bold mb-1">Desenvolvedor</p>
                <p className="text-lg font-bold text-white">Ericles Silva</p>
                <p className="text-xs text-slate-400 mt-1">Versão 2.0.0 (Híbrida)</p>
             </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="md:col-span-2 space-y-6">
           
           {/* USER MANAGEMENT (ADMIN ONLY) */}
           {isAdmin && (
             <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-200 text-gray-700 rounded-lg">
                          <Users size={20} />
                      </div>
                      <div>
                          <h3 className="font-bold text-gray-800">Gestão de Usuários</h3>
                          <p className="text-sm text-gray-500">Adicione ou remova acesso ao sistema.</p>
                      </div>
                   </div>
                   <button 
                      onClick={() => setIsAddUserModalOpen(true)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 flex items-center gap-2"
                   >
                      <Plus size={16} /> Novo Usuário
                   </button>
                </div>
                
                <div className="p-0">
                   <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-gray-500 uppercase font-semibold">
                         <tr>
                            <th className="px-6 py-3">Nome</th>
                            <th className="px-6 py-3">Usuário</th>
                            <th className="px-6 py-3">Cargo</th>
                            <th className="px-6 py-3 text-right">Ações</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                         {users.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50">
                               <td className="px-6 py-3 font-medium text-gray-800">{u.name}</td>
                               <td className="px-6 py-3 text-gray-600">{u.username}</td>
                               <td className="px-6 py-3">
                                  <span className={`px-2 py-1 rounded text-xs font-bold ${u.role === 'ADMIN' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                     {u.role === 'ADMIN' ? 'Admin' : 'Funcionário'}
                                  </span>
                               </td>
                               <td className="px-6 py-3 text-right flex justify-end gap-2">
                                  {u.id !== 'admin' && (
                                     <>
                                        <button 
                                          onClick={() => onResetUserPassword && onResetUserPassword(u.id)}
                                          className="p-2 text-orange-600 hover:bg-orange-50 rounded" title="Resetar Senha para 1234"
                                        >
                                           <RefreshCw size={16} />
                                        </button>
                                        <button 
                                          onClick={() => onDeleteUser && onDeleteUser(u.id)}
                                          className="p-2 text-red-600 hover:bg-red-50 rounded" title="Excluir"
                                        >
                                           <Trash2 size={16} />
                                        </button>
                                     </>
                                  )}
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
           )}

           {/* Backup & Data Section (ADMIN ONLY) */}
           {isAdmin && (
             <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center gap-3 bg-blue-50">
                   <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                      <Database size={20} />
                   </div>
                   <div>
                      <h3 className="font-bold text-gray-800">Backup e Dados</h3>
                      <p className="text-sm text-gray-500">Salve uma cópia de segurança ou restaure seus dados.</p>
                   </div>
                </div>
                
                <div className="p-6 space-y-4">
                   {backupStatus === 'SUCCESS' && (
                      <div className="p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2 text-sm border border-green-200">
                         <CheckCircle2 size={16} /> {message}
                      </div>
                   )}
                   {backupStatus === 'ERROR' && (
                      <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 text-sm border border-red-200">
                         <AlertTriangle size={16} /> {message}
                      </div>
                   )}

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button 
                        onClick={handleDownloadBackup}
                        disabled={backupStatus === 'LOADING'}
                        className="flex items-center justify-center gap-2 p-4 border-2 border-blue-100 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all text-blue-700 font-bold"
                      >
                         <Download size={20} />
                         {backupStatus === 'LOADING' ? 'Gerando...' : 'Fazer Backup (Salvar)'}
                      </button>

                      <div className="relative">
                         <input 
                           type="file" 
                           accept=".json"
                           ref={fileInputRef}
                           onChange={handleRestoreBackup}
                           className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                         />
                         <button className="w-full h-full flex items-center justify-center gap-2 p-4 border-2 border-orange-100 rounded-xl hover:bg-orange-50 hover:border-orange-300 transition-all text-orange-700 font-bold">
                            <Upload size={20} />
                            Restaurar Backup
                         </button>
                      </div>
                   </div>
                </div>
             </div>
           )}

           {/* Password Change Form */}
           <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                 <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                    <Lock size={20} />
                 </div>
                 <div>
                    <h3 className="font-bold text-gray-800">Alterar Minha Senha</h3>
                    <p className="text-sm text-gray-500">Atualize sua senha de acesso.</p>
                 </div>
              </div>
              
              <div className="p-6">
                 {status !== 'IDLE' && backupStatus === 'IDLE' && (
                   <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 border ${
                     status === 'SUCCESS' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                   }`}>
                      {status === 'SUCCESS' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                      <span className="font-medium text-sm">{message}</span>
                   </div>
                 )}

                 <form onSubmit={handleSubmitPassword} className="space-y-4 max-w-md">
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Senha Atual</label>
                       <input 
                         type="password"
                         required
                         value={currentPassInput}
                         onChange={e => setCurrentPassInput(e.target.value)}
                         className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                       />
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
                       <input 
                         type="password"
                         required
                         value={newPass}
                         onChange={e => setNewPass(e.target.value)}
                         className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all"
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
                       />
                    </div>
                    <div className="pt-2">
                       <button type="submit" className="flex items-center gap-2 bg-purple-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-purple-700 transition-all shadow-lg active:scale-95">
                         <Save size={20} /> Salvar Nova Senha
                       </button>
                    </div>
                 </form>
              </div>
           </div>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddUserModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in">
                  <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                      <h3 className="font-bold text-gray-800">Novo Usuário</h3>
                      <button onClick={() => setIsAddUserModalOpen(false)}><Trash2 size={24} className="text-gray-400 rotate-45" /></button>
                  </div>
                  <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
                          <input required type="text" className="w-full p-2 border rounded" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700">Nome de Usuário (Login)</label>
                          <input required type="text" className="w-full p-2 border rounded" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700">Cargo</label>
                          <select className="w-full p-2 border rounded" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})}>
                              <option value="EMPLOYEE">Funcionário</option>
                              <option value="ADMIN">Administrador</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700">Senha Inicial</label>
                          <input type="text" readOnly value="1234" className="w-full p-2 border rounded bg-gray-100 text-gray-500" />
                          <p className="text-xs text-gray-400 mt-1">A senha padrão é 1234. O usuário poderá alterar depois.</p>
                      </div>
                      <button type="submit" className="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700">Criar Usuário</button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
