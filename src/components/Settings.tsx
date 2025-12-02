
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
  onAddUser?: (user: User) => void;
  onDeleteUser?: (id: string) => void;
  onResetUserPassword?: (id: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ currentUser, users, onPasswordChange, currentScale = 1, onScaleChange, onAddUser, onDeleteUser, onResetUserPassword }) => {
  const isAdmin = currentUser?.role === 'ADMIN';
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backupStatus, setBackupStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', username: '', role: 'EMPLOYEE' as const, password: '1234' });

  const handleSubmitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPassInput !== currentUser?.password) { setStatus('ERROR'); setMessage('A senha atual está incorreta.'); return; }
    if (newPass !== confirmPass) { setStatus('ERROR'); setMessage('As novas senhas não coincidem.'); return; }
    if (newPass.length < 4) { setStatus('ERROR'); setMessage('Mínimo 4 caracteres.'); return; }
    onPasswordChange(newPass);
    setStatus('SUCCESS'); setMessage('Senha alterada!');
    setCurrentPassInput(''); setNewPass(''); setConfirmPass('');
    setTimeout(() => { setStatus('IDLE'); setMessage(''); }, 3000);
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
      setBackupStatus('SUCCESS'); setMessage('Backup salvo!');
      setTimeout(() => setBackupStatus('IDLE'), 3000);
    } catch (error) { console.error(error); setBackupStatus('ERROR'); setMessage('Erro ao gerar backup.'); }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm("ATENÇÃO: Isso APAGARÁ todos os dados atuais. Continuar?")) { if (fileInputRef.current) fileInputRef.current.value = ''; return; }
    try {
      setBackupStatus('LOADING');
      const reader = new FileReader();
      reader.onload = async (event) => {
        const jsonContent = event.target?.result as string;
        if (jsonContent && await db.importAllData(jsonContent)) {
            alert('Sistema restaurado! A página será recarregada.');
            window.location.reload();
        } else { throw new Error("Falha na importação"); }
      };
      reader.readAsText(file);
    } catch (error) { setBackupStatus('ERROR'); setMessage('Erro ao restaurar.'); }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (onAddUser) {
        onAddUser({ id: newUser.username.toLowerCase().replace(/\s/g, ''), name: newUser.name, username: newUser.username, password: newUser.password, role: newUser.role });
        setIsAddUserModalOpen(false);
        setNewUser({ name: '', username: '', role: 'EMPLOYEE', password: '1234' });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div><h1 className="text-2xl font-bold text-gray-800">Configurações</h1><p className="text-gray-500">Perfil, segurança e dados.</p></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center">
             <div className="w-24 h-24 bg-purple-100 rounded-full mx-auto flex items-center justify-center text-purple-600 mb-4"><UserIcon size={48} /></div>
             <h2 className="text-xl font-bold text-gray-800">{currentUser?.name}</h2>
             <p className="text-sm text-gray-500">@{currentUser?.username}</p>
             <div className={`mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${isAdmin ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}><Shield size={12} /> {isAdmin ? 'Acesso Total' : 'Acesso Restrito'}</div>
          </div>
          {onScaleChange && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 mb-4 text-gray-800 font-bold"><Monitor size={20} className="text-blue-600" /><h3>Aparência / Zoom</h3></div>
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-gray-600"><span>Escala</span><span className="font-bold">{(currentScale * 100).toFixed(0)}%</span></div>
                    <input type="range" min="0.7" max="1.3" step="0.05" value={currentScale} onChange={(e) => onScaleChange(parseFloat(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer" />
                </div>
            </div>
          )}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
             <div className="flex items-center gap-2 mb-4 text-gray-800 font-bold"><Printer size={20} className="text-purple-600" /><h3>Impressora</h3></div>
             <button onClick={printer.printTest} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg">Imprimir Teste</button>
          </div>
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 rounded-2xl shadow-lg text-white">
             <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-white/10 rounded-lg"><Code2 size={20} className="text-purple-300" /></div><h3 className="font-bold text-lg">Sobre</h3></div>
             <p className="text-sm text-slate-300 mb-4">Sistema de Gestão Paiva Moda</p>
             <div className="pt-4 border-t border-white/10"><p className="text-xs text-slate-400 uppercase font-bold mb-1">Desenvolvedor</p><p className="text-lg font-bold text-white">Ericles Silva</p><p className="text-xs text-slate-400 mt-1">Versão 2.0.0</p></div>
          </div>
        </div>
        <div className="md:col-span-2 space-y-6">
           {isAdmin && (
             <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                   <div className="flex items-center gap-3"><div className="p-2 bg-gray-200 text-gray-700 rounded-lg"><Users size={20} /></div><div><h3 className="font-bold text-gray-800">Usuários</h3></div></div>
                   <button onClick={() => setIsAddUserModalOpen(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 flex items-center gap-2"><Plus size={16} /> Novo Usuário</button>
                </div>
                <table className="w-full text-left text-sm">
                   <thead className="bg-gray-50 text-gray-500 uppercase font-semibold"><tr><th className="px-6 py-3">Nome</th><th className="px-6 py-3">Usuário</th><th className="px-6 py-3">Cargo</th><th className="px-6 py-3 text-right">Ações</th></tr></thead>
                   <tbody className="divide-y divide-gray-100">
                      {users.map(u => (
                         <tr key={u.id} className="hover:bg-gray-50">
                            <td className="px-6 py-3 font-medium text-gray-800">{u.name}</td>
                            <td className="px-6 py-3 text-gray-600">{u.username}</td>
                            <td className="px-6 py-3"><span className={`px-2 py-1 rounded text-xs font-bold ${u.role === 'ADMIN' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{u.role === 'ADMIN' ? 'Admin' : 'Funcionário'}</span></td>
                            <td className="px-6 py-3 text-right flex justify-end gap-2">
                               {u.id !== 'admin' && (<>
                                  <button onClick={() => onResetUserPassword && onResetUserPassword(u.id)} className="p-2 text-orange-600 hover:bg-orange-50 rounded" title="Resetar Senha"><RefreshCw size={16} /></button>
                                  <button onClick={() => onDeleteUser && onDeleteUser(u.id)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Excluir"><Trash2 size={16} /></button>
                               </>)}
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
           )}
           {isAdmin && (
             <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center gap-3 bg-blue-50"><div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Database size={20} /></div><div><h3 className="font-bold text-gray-800">Backup e Dados</h3></div></div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                   {backupStatus === 'SUCCESS' && <div className="col-span-2 p-3 bg-green-50 text-green-700 rounded-lg">{message}</div>}
                   <button onClick={handleDownloadBackup} disabled={backupStatus === 'LOADING'} className="flex items-center justify-center gap-2 p-4 border-2 border-blue-100 rounded-xl hover:bg-blue-50 text-blue-700 font-bold"><Download size={20} /> Fazer Backup</button>
                   <div className="relative"><input type="file" accept=".json" ref={fileInputRef} onChange={handleRestoreBackup} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" /><button className="w-full h-full flex items-center justify-center gap-2 p-4 border-2 border-orange-100 rounded-xl hover:bg-orange-50 text-orange-700 font-bold"><Upload size={20} /> Restaurar Backup</button></div>
                </div>
             </div>
           )}
           <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center gap-3"><div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Lock size={20} /></div><h3 className="font-bold text-gray-800">Alterar Minha Senha</h3></div>
              <div className="p-6"><form onSubmit={handleSubmitPassword} className="space-y-4 max-w-md"><div><label className="block text-sm font-medium text-gray-700">Senha Atual</label><input type="password" required value={currentPassInput} onChange={e => setCurrentPassInput(e.target.value)} className="w-full p-3 border rounded-lg" /></div><div><label className="block text-sm font-medium text-gray-700">Nova Senha</label><input type="password" required value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full p-3 border rounded-lg" /></div><div><label className="block text-sm font-medium text-gray-700">Confirmar</label><input type="password" required value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="w-full p-3 border rounded-lg" /></div><button type="submit" className="bg-purple-600 text-white font-bold px-6 py-3 rounded-xl">Salvar</button></form></div>
           </div>
        </div>
      </div>
      {isAddUserModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6">
                  <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-gray-800">Novo Usuário</h3><button onClick={() => setIsAddUserModalOpen(false)}><Trash2 size={24} className="text-gray-400 rotate-45" /></button></div>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                      <div><label className="block text-sm">Nome</label><input required className="w-full p-2 border rounded" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} /></div>
                      <div><label className="block text-sm">Login</label><input required className="w-full p-2 border rounded" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} /></div>
                      <div><label className="block text-sm">Cargo</label><select className="w-full p-2 border rounded" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})}><option value="EMPLOYEE">Funcionário</option><option value="ADMIN">Administrador</option></select></div>
                      <button type="submit" className="w-full py-3 bg-green-600 text-white font-bold rounded-lg">Criar</button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
