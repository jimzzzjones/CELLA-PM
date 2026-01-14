import React, { useState, useEffect, useRef } from 'react';
import { Project, ScenarioType, UserRole } from '../types';

interface ProjectSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  currentProjectId: string;
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
  onRenameProject: (projectId: string, newName: string) => void;
  onImportProject: (file: File) => void;
  onExportProject: (project: Project) => void;
  userRole: UserRole;
}

const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  isOpen,
  onClose,
  projects,
  currentProjectId,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onImportProject,
  onExportProject,
  userRole,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Define Permissions
  const canManageProjects = userRole === UserRole.Admin || userRole === UserRole.ProjectManager;

  // Reset editing state when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setEditingId(null);
      setEditName('');
    }
  }, [isOpen]);

  const handleStartEdit = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    if (canManageProjects) {
      setEditingId(project.id);
      setEditName(project.name);
    }
  };

  const handleSaveEdit = () => {
    if (editingId && editName.trim()) {
      onRenameProject(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImportProject(e.target.files[0]);
    }
    // Reset input so same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[90] transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div className={`fixed top-0 left-0 h-full w-80 bg-white shadow-2xl z-[100] transform transition-transform duration-300 ease-in-out border-r border-[#E0E2E5] flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#E0E2E5] shrink-0">
          <div className="flex items-center gap-2 text-[#1F1F1F]">
            <span className="material-symbols-outlined text-indigo-600">folder_open</span>
            <span className="font-bold text-lg">项目列表</span>
          </div>
          <button 
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#F1F3F4] text-[#5F6368] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {projects.map((project) => (
            <div 
              key={project.id}
              onClick={() => {
                if (editingId !== project.id) {
                    onSelectProject(project.id);
                }
              }}
              className={`group relative flex items-center px-4 py-3 rounded-xl cursor-pointer transition-all border ${
                project.id === currentProjectId 
                  ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                  : 'bg-white border-transparent hover:bg-[#F8F9FA] hover:border-[#E0E2E5]'
              }`}
            >
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center mr-3 shrink-0 ${
                project.id === currentProjectId ? 'bg-indigo-100 text-indigo-600' : 'bg-[#F1F3F4] text-[#5F6368]'
              }`}>
                <span className="material-symbols-outlined text-[20px]">
                    {project.type === ScenarioType.Equipment ? 'biotech' :
                     project.type === ScenarioType.Facility ? 'domain' : 'science'}
                </span>
              </div>

              <div className="flex-1 min-w-0 pr-8">
                {editingId === project.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleSaveEdit}
                    onKeyDown={handleKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full text-sm font-medium text-[#1F1F1F] bg-white border border-indigo-500 rounded px-1 py-0.5 outline-none"
                  />
                ) : (
                  <>
                    <div className={`text-sm font-medium truncate ${project.id === currentProjectId ? 'text-indigo-900' : 'text-[#1F1F1F]'}`}>
                        {project.name}
                    </div>
                    <div className="text-[10px] text-[#5F6368] flex items-center gap-1">
                        <span>{project.tasks.length} 个任务</span>
                        <span className="w-0.5 h-0.5 bg-[#9AA0A6] rounded-full"></span>
                        <span className={`${
                            project.riskLevel === 'Low' ? 'text-emerald-600' :
                            project.riskLevel === 'Medium' ? 'text-amber-600' : 'text-red-600'
                        }`}>
                            {project.riskLevel} 风险
                        </span>
                    </div>
                  </>
                )}
              </div>

              {/* Actions Area */}
              {editingId !== project.id && (
                <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/80 rounded-full px-1 backdrop-blur-sm">
                    {/* Export Button - Available for all */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); onExportProject(project); }}
                      className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded-full text-[#5F6368] transition-all"
                      title="导出 JSON"
                    >
                      <span className="material-symbols-outlined text-[16px]">ios_share</span>
                    </button>
                    {/* Edit Button - Admin/PM Only */}
                    {canManageProjects && (
                      <button 
                        onClick={(e) => handleStartEdit(e, project)}
                        className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded-full text-[#5F6368] transition-all"
                        title="重命名"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                    )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Action - Only show management buttons if Admin/PM */}
        <div className="p-4 border-t border-[#E0E2E5] bg-[#F8F9FA] flex flex-col gap-3">
           {canManageProjects ? (
             <>
                <div className="flex gap-3 w-full">
                    {/* Hidden Import Input */}
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept=".json"
                        className="hidden"
                    />

                    <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 h-10 bg-white border border-[#E0E2E5] hover:border-indigo-300 hover:text-indigo-600 hover:shadow-md text-[#5F6368] text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                    <span className="material-symbols-outlined text-[20px]">file_open</span>
                    导入
                    </button>

                    <button 
                    onClick={onCreateProject}
                    className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95"
                    >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    新建项目
                    </button>
                </div>
             </>
           ) : (
             <div className="w-full text-center text-xs text-[#9AA0A6] py-2 flex items-center justify-center gap-1">
               <span className="material-symbols-outlined text-[14px]">lock</span>
               您的角色 ({userRole}) 无法管理项目列表
             </div>
           )}
        </div>

      </div>
    </>
  );
};

export default ProjectSidebar;