
export enum TaskStatus {
  Pending = "Pending",
  InProgress = "In Progress",
  Completed = "Completed",
  Blocked = "Blocked",
  Delayed = "Delayed"
}

export enum RiskLevel {
  Low = "Low",
  Medium = "Medium",
  High = "High",
  Critical = "Critical"
}

export enum ScenarioType {
  Facility = "Facility Construction",
  Equipment = "Equipment Validation",
  TechTransfer = "Tech Transfer"
}

export enum UserRole {
  Admin = "Admin", // 管理员 (e.g., Site Head, QA Director) - Can manage projects
  ProjectManager = "Project Manager", // 项目经理 (e.g., Project Lead) - Can edit tasks
  Observer = "Observer" // 观察员 (e.g., Auditor, Stakeholder) - Read only
}

export interface User {
  id: string;
  name: string;
  account?: string; // Login Account
  password?: string; // Login Password
  role: UserRole;
  avatar?: string;
  visibleProjectIds?: string[]; // IDs of projects user can see
}

export type ViewMode = 'Day' | 'Week' | 'Month' | 'Quarter';

export interface Task {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  duration: number; // days
  status: TaskStatus;
  assignee: string;
  progress: number; // 0-100
  dependencies: string[]; // array of Task IDs
  gmpCritical: boolean; // Is this a GMP critical step?
  category: string; // e.g., "Construction", "IQ", "OQ", "PQ"
  isNew?: boolean; // Flag for UI visualization of proposed new tasks
  reason?: string; // Reason for creation
}

export interface Project {
  id: string;
  name: string;
  type: ScenarioType;
  riskLevel: RiskLevel;
  tasks: Task[];
  latestGmpAdvice?: string; // Latest AI advice stored for the project
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    proposedChanges?: ProposedChange[];
    newTasks?: Task[];
    gmpAdvice?: string;
    riskAssessment?: RiskLevel;
  };
}

export interface ProposedChange {
  taskId: string;
  taskName?: string;
  originalStartDate?: string;
  originalEndDate?: string;
  newStartDate: string;
  newEndDate: string;
  originalAssignee?: string;
  newAssignee?: string;
  reason: string;
}

export interface GeminiResponseSchema {
  affected_tasks: {
    task_id: string;
    new_start_date: string;
    new_end_date: string;
    new_assignee?: string;
    reason: string;
  }[];
  created_tasks?: {
    name: string;
    start_date: string;
    end_date: string;
    reason: string;
    assignee?: string;
    gmp_critical?: boolean;
    category?: string;
  }[];
  gmp_advice: string;
  overall_risk: RiskLevel;
  response_text: string;
}

// --- AI Configuration Types ---

export type AIProvider = 'google' | 'deepseek' | 'moonshot' | 'zhipu' | 'qwen' | 'openai';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string; // Optional override
}

export const AI_PROVIDERS_CONFIG: Record<AIProvider, { name: string; defaultModel: string; defaultBaseUrl?: string }> = {
  google: { name: "Google Gemini", defaultModel: "gemini-2.0-flash" },
  deepseek: { name: "DeepSeek (深度求索)", defaultModel: "deepseek-chat", defaultBaseUrl: "https://api.deepseek.com/v1" },
  moonshot: { name: "Moonshot (Kimi)", defaultModel: "moonshot-v1-8k", defaultBaseUrl: "https://api.moonshot.cn/v1" },
  zhipu: { name: "Zhipu AI (智谱GLM)", defaultModel: "glm-4", defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4/" },
  qwen: { name: "Aliyun Qwen (通义千问)", defaultModel: "qwen-turbo", defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  openai: { name: "OpenAI Compatible", defaultModel: "gpt-4o", defaultBaseUrl: "" }
};
