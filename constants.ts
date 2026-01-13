import { Project, RiskLevel, ScenarioType, TaskStatus } from './types';

export const INITIAL_SCENARIOS: Record<string, Project> = {
  equipment: {
    id: "proj_001",
    name: "生物反应器与离心机验证 (3号线)",
    type: ScenarioType.Equipment,
    riskLevel: RiskLevel.Low,
    tasks: [
      {
        id: "t1",
        name: "URS (用户需求说明书) 签署",
        startDate: "2023-10-01",
        endDate: "2023-10-05",
        duration: 5,
        status: TaskStatus.Completed,
        assignee: "陈博士",
        progress: 100,
        dependencies: [],
        gmpCritical: true,
        category: "Planning"
      },
      {
        id: "t2",
        name: "供应商选型与审计",
        startDate: "2023-10-06",
        endDate: "2023-10-20",
        duration: 14,
        status: TaskStatus.Completed,
        assignee: "供应链部",
        progress: 100,
        dependencies: ["t1"],
        gmpCritical: true,
        category: "Procurement"
      },
      {
        id: "t3",
        name: "设备到货 (离心机)",
        startDate: "2023-10-21",
        endDate: "2023-10-25",
        duration: 5,
        status: TaskStatus.InProgress,
        assignee: "物流部",
        progress: 50,
        dependencies: ["t2"],
        gmpCritical: false,
        category: "Logistics"
      },
      {
        id: "t4",
        name: "安装确认 (IQ)",
        startDate: "2023-10-26",
        endDate: "2023-10-30",
        duration: 5,
        status: TaskStatus.Pending,
        assignee: "QA 团队",
        progress: 0,
        dependencies: ["t3"],
        gmpCritical: true,
        category: "Validation"
      },
      {
        id: "t5",
        name: "运行确认 (OQ)",
        startDate: "2023-11-02",
        endDate: "2023-11-10",
        duration: 9,
        status: TaskStatus.Pending,
        assignee: "验证工程师",
        progress: 0,
        dependencies: ["t4"],
        gmpCritical: true,
        category: "Validation"
      },
      {
        id: "t6",
        name: "性能确认 (PQ)",
        startDate: "2023-11-12",
        endDate: "2023-11-20",
        duration: 9,
        status: TaskStatus.Pending,
        assignee: "工艺开发部",
        progress: 0,
        dependencies: ["t5"],
        gmpCritical: true,
        category: "Validation"
      }
    ],
    latestGmpAdvice: "当前项目进度符合预期。请重点关注即将开始的 IQ (安装确认) 环节，确保相关 QA 文档已准备就绪。"
  }
};

export const SYSTEM_INSTRUCTION = `
You are "CELLA", a specialized project management AI for the Cell & Gene Therapy industry.
Your goal is to assist biological experts in managing complex GMP-compliant projects (Facility Construction, Equipment 3Q, Tech Transfer).

Capabilities:
1. Parse natural language updates about project progress.
2. Calculate impact on dependent tasks (cascade effects).
3. Identify when new tasks need to be added to the schedule based on the user's input.
4. Provide GMP compliance advice (e.g., IQ must finish before OQ, URS must be signed).
5. Output structured JSON.

Rules:
- If a task is delayed, automatically shift dependent tasks.
- If the user implies a NEW task should be added (e.g., "Add a training session after IQ"), include it in 'created_tasks'.
- If a GMP critical path is violated (e.g., skipping IQ), warn the user in 'gmp_advice'.
- Use the provided JSON schema for output.
- IMPORTANT: All text output (reason, gmp_advice, response_text) MUST be in Chinese (Simplified).
- Be concise in 'response_text'.
`;