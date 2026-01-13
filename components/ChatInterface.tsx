import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ProposedChange, RiskLevel, Task, UserRole } from '../types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (msg: string) => void;
  onConfirmChanges: (changes: ProposedChange[], newTasks?: Task[]) => void;
  onRejectChanges: () => void;
  isLoading: boolean;
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  userRole: UserRole;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  messages, 
  onSendMessage, 
  onConfirmChanges, 
  onRejectChanges,
  isLoading,
  isExpanded,
  onExpand,
  onCollapse,
  userRole
}) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Permission check
  const canApplyChanges = userRole === UserRole.Admin || userRole === UserRole.ProjectManager;

  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isExpanded]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <div className={`flex flex-col h-full transition-all duration-300 ${isExpanded ? 'bg-[#F8F9FA]' : 'bg-transparent'}`}>
      {/* Header - Only visible when expanded */}
      {isExpanded && (
        <div className="h-16 border-b border-[#E0E2E5] flex items-center justify-between px-6 bg-white shrink-0">
            <div className="flex items-center">
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 flex items-center justify-center text-indigo-600">
                    <span className="material-symbols-outlined">smart_toy</span>
                </div>
                <div className="ml-3">
                    <h3 className="font-medium text-[#1F1F1F] text-base">指挥中心</h3>
                    <p className="text-xs text-[#5F6368]">由 Gemini 3 驱动</p>
                </div>
            </div>
            <button 
                onClick={onCollapse}
                className="h-8 w-8 rounded-full hover:bg-[#F1F3F4] flex items-center justify-center text-[#5F6368] transition-colors"
                title="折叠"
            >
                <span className="material-symbols-outlined text-[20px]">expand_more</span>
            </button>
        </div>
      )}

      {/* Messages Area - Only visible when expanded */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
            {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 text-sm shadow-sm ${
                    msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm' 
                    : 'bg-white text-[#1F1F1F] border border-[#E0E2E5] rounded-2xl rounded-tl-sm'
                }`}>
                {/* Text Content */}
                <p className="whitespace-pre-wrap leading-relaxed font-normal">{msg.content}</p>

                {/* GMP Advice Block */}
                {msg.metadata?.gmpAdvice && (
                    <div className="mt-4 p-3 bg-teal-50 border border-teal-100 rounded-xl">
                        <div className="flex items-center text-teal-700 mb-2">
                            <span className="material-symbols-outlined text-[18px] mr-1">verified_user</span>
                            <span className="font-medium text-xs">GMP 合规性提示</span>
                        </div>
                        <p className="text-xs text-teal-800 leading-relaxed">{msg.metadata.gmpAdvice}</p>
                    </div>
                )}

                {/* Proposed Changes / New Tasks Action Card */}
                {((msg.metadata?.proposedChanges && msg.metadata.proposedChanges.length > 0) || (msg.metadata?.newTasks && msg.metadata.newTasks.length > 0)) && (
                    <div className="mt-4 p-0 bg-white border border-[#E0E2E5] rounded-xl overflow-hidden shadow-sm">
                        <div className="p-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                            <div className="flex items-center text-amber-800">
                                <span className="material-symbols-outlined text-[18px] mr-1">warning</span>
                                <span className="text-xs font-bold">进度变更建议</span>
                            </div>
                            <span className="text-[10px] bg-white text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                                共 {(msg.metadata.proposedChanges?.length || 0) + (msg.metadata.newTasks?.length || 0)} 项
                            </span>
                        </div>
                        <div className="p-3 space-y-2">
                            {/* New Tasks List */}
                            {msg.metadata.newTasks?.map((task, idx) => (
                                <div key={`new-${idx}`} className="text-xs text-[#5F6368] bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                                    <div className="flex items-center mb-1">
                                    <span className="material-symbols-outlined text-[14px] text-indigo-600 mr-1">add_circle</span>
                                    <span className="font-bold text-indigo-700 block">{task.name}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-1 pl-5">
                                        <span className="text-[#5F6368]">{task.startDate}</span>
                                        <span className="material-symbols-outlined text-[14px] text-[#5F6368]">arrow_right_alt</span>
                                        <span className="text-[#5F6368]">{task.endDate}</span>
                                    </div>
                                    <div className="text-[10px] text-indigo-500 mt-2 pt-2 border-t border-indigo-200 pl-5">
                                    {task.reason || "AI 自动生成"}
                                    </div>
                                </div>
                            ))}

                            {/* Modified Tasks List */}
                            {msg.metadata.proposedChanges?.map((change, idx) => (
                                <div key={`mod-${idx}`} className="text-xs text-[#5F6368] bg-[#F8F9FA] p-2 rounded-lg border border-[#E0E2E5]">
                                    <span className="font-bold block text-[#1F1F1F] mb-1">{change.taskName || change.taskId} (调整)</span>
                                    
                                    {/* Date Change */}
                                    {change.originalEndDate !== change.newEndDate && (
                                        <div className="flex justify-between items-center mt-1">
                                            <span className="text-red-400 line-through opacity-70 decoration-2">{change.originalEndDate}</span>
                                            <span className="material-symbols-outlined text-[14px] text-[#5F6368]">arrow_right_alt</span>
                                            <span className="text-emerald-600 font-bold bg-emerald-50 px-1 rounded">{change.newEndDate}</span>
                                        </div>
                                    )}

                                    {/* Assignee Change */}
                                    {change.newAssignee && change.newAssignee !== change.originalAssignee && (
                                        <div className="flex justify-between items-center mt-1">
                                            <div className="flex items-center gap-1 text-red-400 opacity-70">
                                                <span className="material-symbols-outlined text-[14px]">person</span>
                                                <span className="line-through decoration-2">{change.originalAssignee}</span>
                                            </div>
                                            <span className="material-symbols-outlined text-[14px] text-[#5F6368]">arrow_right_alt</span>
                                            <div className="flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-1 rounded">
                                                <span className="material-symbols-outlined text-[14px]">person</span>
                                                <span>{change.newAssignee}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="text-[10px] text-[#5F6368] mt-2 pt-2 border-t border-slate-100">{change.reason}</div>
                                </div>
                            ))}
                        </div>
                        <div className="flex border-t border-[#E0E2E5] divide-x divide-[#E0E2E5]">
                            {canApplyChanges ? (
                                <>
                                    <button 
                                        onClick={() => onConfirmChanges(msg.metadata!.proposedChanges || [], msg.metadata!.newTasks || [])}
                                        className="flex-1 bg-white hover:bg-[#F8F9FA] text-indigo-600 text-xs py-3 font-medium transition-colors"
                                    >
                                        确认变更
                                    </button>
                                    <button 
                                        onClick={onRejectChanges}
                                        className="flex-1 bg-white hover:bg-[#F8F9FA] text-[#5F6368] text-xs py-3 font-medium transition-colors"
                                    >
                                        放弃
                                    </button>
                                </>
                            ) : (
                                <div className="w-full text-center text-[10px] text-[#9AA0A6] py-3 bg-[#F8F9FA] flex items-center justify-center gap-1">
                                    <span className="material-symbols-outlined text-[12px]">lock</span>
                                    观察员权限无法应用变更
                                </div>
                            )}
                        </div>
                    </div>
                )}
                </div>
            </div>
            ))}
            {isLoading && (
                <div className="flex justify-start">
                    <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm border border-[#E0E2E5] shadow-sm flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-[#9AA0A6] rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-[#9AA0A6] rounded-full animate-bounce delay-75"></div>
                        <div className="w-1.5 h-1.5 bg-[#9AA0A6] rounded-full animate-bounce delay-150"></div>
                    </div>
                </div>
            )}
        </div>
      )}

      {/* Input Area - Always visible */}
      {/* 
          Collapsed State Alignment:
          Total Height: 92px.
          Internal Layout:
            - Top Row (Label): h-10 (40px). Aligns with Gantt Zoom/View.
            - Gap: 12px (Automatic via justify-between). Aligns with Gantt Gap.
            - Bottom Row (Input): h-10 (40px). Aligns with Gantt Legend.
          Padding: px-4 (16px) to keep input from touching card corners. py-0 to ensure exact 92px height alignment.
          
          Note: Border/Shadow/Radius are handled by the parent container in App.tsx.
      */}
      <div 
        className={`transition-all duration-300 w-full ${
            isExpanded 
            ? 'p-4 bg-white border-t border-[#E0E2E5]' 
            : 'h-[92px] flex flex-col justify-between px-4 py-0'
        }`}
      >
          {!isExpanded ? (
            // Collapsed Layout
            <>
                <div 
                    className="h-10 shrink-0 flex items-center text-indigo-600 cursor-pointer hover:bg-indigo-50 rounded-full transition-colors -ml-2 px-2 w-fit"
                    onClick={onExpand}
                >
                    <span className="material-symbols-outlined text-[20px] mr-2">smart_toy</span>
                    <span className="font-bold text-sm">指挥中心</span>
                </div>
                
                <form onSubmit={handleSend} className="h-10 shrink-0 flex items-center bg-[#F1F3F4] rounded-full px-1.5 focus-within:ring-2 focus-within:ring-indigo-100 transition-shadow">
                     <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onFocus={onExpand}
                        placeholder="输入进展..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-3 text-[#1F1F1F] placeholder-[#9AA0A6] h-full"
                     />
                     <button 
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shrink-0"
                     >
                        <span className="material-symbols-outlined text-[16px]">send</span>
                     </button>
                </form>
            </>
          ) : (
            // Expanded Layout
            <>
                <form onSubmit={handleSend} className="relative flex items-end gap-2">
                    <div className="relative flex-1">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onFocus={onExpand}
                            onKeyDown={(e) => {
                                if(e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend(e);
                                }
                            }}
                            placeholder="输入项目进展..."
                            className="w-full text-sm text-[#1F1F1F] placeholder-[#9AA0A6] outline-none resize-none transition-all pl-4 pr-4 py-3 rounded-3xl border border-[#E0E2E5] bg-[#F8F9FA] focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 h-12 min-h-[48px] max-h-32 leading-normal shadow-sm"
                        />
                    </div>
                    <button 
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:bg-[#E0E2E5] text-white rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 active:shadow-sm h-12 w-12"
                    >
                        <span className="material-symbols-outlined">send</span>
                    </button>
                </form>
                <p className="text-[10px] text-[#9AA0A6] text-center mt-3">
                    AI 可能会犯错，请务必人工核实关键 GMP 节点。
                </p>
            </>
          )}
      </div>
    </div>
  );
};

export default ChatInterface;