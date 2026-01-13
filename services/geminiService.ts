import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from '../constants';
import { Task, GeminiResponseSchema, RiskLevel, AIConfig, AI_PROVIDERS_CONFIG } from '../types';

export const analyzeProjectUpdate = async (
  currentTasks: Task[],
  userMessage: string,
  aiConfig: AIConfig
): Promise<GeminiResponseSchema> => {
  const { provider, apiKey, model, baseUrl } = aiConfig;
  
  if (!apiKey) {
    throw new Error("请在系统设置中配置 API Key。");
  }

  // Contextualize the prompt with current project state
  const taskContext = currentTasks.map(t => 
    `ID: ${t.id}, Name: ${t.name}, Start: ${t.startDate}, End: ${t.endDate}, Assignee: ${t.assignee}, Dependencies: [${t.dependencies.join(', ')}]`
  ).join('\n');

  const prompt = `
    Current Project State:
    ${taskContext}

    User Update:
    "${userMessage}"

    Analyze the impact of this update on the schedule and task details. 
    1. Calculate specific new dates for affected tasks based on dependencies.
       CRITICAL: You MUST propagate delays to ALL downstream dependent tasks. 
       If Task A moves, and Task B depends on Task A, Task B MUST also move. 
       Do not leave dependent tasks with start dates before their predecessors' end dates.
    2. If the user wants to change assignees, include 'new_assignee' in affected_tasks.
    3. If the user requests adding new tasks, define them in 'created_tasks'.
    4. Provide GMP advice if applicable.
    
    IMPORTANT: Respond in Chinese (Simplified).
    ${provider !== 'google' ? 'IMPORTANT: You MUST return a VALID JSON object matching the requested schema. Do not wrap in markdown code blocks.' : ''}
  `;

  // --- Logic for Google Gemini SDK ---
  if (provider === 'google') {
      const ai = new GoogleGenAI({ apiKey });
      try {
        const response = await ai.models.generateContent({
          model: model || 'gemini-3-flash-preview',
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                affected_tasks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      task_id: { type: Type.STRING },
                      new_start_date: { type: Type.STRING, description: "YYYY-MM-DD" },
                      new_end_date: { type: Type.STRING, description: "YYYY-MM-DD" },
                      new_assignee: { type: Type.STRING, nullable: true, description: "New assignee name if changed" },
                      reason: { type: Type.STRING, description: "Reason in Chinese" }
                    },
                    required: ["task_id", "new_start_date", "new_end_date", "reason"]
                  }
                },
                created_tasks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      start_date: { type: Type.STRING, description: "YYYY-MM-DD" },
                      end_date: { type: Type.STRING, description: "YYYY-MM-DD" },
                      reason: { type: Type.STRING, description: "Reason for adding this task" },
                      assignee: { type: Type.STRING, nullable: true },
                      gmp_critical: { type: Type.BOOLEAN, nullable: true },
                      category: { type: Type.STRING, nullable: true }
                    },
                    required: ["name", "start_date", "end_date", "reason"]
                  }
                },
                gmp_advice: { type: Type.STRING, description: "Advice in Chinese" },
                overall_risk: { type: Type.STRING, enum: [RiskLevel.Low, RiskLevel.Medium, RiskLevel.High, RiskLevel.Critical] },
                response_text: { type: Type.STRING, description: "Response to user in Chinese" }
              },
              required: ["affected_tasks", "gmp_advice", "overall_risk", "response_text"]
            }
          }
        });

        const text = response.text;
        if (!text) throw new Error("No response from AI");
        return JSON.parse(text) as GeminiResponseSchema;
      } catch (error) {
        console.error("Gemini API Error:", error);
        throw error;
      }
  } 
  
  // --- Logic for OpenAI Compatible Endpoints (DeepSeek, Moonshot, GLM, etc.) ---
  else {
      const effectiveBaseUrl = baseUrl || AI_PROVIDERS_CONFIG[provider].defaultBaseUrl;
      const effectiveModel = model || AI_PROVIDERS_CONFIG[provider].defaultModel;

      if (!effectiveBaseUrl) throw new Error("Base URL is missing for custom provider.");

      // OpenAI-compatible JSON Schema enforcement via prompt is clearer for these models
      // We append the schema to the system prompt for better adherence
      const jsonSchemaPrompt = `
      Output ONLY a JSON object with this schema:
      {
          "affected_tasks": [{"task_id": string, "new_start_date": "YYYY-MM-DD", "new_end_date": "YYYY-MM-DD", "new_assignee": string|null, "reason": string}],
          "created_tasks": [{"name": string, "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "reason": string, "assignee": string|null, "gmp_critical": boolean, "category": string}],
          "gmp_advice": string,
          "overall_risk": "Low" | "Medium" | "High" | "Critical",
          "response_text": string
      }
      `;

      try {
          const response = await fetch(`${effectiveBaseUrl}/chat/completions`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                  model: effectiveModel,
                  messages: [
                      { role: 'system', content: SYSTEM_INSTRUCTION + "\n" + jsonSchemaPrompt },
                      { role: 'user', content: prompt }
                  ],
                  temperature: 0.1, // Low temperature for consistent JSON
                  response_format: { type: "json_object" } // Use if supported, otherwise prompt handles it
              })
          });

          if (!response.ok) {
              const err = await response.text();
              throw new Error(`API Error ${response.status}: ${err}`);
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          
          if (!content) throw new Error("Empty response from AI Provider");
          
          // Clean markdown code blocks if present (some models still wrap JSON)
          const cleanedContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
          
          return JSON.parse(cleanedContent) as GeminiResponseSchema;

      } catch (error) {
          console.error(`${provider} API Error:`, error);
          throw new Error(`${provider} 调用失败: ${(error as Error).message}`);
      }
  }
};
