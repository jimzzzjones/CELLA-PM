import React, { useState, useEffect, useRef } from 'react';
import GanttChart from './components/GanttChart';
import KanbanBoard from './components/KanbanBoard';
import ChatInterface from './components/ChatInterface';
import RiskDashboard from './components/RiskDashboard';
import ConflictModal from './components/ConflictModal';
import ProjectSidebar from './components/ProjectSidebar';
import RiskSummaryModal from './components/RiskSummaryModal';
import SettingsModal from './components/SettingsModal';
import { Project, Task, ChatMessage, ProposedChange, RiskLevel, TaskStatus, ViewMode, ScenarioType, User, UserRole, AIConfig, AI_PROVIDERS_CONFIG } from './types';
import { INITIAL_SCENARIOS } from './constants';
import { analyzeProjectUpdate } from './services/geminiService';

// --- Utility Functions ---

// Helper to add days to a date string
const addDays = (dateStr: string, days: number): string => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

// Helper to cascade schedule changes based on dependencies
const cascadeSchedule = (tasks: Task[]): Task[] => {
  // Deep copy to avoid mutating state directly during calculation
  let currentTasks = tasks.map(t => ({...t})); 
  let hasChanged = true;
  let iterations = 0;

  // Run multiple passes to propagate changes through the dependency chain
  while (hasChanged && iterations < 50) { 
    hasChanged = false;
    const taskMap = new Map(currentTasks.map(t => [t.id, t]));

    for (let i = 0; i < currentTasks.length; i++) {
      const task = currentTasks[i];
      if (!task.dependencies || task.dependencies.length === 0) continue;

      let maxDependencyEnd = 0; // Epoch
      
      task.dependencies.forEach(depId => {
        const dep = taskMap.get(depId);
        if (dep) {
           const depEnd = new Date(dep.endDate).getTime();
           if (depEnd > maxDependencyEnd) maxDependencyEnd = depEnd;
        }
      });

      if (maxDependencyEnd > 0) {
          // Standard: Start next day after dependency ends
          const minStartMs = maxDependencyEnd + (24 * 60 * 60 * 1000); 
          const currentStartMs = new Date(task.startDate).getTime();

          // If current start is earlier than allowed, shift it forward
          // We assume strict FS (Finish-to-Start) dependency
          if (currentStartMs < minStartMs) {
              const shift = minStartMs - currentStartMs;
              const newStart = new Date(minStartMs);
              const newEnd = new Date(new Date(task.endDate).getTime() + shift);
              
              currentTasks[i] = {
                  ...task,
                  startDate: newStart.toISOString().split('T')[0],
                  endDate: newEnd.toISOString().split('T')[0]
              };
              hasChanged = true;
          }
      }
    }
    iterations++;
  }
  return currentTasks;
};

