import React, { useState, useRef, useEffect } from 'react';
import { User, UserRole, Project, AIConfig, AIProvider, AI_PROVIDERS_CONFIG } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // User Management Props
  users: User[];
  projects: Project[];
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  currentUserId: string;
  // AI Config Props
  aiConfig: AIConfig;
  onUpdateAiConfig: (config: AIConfig) => void;
}

type Tab = 'users' | 'ai';

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  users,
  projects,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  currentUserId,
  aiConfig,
  onUpdateAiConfig
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('users');

  // Determine current user role
  const currentUser = users.find(u => u.id === currentUserId);
  const isAdmin = currentUser?.role === UserRole.Admin;

  // --- User Management State ---
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [userForm, setUserForm] = useState<{ name: string; account?: string; password?: string; role: UserRole; visibleProjectIds: string[] }>({
    name: '',
    account: '',
    password: '',
    role: UserRole.Observer,
    visibleProjectIds: []
  });

  // --- AI Config State ---
  const [tempAiConfig, setTempAiConfig] = useState<AIConfig>(aiConfig);

  useEffect(() => {
    if (isOpen) {
      setTempAiConfig(aiConfig); // Reset temp config when opening
      // If not admin, force default tab to AI
      if (!isAdmin) {
          setActiveTab('ai');
      } else {
          setActiveTab('users');
      }
    }
  }, [isOpen, aiConfig, isAdmin]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
    };
    if (isProjectDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProjectDropdownOpen]);

  if (!isOpen) return null;

  // --- User Logic ---

  const resetUserForm = () => {
    setUserForm({ name: '', account: '', password: '', role: UserRole.Observer, visibleProjectIds: [] });
    setIsAddingUser(false);
    setEditingUserId(null);
    setIsProjectDropdownOpen(false);
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name.trim()) return;

    if (isAddingUser) {
      const newUser: User = {
        id: `u_${Date.now()}`,
        name: userForm.name,
        account: userForm.account,
        password: userForm.password,
        role: userForm.role,
        avatar: userForm.name.charAt(0).toUpperCase(),
        visibleProjectIds: userForm.visibleProjectIds
      };
      onAddUser(newUser);
    } else if (editingUserId) {
      const existingUser = users.find(u => u.id === editingUserId);
      if (existingUser) {
        onUpdateUser({
          ...existingUser,
          name: userForm.name,
          account: userForm.account,
          password: userForm.password,
          role: userForm.role,
          avatar: userForm.name.charAt(0).toUpperCase(),
          visibleProjectIds: userForm.visibleProjectIds
        });
      }
    }
    resetUserForm();
  };

  const startEditUser = (user: User) => {
    setEditingUserId(user.id);
    setUserForm({ 
        name: user.name, 
        account: user.account || '',
        password: user.password || '',
        role: user.role,
        visibleProjectIds: user.visibleProjectIds || [] 
    });
    setIsAddingUser(false);
  };

  const toggleProject = (projectId: string) => {
    setUserForm(prev => {
        const ids = prev.visibleProjectIds;
        if (ids.includes(projectId)) {
            return { ...prev, visibleProjectIds: ids.filter(id => id !== projectId) };
        } else {
            return { ...prev, visibleProjectIds: [...ids, projectId] };
        }
    });
  };

  // --- AI Logic ---
  
  const handleAiProviderChange = (provider: AIProvider) => {
    const defaults = AI_PROVIDERS_CONFIG[provider];
    setTempAiConfig({
      provider,
      apiKey: '', // Clear key on provider switch for security/logic
      model: defaults.defaultModel,
      baseUrl: defaults.defaultBaseUrl || ''
    });
  };

  const saveAiSettings = () => {
    onUpdateAiConfig(tempAiConfig);
    // Visual feedback could be added here
    alert("AI 配置已保存");
  };

  // --- Render Helpers ---

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.Admin: return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case UserRole.ProjectManager: return 'bg-amber-100 text-amber-700 border-amber-200';
      case UserRole.Observer: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const renderProjectSelector = () => {
      const isAllSelected = userForm.visibleProjectIds.length === projects.length;
      return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                className="h-9 px-3 w-full rounded-lg border border-[#E0E2E5] text-xs outline-none bg-white text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
                <span className="truncate text-[#1F1F1F]">
                    {userForm.role === UserRole.Admin ? '所有项目 (管理员)' : 
                     userForm.visibleProjectIds.length === 0 ? '无可见项目' : 
                     isAllSelected ? '所有项目' :
                     `可见 ${userForm.visibleProjectIds.length} 个项目`}
                </span>
                <span className="material-symbols-outlined text-[16px] text-[#5F6368]">arrow_drop_down</span>
            </button>
            {isProjectDropdownOpen && userForm.role !== UserRole.Admin && (
                <div className="absolute top-10 left-0 w-64 bg-white rounded-xl shadow-xl border border-[#E0E2E5] py-2 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                        {projects.map(p => (
                            <div key={p.id} className="flex items-center px-4 py-2 hover:bg-[#F8F9FA] cursor-pointer" onClick={() => toggleProject(p.id)}>
                                <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center transition-colors ${userForm.visibleProjectIds.includes(p.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-400 bg-white'}`}>
                                    {userForm.visibleProjectIds.includes(p.id) && <span className="material-symbols-outlined text-[10px] text-white font-bold">check</span>}
                                </div>
                                <span className="text-xs text-[#1F1F1F] truncate">{p.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      );
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-[900px] h-[650px] overflow-hidden flex relative animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Left Sidebar */}
        <div className="w-64 bg-[#F8F9FA] border-r border-[#E0E2E5] flex flex-col shrink-0">
          <div className="h-16 flex items-center px-6 border-b border-[#E0E2E5]">
             <span className="material-symbols-outlined text-indigo-600 mr-2">settings</span>
             <h2 className="text-lg font-bold text-[#1F1F1F]">系统设置</h2>
          </div>
          <div className="p-4 space-y-1">
             {isAdmin && (
                <button 
                    onClick={() => setActiveTab('users')}
                    className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'users' ? 'bg-white shadow-sm text-indigo-600 font-medium' : 'text-[#5F6368] hover:bg-[#E0E2E5]/50'}`}
                >
                    <span className="material-symbols-outlined text-[20px]">group</span>
                    人员管理
                </button>
             )}
             <button 
                onClick={() => setActiveTab('ai')}
                className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'ai' ? 'bg-white shadow-sm text-indigo-600 font-medium' : 'text-[#5F6368] hover:bg-[#E0E2E5]/50'}`}
             >
                <span className="material-symbols-outlined text-[20px]">psychology</span>
                AI 模型设置
             </button>
          </div>
        </div>

        {/* Right Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
            {/* Header */}
            <div className="h-16 border-b border-[#E0E2E5] flex items-center justify-between px-8 shrink-0">
                <h3 className="text-base font-bold text-[#1F1F1F]">
                    {activeTab === 'users' ? '人员账号与权限' : 'AI 大模型配置'}
                </h3>
                <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-[#F1F3F4] flex items-center justify-center text-[#5F6368]">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                
                {/* --- USERS TAB --- */}
                {activeTab === 'users' && isAdmin && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-4">
                             <p className="text-xs text-[#5F6368]">管理团队成员的登录账号、密码及项目访问权限。</p>
                             {!isAddingUser && !editingUserId && (
                                <button onClick={() => setIsAddingUser(true)} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm">
                                    <span className="material-symbols-outlined text-[16px]">add</span> 添加用户
                                </button>
                             )}
                        </div>

                        {/* User List */}
                        <div className="space-y-3">
                            {/* Add/Edit Form */}
                            {(isAddingUser || editingUserId) && (
                                <div className="p-4 rounded-xl border border-indigo-500 bg-indigo-50/50 ring-4 ring-indigo-50/30 mb-6">
                                    <form onSubmit={handleUserSubmit}>
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-[#5F6368] mb-1">姓名</label>
                                                <input value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} className="w-full h-9 px-3 rounded-lg border border-[#E0E2E5] text-xs outline-none focus:border-indigo-500 bg-white" placeholder="员工姓名" autoFocus />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-[#5F6368] mb-1">角色权限</label>
                                                <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})} className="w-full h-9 px-3 rounded-lg border border-[#E0E2E5] text-xs outline-none focus:border-indigo-500 bg-white">
                                                    <option value={UserRole.Admin}>管理员 (Admin)</option>
                                                    <option value={UserRole.ProjectManager}>项目经理 (PM)</option>
                                                    <option value={UserRole.Observer}>观察员 (Observer)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-[#5F6368] mb-1">登录账号</label>
                                                <input value={userForm.account} onChange={e => setUserForm({...userForm, account: e.target.value})} className="w-full h-9 px-3 rounded-lg border border-[#E0E2E5] text-xs outline-none focus:border-indigo-500 bg-white" placeholder="用户名/邮箱" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-[#5F6368] mb-1">登录密码</label>
                                                <input value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full h-9 px-3 rounded-lg border border-[#E0E2E5] text-xs outline-none focus:border-indigo-500 bg-white" placeholder="设置密码" />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-bold text-[#5F6368] mb-1">可见项目</label>
                                                {renderProjectSelector()}
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button type="button" onClick={resetUserForm} className="px-3 py-1.5 text-xs text-[#5F6368] hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                                            <button type="submit" className="px-3 py-1.5 text-xs bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors shadow-sm">保存</button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {users.map(user => {
                                const isEditing = editingUserId === user.id;
                                if (isEditing) return null; // Hide row if editing (form is shown above or handled differently, but here we used a separate block. Actually better to edit in place or keep list. Let's keep list shown)
                                
                                return (
                                    <div key={user.id} className="flex items-center justify-between p-3 rounded-xl border border-[#E0E2E5] bg-white hover:border-indigo-200 transition-colors group">
                                        <div className="flex items-center gap-4 min-w-0 flex-1">
                                            <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-sm font-bold text-white ${user.role === UserRole.Admin ? 'bg-indigo-600' : user.role === UserRole.ProjectManager ? 'bg-amber-600' : 'bg-emerald-600'}`}>
                                                {user.name.charAt(0)}
                                            </div>
                                            <div className="min-w-0 flex-1 grid grid-cols-4 gap-4">
                                                <div className="col-span-1">
                                                    <div className="text-sm font-bold text-[#1F1F1F]">{user.name}</div>
                                                    <div className={`text-[10px] inline-block px-1.5 py-0.5 rounded border mt-1 ${getRoleBadgeColor(user.role)}`}>{user.role}</div>
                                                </div>
                                                <div className="col-span-1 flex flex-col justify-center">
                                                    <div className="text-[10px] text-[#9AA0A6] uppercase">账号</div>
                                                    <div className="text-xs text-[#5F6368] font-mono truncate">{user.account || '-'}</div>
                                                </div>
                                                <div className="col-span-1 flex flex-col justify-center">
                                                     <div className="text-[10px] text-[#9AA0A6] uppercase">密码</div>
                                                     <div className="text-xs text-[#5F6368] font-mono">******</div>
                                                </div>
                                                <div className="col-span-1 flex flex-col justify-center">
                                                    <div className="text-[10px] text-[#9AA0A6] uppercase">权限范围</div>
                                                    <div className="text-xs text-[#5F6368] truncate">
                                                        {user.role === UserRole.Admin ? '全部项目' : `可见 ${(user.visibleProjectIds || []).length} 个项目`}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => startEditUser(user)} className="p-2 text-[#5F6368] hover:text-indigo-600 hover:bg-[#F8F9FA] rounded-full"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                                            <button onClick={() => onDeleteUser(user.id)} disabled={user.id === currentUserId} className="p-2 text-[#5F6368] hover:text-red-600 hover:bg-red-50 rounded-full disabled:opacity-30"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* --- AI TAB --- */}
                {activeTab === 'ai' && (
                    <div className="max-w-2xl">
                        <div className="mb-6">
                            <h4 className="text-sm font-bold text-[#1F1F1F] mb-1">模型提供商</h4>
                            <p className="text-xs text-[#5F6368] mb-3">选择您希望使用的 AI 大模型服务。支持 Google Gemini 及兼容 OpenAI 接口的主流国产模型。</p>
                            
                            <div className="grid grid-cols-2 gap-3">
                                {(Object.keys(AI_PROVIDERS_CONFIG) as AIProvider[]).map(key => (
                                    <div 
                                        key={key}
                                        onClick={() => handleAiProviderChange(key)}
                                        className={`cursor-pointer rounded-xl border p-3 flex items-center gap-3 transition-all ${tempAiConfig.provider === key ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-[#E0E2E5] hover:border-indigo-300 bg-white'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${tempAiConfig.provider === key ? 'border-indigo-600' : 'border-[#9AA0A6]'}`}>
                                            {tempAiConfig.provider === key && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                                        </div>
                                        <span className={`text-sm font-medium ${tempAiConfig.provider === key ? 'text-indigo-900' : 'text-[#1F1F1F]'}`}>
                                            {AI_PROVIDERS_CONFIG[key].name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4 border-t border-[#E0E2E5] pt-6">
                            <div>
                                <label className="block text-xs font-bold text-[#5F6368] mb-1">API Key (密钥)</label>
                                <input 
                                    type="password"
                                    value={tempAiConfig.apiKey}
                                    onChange={e => setTempAiConfig({...tempAiConfig, apiKey: e.target.value})}
                                    className="w-full h-10 px-3 rounded-lg border border-[#E0E2E5] text-sm outline-none focus:border-indigo-500 bg-white font-mono"
                                    placeholder="sk-..."
                                />
                                <p className="text-[10px] text-[#9AA0A6] mt-1">密钥仅存储在本地会话中，刷新后需重新输入 (Demo 模式)。</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[#5F6368] mb-1">Model Name (模型名称)</label>
                                    <input 
                                        value={tempAiConfig.model}
                                        onChange={e => setTempAiConfig({...tempAiConfig, model: e.target.value})}
                                        className="w-full h-10 px-3 rounded-lg border border-[#E0E2E5] text-sm outline-none focus:border-indigo-500 bg-white font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[#5F6368] mb-1">Base URL (接口地址)</label>
                                    <input 
                                        value={tempAiConfig.baseUrl}
                                        onChange={e => setTempAiConfig({...tempAiConfig, baseUrl: e.target.value})}
                                        className="w-full h-10 px-3 rounded-lg border border-[#E0E2E5] text-sm outline-none focus:border-indigo-500 bg-white font-mono"
                                        placeholder={AI_PROVIDERS_CONFIG[tempAiConfig.provider].defaultBaseUrl || "Default"}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button 
                                onClick={saveAiSettings}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[18px]">save</span>
                                保存配置
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;