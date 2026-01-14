import React, { useState, useEffect } from 'react';
import { AIConfig, AIProvider, AI_PROVIDERS_CONFIG } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // AI Config Props
  aiConfig: AIConfig;
  onUpdateAiConfig: (config: AIConfig) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  aiConfig,
  onUpdateAiConfig
}) => {
  // --- AI Config State ---
  const [tempAiConfig, setTempAiConfig] = useState<AIConfig>(aiConfig);

  useEffect(() => {
    if (isOpen) {
      setTempAiConfig(aiConfig); // Reset temp config when opening
    }
  }, [isOpen, aiConfig]);

  if (!isOpen) return null;

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
    onClose();
    // Visual feedback could be added here
    alert("AI 配置已保存");
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-[90vw] md:w-[600px] max-h-[90vh] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E0E2E5] flex items-center justify-between bg-[#F8F9FA] shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600">psychology</span>
            <h2 className="text-lg font-bold text-[#1F1F1F]">AI 大模型配置</h2>
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
            <div className="mb-6">
                <h4 className="text-sm font-bold text-[#1F1F1F] mb-1">模型提供商</h4>
                <p className="text-xs text-[#5F6368] mb-3">选择您希望使用的 AI 大模型服务。支持 Google Gemini 及兼容 OpenAI 接口的主流国产模型。</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    <p className="text-[10px] text-[#9AA0A6] mt-1">密钥仅存储在本地会话中，刷新后需重新输入。</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E0E2E5] bg-[#F8F9FA] flex justify-end gap-3">
             <button 
                onClick={onClose}
                className="px-4 py-2 border border-[#E0E2E5] hover:bg-[#E0E2E5] text-[#5F6368] rounded-lg text-sm font-medium transition-colors"
            >
                取消
            </button>
            <button 
                onClick={saveAiSettings}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
            >
                <span className="material-symbols-outlined text-[18px]">save</span>
                保存配置
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;