const App: React.FC = () => {
  // Application State
  const [allProjects, setAllProjects] = useState<Project[]>([INITIAL_SCENARIOS.equipment]);
  const [project, setProject] = useState<Project>(INITIAL_SCENARIOS.equipment);
  
  // AI Configuration State
  const [aiConfig, setAiConfig] = useState<AIConfig>({
      provider: 'google',
      apiKey: process.env.API_KEY || '',
      model: AI_PROVIDERS_CONFIG.google.defaultModel,
      baseUrl: ''
  });

  // Simplified User State (Single Admin User)
  const [currentUser] = useState<User>({
      id: 'admin',
      name: '管理员',
      role: UserRole.Admin,
      avatar: 'Admin'
  });

  // Permissions based on Role (Always Admin now)
  const canManageProjects = currentUser.role === UserRole.Admin;
  const canEditTasks = currentUser.role === UserRole.Admin;
  
  // Project Sidebar State
  const [isProjectDrawerOpen, setIsProjectDrawerOpen] = useState(false);

  // Risk Modal State
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '您好，我是 CELLA 项目助理。今天有什么进展需要更新吗？',
      timestamp: new Date()
    }
  ]);
  const [proposedChanges, setProposedChanges] = useState<ProposedChange[]>([]);
  const [pendingNewTasks, setPendingNewTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // UI State
  const [isChatExpanded, setIsChatExpanded] = useState(false); // Default to collapsed
  const [viewMode, setViewMode] = useState<ViewMode>('Day'); // For Gantt
  const [currentView, setCurrentView] = useState<'gantt' | 'kanban'>('gantt'); // 'gantt' or 'kanban'
  const [kanbanGroupBy, setKanbanGroupBy] = useState<'status' | 'assignee'>('status');
  
  // Add Menu State
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isGroupByMenuOpen, setIsGroupByMenuOpen] = useState(false); // For Kanban dropdown
  
  const addMenuRef = useRef<HTMLDivElement>(null);
  const groupByMenuRef = useRef<HTMLDivElement>(null);

  // Conflict Handling State
  const [conflict, setConflict] = useState<{
    task: Task;
    dependency: Task;
    suggestedDate: string;
  } | null>(null);
  const [pendingTaskUpdate, setPendingTaskUpdate] = useState<Task | null>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setIsAddMenuOpen(false);
      }
      if (groupByMenuRef.current && !groupByMenuRef.current.contains(event.target as Node)) {
        setIsGroupByMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Zoom Logic
  const handleZoomIn = () => {
    if (viewMode === 'Quarter') setViewMode('Month');
    else if (viewMode === 'Month') setViewMode('Week');
    else if (viewMode === 'Week') setViewMode('Day');
  };

  const handleZoomOut = () => {
    if (viewMode === 'Day') setViewMode('Week');
    else if (viewMode === 'Week') setViewMode('Month');
    else if (viewMode === 'Month') setViewMode('Quarter');
  };


  // --- Project Management Logic ---

  // Helper: Save current project state to allProjects list
  const saveCurrentProjectToStorage = (currentProjState: Project) => {
    setAllProjects(prev => prev.map(p => p.id === currentProjState.id ? currentProjState : p));
  };

  const handleSwitchProject = (projectId: string) => {
    // 1. Save current project first
    saveCurrentProjectToStorage(project);

    // 2. Find target project
    const targetProject = allProjects.find(p => p.id === projectId);
    if (targetProject) {
      setProject(targetProject);
      // Reset chat context for new project (optional, or keep history?)
      // For now, let's just add a separator message
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: `已切换至项目：${targetProject.name}`,
        timestamp: new Date()
      }]);
      setIsProjectDrawerOpen(false);
    }
  };

  const handleCreateProject = () => {
    if (!canManageProjects) return; // Guard

    // Save current before creating new
    saveCurrentProjectToStorage(project);

    const newId = `proj_${Date.now()}`;
    const newProject: Project = {
      id: newId,
      name: "未命名新项目",
      type: ScenarioType.Facility, // Default
      riskLevel: RiskLevel.Low,
      tasks: [],
      latestGmpAdvice: "新项目已创建，暂无风险评估。"
    };

    setAllProjects(prev => [...prev, newProject]);
    setProject(newProject);
    setMessages([{
        id: 'welcome_new',
        role: 'assistant',
        content: '新项目已创建。您可以开始添加任务模块了。',
        timestamp: new Date()
    }]);
    setIsProjectDrawerOpen(false);
  };

  const handleRenameProject = (projectId: string, newName: string) => {
    if (!canManageProjects) return; // Guard

    // Update in list
    setAllProjects(prev => prev.map(p => p.id === projectId ? { ...p, name: newName } : p));
    
    // If it's the currently active project, update local state too
    if (project.id === projectId) {
      setProject(prev => ({ ...prev, name: newName }));
    }
  };

  // Import Project (JSON)
  const handleImportProject = (file: File) => {
    if (!canManageProjects) return; // Guard

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedProject = JSON.parse(content) as Project;
        
        // Basic validation
        if (!importedProject.id || !importedProject.tasks) {
          alert("无效的项目文件格式");
          return;
        }

        // Avoid ID collision
        const newProject = {
          ...importedProject,
          id: `imported_${Date.now()}_${importedProject.id}`,
          name: `${importedProject.name} (导入)`
        };

        saveCurrentProjectToStorage(project); // Save current
        setAllProjects(prev => [...prev, newProject]);
        setProject(newProject);
        setIsProjectDrawerOpen(false);
        setMessages([{
            id: `import_${Date.now()}`,
            role: 'system',
            content: `成功导入项目：${newProject.name}`,
            timestamp: new Date()
        }]);

      } catch (err) {
        console.error("Import failed", err);
        alert("导入失败：文件格式错误");
      }
    };
    reader.readAsText(file);
  };

  // Export Project (JSON) - Allowed for all roles (typically read access implies export)
  const handleExportProject = (projToExport: Project) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projToExport, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${projToExport.name}_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // Export Gantt Data (CSV)
  const handleExportGanttCsv = () => {
    const headers = ["任务ID", "任务名称", "负责人", "开始日期", "结束日期", "工期(天)", "状态", "GMP关键", "进度"];
    const rows = project.tasks.map(t => [
        t.id,
        `"${t.name.replace(/"/g, '""')}"`, // Handle commas in names
        t.assignee,
        t.startDate,
        t.endDate,
        t.duration,
        t.status,
        t.gmpCritical ? "是" : "否",
        `${t.progress}%`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" // Add BOM for Excel Chinese support
        + [headers, ...rows].map(e => e.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${project.name}_任务表.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // --- End Project Management Logic ---


  // Handle User Message
  const handleSendMessage = async (text: string) => {
    // Ensure chat is expanded when sending
    setIsChatExpanded(true);
    
    // 1. Add User Message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // 2. Call AI Service (Now supports dynamic providers)
      const aiResponse = await analyzeProjectUpdate(project.tasks, text, aiConfig);

      // 3. Process AI Response (Existing Tasks Update)
      const changes: ProposedChange[] = aiResponse.affected_tasks.map(at => {
        const originalTask = project.tasks.find(t => t.id === at.task_id);
        return {
          taskId: at.task_id,
          taskName: originalTask?.name,
          originalStartDate: originalTask?.startDate,
          originalEndDate: originalTask?.endDate,
          newStartDate: at.new_start_date,
          newEndDate: at.new_end_date,
          originalAssignee: originalTask?.assignee,
          newAssignee: at.new_assignee,
          reason: at.reason
        };
      });

      // 4. Process AI Response (New Tasks Creation)
      const newTasks: Task[] = (aiResponse.created_tasks || []).map((ct, idx) => ({
        id: `new_task_${Date.now()}_${idx}`,
        name: ct.name,
        startDate: ct.start_date,
        endDate: ct.end_date,
        duration: Math.ceil((new Date(ct.end_date).getTime() - new Date(ct.start_date).getTime()) / (1000 * 3600 * 24)) + 1,
        status: TaskStatus.Pending,
        assignee: ct.assignee || "AI 建议",
        progress: 0,
        dependencies: [], // AI can suggest these in future
        gmpCritical: ct.gmp_critical || false,
        category: ct.category || "General",
        isNew: true,
        reason: ct.reason
      }));

      // 5. Update State
      setProposedChanges(changes);
      setPendingNewTasks(newTasks);

      // 6. Add Assistant Message
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse.response_text,
        timestamp: new Date(),
        metadata: {
          proposedChanges: changes,
          newTasks: newTasks,
          gmpAdvice: aiResponse.gmp_advice,
          riskAssessment: aiResponse.overall_risk as RiskLevel
        }
      };
      setMessages(prev => [...prev, assistantMsg]);
      
      // Update risk level and advice if provided
      if (aiResponse.overall_risk || aiResponse.gmp_advice) {
        setProject(prev => {
           const updated = { 
               ...prev, 
               riskLevel: aiResponse.overall_risk as RiskLevel || prev.riskLevel,
               latestGmpAdvice: aiResponse.gmp_advice || prev.latestGmpAdvice
           };
           saveCurrentProjectToStorage(updated); // Sync
           return updated;
        });
      }

    } catch (error) {
      console.error(error);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "抱歉，分析您的请求时出现错误，请检查网络或 API 配置。",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Confirm changes: Apply proposed to actual
  const handleConfirmChanges = (changes: ProposedChange[], newTasks: Task[] = []) => {
    if (!canEditTasks) return;

    setProject(prev => {
      // 1. Update existing tasks based on AI suggestions
      const tasksWithAIUpdates = prev.tasks.map(task => {
        const change = changes.find(c => c.taskId === task.id);
        if (change) {
          return {
            ...task,
            startDate: change.newStartDate,
            endDate: change.newEndDate,
            assignee: change.newAssignee || task.assignee, // Apply assignee change if present
            status: task.status
          };
        }
        return task;
      });

      // 2. Add new tasks (remove isNew flag)
      const finalizedNewTasks = newTasks.map(t => {
        const { isNew, reason, ...rest } = t;
        return rest;
      });

      const mergedTasks = [...tasksWithAIUpdates, ...finalizedNewTasks];

      // 3. Auto-cascade dependencies to ensure consistency
      // This fixes the issue where AI might miss updating downstream tasks (e.g. Q2 tasks depending on Q1)
      const finalizedTasks = cascadeSchedule(mergedTasks);

      const newProjectState = { ...prev, tasks: finalizedTasks };
      saveCurrentProjectToStorage(newProjectState); // Sync
      return newProjectState;
    });
    
    // Clear proposal
    setProposedChanges([]);
    setPendingNewTasks([]);
    
    // Add confirmation message
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: "变更已确认，进度表已更新 (相关依赖任务已自动顺延)。",
      timestamp: new Date()
    }]);
  };

  // Reject changes: Clear proposed
  const handleRejectChanges = () => {
    setProposedChanges([]);
    setPendingNewTasks([]);
    setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "变更已放弃，进度表保持原样。",
        timestamp: new Date()
      }]);
  };

  // Check dependencies before updating
  const checkDependencies = (updatedTask: Task, allTasks: Task[]) => {
    if (updatedTask.dependencies && updatedTask.dependencies.length > 0) {
      for (const depId of updatedTask.dependencies) {
        const depTask = allTasks.find(t => t.id === depId);
        if (depTask) {
          const depEnd = new Date(depTask.endDate);
          const currentStart = new Date(updatedTask.startDate);
          
          // Strict sequential: Start Date must be > Dependency End Date
          if (currentStart <= depEnd) {
             const suggested = new Date(depEnd);
             suggested.setDate(suggested.getDate() + 1);
             return {
               dependency: depTask,
               suggestedDate: suggested.toISOString().split('T')[0]
             };
          }
        }
      }
    }
    return null;
  };

  // Handle manual task update from Gantt Chart
  const handleTaskUpdate = (updatedTask: Task) => {
    if (!canEditTasks) return;

    // 1. Check for conflicts
    const conflictResult = checkDependencies(updatedTask, project.tasks);
    
    if (conflictResult) {
      setPendingTaskUpdate(updatedTask);
      setConflict({
        task: updatedTask,
        dependency: conflictResult.dependency,
        suggestedDate: conflictResult.suggestedDate
      });
      return;
    }

    // 2. No conflict, update immediately
    setProject(prev => {
      // Apply update then cascade to be safe for manual edits too
      const newTasksRaw = prev.tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
      const newTasksCascaded = cascadeSchedule(newTasksRaw);
      
      const newProjectState = { ...prev, tasks: newTasksCascaded };
      saveCurrentProjectToStorage(newProjectState); // Sync
      return newProjectState;
    });
  };

  // Handle Task Reorder
  const handleTaskReorder = (newTasks: Task[]) => {
    if (!canEditTasks) return;
    setProject(prev => {
        const newProjectState = { ...prev, tasks: newTasks };
        saveCurrentProjectToStorage(newProjectState);
        return newProjectState;
    });
  };

  // Handle Task Delete
  const handleTaskDelete = (taskId: string) => {
    if (!canEditTasks) return;
    setProject(prev => {
        const newTasks = prev.tasks.filter(t => t.id !== taskId);
        const newProjectState = { ...prev, tasks: newTasks };
        saveCurrentProjectToStorage(newProjectState);
        return newProjectState;
    });
  };

  // Handle Insert Task (Before/After)
  const handleInsertTask = (targetTaskId: string, position: 'before' | 'after') => {
    if (!canEditTasks) return;

    setProject(prev => {
        const tasks = [...prev.tasks];
        const index = tasks.findIndex(t => t.id === targetTaskId);
        if (index === -1) return prev;

        const targetTask = tasks[index];
        const newTask: Task = {
            id: `task_${Date.now()}`,
            name: "新任务",
            startDate: targetTask.startDate,
            endDate: targetTask.endDate, // Default to same duration/dates
            duration: targetTask.duration,
            status: TaskStatus.Pending,
            assignee: "未分配",
            progress: 0,
            dependencies: [],
            gmpCritical: false,
            category: "General",
            isNew: true
        };

        const insertIndex = position === 'after' ? index + 1 : index;
        tasks.splice(insertIndex, 0, newTask);

        const newProjectState = { ...prev, tasks };
        saveCurrentProjectToStorage(newProjectState);
        return newProjectState;
    });
  };

  // Resolve conflict by applying suggestions
  const resolveConflict = () => {
    if (pendingTaskUpdate && conflict && canEditTasks) {
      // Calculate duration to shift end date correctly
      const oldStart = new Date(pendingTaskUpdate.startDate).getTime();
      const oldEnd = new Date(pendingTaskUpdate.endDate).getTime();
      const durationMs = oldEnd - oldStart;
      
      const newStartStr = conflict.suggestedDate;
      const newStart = new Date(newStartStr).getTime();
      const newEnd = new Date(newStart + durationMs);
      const newEndStr = newEnd.toISOString().split('T')[0];

      const fixedTask = {
        ...pendingTaskUpdate,
        startDate: newStartStr,
        endDate: newEndStr
      };
      
      setProject(prev => {
          // Apply fixed task then cascade
          const newTasksRaw = prev.tasks.map(t => t.id === fixedTask.id ? fixedTask : t);
          const newTasksCascaded = cascadeSchedule(newTasksRaw);

          const newProjectState = { ...prev, tasks: newTasksCascaded };
          saveCurrentProjectToStorage(newProjectState);
          return newProjectState;
      });
      
      setConflict(null);
      setPendingTaskUpdate(null);
    }
  };

  const cancelConflict = () => {
    setConflict(null);
    setPendingTaskUpdate(null);
  };

  // Handle adding modules or single tasks
  const handleAddModule = (type: 'general' | 'facility' | 'equipment' | 'tech_transfer') => {
    if (!canEditTasks) return;

    const baseId = Date.now();
    let newTasks: Task[] = [];
    const today = new Date().toISOString().split('T')[0];

    if (type === 'general') {
        newTasks.push({
            id: `task_${baseId}`,
            name: "新建通用任务",
            startDate: today,
            endDate: addDays(today, 5),
            duration: 5,
            status: TaskStatus.Pending,
            assignee: "未分配",
            progress: 0,
            dependencies: [],
            gmpCritical: false,
            category: "General"
        });
    } else {
        let prefix = '';
        let template: { name: string, duration: number, gmp: boolean, cat: string }[] = [];

        if (type === 'facility') {
            prefix = '[厂房]';
            template = [
                { name: "URS (用户需求说明书) 签署", duration: 5, gmp: true, cat: "Planning" },
                { name: "施工商选型与审计", duration: 10, gmp: true, cat: "Procurement" },
                { name: "设计确认 (DQ)", duration: 7, gmp: true, cat: "Validation" },
                { name: "施工与安装确认 (IQ)", duration: 20, gmp: true, cat: "Construction" },
                { name: "运行确认 (OQ) & HVAC调试", duration: 14, gmp: true, cat: "Validation" },
                { name: "性能确认 (PQ) & 环境监测", duration: 14, gmp: true, cat: "Validation" }
            ];
        } else if (type === 'equipment') {
            prefix = '[设备]';
            template = [
                 { name: "URS (用户需求说明书) 签署", duration: 5, gmp: true, cat: "Planning" },
                 { name: "供应商选型与审计", duration: 10, gmp: true, cat: "Procurement" },
                 { name: "设计确认 (DQ)", duration: 5, gmp: true, cat: "Validation" },
                 { name: "到货与安装确认 (IQ)", duration: 7, gmp: true, cat: "Validation" },
                 { name: "运行确认 (OQ)", duration: 10, gmp: true, cat: "Validation" },
                 { name: "性能确认 (PQ)", duration: 10, gmp: true, cat: "Validation" }
            ];
        } else if (type === 'tech_transfer') {
            prefix = '[技转]';
            template = [
                { name: "技术转移方案 (Protocol) 制定", duration: 5, gmp: true, cat: "Planning" },
                { name: "物料供应商审计", duration: 14, gmp: true, cat: "Quality" },
                { name: "分析方法转移 (AMT)", duration: 14, gmp: true, cat: "QC" },
                { name: "工艺参数确认 runs", duration: 10, gmp: true, cat: "Process" },
                { name: "工艺验证 (PPQ)", duration: 21, gmp: true, cat: "Validation" }
            ];
        }

        let currentStartDate = today;
        let prevTaskId = "";

        newTasks = template.map((step, index) => {
            const taskId = `task_${baseId}_${index}`;
            const endDate = addDays(currentStartDate, step.duration);
            
            const task: Task = {
                id: taskId,
                name: `${prefix} ${step.name}`,
                startDate: currentStartDate,
                endDate: endDate,
                duration: step.duration,
                status: TaskStatus.Pending,
                assignee: "待定",
                progress: 0,
                dependencies: prevTaskId ? [prevTaskId] : [],
                gmpCritical: step.gmp,
                category: step.cat
            };

            // Set up next task start date (next day)
            currentStartDate = addDays(endDate, 1);
            prevTaskId = taskId;
            return task;
        });
    }

    setProject(prev => {
        const newProjectState = { ...prev, tasks: [...prev.tasks, ...newTasks] };
        saveCurrentProjectToStorage(newProjectState);
        return newProjectState;
    });
    setIsAddMenuOpen(false);
  };


  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#F8F9FA]">
      
      {/* Project Management Sidebar */}
      <ProjectSidebar 
        isOpen={isProjectDrawerOpen}
        onClose={() => setIsProjectDrawerOpen(false)}
        projects={allProjects}
        currentProjectId={project.id}
        onSelectProject={handleSwitchProject}
        onCreateProject={handleCreateProject}
        onRenameProject={handleRenameProject}
        onImportProject={handleImportProject}
        onExportProject={handleExportProject}
        userRole={currentUser.role}
      />

      {/* AI Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        aiConfig={aiConfig}
        onUpdateAiConfig={setAiConfig}
      />

      {/* Conflict Warning Modal */}
      <ConflictModal 
        isOpen={!!conflict}
        conflict={conflict ? {
          taskName: conflict.task.name,
          dependencyName: conflict.dependency.name,
          suggestedDate: conflict.suggestedDate
        } : null}
        onCancel={cancelConflict}
        onAutoFix={resolveConflict}
      />

      {/* Risk Summary Modal */}
      <RiskSummaryModal 
        isOpen={isRiskModalOpen}
        onClose={() => setIsRiskModalOpen(false)}
        project={project}
      />

      {/* Top App Bar (Material 3 Style) - Responsive adjustments */}
      <header className="h-16 bg-white flex items-center justify-between px-4 md:px-6 shrink-0 z-50 shadow-sm relative">
        <div className="flex items-center space-x-2 md:space-x-4">
            <div className="h-8 w-8 md:h-10 md:w-10 bg-indigo-600 rounded-lg md:rounded-xl flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-white text-[20px] md:text-[24px]">science</span>
            </div>
            <div>
                <h1 className="text-lg md:text-xl font-medium text-[#1F1F1F]">CELLA</h1>
                <p className="text-[10px] md:text-xs text-[#5F6368] hidden md:block">GMP 项目智能助手</p>
            </div>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-6">
            {/* Project Selector - Optimized for mobile */}
            <div 
                className="cursor-pointer hover:bg-[#F8F9FA] px-2 md:px-3 py-1 rounded-lg transition-colors group flex items-center"
                onClick={() => setIsProjectDrawerOpen(true)}
            >
                <div className="flex flex-col items-end mr-1">
                    <div className="text-[10px] font-medium text-[#5F6368] hidden md:block">当前项目</div>
                    <div className="text-sm font-medium text-[#1F1F1F] group-hover:text-indigo-600 transition-colors max-w-[120px] md:max-w-[200px] truncate">{project.name}</div>
                </div>
                <span className="material-symbols-outlined text-[20px] text-[#9AA0A6] group-hover:text-indigo-600">expand_more</span>
            </div>

            <RiskDashboard 
                level={project.riskLevel} 
                onClick={() => setIsRiskModalOpen(true)}
            />
            
            {/* AI Settings Button */}
            <button 
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full hover:bg-[#F1F3F4] text-[#5F6368] transition-colors border border-transparent hover:border-[#E0E2E5]"
                title="AI 模型设置"
            >
                <span className="material-symbols-outlined text-[20px] md:text-[24px]">psychology</span>
            </button>
        </div>
      </header>

      {/* Main Content: Full Screen Gantt/Kanban + Floating Chat */}
      <main className="flex-1 flex flex-col min-h-0 bg-[#F8F9FA] p-0 md:p-4 relative">
        
        {/* Full Screen Visualization Container */}
        <div 
          className="flex-1 flex flex-col min-h-0 bg-white md:rounded-3xl shadow-sm border-t md:border border-[#E0E2E5] transition-all overflow-hidden"
          onClick={() => setIsChatExpanded(false)} // Click outside to collapse chat
        >
            <div className="px-4 md:px-6 py-3 md:py-5 flex flex-wrap gap-2 items-center justify-between shrink-0 border-b border-[#E0E2E5]">
                <h2 className="text-lg md:text-xl font-normal text-[#1F1F1F] flex items-center mr-auto">
                    <span className="material-symbols-outlined mr-2 text-indigo-600">
                        {currentView === 'gantt' ? 'calendar_month' : 'view_kanban'}
                    </span>
                    <span className="hidden md:inline">{currentView === 'gantt' ? '主进度计划' : '任务看板'}</span>
                </h2>
                
                <div className="flex items-center gap-2 flex-wrap justify-end">
                     {/* Gantt Export Button - Hidden on small mobile */}
                     <button 
                        onClick={handleExportGanttCsv}
                        className="h-8 md:h-10 px-3 md:px-4 bg-white border border-[#E0E2E5] hover:bg-[#F1F3F4] text-[#1F1F1F] rounded-full text-xs md:text-sm font-medium transition-all hidden sm:flex items-center gap-2"
                        title="导出当前进度表 (CSV)"
                     >
                        <span className="material-symbols-outlined text-[16px] md:text-[20px] text-[#5F6368]">ios_share</span>
                        <span className="hidden md:inline">导出 CSV</span>
                     </button>

                     {/* Add Module Dropdown */}
                     {canEditTasks && (
                       <div className="relative" ref={addMenuRef}>
                           <button 
                             onClick={(e) => { e.stopPropagation(); setIsAddMenuOpen(!isAddMenuOpen); }}
                             className="h-8 md:h-10 px-3 md:px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-xs md:text-sm font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-1 md:gap-2 active:scale-95"
                           >
                             <span className="material-symbols-outlined text-[16px] md:text-[20px]">add</span>
                             <span className="hidden xs:inline">新增模块</span>
                             <span className="material-symbols-outlined text-[16px] ml-1">arrow_drop_down</span>
                           </button>
                           
                           {isAddMenuOpen && (
                               <div className="absolute top-12 right-0 md:left-0 w-48 bg-white rounded-xl shadow-xl border border-[#E0E2E5] py-2 z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col">
                                   <button 
                                       onClick={() => handleAddModule('equipment')}
                                       className="px-4 py-3 text-left hover:bg-[#F1F3F4] flex items-center gap-3 text-sm text-[#1F1F1F]"
                                   >
                                       <span className="material-symbols-outlined text-[#5F6368]">biotech</span>
                                       <div>
                                           <div className="font-medium">设备采购验证</div>
                                           <div className="text-[10px] text-[#5F6368]">含 URS, IQ, OQ, PQ</div>
                                       </div>
                                   </button>
                                   <button 
                                       onClick={() => handleAddModule('facility')}
                                       className="px-4 py-3 text-left hover:bg-[#F1F3F4] flex items-center gap-3 text-sm text-[#1F1F1F]"
                                   >
                                       <span className="material-symbols-outlined text-[#5F6368]">domain</span>
                                        <div>
                                           <div className="font-medium">厂房建设验证</div>
                                           <div className="text-[10px] text-[#5F6368]">含施工, DQ, EMS等</div>
                                       </div>
                                   </button>
                                   <button 
                                       onClick={() => handleAddModule('tech_transfer')}
                                       className="px-4 py-3 text-left hover:bg-[#F1F3F4] flex items-center gap-3 text-sm text-[#1F1F1F]"
                                   >
                                       <span className="material-symbols-outlined text-[#5F6368]">swap_horiz</span>
                                        <div>
                                           <div className="font-medium">技术转移 (TT)</div>
                                           <div className="text-[10px] text-[#5F6368]">含审计, 方法转移, PPQ</div>
                                       </div>
                                   </button>
                               </div>
                           )}
                       </div>
                     )}

                     {/* Kanban Grouping Dropdown (Only Visible in Kanban Mode) */}
                     {currentView === 'kanban' && (
                        <div className="relative" ref={groupByMenuRef}>
                            <button
                                onClick={() => setIsGroupByMenuOpen(!isGroupByMenuOpen)}
                                className="h-8 md:h-10 px-3 md:px-4 bg-white border border-[#E0E2E5] hover:bg-[#F1F3F4] text-[#1F1F1F] rounded-full text-xs md:text-sm font-medium transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[16px] md:text-[20px] text-[#5F6368]">group_work</span>
                                <span className="hidden xs:inline">{kanbanGroupBy === 'status' ? '按状态' : '按负责人'}</span>
                                <span className="material-symbols-outlined text-[16px] ml-1">arrow_drop_down</span>
                            </button>
                            {isGroupByMenuOpen && (
                                <div className="absolute top-12 right-0 w-32 bg-white rounded-xl shadow-xl border border-[#E0E2E5] py-2 z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col">
                                    <button 
                                        onClick={() => { setKanbanGroupBy('status'); setIsGroupByMenuOpen(false); }}
                                        className={`px-4 py-2 text-left text-sm flex items-center gap-2 ${kanbanGroupBy === 'status' ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-[#F1F3F4] text-[#1F1F1F]'}`}
                                    >
                                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                        状态
                                    </button>
                                    <button 
                                        onClick={() => { setKanbanGroupBy('assignee'); setIsGroupByMenuOpen(false); }}
                                        className={`px-4 py-2 text-left text-sm flex items-center gap-2 ${kanbanGroupBy === 'assignee' ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-[#F1F3F4] text-[#1F1F1F]'}`}
                                    >
                                        <span className="material-symbols-outlined text-[18px]">person</span>
                                        负责人
                                    </button>
                                </div>
                            )}
                        </div>
                     )}

                     {/* View Switcher */}
                     <div className="h-8 md:h-10 bg-[#F1F3F4] rounded-full p-1 flex">
                        <button 
                            onClick={() => setCurrentView('gantt')}
                            className={`px-3 md:px-4 rounded-full text-xs md:text-sm font-medium transition-all ${currentView === 'gantt' ? 'bg-white text-[#1F1F1F] shadow-sm' : 'text-[#5F6368] hover:text-[#1F1F1F]'}`}
                        >
                            甘特图
                        </button>
                        <button 
                            onClick={() => setCurrentView('kanban')}
                            className={`px-3 md:px-4 rounded-full text-xs md:text-sm font-medium transition-all ${currentView === 'kanban' ? 'bg-white text-[#1F1F1F] shadow-sm' : 'text-[#5F6368] hover:text-[#1F1F1F]'}`}
                        >
                            看板
                        </button>
                     </div>
                </div>
            </div>
            
            <div className="flex-1 min-h-0 w-full relative">
                {currentView === 'gantt' ? (
                    <GanttChart 
                        tasks={project.tasks} 
                        proposedChanges={proposedChanges} 
                        pendingNewTasks={pendingNewTasks}
                        onTaskUpdate={handleTaskUpdate}
                        onTaskReorder={handleTaskReorder}
                        onTaskDelete={handleTaskDelete}
                        viewMode={viewMode}
                        readOnly={!canEditTasks}
                        onZoomIn={handleZoomIn}
                        onZoomOut={handleZoomOut}
                        onInsertTask={handleInsertTask}
                    />
                ) : (
                    <KanbanBoard 
                        tasks={[...project.tasks, ...pendingNewTasks]}
                        groupBy={kanbanGroupBy}
                        onTaskUpdate={handleTaskUpdate}
                        readOnly={!canEditTasks}
                    />
                )}
            </div>
        </div>

        {/* Floating View Controls & Legend (Left Side) - Only Visible in Gantt Mode */}
        {currentView === 'gantt' && (
            <div className="absolute left-4 bottom-20 md:left-6 md:bottom-6 z-[60] h-auto md:h-[92px] w-auto md:w-[320px] flex flex-col gap-2 md:gap-0 md:justify-between transition-all select-none animate-in fade-in slide-in-from-bottom-4 pointer-events-none md:pointer-events-auto">
                 {/* Desktop Container Style applied via children pointer-events */}
                 
                {/* Row 1: View Label & Zoom Controls */}
                <div className="h-10 flex items-center justify-between shrink-0 bg-white/90 backdrop-blur-sm md:bg-white rounded-full md:rounded-3xl shadow-lg border border-[#E0E2E5] px-2 md:px-4 pointer-events-auto w-fit md:w-full">
                    <div className="flex items-center text-indigo-600 cursor-default px-2 py-1">
                        <span className="material-symbols-outlined text-[20px] md:text-[22px] mr-2">calendar_month</span>
                        <span className="font-bold text-xs md:text-sm whitespace-nowrap">
                            {viewMode === 'Day' && '日视图'}
                            {viewMode === 'Week' && '周视图'}
                            {viewMode === 'Month' && '月视图'}
                            {viewMode === 'Quarter' && '季度视图'}
                        </span>
                    </div>

                    <div className="flex items-center gap-1 ml-2">
                        <button 
                            onClick={handleZoomOut}
                            disabled={viewMode === 'Quarter'}
                            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#F1F3F4] text-[#5F6368] disabled:opacity-30 transition-colors active:scale-95"
                            title="Zoom Out"
                        >
                            <span className="material-symbols-outlined text-[20px]">remove</span>
                        </button>
                        <button 
                            onClick={handleZoomIn}
                            disabled={viewMode === 'Day'}
                            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#F1F3F4] text-[#5F6368] disabled:opacity-30 transition-colors active:scale-95"
                            title="Zoom In"
                        >
                            <span className="material-symbols-outlined text-[20px]">add</span>
                        </button>
                    </div>
                </div>

                {/* Row 2: Legend (Styled as Grey Capsule) - Hidden on very small screens or made compact */}
                <div className="hidden md:flex h-10 shrink-0 items-center bg-[#F1F3F4] rounded-full px-4 justify-between gap-4 text-[11px] font-medium text-[#444746] cursor-default pointer-events-auto shadow-sm border border-[#E0E2E5] md:border-none md:shadow-none">
                    <div className="flex items-center whitespace-nowrap">
                        <div className="w-2.5 h-2.5 bg-[#C4EED0] border border-[#6DD58C] rounded-full mr-1.5 shadow-sm"></div>
                        <span>GMP 关键</span>
                    </div>
                    <div className="flex items-center whitespace-nowrap">
                        <div className="w-2.5 h-2.5 bg-[#D3E3FD] border border-[#A8C7FA] rounded-full mr-1.5 shadow-sm"></div>
                        <span>普通</span>
                    </div>
                    <div className="flex items-center whitespace-nowrap">
                        <div className="w-2.5 h-2.5 border-2 border-dashed border-amber-500 bg-amber-50 rounded-full mr-1.5 shadow-sm"></div>
                        <span>建议</span>
                    </div>
                    <div className="flex items-center whitespace-nowrap">
                        <div className="w-2.5 h-2.5 border-2 border-dashed border-indigo-300 bg-indigo-100 rounded-full mr-1.5 shadow-sm"></div>
                        <span>新增</span>
                    </div>
                </div>
            </div>
        )}

        {/* Floating Chat Command Center (Right Side) */}
        <div 
            className={`
                transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] shadow-2xl border border-[#E0E2E5] bg-white overflow-hidden flex flex-col z-[60]
                ${isChatExpanded 
                   ? 'absolute left-0 right-0 bottom-0 h-full md:left-auto md:top-auto md:right-6 md:bottom-6 md:h-[80%] md:w-[400px] md:max-h-[800px] md:rounded-3xl rounded-none' 
                   : 'absolute right-4 bottom-4 left-4 h-[92px] md:left-auto md:top-auto md:right-6 md:bottom-6 md:h-[92px] md:w-[400px] rounded-3xl'}
            `}
            onClick={(e) => e.stopPropagation()}
        >
            <ChatInterface 
                messages={messages} 
                onSendMessage={handleSendMessage}
                onConfirmChanges={handleConfirmChanges}
                onRejectChanges={handleRejectChanges}
                isLoading={isLoading}
                isExpanded={isChatExpanded}
                onExpand={() => setIsChatExpanded(true)}
                onCollapse={() => setIsChatExpanded(false)}
                userRole={currentUser.role}
            />
        </div>

      </main>
    </div>
  );
};

export default App;