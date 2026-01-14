import React, { useMemo } from 'react';
import { Project, RiskLevel, Task, TaskStatus } from '../types';

interface RiskSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

const RiskSummaryModal: React.FC<RiskSummaryModalProps> = ({ isOpen, onClose, project }) => {
  if (!isOpen) return null;

  // Derive risks from project data
  const risks = useMemo(() => {
    const list: { type: 'critical' | 'warning' | 'info'; message: string; task?: string }[] = [];

    // 1. Check for delayed GMP Critical tasks
    const delayedCriticalTasks = project.tasks.filter(t => 
      t.gmpCritical && (t.status === TaskStatus.Delayed || t.status === TaskStatus.Blocked)
    );
    delayedCriticalTasks.forEach(t => {
      list.push({
        type: 'critical',
        message: `关键 GMP 节点 ${t.status === TaskStatus.Blocked ? '已阻塞' : '已延期'}，可能影响合规性。`,
        task: t.name
      });
    });

    // 2. Check for blocked non-critical tasks
    const blockedTasks = project.tasks.filter(t => 
        !t.gmpCritical && t.status === TaskStatus.Blocked
    );
    blockedTasks.forEach(t => {
        list.push({
            type: 'warning',
            message: `任务处于阻塞状态，需协调资源。`,
            task: t.name
        });
    });

    // 3. Check for unassigned tasks
    const unassignedTasks = project.tasks.filter(t => 
        !t.assignee || t.assignee === '待定' || t.assignee === '未分配' || t.assignee === 'Unassigned'
    );
    if (unassignedTasks.length > 0) {
        list.push({
            type: 'info',
            message: `存在 ${unassignedTasks.length} 个未分配负责人的任务。`,
            task: unassignedTasks.length === 1 ? unassignedTasks[0].name : '多个任务'
        });
    }

    // 4. Fallback if no specific algorithmic risks found
    if (list.length === 0 && project.riskLevel === RiskLevel.Low) {
        list.push({
            type: 'info',
            message: '目前未检测到显著的进度或合规风险。'
        });
    }

    return list;
  }, [project]);

  const getRiskColor = (level: RiskLevel) => {
      switch (level) {
          case RiskLevel.Low: return 'bg-emerald-100 text-emerald-800';
          case RiskLevel.Medium: return 'bg-amber-100 text-amber-800';
          case RiskLevel.High: return 'bg-orange-100 text-orange-800';
          case RiskLevel.Critical: return 'bg-red-100 text-red-800';
          default: return 'bg-gray-100 text-gray-800';
      }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-[90vw] md:w-[500px] max-h-[85vh] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E0E2E5] flex items-center justify-between shrink-0 bg-[#F8F9FA]">
            <div>
                <h2 className="text-lg font-bold text-[#1F1F1F]">项目合规风险看板</h2>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-[#5F6368]">当前总体评级:</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getRiskColor(project.riskLevel)}`}>
                        {project.riskLevel}
                    </span>
                </div>
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
            
            {/* AI Insight Section */}
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-indigo-600">psychology</span>
                    <h3 className="font-bold text-sm text-[#1F1F1F]">AI 智能合规诊断</h3>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-[#444746] leading-relaxed">
                    {project.latestGmpAdvice || "AI 尚未生成针对当前项目状态的详细分析。请尝试在指挥中心输入项目进展。"}
                </div>
            </div>

            {/* Detailed Risk List */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-[#5F6368]">list_alt</span>
                    <h3 className="font-bold text-sm text-[#1F1F1F]">风险详情 ({risks.length})</h3>
                </div>
                
                <div className="space-y-3">
                    {risks.map((risk, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-xl border border-[#E0E2E5] bg-white hover:shadow-sm transition-shadow">
                            {risk.type === 'critical' && <span className="material-symbols-outlined text-red-600 mt-0.5">error</span>}
                            {risk.type === 'warning' && <span className="material-symbols-outlined text-amber-500 mt-0.5">warning</span>}
                            {risk.type === 'info' && <span className="material-symbols-outlined text-blue-500 mt-0.5">info</span>}
                            
                            <div>
                                <p className="text-sm font-medium text-[#1F1F1F]">{risk.message}</p>
                                {risk.task && (
                                    <div className="flex items-center gap-1 mt-1 text-xs text-[#5F6368] bg-[#F1F3F4] w-fit px-2 py-0.5 rounded">
                                        <span className="material-symbols-outlined text-[12px]">task</span>
                                        {risk.task}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E0E2E5] bg-[#F8F9FA] flex justify-end">
            <button 
                onClick={onClose}
                className="px-4 py-2 bg-white border border-[#E0E2E5] rounded-full text-sm font-medium text-[#5F6368] hover:bg-[#F1F3F4] transition-colors"
            >
                关闭
            </button>
        </div>
      </div>
    </div>
  );
};

export default RiskSummaryModal;