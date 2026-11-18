export type UserRole = 'patient' | 'therapist' | 'admin';

export type SceneId = 'forest' | 'stream';

export type TaskType = 'A_BASIC' | 'B_AUDITORY' | 'C_OLFACTORY' | 'D_COMPREHENSIVE';

export type PlanStatus =
  | 'draft'
  | 'pending_publish'
  | 'active'
  | 'paused'
  | 'completed'
  | 'expired';

export type SessionStatus =
  | 'pending'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'voluntary_exit'
  | 'abnormal_abort';

export type RiskSeverity = 'notice' | 'attention' | 'high_risk';

export type ReportStatus = 'pending_review' | 'approved' | 'returned';

export type HardwareState = 'ready' | 'degraded' | 'offline' | 'not_equipped';

export interface StaffAccount {
  id: string;
  name: string;
  role: 'therapist' | 'admin';
  department: string;
  status: 'active' | 'inactive';
}

export interface PatientProfile {
  patientCode: string; // Coded / de-identified institutional ID
  displayLabel: string; // e.g., "林某 (SR-P-2048)"
  focusArea: string; // Descriptive rehabilitation focus (non-diagnostic label)
  assignedTherapistId: string;
  assignedTherapistName: string;
  riskTier: 'standard' | 'elevated';
  riskNote: string;
  supervisionDefault: 'autonomous' | 'therapist_supervised';
  scaleAssessmentNote: string;
  consentSigned: boolean;
  lastUpdated: string;
}

export interface PlanAdjustmentRecord {
  version: number;
  adjustedBy: string;
  adjustedAt: string;
  reason: string;
}

export interface TrainingPlan {
  id: string;
  version: number;
  patientCode: string;
  therapistId: string;
  therapistName: string;
  goal: string;
  scene: SceneId;
  allowedTasks: TaskType[];
  primaryMode: TaskType;
  durationNote: string;
  frequency: string;
  validFrom: string;
  validTo: string;
  supervisionMode: 'autonomous' | 'therapist_supervised';
  sensoryConfig: {
    audioCategories: string[];
    maxVolumePercent: number;
    olfactoryEnabled: boolean;
    olfactoryProfile: string;
    olfactoryNote: string;
  };
  status: PlanStatus;
  adjustmentHistory: PlanAdjustmentRecord[];
}

export interface HardwareSnapshot {
  vrStatus: 'ready' | 'offline';
  audioStatus: 'ready' | 'offline';
  olfactoryStatus: 'ready' | 'not_equipped' | 'offline';
  isWebSimulation: boolean;
}

export interface PreTrainingFeedback {
  tensionScore: number; // 1-10 self-report
  comfortScore: number; // 1-10 self-report
  contraindicationConfirmed: boolean;
  note: string;
  scaleVersion: string;
  submittedAt: string;
}

export interface PostTrainingFeedback {
  tensionScore: number; // 1-10 same scale for descriptive comparison
  comfortScore: number; // 1-10
  overallExperienceScore: number; // 1-10
  preferredScene: SceneId | 'neutral';
  audioComfort: 'comfortable' | 'too_loud' | 'too_quiet' | 'discomfort';
  audioDiscomfortFlag: boolean;
  olfactoryPreference?: 'pleasant' | 'neutral' | 'discomfort' | 'not_used';
  olfactoryDiscomfortFlag: boolean;
  openText: string;
  scaleVersion: string;
  submittedAt: string;
}

export interface TaskLogEntry {
  taskType: TaskType;
  label: string;
  status: 'completed' | 'skipped' | 'aborted';
  durationSeconds: number;
  reactionTimeMs?: number;
  accuracyPercent?: number;
  selectedOption?: string;
  detailNote: string;
}

export interface TrainingSession {
  id: string;
  planId: string;
  planVersion: number;
  patientCode: string;
  therapistId: string;
  scene: SceneId;
  mode: TaskType;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  elapsedSeconds: number;
  supervisionRequired: boolean;
  supervisorConfirmedBy?: string;
  hardwareSnapshot: HardwareSnapshot;
  preFeedback: PreTrainingFeedback;
  postFeedback?: PostTrainingFeedback;
  taskLogs: TaskLogEntry[];
  pauseCount: number;
  exitReason?: string;
  abortReason?: string;
}

export interface SafetyEvent {
  id: string;
  sessionId: string;
  patientCode: string;
  severity: RiskSeverity;
  eventType: string;
  description: string;
  systemAction: string;
  therapistAction?: string;
  resolvedStatus: 'open' | 'reviewing' | 'resolved';
  timestamp: string;
  reviewedBy?: string;
}

export interface TelemetryEvent {
  id: string;
  eventName:
    | 'plan_view'
    | 'training_start'
    | 'task_start'
    | 'task_complete'
    | 'training_pause'
    | 'training_exit'
    | 'sensory_feedback'
    | 'report_review'
    | 'safety_event';
  patientCode: string;
  sessionId?: string;
  planId?: string;
  timestamp: string;
  properties: Record<string, string | number | boolean>;
}

export interface AIAdjustmentProposal {
  suggestedScene: SceneId;
  suggestedTasks: TaskType[];
  suggestedAudioMaxVolume: number;
  suggestedOlfactoryEnabled: boolean;
  rationale: string;
  uncertaintyNote: string;
  appliedByTherapist: boolean;
  appliedAt?: string;
}

export interface AIReport {
  id: string;
  patientCode: string;
  therapistId: string;
  generatedAt: string;
  periodLabel: string;
  sessionCountIncluded: number;
  status: ReportStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  therapistOpinion?: string;
  flaggedForAttention: boolean;
  sections: {
    basicInfo: string;
    trainingOverview: string;
    behavioralPerformance: string;
    subjectiveFeedback: string;
    multisensoryAdaptation: string;
    aiObservations: string;
    professionalReview: string;
    dataLimitations: string;
  };
  adjustmentProposal: AIAdjustmentProposal;
}

export interface HardwareInventoryItem {
  id: string;
  name: string;
  moduleType: 'vr_headset' | 'audio_unit' | 'olfactory_dispenser';
  required: boolean;
  room: string;
  status: HardwareState;
  firmwareOrSpec: string;
  lastCheckedAt: string;
  note: string;
}

export interface AuditLogEntry {
  id: string;
  actorRole: UserRole;
  actorName: string;
  action: string;
  targetId: string;
  detail: string;
  timestamp: string;
}

export interface VerificationItem {
  id: string;
  layer: 'A_EXPERIENCE' | 'B_DATA' | 'C_EXPERT';
  title: string;
  criteria: string;
  status: 'pending' | 'passed' | 'needs_action';
  evidenceNote: string;
  updatedBy: string;
  updatedAt: string;
}

export interface AppMetricsSummary {
  timeRangeLabel: string;
  scopeLabel: string;
  planActivationRate: number;
  taskCompletionRate: number;
  trainingInterruptionRate: number;
  keyFieldCompletenessRate: number;
  avgReportReviewMinutes: number;
  deviceAbnormalRate: number;
  totalSessions: number;
  activePatients: number;
  pendingReports: number;
  openSafetyEvents: number;
}
