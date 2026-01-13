import React, { useState, useRef, useEffect } from 'react';
import { User, UserRole, Project } from '../types';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  projects: Project[];
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  currentUserId: string;
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  users,
  projects,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  currentUserId
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Form State
  const [formData, setFormData] = useState<{ name: string; role: UserRole; visibleProjectIds: string[] }>({
    name: '',
    role: UserRole.Observer,
    visibleProjectIds: []
  });

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

  const resetForm = () => {
    setFormData({ name: '', role: UserRole.Observer, visibleProjectIds: [] });
    setIsAdding(false);
    setEditingId(null);
    setIsProjectDropdownOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (isAdding) {
      const newUser: User = {
        id: `u_${Date.now()}`,
        name: formData.name,
        role: formData.role,
        avatar: formData.name.charAt(0).toUpperCase(),
        visibleProjectIds: formData.visibleProjectIds
      };
      onAddUser(newUser);
    } else if (editingId) {
      const existingUser = users.find(u => u.id === editingId);
      if (existingUser) {
        onUpdateUser({
          ...existingUser,
          name: formData.name,
          role: formData.role,
          avatar: formData.name.charAt(0).toUpperCase(),
          visibleProjectIds: formData.visibleProjectIds
        });
      }
    }
    resetForm();
  };

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setFormData({ 
        name: user.name, 
        role: user.role,
        visibleProjectIds: user.visibleProjectIds || [] 
    });
    setIsAdding(false);
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.Admin: return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case UserRole.ProjectManager: return 'bg-amber-100 text-amber-700 border-amber-200';
      case UserRole.Observer: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const toggleProject = (projectId: string) => {
    setFormData(prev => {
        const ids = prev.visibleProjectIds;
        if (ids.includes(projectId)) {
            return { ...prev, visibleProjectIds: ids.filter(id => id !== projectId) };
        } else {
            return { ...prev, visibleProjectIds: [...ids, projectId] };
        }
    });
  };

  const renderProjectSelector = () => {
      const isAllSelected = formData.visibleProjectIds.length === projects.length;
      
      return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                className="h-9 px-3 w-full rounded-lg border border-indigo-300 text-sm outline-none bg-white text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
                <span className="truncate text-[#1F1F1F]">
                    {formData.role === UserRole.Admin ? '所有项目 (管理员)' : 
                     formData.visibleProjectIds.length === 0 ? '无可见项目' : 
                     isAllSelected ? '所有项目' :
                     `可见 ${formData.visibleProjectIds.length} 个项目`}
                </span>
                <span className="material-symbols-outlined text-[18px] text-[#5F6368]">arrow_drop_down</span>
            </button>

            {isProjectDropdownOpen && formData.role !== UserRole.Admin && (
                <div className="absolute top-10 left-0 w-64 bg-white rounded-xl shadow-xl border border-[#E0E2E5] py-2 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                        {projects.map(p => (
                            <div 
                                key={p.id} 
                                className="flex items-center px-4 py-2 hover:bg-[#F8F9FA] cursor-pointer"
                                onClick={() => toggleProject(p.id)}
                            >
                                <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center transition-colors ${
                                    formData.visibleProjectIds.includes(p.id) 
                                    ? 'bg-indigo-600 border-indigo-600' 
                                    : 'border-gray-400 bg-white'
                                }`}>
                                    {formData.visibleProjectIds.includes(p.id) && (
                                        <span className="material-symbols-outlined text-[12px] text-white font-bold">check</span>
                                    )}
                                </div>
                                <span className="text-sm text-[#1F1F1F] truncate">{p.name}</span>
                            </div>
                        ))}
                         {projects.length === 0 && <div className="text-xs text-gray-400 text-center py-2">无项目可分配</div>}
                    </div>
                </div>
            )}
        </div>
      );
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-[700px] max-h-[85vh] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E0E2E5] flex items-center justify-between bg-[#F8F9FA] shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600">manage_accounts</span>
            <h2 className="text-lg font-bold text-[#1F1F1F]">人员权限管理</h2>
          </div>
          <button 
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-[#E0E2E5] flex items-center justify-center text-[#5F6368] transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            
            {/* List */}
            <div className="space-y-3">
              {users.map(user => (
                <div key={user.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${editingId === user.id ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-50/50' : 'border-[#E0E2E5] bg-white'}`}>
                  
                  {editingId === user.id ? (
                    /* Edit Mode */
                    <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-3 w-full">
                         <div className="h-10 w-10 shrink-0 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold">
                            {formData.name ? formData.name.charAt(0) : '?'}
                         </div>
                         <div className="flex-1 grid grid-cols-10 gap-2">
                             <input 
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className="col-span-3 h-9 px-3 rounded-lg border border-indigo-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                placeholder="姓名"
                                autoFocus
                             />
                             <select
                                value={formData.role}
                                onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                                className="col-span-3 h-9 px-3 rounded-lg border border-indigo-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                             >
                                <option value={UserRole.Admin}>管理员 (Admin)</option>
                                <option value={UserRole.ProjectManager}>项目经理 (PM)</option>
                                <option value={UserRole.Observer}>观察员 (Observer)</option>
                             </select>
                             <div className="col-span-4">
                                {renderProjectSelector()}
                             </div>
                         </div>
                         <div className="flex items-center gap-1 shrink-0">
                             <button type="button" onClick={resetForm} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"><span className="material-symbols-outlined text-[20px]">close</span></button>
                             <button type="submit" className="p-1.5 text-indigo-600 hover:bg-indigo-200 rounded-full transition-colors"><span className="material-symbols-outlined text-[20px]">check</span></button>
                         </div>
                    </form>
                  ) : (
                    /* View Mode */
                    <>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm ${
                                user.role === UserRole.Admin ? 'bg-indigo-600' :
                                user.role === UserRole.ProjectManager ? 'bg-amber-600' : 'bg-emerald-600'
                            }`}>
                                {user.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-bold text-[#1F1F1F] flex items-center gap-2">
                                    {user.name}
                                    {user.id === currentUserId && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 rounded">你自己</span>}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className={`text-[10px] px-2 py-0.5 rounded-full border w-fit font-medium ${getRoleBadgeColor(user.role)}`}>
                                        {user.role}
                                    </div>
                                    {user.role !== UserRole.Admin && (
                                        <span className="text-[10px] text-[#5F6368]">
                                            可见 {(user.visibleProjectIds || []).length} 个项目
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                             <button 
                                onClick={() => startEdit(user)}
                                className="p-2 text-[#5F6368] hover:text-indigo-600 hover:bg-[#F1F3F4] rounded-full transition-colors"
                                title="编辑"
                             >
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                             </button>
                             <button 
                                onClick={() => onDeleteUser(user.id)}
                                disabled={user.id === currentUserId} // Prevent deleting self
                                className="p-2 text-[#5F6368] hover:text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#5F6368]"
                                title="删除"
                             >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                             </button>
                        </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add New Section */}
            {isAdding && !editingId && (
                <div className="mt-3 p-3 rounded-xl border border-indigo-500 bg-indigo-50 animate-in fade-in slide-in-from-top-2 ring-4 ring-indigo-50/50">
                    <form onSubmit={handleSubmit} className="flex items-center gap-3 w-full">
                         <div className="h-10 w-10 shrink-0 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
                            <span className="material-symbols-outlined">person_add</span>
                         </div>
                         <div className="flex-1 grid grid-cols-10 gap-2">
                             <input 
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className="col-span-3 h-9 px-3 rounded-lg border border-indigo-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                placeholder="输入新用户姓名"
                                autoFocus
                             />
                             <select
                                value={formData.role}
                                onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                                className="col-span-3 h-9 px-3 rounded-lg border border-indigo-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                             >
                                <option value={UserRole.Admin}>管理员 (Admin)</option>
                                <option value={UserRole.ProjectManager}>项目经理 (PM)</option>
                                <option value={UserRole.Observer}>观察员 (Observer)</option>
                             </select>
                             <div className="col-span-4">
                                {renderProjectSelector()}
                             </div>
                         </div>
                         <div className="flex items-center gap-1 shrink-0">
                             <button type="button" onClick={resetForm} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"><span className="material-symbols-outlined text-[20px]">close</span></button>
                             <button type="submit" className="p-1.5 text-indigo-600 hover:bg-indigo-200 rounded-full transition-colors"><span className="material-symbols-outlined text-[20px]">check</span></button>
                         </div>
                    </form>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E0E2E5] bg-[#F8F9FA] flex justify-between items-center">
             <div className="text-xs text-[#5F6368]">
                共 {users.length} 位用户
             </div>
             {!isAdding && !editingId && (
                <button 
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-medium transition-colors shadow-sm"
                >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    添加用户
                </button>
             )}
        </div>
      </div>
    </div>
  );
};

export default UserManagementModal;