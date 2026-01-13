import React, { useMemo } from 'react';
import { Task, TaskStatus } from '../types';

interface KanbanBoardProps {
  tasks: Task[];
  groupBy: 'status' | 'assignee';
  onTaskUpdate?: (task: Task) => void;
  readOnly?: boolean;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks, groupBy, onTaskUpdate, readOnly = false }) => {
  
  // Define columns based on grouping strategy
  const columns = useMemo(() => {
    if (groupBy === 'status') {
      return Object.values(TaskStatus).map(status => ({
        id: status,
        title: status === TaskStatus.Pending ? '待处理' :
               status === TaskStatus.InProgress ? '进行中' :
               status === TaskStatus.Completed ? '已完成' :
               status === TaskStatus.Blocked ? '已阻塞' :
               status === TaskStatus.Delayed ? '已延期' : status,
        tasks: tasks.filter(t => t.status === status)
      }));
    } else {
      // Group by Assignee
      const assignees = Array.from(new Set(tasks.map(t => t.assignee || 'Unassigned')));
      return assignees.map(assignee => ({
        id: assignee,
        title: assignee === 'Unassigned' ? '未分配' : assignee,
        tasks: tasks.filter(t => (t.assignee || 'Unassigned') === assignee)
      }));
    }
  }, [tasks, groupBy]);

  // Helper for Status Badge Color
  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.Completed: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case TaskStatus.InProgress: return 'bg-blue-100 text-blue-700 border-blue-200';
      case TaskStatus.Blocked: return 'bg-red-100 text-red-700 border-red-200';
      case TaskStatus.Delayed: return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="h-full flex overflow-x-auto p-6 gap-6 bg-[#F8F9FA]">
      {columns.map(col => (
        <div key={col.id} className="flex-shrink-0 w-80 flex flex-col h-full max-h-full">
          {/* Column Header */}
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[#1F1F1F] text-sm">{col.title}</h3>
              <span className="bg-[#E0E2E5] text-[#444746] text-[10px] px-2 py-0.5 rounded-full font-medium">
                {col.tasks.length}
              </span>
            </div>
            {/* Optional: Column Action Menu could go here */}
          </div>

          {/* Column Body (Droppable Area) */}
          <div className="flex-1 overflow-y-auto pr-2 pb-36 space-y-3 custom-scrollbar">
            {col.tasks.map(task => (
              <div 
                key={task.id} 
                className={`group bg-white p-4 rounded-xl border border-[#E0E2E5] shadow-sm hover:shadow-md transition-all relative ${task.isNew ? 'ring-2 ring-indigo-100' : ''} ${!readOnly ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={() => {
                   if (!readOnly) {
                       // Placeholder for task detail view
                       console.log("View Task", task.name);
                   }
                }}
              >
                {/* GMP Critical Badge */}
                {task.gmpCritical && (
                  <div className="absolute top-4 right-4">
                    <span className="material-symbols-outlined text-[16px] text-[#137333]" title="GMP Critical Path">verified_user</span>
                  </div>
                )}
                
                {/* Category & ID */}
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-[#5F6368] uppercase tracking-wider">{task.id}</span>
                    <span className="text-[10px] bg-[#F1F3F4] text-[#444746] px-1.5 py-0.5 rounded flex items-center">
                        {task.category}
                    </span>
                </div>

                {/* Task Name */}
                <h4 className="font-medium text-[#1F1F1F] text-sm leading-snug mb-3 pr-6">
                    {task.name}
                    {task.isNew && <span className="ml-1 text-indigo-600 text-[10px]">✨</span>}
                </h4>

                {/* Meta Data Row */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F1F3F4]">
                    {/* Assignee Avatar */}
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold border border-indigo-200">
                            {task.assignee.charAt(0)}
                        </div>
                        <span className="text-xs text-[#5F6368] max-w-[80px] truncate">{task.assignee}</span>
                    </div>

                    {/* Conditional Status or Date */}
                    {groupBy === 'assignee' ? (
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${getStatusColor(task.status)}`}>
                            {task.status === TaskStatus.Pending ? '待处理' :
                             task.status === TaskStatus.InProgress ? '进行中' :
                             task.status === TaskStatus.Completed ? '已完成' : task.status}
                        </span>
                    ) : (
                        <div className="text-[10px] text-[#5F6368] font-mono bg-[#F8F9FA] px-1.5 py-0.5 rounded">
                            {new Date(task.endDate).getMonth() + 1}/{new Date(task.endDate).getDate()} 截止
                        </div>
                    )}
                </div>
                
                {/* Progress Bar */}
                {task.status === TaskStatus.InProgress && (
                    <div className="mt-3 h-1 w-full bg-[#F1F3F4] rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${task.progress}%` }}></div>
                    </div>
                )}
              </div>
            ))}
            
            {col.tasks.length === 0 && (
                <div className="h-24 border-2 border-dashed border-[#E0E2E5] rounded-xl flex items-center justify-center text-[#9AA0A6] text-xs">
                    暂无任务
                </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default KanbanBoard;