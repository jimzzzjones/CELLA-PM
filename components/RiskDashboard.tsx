import React from 'react';
import { RiskLevel } from '../types';

interface RiskDashboardProps {
  level: RiskLevel;
  onClick?: () => void;
}

const RiskDashboard: React.FC<RiskDashboardProps> = ({ level, onClick }) => {
  const getStyles = (lvl: RiskLevel) => {
    switch (lvl) {
      case RiskLevel.Low: return 'bg-[#E6F4EA] text-[#137333] border-[#CEEAD6] hover:bg-[#D6EBD0]';
      case RiskLevel.Medium: return 'bg-[#FEF7E0] text-[#B06000] border-[#FEEFC3] hover:bg-[#FCEFC0]';
      case RiskLevel.High: return 'bg-[#FCE8E6] text-[#C5221F] border-[#FAD2CF] hover:bg-[#F9D5D2]';
      case RiskLevel.Critical: return 'bg-[#C5221F] text-white border-[#C5221F] animate-pulse hover:opacity-90';
      default: return 'bg-[#F1F3F4] text-[#5F6368] border-[#E0E2E5]';
    }
  };

  const getLabel = (lvl: RiskLevel) => {
    switch (lvl) {
      case RiskLevel.Low: return '合规';
      case RiskLevel.Medium: return '需关注';
      case RiskLevel.High: return '风险';
      case RiskLevel.Critical: return '违规';
      default: return '未知';
    }
  };

  const getIcon = (lvl: RiskLevel) => {
     switch (lvl) {
      case RiskLevel.Low: return 'check_circle';
      case RiskLevel.Medium: return 'info';
      case RiskLevel.High: return 'warning';
      case RiskLevel.Critical: return 'dangerous';
      default: return 'help';
    }
  };

  return (
    <button 
      onClick={onClick}
      className={`flex items-center px-3 py-1.5 rounded-lg border ${getStyles(level)} transition-colors cursor-pointer group`}
    >
      <span className="material-symbols-outlined text-lg mr-2 leading-none group-hover:scale-110 transition-transform">
        {getIcon(level)}
      </span>
      <div className="flex flex-col items-start">
          <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 leading-tight">合规风险</span>
          <span className="text-sm font-bold leading-tight">{getLabel(level)}</span>
      </div>
    </button>
  );
};

export default RiskDashboard;