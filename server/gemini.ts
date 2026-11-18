import { GoogleGenAI, Type } from '@google/genai';
import type {
  AIReport,
  PatientProfile,
  SafetyEvent,
  TrainingPlan,
  TrainingSession,
} from '../src/types.ts';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY 未配置，请在 Settings > Secrets 中设置后重试 AI 分析报告生成。',
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const CLINICAL_BOUNDARY_INSTRUCTION = `你是 SenseRehab 多感官康复辅助训练系统的 AI 分析辅助模块，仅面向专业康复师生成“阶段性训练分析报告草稿”或“受限方案调整建议”。
你必须严格遵守以下安全与专业边界：
1. 严禁诊断焦虑症、抑郁症或任何心理/精神疾病。
2. 严禁承诺或宣称任何临床疗效（训练完成率、主观舒适度与前后自评变化仅用于描述性对照，不得表述为临床改善或因果关系）。
3. 必须明确区分：客观 VR 交互行为记录、患者主观自评反馈、康复师专业评估、以及 AI 描述性观察。
4. 必须主动指出样本量有限、设备熟悉度、疲劳度或 Web 模拟环境等不确定性与数据限制。
5. 所有建议均不得超出当前康复师设定的任务与安全范围，必须标注“待康复师人工审核确认”。
请使用严谨、克制、专业、客观的简体中文撰写。`;

export async function generateStageReportDraft(params: {
  patient: PatientProfile;
  plan?: TrainingPlan;
  sessions: TrainingSession[];
  safetyEvents: SafetyEvent[];
}): Promise<{
  sections: AIReport['sections'];
  adjustmentProposal: AIReport['adjustmentProposal'];
}> {
  const ai = getGeminiClient();

  const promptPayload = {
    patientCode: params.patient.patientCode,
    focusArea: params.patient.focusArea,
    riskTier: params.patient.riskTier,
    riskNote: params.patient.riskNote,
    scaleAssessmentNote: params.patient.scaleAssessmentNote,
    currentPlan: params.plan
      ? {
          id: params.plan.id,
          version: params.plan.version,
          goal: params.plan.goal,
          scene: params.plan.scene,
          allowedTasks: params.plan.allowedTasks,
          supervisionMode: params.plan.supervisionMode,
          sensoryConfig: params.plan.sensoryConfig,
        }
      : null,
    sessions: params.sessions.map((s) => ({
      id: s.id,
      scene: s.scene,
      mode: s.mode,
      status: s.status,
      startedAt: s.startedAt,
      elapsedSeconds: s.elapsedSeconds,
      pauseCount: s.pauseCount,
      hardwareSnapshot: s.hardwareSnapshot,
      preFeedback: s.preFeedback,
      postFeedback: s.postFeedback ?? null,
      taskLogs: s.taskLogs,
      exitReason: s.exitReason ?? null,
    })),
    safetyEvents: params.safetyEvents.map((e) => ({
      severity: e.severity,
      eventType: e.eventType,
      description: e.description,
      resolvedStatus: e.resolvedStatus,
    })),
  };

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `请基于以下脱敏训练档案数据，生成面向康复师审核的 8 区块阶段性训练分析报告草稿及受限调整建议：\n${JSON.stringify(promptPayload, null, 2)}`,
    config: {
      systemInstruction: CLINICAL_BOUNDARY_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sections: {
            type: Type.OBJECT,
            properties: {
              basicInfo: { type: Type.STRING },
              trainingOverview: { type: Type.STRING },
              behavioralPerformance: { type: Type.STRING },
              subjectiveFeedback: { type: Type.STRING },
              multisensoryAdaptation: { type: Type.STRING },
              aiObservations: { type: Type.STRING },
              professionalReview: { type: Type.STRING },
              dataLimitations: { type: Type.STRING },
            },
            required: [
              'basicInfo',
              'trainingOverview',
              'behavioralPerformance',
              'subjectiveFeedback',
              'multisensoryAdaptation',
              'aiObservations',
              'professionalReview',
              'dataLimitations',
            ],
          },
          adjustmentProposal: {
            type: Type.OBJECT,
            properties: {
              suggestedScene: { type: Type.STRING, enum: ['forest', 'stream'] },
              suggestedTasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                  enum: ['A_BASIC', 'B_AUDITORY', 'C_OLFACTORY', 'D_COMPREHENSIVE'],
                },
              },
              suggestedAudioMaxVolume: { type: Type.INTEGER },
              suggestedOlfactoryEnabled: { type: Type.BOOLEAN },
              rationale: { type: Type.STRING },
              uncertaintyNote: { type: Type.STRING },
            },
            required: [
              'suggestedScene',
              'suggestedTasks',
              'suggestedAudioMaxVolume',
              'suggestedOlfactoryEnabled',
              'rationale',
              'uncertaintyNote',
            ],
          },
        },
        required: ['sections', 'adjustmentProposal'],
      },
    },
  });

  const text = (response.text ?? '').trim();
  if (!text) {
    throw new Error('Gemini 模型返回为空，未能生成报告草稿。');
  }
  const parsed = JSON.parse(text) as {
    sections: AIReport['sections'];
    adjustmentProposal: Omit<AIReport['adjustmentProposal'], 'appliedByTherapist'>;
  };

  const allowedTaskSet = new Set(
    params.plan?.allowedTasks ?? ['A_BASIC', 'B_AUDITORY'],
  );
  const constrainedTasks = parsed.adjustmentProposal.suggestedTasks.filter((t) =>
    allowedTaskSet.has(t),
  );

  return {
    sections: parsed.sections,
    adjustmentProposal: {
      ...parsed.adjustmentProposal,
      suggestedTasks: constrainedTasks.length > 0 ? constrainedTasks : ['A_BASIC'],
      suggestedAudioMaxVolume: Math.min(
        Math.max(parsed.adjustmentProposal.suggestedAudioMaxVolume, 20),
        params.plan?.sensoryConfig.maxVolumePercent ?? 70,
      ),
      suggestedOlfactoryEnabled:
        (params.plan?.sensoryConfig.olfactoryEnabled ?? false) &&
        parsed.adjustmentProposal.suggestedOlfactoryEnabled,
      appliedByTherapist: false,
    },
  };
}

