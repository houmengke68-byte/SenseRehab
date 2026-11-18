import type {
  HardwareState,
  PlanStatus,
  RiskSeverity,
  SceneId,
  SessionStatus,
  TaskType,
} from '../types';

export const SCENE_META: Record<
  SceneId,
  {
    name: string;
    subtitle: string;
    imageUrl: string;
    visualElements: string;
    audioElements: string;
    olfactoryNote: string;
  }
> = {
  forest: {
    name: '林间晨光（森林场景）',
    subtitle: '首期核心沉浸场景 · 林间小径与自然日光',
    imageUrl: '/src/assets/images/scene_forest_glade_1795011094605.jpg',
    visualElements: '林间小径、松木与桦树林冠、柔和晨光与蕨类植被',
    audioElements: '林间鸟鸣、树叶沙沙、柔和微风',
    olfactoryNote: '可选松木 / 草木类自然气息（仅配备并获批气味设备时启用）',
  },
  stream: {
    name: '山涧清溪（溪流场景）',
    subtitle: '辅助舒缓沉浸场景 · 缓流卵石与水岸植被',
    imageUrl: '/src/assets/images/scene_stream_creek_1795011093679.jpg',
    visualElements: '清澈溪流、光滑鹅卵石、青苔水岸与摇曳蕨草',
    audioElements: '溪水潺潺、微风拂叶、远处零星鸟鸣',
    olfactoryNote: '可选湿润泥土 / 草木气息（仅配备并获批气味设备时启用）',
  },
};

export const TASK_LABELS: Record<TaskType, { short: string; name: string; desc: string }> = {
  A_BASIC: {
    short: 'A 基础体验',
    name: 'A 基础沉浸体验',
    desc: '进入场景自主观察与聆听自然声音，按个人节奏随时暂停或结束。',
  },
  B_AUDITORY: {
    short: 'B 听觉任务',
    name: 'B 听觉可选任务',
    desc: '聚焦并辨识自然声音层次（鸟鸣、风声、流水），可随时跳过。',
  },
  C_OLFACTORY: {
    short: 'C 嗅觉任务',
    name: 'C 嗅觉可选任务',
    desc: '在硬件就绪且获授权时体验或模拟气味偏好与耐受确认，随时可关闭。',
  },
  D_COMPREHENSIVE: {
    short: 'D 综合训练',
    name: 'D 多感官综合训练流程',
    desc: '按康复师计划串联基础体验与可选听觉/嗅觉环节的完整流程。',
  },
};

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  draft: '草稿',
  pending_publish: '待发布',
  active: '生效中',
  paused: '已暂停',
  completed: '已结束',
  expired: '已过期',
};

export const SESSION_STATUS_LABELS: Record<
  SessionStatus,
  { label: string; tone: 'neutral' | 'active' | 'warning' | 'success' | 'danger' }
> = {
  pending: { label: '待开始', tone: 'neutral' },
  in_progress: { label: '训练中', tone: 'active' },
  paused: { label: '已暂停', tone: 'warning' },
  completed: { label: '已完成', tone: 'success' },
  voluntary_exit: { label: '主动退出', tone: 'neutral' },
  abnormal_abort: { label: '异常中止', tone: 'danger' },
};

export const RISK_SEVERITY_LABELS: Record<
  RiskSeverity,
  { label: string; guidance: string; tone: 'neutral' | 'warning' | 'danger' }
> = {
  notice: {
    label: '一般提示',
    guidance: '流程记录（如设备未配备自动降级、主动跳过可选任务），可继续或重连。',
    tone: 'neutral',
  },
  attention: {
    label: '需关注',
    guidance: '患者反馈不适或连续暂停，系统已停止对应刺激并提示康复师评估。',
    tone: 'warning',
  },
  high_risk: {
    label: '高风险事件',
    guidance: '立即停止训练并触发机构人工响应 SOP，完整留痕复核。',
    tone: 'danger',
  },
};

export const HARDWARE_STATE_LABELS: Record<
  HardwareState,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  ready: { label: '连接正常', tone: 'success' },
  degraded: { label: '降级运行', tone: 'warning' },
  offline: { label: '异常 / 离线', tone: 'danger' },
  not_equipped: { label: '未配备（可选）', tone: 'neutral' },
};

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
