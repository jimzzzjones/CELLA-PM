import React from 'react';

interface ConflictModalProps {
  isOpen: boolean;
  conflict: {
    taskName: string;
    dependencyName: string;
    suggestedDate: string;
  } | null;
  onCancel: () => void;
  onAutoFix: () => void;
}

const ConflictModal: React.FC<ConflictModalProps> = ({ isOpen, conflict, onCancel, onAutoFix }) => {
  if (!isOpen || !conflict) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-[480px] overflow-hidden transform transition-all scale-100 p-6 font-roboto">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-amber-600 text-2xl">warning</span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-[#1F1F1F] mb-1">发现依赖冲突</h3>
            <p className="text-sm text-[#5F6368] leading-relaxed mb-4">
              任务 <span className="font-medium text-[#1F1F1F]">"{conflict.taskName}"</span> 的开始时间早于其前置任务 <span className="font-medium text-[#1F1F1F]">"{conflict.dependencyName}"</span> 的结束时间。这违反了 GMP 依赖约束。
            </p>
            
            <div className="bg-[#F8F9FA] rounded-xl p-4 border border-[#E0E2E5] mb-6">
              <div className="text-xs font-bold text-[#5F6368] uppercase mb-2 tracking-wide">AI 建议解决方案</div>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-indigo-600">auto_fix</span>
                <div className="text-sm text-[#1F1F1F]">
                  自动将开始日期顺延至 <span className="font-bold text-indigo-600">{conflict.suggestedDate}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={onCancel}
                className="px-4 py-2 rounded-full border border-[#E0E2E5] text-sm font-medium text-[#5F6368] hover:bg-[#F1F3F4] transition-colors"
              >
                取消修改
              </button>
              <button 
                onClick={onAutoFix}
                className="px-4 py-2 rounded-full bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm transition-colors"
              >
                自动修复
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConflictModal;