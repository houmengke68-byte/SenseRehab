import fs from 'node:fs';
import path from 'node:path';
import type {
  AIReport,
  AppMetricsSummary,
  AuditLogEntry,
  HardwareInventoryItem,
  PatientProfile,
  SafetyEvent,
  StaffAccount,
  TelemetryEvent,
  TrainingPlan,
  TrainingSession,
  UserRole,
  VerificationItem,
} from '../src/types.ts';

export interface StoreState {
  institutionName: string;
  staff: StaffAccount[];
  patients: PatientProfile[];
  plans: TrainingPlan[];
  sessions: TrainingSession[];
  safetyEvents: SafetyEvent[];
  telemetryEvents: TelemetryEvent[];
  reports: AIReport[];
  hardwareInventory: HardwareInventoryItem[];
  auditLogs: AuditLogEntry[];
  verificationItems: VerificationItem[];
}

export const store: StoreState = {
  institutionName: '康宁心身多感官康复中心',
  staff: [
    {
      id: 'TH-101',
      name: '周安（主任康复师）',
      role: 'therapist',
      department: '情绪障碍数字康复科',
      status: 'active',
    },
    {
      id: 'TH-102',
      name: '顾清（康复治疗师）',
      role: 'therapist',
      department: '感官整合训练室',
      status: 'active',
    },
    {
      id: 'AD-001',
      name: '王宁（机构运营管理员）',
      role: 'admin',
      department: '机构信息与设备运维部',
      status: 'active',
    },
  ],
  patients: [
    {
      patientCode: 'SR-P-2048',
      displayLabel: '林某 (SR-P-2048)',
      focusArea: '焦虑情绪调节辅助训练 · 首期适应阶段',
      assignedTherapistId: 'TH-101',
      assignedTherapistName: '周安（主任康复师）',
      riskTier: 'standard',
      riskNote: '对突发性高分贝声响较敏感，建议音量上限控制在 65% 以内；自主训练前需完成主观紧张度自评。',
      supervisionDefault: 'autonomous',
      scaleAssessmentNote: '康复师基线记录（2026-11-08 · 机构观察表 v2.1）：注意力集中时间中等，对自然森林声景接受度良好。',
      consentSigned: true,
      lastUpdated: '2026-11-17 16:20',
    },
    {
      patientCode: 'SR-P-2051',
      displayLabel: '陈某 (SR-P-2051)',
      focusArea: '抑郁情绪伴睡眠节律困扰 · 多感官唤醒训练',
      assignedTherapistId: 'TH-101',
      assignedTherapistName: '周安（主任康复师）',
      riskTier: 'elevated',
      riskNote: '近期主观疲劳感偏高，已设为须康复师现场监督（therapist_supervised）；如遇气味或视觉不适立即暂停。',
      supervisionDefault: 'therapist_supervised',
      scaleAssessmentNote: '康复师基线记录（2026-11-12 · 机构观察表 v2.1）：需温和过渡引导，建议先从 A 基础体验逐步进入 B 听觉任务。',
      consentSigned: true,
      lastUpdated: '2026-11-18 09:05',
    },
    {
      patientCode: 'SR-P-2055',
      displayLabel: '赵某 (SR-P-2055)',
      focusArea: '慢性紧张状态放松训练 · 溪流声景探索',
      assignedTherapistId: 'TH-102',
      assignedTherapistName: '顾清（康复治疗师）',
      riskTier: 'standard',
      riskNote: '无已知气味过敏史；可选气味扩展模块需在设备就绪且本人同意后开启。',
      supervisionDefault: 'autonomous',
      scaleAssessmentNote: '康复师基线记录（2026-11-14 · 机构观察表 v2.1）：偏爱流水声层次辨识任务，操作依从性稳定。',
      consentSigned: true,
      lastUpdated: '2026-11-16 14:40',
    },
  ],
  plans: [
    {
      id: 'PLAN-2048-03',
      version: 3,
      patientCode: 'SR-P-2048',
      therapistId: 'TH-101',
      therapistName: '周安（主任康复师）',
      goal: '在可控自然森林视觉与舒缓声音环境中维持平稳注意力，探索听觉声音层次辨识耐受度。',
      scene: 'forest',
      allowedTasks: ['A_BASIC', 'B_AUDITORY', 'C_OLFACTORY', 'D_COMPREHENSIVE'],
      primaryMode: 'D_COMPREHENSIVE',
      durationNote: '时长规则 D：由康复师结合当次耐受度设定节奏，过程可随时暂停或跳过可选环节（不预设固定疗效时长）。',
      frequency: '每周 3 次 · 本阶段共 6 次',
      validFrom: '2026-11-10',
      validTo: '2026-11-28',
      supervisionMode: 'autonomous',
      sensoryConfig: {
        audioCategories: ['林间鸟鸣', '树叶沙沙', '微风声'],
        maxVolumePercent: 65,
        olfactoryEnabled: true,
        olfactoryProfile: '松木/草木类自然气息（可选模拟配置）',
        olfactoryNote: '无真实气味释放硬件时仅记录偏好与模拟反馈，严禁宣称实际气味输出。',
      },
      status: 'active',
      adjustmentHistory: [
        {
          version: 1,
          adjustedBy: '周安（主任康复师）',
          adjustedAt: '2026-11-10 10:00',
          reason: '初始建档：配置 A 基础体验 + 森林场景。',
        },
        {
          version: 2,
          adjustedBy: '周安（主任康复师）',
          adjustedAt: '2026-11-13 15:30',
          reason: '患者两次体验舒适度稳定，开放 B 听觉可选任务，音量上限设为 65%。',
        },
        {
          version: 3,
          adjustedBy: '周安（主任康复师）',
          adjustedAt: '2026-11-16 11:20',
          reason: '新增 D 多感官综合流程及可选 C 嗅觉模块授权（受硬件检测约束）。',
        },
      ],
    },
    {
      id: 'PLAN-2051-02',
      version: 2,
      patientCode: 'SR-P-2051',
      therapistId: 'TH-101',
      therapistName: '周安（主任康复师）',
      goal: '以溪流低负荷沉浸观察为主，配合康复师现场监督下的单层流水声关注练习，避免多刺激叠加负荷。',
      scene: 'stream',
      allowedTasks: ['A_BASIC', 'B_AUDITORY'],
      primaryMode: 'A_BASIC',
      durationNote: '时长规则 D：按现场监督评估与患者即时舒适反馈动态结束，不强制完成全部可选任务。',
      frequency: '每周 2 次 · 现场监督执行',
      validFrom: '2026-11-12',
      validTo: '2026-11-26',
      supervisionMode: 'therapist_supervised',
      sensoryConfig: {
        audioCategories: ['溪水潺潺', '微风声'],
        maxVolumePercent: 55,
        olfactoryEnabled: false,
        olfactoryProfile: '暂不启用',
        olfactoryNote: '当前阶段未授权嗅觉刺激，保持视觉与低强度听觉双通道。',
      },
      status: 'active',
      adjustmentHistory: [
        {
          version: 1,
          adjustedBy: '周安（主任康复师）',
          adjustedAt: '2026-11-12 09:30',
          reason: '设定溪流场景与 A 基础体验，明确现场监督要求。',
        },
        {
          version: 2,
          adjustedBy: '周安（主任康复师）',
          adjustedAt: '2026-11-15 16:10',
          reason: '补充 B 听觉可选任务供患者自主确认是否尝试，音量上限 55%。',
        },
      ],
    },
    {
      id: 'PLAN-2055-01',
      version: 1,
      patientCode: 'SR-P-2055',
      therapistId: 'TH-102',
      therapistName: '顾清（康复治疗师）',
      goal: '溪流场景自然声音辨识与注意力平稳切换训练。',
      scene: 'stream',
      allowedTasks: ['A_BASIC', 'B_AUDITORY', 'D_COMPREHENSIVE'],
      primaryMode: 'B_AUDITORY',
      durationNote: '时长规则 D：根据当次自评状态决定是否进入 B 任务延伸环节。',
      frequency: '每周 3 次',
      validFrom: '2026-11-14',
      validTo: '2026-11-30',
      supervisionMode: 'autonomous',
      sensoryConfig: {
        audioCategories: ['溪水潺潺', '远处鸟鸣', '微风声'],
        maxVolumePercent: 70,
        olfactoryEnabled: false,
        olfactoryProfile: '未启用',
        olfactoryNote: '本计划仅配置视觉与听觉模块。',
      },
      status: 'active',
      adjustmentHistory: [
        {
          version: 1,
          adjustedBy: '顾清（康复治疗师）',
          adjustedAt: '2026-11-14 10:15',
          reason: '初始方案创建并生效。',
        },
      ],
    },
  ],
  sessions: [
    {
      id: 'SES-20261114-01',
      planId: 'PLAN-2048-03',
      planVersion: 2,
      patientCode: 'SR-P-2048',
      therapistId: 'TH-101',
      scene: 'forest',
      mode: 'B_AUDITORY',
      status: 'completed',
      startedAt: '2026-11-14 10:12:00',
      endedAt: '2026-11-14 10:21:45',
      elapsedSeconds: 585,
      supervisionRequired: false,
      hardwareSnapshot: {
        vrStatus: 'ready',
        audioStatus: 'ready',
        olfactoryStatus: 'not_equipped',
        isWebSimulation: true,
      },
      preFeedback: {
        tensionScore: 7,
        comfortScore: 5,
        contraindicationConfirmed: true,
        note: '上午思绪偏紧绷，希望先听轻柔一些的自然声音。',
        scaleVersion: '自评体验量表 v1.0',
        submittedAt: '2026-11-14 10:11:10',
      },
      postFeedback: {
        tensionScore: 4,
        comfortScore: 8,
        overallExperienceScore: 8,
        preferredScene: 'forest',
        audioComfort: 'comfortable',
        audioDiscomfortFlag: false,
        olfactoryPreference: 'not_used',
        olfactoryDiscomfortFlag: false,
        openText: '鸟鸣和风声层次清楚，中途暂停调整过一次坐姿后感觉更轻松。',
        scaleVersion: '自评体验量表 v1.0',
        submittedAt: '2026-11-14 10:22:30',
      },
      taskLogs: [
        {
          taskType: 'A_BASIC',
          label: 'A 基础体验：林间自主探索',
          status: 'completed',
          durationSeconds: 310,
          detailNote: '在阳光林间路径区停留较久，操作平稳。',
        },
        {
          taskType: 'B_AUDITORY',
          label: 'B 听觉任务：自然声景辨识',
          status: 'completed',
          durationSeconds: 275,
          reactionTimeMs: 1840,
          accuracyPercent: 88,
          selectedOption: '林间鸟鸣 / 树叶沙沙',
          detailNote: '完成 4 轮声音层辨识，未触发跳过。',
        },
      ],
      pauseCount: 1,
    },
    {
      id: 'SES-20261116-02',
      planId: 'PLAN-2048-03',
      planVersion: 3,
      patientCode: 'SR-P-2048',
      therapistId: 'TH-101',
      scene: 'forest',
      mode: 'D_COMPREHENSIVE',
      status: 'completed',
      startedAt: '2026-11-16 14:30:00',
      endedAt: '2026-11-16 14:41:12',
      elapsedSeconds: 672,
      supervisionRequired: false,
      hardwareSnapshot: {
        vrStatus: 'ready',
        audioStatus: 'ready',
        olfactoryStatus: 'ready',
        isWebSimulation: true,
      },
      preFeedback: {
        tensionScore: 6,
        comfortScore: 6,
        contraindicationConfirmed: true,
        note: '状态尚可，愿意尝试综合流程。',
        scaleVersion: '自评体验量表 v1.0',
        submittedAt: '2026-11-16 14:29:05',
      },
      postFeedback: {
        tensionScore: 3,
        comfortScore: 8,
        overallExperienceScore: 9,
        preferredScene: 'forest',
        audioComfort: 'comfortable',
        audioDiscomfortFlag: false,
        olfactoryPreference: 'pleasant',
        olfactoryDiscomfortFlag: false,
        openText: '松木香型偏好选择过程简单，整体节奏舒适，没有压迫感。',
        scaleVersion: '自评体验量表 v1.0',
        submittedAt: '2026-11-16 14:42:00',
      },
      taskLogs: [
        {
          taskType: 'A_BASIC',
          label: 'A 基础体验：林间自主观察',
          status: 'completed',
          durationSeconds: 260,
          detailNote: '平稳完成环境适应。',
        },
        {
          taskType: 'B_AUDITORY',
          label: 'B 听觉任务：多声源聚焦',
          status: 'completed',
          durationSeconds: 242,
          reactionTimeMs: 1590,
          accuracyPercent: 92,
          selectedOption: '树叶沙沙',
          detailNote: '反应时较上次缩短，无错误提示。',
        },
        {
          taskType: 'C_OLFACTORY',
          label: 'C 嗅觉任务：气味偏好与耐受确认',
          status: 'completed',
          durationSeconds: 170,
          selectedOption: '松木清香（低强度）',
          detailNote: '设备模拟状态正常，患者反馈舒适无不适。',
        },
      ],
      pauseCount: 0,
    },
    {
      id: 'SES-20261117-03',
      planId: 'PLAN-2051-02',
      planVersion: 2,
      patientCode: 'SR-P-2051',
      therapistId: 'TH-101',
      scene: 'stream',
      mode: 'A_BASIC',
      status: 'voluntary_exit',
      startedAt: '2026-11-17 15:05:00',
      endedAt: '2026-11-17 15:10:20',
      elapsedSeconds: 320,
      supervisionRequired: true,
      supervisorConfirmedBy: '周安（主任康复师）',
      hardwareSnapshot: {
        vrStatus: 'ready',
        audioStatus: 'ready',
        olfactoryStatus: 'not_equipped',
        isWebSimulation: true,
      },
      preFeedback: {
        tensionScore: 8,
        comfortScore: 4,
        contraindicationConfirmed: true,
        note: '今日精力偏弱，现场监督已确认开始。',
        scaleVersion: '自评体验量表 v1.0',
        submittedAt: '2026-11-17 15:04:12',
      },
      postFeedback: {
        tensionScore: 7,
        comfortScore: 5,
        overallExperienceScore: 6,
        preferredScene: 'stream',
        audioComfort: 'too_loud',
        audioDiscomfortFlag: true,
        olfactoryPreference: 'not_used',
        olfactoryDiscomfortFlag: false,
        openText: '流水声连续听一会儿觉得有点吵，所以主动选择了退出休息。',
        scaleVersion: '自评体验量表 v1.0',
        submittedAt: '2026-11-17 15:11:05',
      },
      taskLogs: [
        {
          taskType: 'A_BASIC',
          label: 'A 基础体验：溪流畔观察',
          status: 'completed',
          durationSeconds: 280,
          detailNote: '中途连续暂停 2 次后自主结束。',
        },
        {
          taskType: 'B_AUDITORY',
          label: 'B 听觉任务：溪流声层次选择',
          status: 'skipped',
          durationSeconds: 40,
          detailNote: '患者反馈声音偏响，主动跳过并安全退出。',
        },
      ],
      pauseCount: 2,
      exitReason: '患者感到声音偏响并有轻度疲惫，使用自主退出按钮结束训练。',
    },
    {
      id: 'SES-20261116-04',
      planId: 'PLAN-2055-01',
      planVersion: 1,
      patientCode: 'SR-P-2055',
      therapistId: 'TH-102',
      scene: 'stream',
      mode: 'B_AUDITORY',
      status: 'completed',
      startedAt: '2026-11-16 11:00:00',
      endedAt: '2026-11-16 11:09:40',
      elapsedSeconds: 580,
      supervisionRequired: false,
      hardwareSnapshot: {
        vrStatus: 'ready',
        audioStatus: 'ready',
        olfactoryStatus: 'not_equipped',
        isWebSimulation: true,
      },
      preFeedback: {
        tensionScore: 5,
        comfortScore: 6,
        contraindicationConfirmed: true,
        note: '状态平稳。',
        scaleVersion: '自评体验量表 v1.0',
        submittedAt: '2026-11-16 10:59:10',
      },
      postFeedback: {
        tensionScore: 3,
        comfortScore: 8,
        overallExperienceScore: 8,
        preferredScene: 'stream',
        audioComfort: 'comfortable',
        audioDiscomfortFlag: false,
        olfactoryPreference: 'not_used',
        olfactoryDiscomfortFlag: false,
        openText: '流水与鸟鸣交替辨识感很好。',
        scaleVersion: '自评体验量表 v1.0',
        submittedAt: '2026-11-16 11:10:15',
      },
      taskLogs: [
        {
          taskType: 'A_BASIC',
          label: 'A 基础体验：溪流场景浏览',
          status: 'completed',
          durationSeconds: 240,
          detailNote: '平稳探索。',
        },
        {
          taskType: 'B_AUDITORY',
          label: 'B 听觉任务：流水与鸟鸣辨识',
          status: 'completed',
          durationSeconds: 340,
          reactionTimeMs: 1420,
          accuracyPercent: 94,
          selectedOption: '溪水潺潺 / 远处鸟鸣',
          detailNote: '完成全部声音辨识提示。',
        },
      ],
      pauseCount: 0,
    },
  ],
  safetyEvents: [
    {
      id: 'EVT-901',
      sessionId: 'SES-20261117-03',
      patientCode: 'SR-P-2051',
      severity: 'attention',
      eventType: '感官不适与连续暂停',
      description: '患者在溪流训练中连续暂停 2 次并反馈流水声偏响，随即主动退出。',
      systemAction: '自动降低音频输出并保存已产生记录，发送需关注提示至责任康复师。',
      therapistAction: '建议下次将音频上限下调至 40%，暂缓 B 听觉任务，保持现场监督。',
      resolvedStatus: 'open',
      timestamp: '2026-11-17 15:10:25',
    },
    {
      id: 'EVT-900',
      sessionId: 'SES-20261114-01',
      patientCode: 'SR-P-2048',
      severity: 'notice',
      eventType: '可选模块未配备降级',
      description: '训练前检测到气味释放设备未连接，系统按降级规则禁用 C 嗅觉任务。',
      systemAction: '已自动保留 A 基础体验与 B 听觉任务，过程未中断。',
      therapistAction: '已阅知设备状态正常降级。',
      resolvedStatus: 'resolved',
      timestamp: '2026-11-14 10:11:30',
      reviewedBy: '周安（主任康复师）',
    },
  ],
  telemetryEvents: [
    {
      id: 'TEL-01',
      eventName: 'training_start',
      patientCode: 'SR-P-2048',
      sessionId: 'SES-20261116-02',
      planId: 'PLAN-2048-03',
      timestamp: '2026-11-16 14:30:00',
      properties: { scene_id: 'forest', plan_version: 3, device_status: 'all_ready' },
    },
    {
      id: 'TEL-02',
      eventName: 'task_complete',
      patientCode: 'SR-P-2048',
      sessionId: 'SES-20261116-02',
      timestamp: '2026-11-16 14:38:22',
      properties: { task_type: 'B_AUDITORY', duration: 242, result_status: 'completed' },
    },
    {
      id: 'TEL-03',
      eventName: 'sensory_feedback',
      patientCode: 'SR-P-2051',
      sessionId: 'SES-20261117-03',
      timestamp: '2026-11-17 15:11:05',
      properties: { sensory_type: 'audio', preference: 'too_loud', discomfort_flag: true },
    },
  ],
  reports: [
    {
      id: 'REP-2048-01',
      patientCode: 'SR-P-2048',
      therapistId: 'TH-101',
      generatedAt: '2026-11-17 09:30:00',
      periodLabel: '2026-11-10 至 2026-11-17（第 1 阶段）',
      sessionCountIncluded: 2,
      status: 'pending_review',
      flaggedForAttention: false,
      sections: {
        basicInfo: '机构内患者标识：SR-P-2048｜统计周期：2026-11-10 至 2026-11-17｜纳入完整训练会话 2 次，关键字段完整率 100%。',
        trainingOverview: '本周期内共启动计划内训练 2 次（森林场景 2 次），均完整结束；实际累计时长 20 分 57 秒，平均单次 10 分 28 秒，无异常中止。',
        behavioralPerformance: 'A 基础体验均顺利完成；B 听觉可选任务平均正确率由 88% 提升至 92%，平均反应时由 1840ms 缩短至 1590ms。仅第 1 次训练期间自主暂停 1 次（调整坐姿）。',
        subjectiveFeedback: '依据“自评体验量表 v1.0”（描述性对照，非临床量表）：第 1 次训练后紧张度自评从 7 降至 4，舒适度从 5 升至 8；第 2 次训练后紧张度从 6 降至 3，整体体验评分 9/10。',
        multisensoryAdaptation: '偏好森林视觉环境与鸟鸣/树叶声景；第 2 次启用可选松木气味模拟偏好记录，反馈舒适且无不适标记。',
        aiObservations: '描述性观察：两次训练过程中交互反应速度与主观舒适度呈正向同步记录，暂未出现听觉或嗅觉耐受不良。\n不确定性说明：当前仅包含 2 次会话样本且包含 Web 模拟硬件记录，反应时变化可能受操作熟悉度影响，不可推断为临床症状改善。',
        professionalReview: '当前处于【待康复师审核】状态，尚未写入正式康复方案。需由责任康复师结合线下访谈与专业评估后给出审核意见。',
        dataLimitations: '本报告基于患者自评（自评体验量表 v1.0）、VR 交互日志及康复师基线记录生成。缺少真实气味硬件物理浓度数据；不构成心理状态诊断或临床疗效结论。',
      },
      adjustmentProposal: {
        suggestedScene: 'forest',
        suggestedTasks: ['A_BASIC', 'B_AUDITORY', 'C_OLFACTORY', 'D_COMPREHENSIVE'],
        suggestedAudioMaxVolume: 65,
        suggestedOlfactoryEnabled: true,
        rationale: '近两次森林声景与松木偏好反馈平稳，可维持当前多感官综合流程并允许患者探索溪流备选对比。',
        uncertaintyNote: '样本量为 2 次，建议在下次训练时复核音量 65% 上限是否仍舒适，须由康复师人工确认。',
        appliedByTherapist: false,
      },
    },
  ],
  hardwareInventory: [
    {
      id: 'HW-VR-01',
      name: 'VR 头显终端 #01（训练室 A）',
      moduleType: 'vr_headset',
      required: true,
      room: '多感官康复室 A',
      status: 'ready',
      firmwareOrSpec: 'Standalone 6DoF · SDK v2.4',
      lastCheckedAt: '2026-11-18 08:30',
      note: '必选核心视觉硬件，连接稳定。',
    },
    {
      id: 'HW-AUD-01',
      name: '定向开放式音频单元 #01',
      moduleType: 'audio_unit',
      required: true,
      room: '多感官康复室 A',
      status: 'ready',
      firmwareOrSpec: '空间双声道 · 硬件限幅 75dB',
      lastCheckedAt: '2026-11-18 08:30',
      note: '必选听觉硬件，支持独立一键静音。',
    },
    {
      id: 'HW-OLF-01',
      name: '模块化气味释放器（扩展槽位）',
      moduleType: 'olfactory_dispenser',
      required: false,
      room: '多感官康复室 A',
      status: 'not_equipped',
      firmwareOrSpec: '可选扩展模块（协议待试点标定）',
      lastCheckedAt: '2026-11-18 08:30',
      note: '首期可选配置；未配备时系统自动触发嗅觉任务降级策略。',
    },
    {
      id: 'HW-VR-02',
      name: 'VR 头显终端 #02（训练室 B）',
      moduleType: 'vr_headset',
      required: true,
      room: '多感官康复室 B',
      status: 'ready',
      firmwareOrSpec: 'Standalone 6DoF · SDK v2.4',
      lastCheckedAt: '2026-11-18 08:25',
      note: '供监督型训练使用。',
    },
  ],
  auditLogs: [
    {
      id: 'AUD-01',
      actorRole: 'therapist',
      actorName: '周安（主任康复师）',
      action: '更新训练计划',
      targetId: 'PLAN-2048-03',
      detail: '发布 v3 版本计划，开放 D 综合流程并限定音量上限 65%。',
      timestamp: '2026-11-16 11:20:00',
    },
    {
      id: 'AUD-02',
      actorRole: 'admin',
      actorName: '王宁（机构运营管理员）',
      action: '核验硬件清单',
      targetId: 'HW-OLF-01',
      detail: '确认气味扩展模块处于未配备状态，启用自动降级策略。',
      timestamp: '2026-11-18 08:30:00',
    },
  ],
  verificationItems: [
    {
      id: 'VER-A1',
      layer: 'A_EXPERIENCE',
      title: '患者端低负担流程与暂停/退出可达性',
      criteria: '受试者无需指导即可理解今日计划、完成前后同量尺自评，并在 1 次点击内暂停或独立关闭声音/气味。',
      status: 'passed',
      evidenceNote: '首轮原型可用性走查确认暂停、跳过与不适停止按钮均位于视口首层，未见操作阻塞。',
      updatedBy: '周安（主任康复师）',
      updatedAt: '2026-11-17 17:10',
    },
    {
      id: 'VER-A2',
      layer: 'A_EXPERIENCE',
      title: '训练时长规则 D 与任务脚本细化共创',
      criteria: '与康复师共同确认 A/B/C/D 具体指导语、B 听觉难度梯度及单次耐受时长上下限（不虚构固定疗效分钟数）。',
      status: 'needs_action',
      evidenceNote: '待临床共创会议补充各难度梯度声音素材边界与耐受提示语。',
      updatedBy: '周安（主任康复师）',
      updatedAt: '2026-11-18 08:40',
    },
    {
      id: 'VER-B1',
      layer: 'B_DATA',
      title: '核心埋点完整率与降级策略一致性核验',
      criteria: 'training_start、task_complete、sensory_feedback 与 safety_event 关键字段完整率 ≥ 95%，硬件缺失时不生成孤立异常记录。',
      status: 'passed',
      evidenceNote: '近期 4 次会话关键字段完整率 100%，未配备气味设备时已稳定记录 notice 降级事件。',
      updatedBy: '王宁（机构运营管理员）',
      updatedAt: '2026-11-18 08:50',
    },
    {
      id: 'VER-C1',
      layer: 'C_EXPERT',
      title: 'AI 报告非诊断边界与人工审核分离审查',
      criteria: '阶段性报告草稿明确区分客观记录、主观自评与 AI 观察；未经康复师审核确认不得变更有效计划。',
      status: 'passed',
      evidenceNote: '已核验服务端 Prompt 边界与前端人工审核门控，不存在自动诊断或擅自加量行为。',
      updatedBy: '周安（主任康复师）',
      updatedAt: '2026-11-17 18:00',
    },
    {
      id: 'VER-C2',
      layer: 'C_EXPERT',
      title: '嗅觉设备安全标准与风险分级处置 SOP 签字',
      criteria: '由机构专业团队审定气味材料过敏禁忌、强度阈值与高风险人工响应 SOP（非由软件自行定义）。',
      status: 'pending',
      evidenceNote: '待气味硬件供应商安全评审及伦理试点文件签署后再开放真实硬件接入。',
      updatedBy: '顾清（康复治疗师）',
      updatedAt: '2026-11-16 15:20',
    },
  ],
};