export async function generatePlanRecommendation(params: {
  patient: PatientProfile;
  plan?: TrainingPlan;
  recentSessions: TrainingSession[];
}): Promise<{
  recommendedScene: 'forest' | 'stream';
  recommendedPrimaryMode: 'A_BASIC' | 'B_AUDITORY' | 'C_OLFACTORY' | 'D_COMPREHENSIVE';
  recommendedMaxVolume: number;
  reasoning: string;
  cautionNote: string;
}> {
  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `请根据患者授权范围与近期训练记录，提出保守、可解释的下一次训练辅助推荐（不可越权提升刺激或延长时长）：\n${JSON.stringify({
      patientCode: params.patient.patientCode,
      riskTier: params.patient.riskTier,
      riskNote: params.patient.riskNote,
      allowedTasks: params.plan?.allowedTasks ?? ['A_BASIC', 'B_AUDITORY'],
      maxVolumeCap: params.plan?.sensoryConfig.maxVolumePercent ?? 65,
      olfactoryAllowed: params.plan?.sensoryConfig.olfactoryEnabled ?? false,
      recentSessions: params.recentSessions.slice(0, 3).map((s) => ({
        scene: s.scene,
        mode: s.mode,
        status: s.status,
        pauseCount: s.pauseCount,
        postFeedback: s.postFeedback ?? null,
      })),
    })}`,
    config: {
      systemInstruction: CLINICAL_BOUNDARY_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          recommendedScene: { type: Type.STRING, enum: ['forest', 'stream'] },
          recommendedPrimaryMode: {
            type: Type.STRING,
            enum: ['A_BASIC', 'B_AUDITORY', 'C_OLFACTORY', 'D_COMPREHENSIVE'],
          },
          recommendedMaxVolume: { type: Type.INTEGER },
          reasoning: { type: Type.STRING },
          cautionNote: { type: Type.STRING },
        },
        required: [
          'recommendedScene',
          'recommendedPrimaryMode',
          'recommendedMaxVolume',
          'reasoning',
          'cautionNote',
        ],
      },
    },
  });

  const text = (response.text ?? '').trim();
  if (!text) {
    throw new Error('Gemini 模型返回为空，未能生成推荐建议。');
  }
  return JSON.parse(text);
}