const PERSIST_PATH = path.resolve(process.cwd(), 'data', 'senserehab-store.json');

export function loadStoreFromDisk(): void {
  try {
    if (!fs.existsSync(PERSIST_PATH)) return;
    const raw = fs.readFileSync(PERSIST_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoreState>;
    if (parsed.patients && parsed.plans && parsed.sessions) {
      Object.assign(store, parsed);
    }
  } catch {
    // Keep default seed state if disk snapshot is unreadable
  }
}

export function persistStore(): void {
  try {
    const dir = path.dirname(PERSIST_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PERSIST_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch {
    // Non-fatal in read-only sandboxes
  }
}

loadStoreFromDisk();

export function addAuditLog(
  actorRole: UserRole,
  actorName: string,
  action: string,
  targetId: string,
  detail: string,
): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: `AUD-${Date.now().toString().slice(-6)}`,
    actorRole,
    actorName,
    action,
    targetId,
    detail,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
  };
  store.auditLogs.unshift(entry);
  persistStore();
  return entry;
}

export function computeMetrics(therapistId?: string): AppMetricsSummary {
  const scopedPlans = therapistId
    ? store.plans.filter((p) => p.therapistId === therapistId)
    : store.plans;
  const scopedSessions = therapistId
    ? store.sessions.filter((s) => s.therapistId === therapistId)
    : store.sessions;
  const scopedReports = therapistId
    ? store.reports.filter((r) => r.therapistId === therapistId)
    : store.reports;
  const scopedPatients = therapistId
    ? store.patients.filter((p) => p.assignedTherapistId === therapistId)
    : store.patients;

  const activePlansCount = scopedPlans.filter((p) => p.status === 'active').length;
  const plansWithSessions = new Set(scopedSessions.map((s) => s.planId)).size;
  const planActivationRate =
    activePlansCount > 0 ? Math.round((plansWithSessions / activePlansCount) * 100) : 0;

  const startedTasks = scopedSessions.flatMap((s) => s.taskLogs);
  const completedTasks = startedTasks.filter((t) => t.status === 'completed').length;
  const taskCompletionRate =
    startedTasks.length > 0 ? Math.round((completedTasks / startedTasks.length) * 100) : 0;

  const abortedSessions = scopedSessions.filter((s) => s.status === 'abnormal_abort').length;
  const trainingInterruptionRate =
    scopedSessions.length > 0 ? Math.round((abortedSessions / scopedSessions.length) * 100) : 0;

  const sessionsWithFullFields = scopedSessions.filter(
    (s) => s.preFeedback && s.postFeedback && s.hardwareSnapshot,
  ).length;
  const keyFieldCompletenessRate =
    scopedSessions.length > 0
      ? Math.round((sessionsWithFullFields / scopedSessions.length) * 100)
      : 100;

  const deviceAbnormalSessions = scopedSessions.filter(
    (s) =>
      s.hardwareSnapshot.vrStatus === 'offline' ||
      s.hardwareSnapshot.audioStatus === 'offline' ||
      s.hardwareSnapshot.olfactoryStatus === 'offline',
  ).length;
  const deviceAbnormalRate =
    scopedSessions.length > 0
      ? Math.round((deviceAbnormalSessions / scopedSessions.length) * 100)
      : 0;

  const openSafetyEvents = store.safetyEvents.filter((e) => {
    if (e.resolvedStatus === 'resolved') return false;
    if (!therapistId) return true;
    return scopedPatients.some((p) => p.patientCode === e.patientCode);
  }).length;

  return {
    timeRangeLabel: '近 14 天（2026-11-05 至 2026-11-18）',
    scopeLabel: therapistId ? '当前康复师授权管理患者范围' : '机构全量运营统计（去标识化聚合）',
    planActivationRate,
    taskCompletionRate,
    trainingInterruptionRate,
    keyFieldCompletenessRate,
    avgReportReviewMinutes: 14,
    deviceAbnormalRate,
    totalSessions: scopedSessions.length,
    activePatients: scopedPatients.length,
    pendingReports: scopedReports.filter((r) => r.status === 'pending_review').length,
    openSafetyEvents,
  };
}
