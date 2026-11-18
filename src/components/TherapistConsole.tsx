import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
} from 'lucide-react';
import type {
  AIReport,
  AppMetricsSummary,
  HardwareInventoryItem,
  PatientProfile,
  PlanStatus,
  SafetyEvent,
  SceneId,
  TaskType,
  TelemetryEvent,
  TrainingPlan,
  TrainingSession,
  VerificationItem,
} from '../types';
import {
  formatDuration,
  HARDWARE_STATE_LABELS,
  PLAN_STATUS_LABELS,
  RISK_SEVERITY_LABELS,
  SCENE_META,
  SESSION_STATUS_LABELS,
  TASK_LABELS,
} from '../utils/labels';

interface TherapistConsoleProps {
  activeSection: 'dashboard' | 'patients_plans' | 'monitoring' | 'reports';
  onNavigateSection: (sec: 'dashboard' | 'patients_plans' | 'monitoring' | 'reports') => void;
  therapistId: string;
  therapistName: string;
  patients: PatientProfile[];
  plans: TrainingPlan[];
  sessions: TrainingSession[];
  safetyEvents: SafetyEvent[];
  reports: AIReport[];
  telemetryEvents: TelemetryEvent[];
  hardwareInventory: HardwareInventoryItem[];
  metrics: AppMetricsSummary;
  verificationItems: VerificationItem[];
  onRefreshWorkspace: () => Promise<void>;
}

export const TherapistConsole: React.FC<TherapistConsoleProps> = ({
  activeSection,
  onNavigateSection,
  therapistId,
  therapistName,
  patients,
  plans,
  sessions,
  safetyEvents,
  reports,
  telemetryEvents,
  hardwareInventory,
  metrics,
  verificationItems,
  onRefreshWorkspace,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'standard' | 'elevated'>('all');
  const [selectedPatientCode, setSelectedPatientCode] = useState<string>(
    patients[0]?.patientCode ?? 'SR-P-2048',
  );
  const [selectedReportId, setSelectedReportId] = useState<string>(reports[0]?.id ?? '');
  const [statusNotice, setStatusNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  );

  // Plan editor / creator modal state
  const [editingPlan, setEditingPlan] = useState<TrainingPlan | null>(null);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [planForm, setPlanForm] = useState<{
    goal: string;
    scene: SceneId;
    allowedTasks: TaskType[];
    primaryMode: TaskType;
    supervisionMode: 'autonomous' | 'therapist_supervised';
    maxVolumePercent: number;
    olfactoryEnabled: boolean;
    frequency: string;
    validFrom: string;
    validTo: string;
    status: PlanStatus;
    adjustmentReason: string;
  }>({
    goal: '',
    scene: 'forest',
    allowedTasks: ['A_BASIC', 'B_AUDITORY'],
    primaryMode: 'A_BASIC',
    supervisionMode: 'autonomous',
    maxVolumePercent: 60,
    olfactoryEnabled: false,
    frequency: '每周 3 次',
    validFrom: '2026-11-18',
    validTo: '2026-12-02',
    status: 'active',
    adjustmentReason: '',
  });

  // Bounded AI recommendation state
  const [aiSuggestionLoading, setAiSuggestionLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    recommendedScene: SceneId;
    recommendedPrimaryMode: TaskType;
    recommendedMaxVolume: number;
    reasoning: string;
    cautionNote: string;
  } | null>(null);

  // Safety event triage state
  const [triageInputs, setTriageInputs] = useState<Record<string, string>>({});
  const [autoSyncMonitoring, setAutoSyncMonitoring] = useState(false);

  // AI Report generation & review state
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reviewOpinion, setReviewOpinion] = useState('');
  const [applyProposalChecked, setApplyProposalChecked] = useState(false);
  const [flagAttentionChecked, setFlagAttentionChecked] = useState(false);

  useEffect(() => {
    if (activeSection !== 'monitoring' || !autoSyncMonitoring) return;
    const id = window.setInterval(() => {
      void onRefreshWorkspace();
    }, 5000);
    return () => window.clearInterval(id);
  }, [activeSection, autoSyncMonitoring, onRefreshWorkspace]);

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchesRisk = riskFilter === 'all' || p.riskTier === riskFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        p.patientCode.toLowerCase().includes(q) ||
        p.displayLabel.toLowerCase().includes(q) ||
        p.focusArea.toLowerCase().includes(q);
      return matchesRisk && matchesQuery;
    });
  }, [patients, riskFilter, searchQuery]);

  const currentPatient = useMemo(
    () =>
      patients.find((p) => p.patientCode === selectedPatientCode) || patients[0] || null,
    [patients, selectedPatientCode],
  );

  const currentPatientPlans = useMemo(
    () => plans.filter((p) => p.patientCode === currentPatient?.patientCode),
    [plans, currentPatient],
  );

  const currentPatientSessions = useMemo(
    () => sessions.filter((s) => s.patientCode === currentPatient?.patientCode),
    [sessions, currentPatient],
  );

  const currentReport = useMemo(
    () => reports.find((r) => r.id === selectedReportId) || reports[0] || null,
    [reports, selectedReportId],
  );

  const pendingReports = useMemo(
    () => reports.filter((r) => r.status === 'pending_review'),
    [reports],
  );

  const openSafetyEvents = useMemo(
    () => safetyEvents.filter((e) => e.resolvedStatus !== 'resolved'),
    [safetyEvents],
  );

  const openEditPlan = (plan: TrainingPlan) => {
    setIsCreatingPlan(false);
    setEditingPlan(plan);
    setPlanForm({
      goal: plan.goal,
      scene: plan.scene,
      allowedTasks: plan.allowedTasks,
      primaryMode: plan.primaryMode,
      supervisionMode: plan.supervisionMode,
      maxVolumePercent: plan.sensoryConfig.maxVolumePercent,
      olfactoryEnabled: plan.sensoryConfig.olfactoryEnabled,
      frequency: plan.frequency,
      validFrom: plan.validFrom,
      validTo: plan.validTo,
      status: plan.status,
      adjustmentReason: '',
    });
  };

  const openCreatePlan = () => {
    if (!currentPatient) return;
    setEditingPlan(null);
    setIsCreatingPlan(true);
    setPlanForm({
      goal: '建立平稳的多感官沉浸适应体验，结合受试者耐受度探索自然声景层次。',
      scene: 'forest',
      allowedTasks: ['A_BASIC', 'B_AUDITORY'],
      primaryMode: 'A_BASIC',
      supervisionMode: currentPatient.supervisionDefault,
      maxVolumePercent: 60,
      olfactoryEnabled: false,
      frequency: '每周 3 次',
      validFrom: '2026-11-18',
      validTo: '2026-12-02',
      status: 'active',
      adjustmentReason: '创建新阶段训练计划',
    });
  };

  const toggleAllowedTask = (task: TaskType) => {
    setPlanForm((prev) => {
      const exists = prev.allowedTasks.includes(task);
      const next = exists
        ? prev.allowedTasks.filter((t) => t !== task)
        : [...prev.allowedTasks, task];
      if (next.length === 0) return prev;
      return {
        ...prev,
        allowedTasks: next,
        primaryMode: next.includes(prev.primaryMode) ? prev.primaryMode : next[0],
      };
    });
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPatient) return;
    setStatusNotice(null);

    if (isCreatingPlan) {
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientCode: currentPatient.patientCode,
          therapistId,
          therapistName,
          goal: planForm.goal,
          scene: planForm.scene,
          allowedTasks: planForm.allowedTasks,
          primaryMode: planForm.primaryMode,
          durationNote:
            '时长规则 D：由康复师结合当次耐受度与专业评审边界执行，不预设固定疗效分钟数。',
          frequency: planForm.frequency,
          validFrom: planForm.validFrom,
          validTo: planForm.validTo,
          supervisionMode: planForm.supervisionMode,
          sensoryConfig: {
            audioCategories:
              planForm.scene === 'forest'
                ? ['林间鸟鸣', '树叶沙沙', '微风声']
                : ['溪水潺潺', '微风声', '远处鸟鸣'],
            maxVolumePercent: planForm.maxVolumePercent,
            olfactoryEnabled: planForm.olfactoryEnabled,
            olfactoryProfile: planForm.olfactoryEnabled
              ? '经安全评审的松木/草木类气味（需硬件支持）'
              : '未启用',
            olfactoryNote: '无气味释放设备时按规则降级禁用 C 任务。',
          },
          status: planForm.status,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setStatusNotice({ type: 'err', text: d.error || '创建计划失败' });
        return;
      }
      setIsCreatingPlan(false);
      setStatusNotice({ type: 'ok', text: `已为 ${currentPatient.patientCode} 创建新训练计划。` });
    } else if (editingPlan) {
      const res = await fetch(`/api/plans/${editingPlan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: planForm.goal,
          scene: planForm.scene,
          allowedTasks: planForm.allowedTasks,
          primaryMode: planForm.primaryMode,
          supervisionMode: planForm.supervisionMode,
          frequency: planForm.frequency,
          validFrom: planForm.validFrom,
          validTo: planForm.validTo,
          status: planForm.status,
          sensoryConfig: {
            ...editingPlan.sensoryConfig,
            maxVolumePercent: planForm.maxVolumePercent,
            olfactoryEnabled: planForm.olfactoryEnabled,
          },
          adjustedBy: therapistName,
          adjustmentReason: planForm.adjustmentReason || '康复师调整训练参数',
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setStatusNotice({ type: 'err', text: d.error || '更新计划失败' });
        return;
      }
      setEditingPlan(null);
      setStatusNotice({ type: 'ok', text: `计划 ${editingPlan.id} 已保存新版本并写入审计日志。` });
    }
    await onRefreshWorkspace();
  };

  const handleFetchAiRecommendation = async () => {
    if (!currentPatient) return;
    setAiSuggestionLoading(true);
    setStatusNotice(null);
    try {
      const res = await fetch('/api/recommendations/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientCode: currentPatient.patientCode }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        suggestion?: typeof aiSuggestion;
      };
      if (!res.ok || !data.suggestion) {
        setStatusNotice({ type: 'err', text: data.error || 'AI 推荐服务调用失败' });
        return;
      }
      setAiSuggestion(data.suggestion);
    } catch {
      setStatusNotice({ type: 'err', text: '网络请求失败，无法获取 AI 方案建议。' });
    } finally {
      setAiSuggestionLoading(false);
    }
  };

  const handleResolveSafetyEvent = async (
    evtId: string,
    resolvedStatus: SafetyEvent['resolvedStatus'],
  ) => {
    const res = await fetch(`/api/safety-events/${evtId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resolvedStatus,
        therapistAction: triageInputs[evtId] || '康复师已核查并确认当前处理措施。',
        reviewedBy: therapistName,
      }),
    });
    if (res.ok) {
      setStatusNotice({ type: 'ok', text: `异常事件 ${evtId} 已更新处置记录并留痕。` });
      await onRefreshWorkspace();
    }
  };

  const handleGenerateReport = async () => {
    if (!currentPatient) return;
    setGeneratingReport(true);
    setStatusNotice(null);
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientCode: currentPatient.patientCode,
          therapistId,
          therapistName,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; report?: AIReport; error?: string };
      if (!res.ok || !data.report) {
        setStatusNotice({ type: 'err', text: data.error || '生成 AI 报告草稿失败' });
        return;
      }
      await onRefreshWorkspace();
      setSelectedReportId(data.report.id);
      setStatusNotice({
        type: 'ok',
        text: `已为 ${currentPatient.patientCode} 生成阶段性报告草稿（状态：待康复师审核）。`,
      });
    } catch {
      setStatusNotice({ type: 'err', text: '无法连接到服务器生成报告草稿。' });
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleReviewReport = async (status: 'approved' | 'returned') => {
    if (!currentReport) return;
    const res = await fetch(`/api/reports/${currentReport.id}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        therapistOpinion: reviewOpinion,
        reviewedBy: therapistName,
        flaggedForAttention: flagAttentionChecked,
        applyAdjustmentToPlan: status === 'approved' && applyProposalChecked,
      }),
    });
    if (res.ok) {
      setReviewOpinion('');
      setApplyProposalChecked(false);
      setStatusNotice({
        type: 'ok',
        text: `报告 ${currentReport.id} 已${status === 'approved' ? '审核通过' : '退回补充'}${
          status === 'approved' && applyProposalChecked ? '，并同步更新下一阶段计划版本' : ''
        }。`,
      });
      await onRefreshWorkspace();
    }
  };

  const handlePlanStatusChange = async (planId: string, nextStatus: PlanStatus) => {
    const res = await fetch(`/api/plans/${planId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus, actorName: therapistName }),
    });
    if (res.ok) {
      setStatusNotice({
        type: 'ok',
        text: `训练计划 ${planId} 状态已变更为“${PLAN_STATUS_LABELS[nextStatus]}”。`,
      });
      await onRefreshWorkspace();
    }
  };

  const handleUpdateVerification = async (
    id: string,
    status: VerificationItem['status'],
    evidenceNote?: string,
  ) => {
    const res = await fetch(`/api/verification/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        evidenceNote,
        updatedBy: therapistName,
      }),
    });
    if (res.ok) {
      setStatusNotice({ type: 'ok', text: `验证条目 ${id} 已更新评审状态并留痕。` });
      await onRefreshWorkspace();
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      {/* Header Context */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-medium text-slate-500">
            康复师专业管理端 · 当前账号：{therapistName}（仅访问本人授权管理患者）
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {activeSection === 'dashboard' && '临床训练工作台与数据概览'}
            {activeSection === 'patients_plans' && '授权患者档案与训练计划管理'}
            {activeSection === 'monitoring' && '实时训练监控与安全事件分级处置'}
            {activeSection === 'reports' && 'AI 阶段性训练分析报告与专业审核'}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => void onRefreshWorkspace()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          同步最新训练数据
        </button>
      </div>

      {statusNotice && (
        <div
          className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${
            statusNotice.type === 'ok'
              ? 'border-teal-200 bg-teal-50/70 text-teal-950'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusNotice.type === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-700" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-700" />
            )}
            <span>{statusNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-xs font-medium underline whitespace-nowrap shrink-0"
          >
            关闭
          </button>
        </div>
      )}

      {/* VIEW 1: WORKSPACE DASHBOARD */}
      {activeSection === 'dashboard' && (
        <div className="space-y-6">
          {/* Metrics Scope Note (§5.1) */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>统计范围：{metrics.scopeLabel}</span>
            <span>统计周期：{metrics.timeRangeLabel}</span>
          </div>

          {/* 6-cell KPI Strip */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">授权患者数</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {metrics.activePatients}
              </p>
              <p className="mt-1 text-xs text-slate-500">近期会话 {metrics.totalSessions} 次</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">计划启动率</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {metrics.planActivationRate}%
              </p>
              <p className="mt-1 text-xs text-slate-500">已启动 / 已发布计划</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">任务完成率</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold text-teal-800 tabular-nums">
                {metrics.taskCompletionRate}%
              </p>
              <p className="mt-1 text-xs text-slate-500">跳过与中止单独统计</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">训练中断率</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {metrics.trainingInterruptionRate}%
              </p>
              <p className="mt-1 text-xs text-slate-500">异常中止 / 总启动次数</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">关键字段完整率</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {metrics.keyFieldCompletenessRate}%
              </p>
              <p className="mt-1 text-xs text-slate-500">前后自评与设备快照</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">设备异常率</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {metrics.deviceAbnormalRate}%
              </p>
              <p className="mt-1 text-xs text-slate-500">平均审阅 {metrics.avgReportReviewMinutes} 分</p>
            </div>
          </div>

          {/* Actionable To-Do Split */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Pending Reports & Open Safety Events */}
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  待处理专业事项（待审报告 {pendingReports.length} · 异常事件 {openSafetyEvents.length}）
                </h2>
              </div>

              <div className="divide-y divide-slate-100">
                {pendingReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        AI 阶段性报告草稿待审核 · {rep.patientCode}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {rep.periodLabel} · 纳入 {rep.sessionCountIncluded} 次训练
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReportId(rep.id);
                        onNavigateSection('reports');
                      }}
                      className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
                    >
                      前往审核
                    </button>
                  </div>
                ))}

                {openSafetyEvents.map((evt) => {
                  const sev = RISK_SEVERITY_LABELS[evt.severity];
                  return (
                    <div
                      key={evt.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          [{sev.label}] {evt.eventType} · {evt.patientCode}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600">{evt.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigateSection('monitoring')}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                      >
                        处置复核
                      </button>
                    </div>
                  );
                })}

                {pendingReports.length === 0 && openSafetyEvents.length === 0 && (
                  <p className="py-6 text-center text-sm text-slate-500">
                    当前授权范围内暂无待审核报告或未闭合异常事件。
                  </p>
                )}
              </div>
            </div>

            {/* Hardware Room Status & Telemetry */}
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
              <h2 className="text-base font-semibold text-slate-900">训练室硬件模块状态</h2>
              <div className="divide-y divide-slate-100">
                {hardwareInventory.map((hw) => {
                  const st = HARDWARE_STATE_LABELS[hw.status];
                  return (
                    <div key={hw.id} className="flex items-center justify-between gap-2 py-2.5">
                      <div>
                        <p className="text-xs font-medium text-slate-900">{hw.name}</p>
                        <p className="text-xs text-slate-500">
                          {hw.room} · {hw.required ? '必选硬件' : '可选扩展'}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-medium whitespace-nowrap shrink-0 ${
                          st.tone === 'success'
                            ? 'text-emerald-700'
                            : st.tone === 'danger'
                            ? 'text-red-700'
                            : st.tone === 'warning'
                            ? 'text-amber-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-700">最近核心埋点事件（§9）</p>
                <div className="mt-2 space-y-1.5">
                  {telemetryEvents.slice(0, 4).map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between text-xs text-slate-600"
                    >
                      <span className="font-mono text-slate-800">{t.eventName}</span>
                      <span className="font-mono text-slate-500 tabular-nums">
                        {t.patientCode} · {t.timestamp.slice(11)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Three-Layer Product Verification Matrix (§11) */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-teal-700" />
                <h2 className="text-base font-semibold text-slate-900">
                  产品三层综合验证追踪（§11：A 体验验证 · B 数据验证 · C 专业评价）
                </h2>
              </div>
              <span className="text-xs text-slate-500">
                已通过 {verificationItems.filter((v) => v.status === 'passed').length} /{' '}
                {verificationItems.length} 项 · 遵循“先验证可用性与安全，再评估效果”原则
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {verificationItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-4 py-3.5"
                >
                  <div className="max-w-3xl space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-teal-800">
                        {item.layer === 'A_EXPERIENCE'
                          ? 'A 产品体验验证'
                          : item.layer === 'B_DATA'
                          ? 'B 数据表现验证'
                          : 'C 专业评价验证'}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-sm font-semibold text-slate-900">{item.title}</span>
                    </div>
                    <p className="text-xs text-slate-600">{item.criteria}</p>
                    <p className="text-xs text-slate-500">
                      当前记录：{item.evidenceNote}（{item.updatedBy} · {item.updatedAt}）
                    </p>
                  </div>

                  <select
                    value={item.status}
                    onChange={(e) =>
                      void handleUpdateVerification(
                        item.id,
                        e.target.value as VerificationItem['status'],
                      )
                    }
                    aria-label={`更新验证条目 ${item.title} 状态`}
                    className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                      item.status === 'passed'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : item.status === 'needs_action'
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <option value="pending">待评审</option>
                    <option value="needs_action">需整改 / 共创</option>
                    <option value="passed">已核验通过</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: PATIENTS & TRAINING PLANS */}
      {activeSection === 'patients_plans' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Patient Directory */}
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                授权患者列表（{filteredPatients.length}）
              </h2>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索编码或训练方向..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {[
                { id: 'all', label: '全部' },
                { id: 'standard', label: '常规风险' },
                { id: 'elevated', label: '重点关注' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setRiskFilter(f.id as typeof riskFilter)}
                  className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                    riskFilter === f.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="divide-y divide-slate-100">
              {filteredPatients.map((p) => {
                const active = currentPatient?.patientCode === p.patientCode;
                return (
                  <button
                    key={p.patientCode}
                    type="button"
                    onClick={() => {
                      setSelectedPatientCode(p.patientCode);
                      setEditingPlan(null);
                      setIsCreatingPlan(false);
                      setAiSuggestion(null);
                    }}
                    className={`w-full py-3.5 px-2 text-left transition-colors ${
                      active ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">
                        {p.displayLabel}
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          p.riskTier === 'elevated' ? 'text-amber-700' : 'text-slate-500'
                        }`}
                      >
                        {p.riskTier === 'elevated' ? '需现场监督' : '自主可训'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 line-clamp-1">{p.focusArea}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Patient Detail & Plans */}
          <div className="space-y-6 lg:col-span-8">
            {currentPatient ? (
              <>
                {/* Patient Clinical Profile & Descriptive Trend */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        {currentPatient.displayLabel}
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-600">{currentPatient.focusArea}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleFetchAiRecommendation()}
                        disabled={aiSuggestionLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-teal-700 bg-white px-3 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-50 whitespace-nowrap shrink-0"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {aiSuggestionLoading ? '生成建议中...' : 'AI 辅助方案推荐'}
                      </button>
                      <button
                        type="button"
                        onClick={openCreatePlan}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        新建训练计划
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
                    <div className="rounded-lg bg-slate-50 p-3.5">
                      <p className="font-semibold text-slate-800">风险备注与监督要求</p>
                      <p className="mt-1 leading-relaxed text-slate-600">
                        {currentPatient.riskNote}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3.5">
                      <p className="font-semibold text-slate-800">康复师评估基线记录</p>
                      <p className="mt-1 leading-relaxed text-slate-600">
                        {currentPatient.scaleAssessmentNote}
                      </p>
                    </div>
                  </div>

                  {/* AI Bounded Recommendation Box */}
                  {aiSuggestion && (
                    <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-teal-900">
                          AI 受限辅助建议（仅供康复师参考，未自动生效）
                        </p>
                        <span className="text-xs text-teal-800">
                          建议场景：{SCENE_META[aiSuggestion.recommendedScene].name} · 建议模式：
                          {TASK_LABELS[aiSuggestion.recommendedPrimaryMode].short} · 建议音量上限：
                          {aiSuggestion.recommendedMaxVolume}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        依据：{aiSuggestion.reasoning}
                      </p>
                      <p className="text-xs text-amber-800">
                        不确定性提示：{aiSuggestion.cautionNote}
                      </p>
                    </div>
                  )}

                  {/* Descriptive Pre/Post Trend Visualization & Table (§4.5) */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-slate-800">
                        近期自评变化记录（自评体验量表 v1.0 · 仅作描述性比较）
                      </h3>
                      <span className="text-xs text-slate-500">
                        共 {currentPatientSessions.length} 次训练记录
                      </span>
                    </div>

                    {currentPatientSessions.length > 0 && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                          <span>训练前后自评对比柱图（左：紧张度 1-10 · 右：舒适度 1-10）</span>
                          <span>浅色为训练前 · 深色为训练后</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {currentPatientSessions
                            .slice()
                            .reverse()
                            .map((s) => (
                              <div
                                key={`chart-${s.id}`}
                                className="rounded-md border border-slate-200 bg-white p-3 text-xs"
                              >
                                <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                                  {s.startedAt.slice(5, 16)} · {SCENE_META[s.scene].name.split('（')[0]}
                                </p>
                                <div className="mt-2 space-y-2">
                                  <div>
                                    <div className="flex justify-between text-[11px] text-slate-600">
                                      <span>紧张度</span>
                                      <span className="font-mono tabular-nums">
                                        {s.preFeedback.tensionScore} →{' '}
                                        {s.postFeedback ? s.postFeedback.tensionScore : '--'}
                                      </span>
                                    </div>
                                    <div className="mt-1 flex gap-1 h-2">
                                      <div
                                        className="rounded-xs bg-amber-200"
                                        style={{ width: `${s.preFeedback.tensionScore * 10}%` }}
                                      />
                                    </div>
                                    {s.postFeedback && (
                                      <div className="mt-1 flex gap-1 h-2">
                                        <div
                                          className="rounded-xs bg-amber-600"
                                          style={{ width: `${s.postFeedback.tensionScore * 10}%` }}
                                        />
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <div className="flex justify-between text-[11px] text-slate-600">
                                      <span>舒适度</span>
                                      <span className="font-mono tabular-nums">
                                        {s.preFeedback.comfortScore} →{' '}
                                        {s.postFeedback ? s.postFeedback.comfortScore : '--'}
                                      </span>
                                    </div>
                                    <div className="mt-1 flex gap-1 h-2">
                                      <div
                                        className="rounded-xs bg-teal-200"
                                        style={{ width: `${s.preFeedback.comfortScore * 10}%` }}
                                      />
                                    </div>
                                    {s.postFeedback && (
                                      <div className="mt-1 flex gap-1 h-2">
                                        <div
                                          className="rounded-xs bg-teal-700"
                                          style={{ width: `${s.postFeedback.comfortScore * 10}%` }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {currentPatientSessions.length === 0 ? (
                      <p className="text-xs text-slate-500">暂无会话记录。</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="py-2 pr-4 font-medium">时间</th>
                              <th className="py-2 pr-4 font-medium">场景 / 模式</th>
                              <th className="py-2 pr-4 font-medium">状态</th>
                              <th className="py-2 pr-4 font-medium text-right">时长</th>
                              <th className="py-2 pr-4 font-medium text-right">紧张度(前→后)</th>
                              <th className="py-2 font-medium text-right">舒适度(前→后)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {currentPatientSessions.map((s) => (
                              <tr key={s.id} className="hover:bg-slate-50">
                                <td className="py-2 pr-4 font-mono tabular-nums text-slate-600">
                                  {s.startedAt.slice(0, 16)}
                                </td>
                                <td className="py-2 pr-4 text-slate-800">
                                  {SCENE_META[s.scene].name.split('（')[0]} · {TASK_LABELS[s.mode].short}
                                </td>
                                <td className="py-2 pr-4 text-slate-700">
                                  {SESSION_STATUS_LABELS[s.status].label}
                                </td>
                                <td className="py-2 pr-4 text-right font-mono tabular-nums text-slate-700">
                                  {formatDuration(s.elapsedSeconds)}
                                </td>
                                <td className="py-2 pr-4 text-right font-mono tabular-nums text-slate-800">
                                  {s.preFeedback.tensionScore} →{' '}
                                  {s.postFeedback ? s.postFeedback.tensionScore : '--'}
                                </td>
                                <td className="py-2 text-right font-mono tabular-nums text-slate-800">
                                  {s.preFeedback.comfortScore} →{' '}
                                  {s.postFeedback ? s.postFeedback.comfortScore : '--'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Plan Editor / Creator Form */}
                {(editingPlan || isCreatingPlan) && (
                  <form
                    onSubmit={handleSavePlan}
                    className="rounded-xl border border-teal-300 bg-white p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="text-base font-semibold text-slate-900">
                        {isCreatingPlan
                          ? `新建训练计划（${currentPatient.patientCode}）`
                          : `调整训练计划 ${editingPlan?.id}（当前 v${editingPlan?.version}）`}
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPlan(null);
                          setIsCreatingPlan(false);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-900"
                      >
                        取消
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        训练目标（由康复师制定，不可写诊断结论）
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={planForm.goal}
                        onChange={(e) => setPlanForm({ ...planForm, goal: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700">默认场景</label>
                        <select
                          value={planForm.scene}
                          onChange={(e) =>
                            setPlanForm({ ...planForm, scene: e.target.value as SceneId })
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                        >
                          <option value="forest">森林场景</option>
                          <option value="stream">溪流场景</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700">监督要求</label>
                        <select
                          value={planForm.supervisionMode}
                          onChange={(e) =>
                            setPlanForm({
                              ...planForm,
                              supervisionMode: e.target.value as
                                | 'autonomous'
                                | 'therapist_supervised',
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                        >
                          <option value="autonomous">患者自主训练</option>
                          <option value="therapist_supervised">康复师现场监督</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700">计划状态</label>
                        <select
                          value={planForm.status}
                          onChange={(e) =>
                            setPlanForm({ ...planForm, status: e.target.value as PlanStatus })
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                        >
                          <option value="draft">草稿</option>
                          <option value="pending_publish">待发布</option>
                          <option value="active">生效中</option>
                          <option value="paused">已暂停</option>
                          <option value="completed">已结束</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-slate-700 mb-2">授权任务模块</p>
                        <div className="flex flex-wrap gap-2">
                          {(['A_BASIC', 'B_AUDITORY', 'C_OLFACTORY', 'D_COMPREHENSIVE'] as TaskType[]).map(
                            (t) => {
                              const active = planForm.allowedTasks.includes(t);
                              return (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => toggleAllowedTask(t)}
                                  className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                                    active
                                      ? 'border-teal-700 bg-teal-50 text-teal-900'
                                      : 'border-slate-200 text-slate-600'
                                  }`}
                                >
                                  {TASK_LABELS[t].short}
                                </button>
                              );
                            },
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center justify-between text-xs font-medium text-slate-700">
                          <span>音频音量上限</span>
                          <span className="font-mono tabular-nums">{planForm.maxVolumePercent}%</span>
                        </label>
                        <input
                          type="range"
                          min={20}
                          max={80}
                          value={planForm.maxVolumePercent}
                          onChange={(e) =>
                            setPlanForm({
                              ...planForm,
                              maxVolumePercent: Number(e.target.value),
                            })
                          }
                          className="w-full accent-teal-700"
                        />
                        <label className="flex items-center gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={planForm.olfactoryEnabled}
                            onChange={(e) =>
                              setPlanForm({ ...planForm, olfactoryEnabled: e.target.checked })
                            }
                            className="h-4 w-4 accent-teal-700"
                          />
                          <span>授权可选气味模块（受实际硬件检测约束）</span>
                        </label>
                      </div>
                    </div>

                    {!isCreatingPlan && (
                      <div>
                        <label className="block text-xs font-medium text-slate-700">
                          本次方案调整原因（将写入版本审计记录）
                        </label>
                        <input
                          type="text"
                          required
                          value={planForm.adjustmentReason}
                          onChange={(e) =>
                            setPlanForm({ ...planForm, adjustmentReason: e.target.value })
                          }
                          placeholder="例如：根据上次患者反馈音量偏响，将上限下调至 50%"
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                        />
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="submit"
                        className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
                      >
                        保存计划并留痕
                      </button>
                    </div>
                  </form>
                )}

                {/* Existing Plans List */}
                <div className="space-y-3">
                  {currentPatientPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-900">
                            {plan.id} · v{plan.version}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="text-xs font-medium text-teal-800">
                            {PLAN_STATUS_LABELS[plan.status]}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="text-xs text-slate-600">
                            {SCENE_META[plan.scene].name.split('（')[0]}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {plan.status !== 'active' && plan.status !== 'completed' && (
                            <button
                              type="button"
                              onClick={() => void handlePlanStatusChange(plan.id, 'active')}
                              className="rounded-lg border border-teal-700 px-2.5 py-1 text-xs font-medium text-teal-800 hover:bg-teal-50"
                            >
                              发布生效
                            </button>
                          )}
                          {plan.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => void handlePlanStatusChange(plan.id, 'paused')}
                              className="rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50"
                            >
                              暂停计划
                            </button>
                          )}
                          {plan.status !== 'completed' && (
                            <button
                              type="button"
                              onClick={() => void handlePlanStatusChange(plan.id, 'completed')}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                            >
                              结束计划
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditPlan(plan)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Sliders className="h-3.5 w-3.5" />
                            调整方案
                          </button>
                        </div>
                      </div>

                      <p className="text-xs leading-relaxed text-slate-700">{plan.goal}</p>

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
                        <span>
                          授权任务：{plan.allowedTasks.map((t) => TASK_LABELS[t].short).join(' / ')}
                        </span>
                        <span>音量上限：{plan.sensoryConfig.maxVolumePercent}%</span>
                        <span>
                          气味授权：{plan.sensoryConfig.olfactoryEnabled ? '已授权' : '未启用'}
                        </span>
                        <span>
                          监督：{plan.supervisionMode === 'therapist_supervised' ? '现场监督' : '自主'}
                        </span>
                      </div>

                      <div className="border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                        最近调整（v{plan.adjustmentHistory[plan.adjustmentHistory.length - 1]?.version}）：
                        {plan.adjustmentHistory[plan.adjustmentHistory.length - 1]?.reason}（
                        {plan.adjustmentHistory[plan.adjustmentHistory.length - 1]?.adjustedAt}）
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* VIEW 3: LIVE MONITORING & SAFETY TRIAGE (§5.4 & §10) */}
      {activeSection === 'monitoring' && (
        <div className="space-y-6">
          {/* Active / Recent Sessions Monitor */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  训练会话实时状态监控（授权范围共 {sessions.length} 条）
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  呈现待开始、训练中、已暂停、已完成、主动退出与异常中止状态，支持开启 5 秒自动同步观察患者端实时会话。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutoSyncMonitoring((v) => !v)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  autoSyncMonitoring
                    ? 'border-teal-700 bg-teal-700 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {autoSyncMonitoring ? '已开启 5 秒自动同步（点击关闭）' : '开启 5 秒自动同步'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                    <th className="px-5 py-3 font-medium">会话编号</th>
                    <th className="px-4 py-3 font-medium">患者标识</th>
                    <th className="px-4 py-3 font-medium">场景 / 模式</th>
                    <th className="px-4 py-3 font-medium">当前状态</th>
                    <th className="px-4 py-3 font-medium">硬件连接（VR/音频/气味）</th>
                    <th className="px-4 py-3 font-medium">监督要求</th>
                    <th className="px-5 py-3 font-medium text-right">已用时长</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.map((s) => {
                    const st = SESSION_STATUS_LABELS[s.status];
                    return (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-mono text-slate-800">{s.id}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{s.patientCode}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {SCENE_META[s.scene].name.split('（')[0]} · {TASK_LABELS[s.mode].short}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-medium ${
                              st.tone === 'active'
                                ? 'text-teal-700'
                                : st.tone === 'warning'
                                ? 'text-amber-700'
                                : st.tone === 'danger'
                                ? 'text-red-700'
                                : st.tone === 'success'
                                ? 'text-emerald-700'
                                : 'text-slate-600'
                            }`}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">
                          {s.hardwareSnapshot.vrStatus} / {s.hardwareSnapshot.audioStatus} /{' '}
                          {s.hardwareSnapshot.olfactoryStatus}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {s.supervisionRequired
                            ? `现场监督（${s.supervisorConfirmedBy || '待确认'}）`
                            : '自主训练'}
                        </td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-800">
                          {formatDuration(s.elapsedSeconds)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Safety Events & Risk Triage (§10.2) */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900">
                安全与异常事件记录及分级处置（§10.2）
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                注：以下分级为产品流程响应框架，不构成临床风险判定标准；不可仅凭单一行为指标推断心理危机。
              </p>
            </div>

            <div className="space-y-3">
              {safetyEvents.map((evt) => {
                const sev = RISK_SEVERITY_LABELS[evt.severity];
                return (
                  <div
                    key={evt.id}
                    className="rounded-lg border border-slate-200 p-4 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={`font-semibold ${
                            sev.tone === 'danger'
                              ? 'text-red-700'
                              : sev.tone === 'warning'
                              ? 'text-amber-700'
                              : 'text-slate-700'
                          }`}
                        >
                          [{sev.label}]
                        </span>
                        <span className="font-semibold text-slate-900">{evt.eventType}</span>
                        <span className="text-slate-400">·</span>
                        <span className="font-mono text-slate-700">{evt.patientCode}</span>
                      </div>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        {evt.timestamp} ·{' '}
                        {evt.resolvedStatus === 'resolved'
                          ? `已复核关闭（${evt.reviewedBy || '康复师'}）`
                          : '待处置复核'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700">事件描述：{evt.description}</p>
                    <p className="text-xs text-slate-600">系统动作：{evt.systemAction}</p>

                    {evt.resolvedStatus !== 'resolved' ? (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={triageInputs[evt.id] || ''}
                          onChange={(e) =>
                            setTriageInputs({ ...triageInputs, [evt.id]: e.target.value })
                          }
                          placeholder="输入康复师处置意见与后续跟进建议..."
                          className="min-w-[260px] flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => void handleResolveSafetyEvent(evt.id, 'resolved')}
                          className="rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
                        >
                          确认复核并闭环
                        </button>
                      </div>
                    ) : (
                      evt.therapistAction && (
                        <p className="text-xs text-teal-800">
                          康复师复核记录：{evt.therapistAction}
                        </p>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: AI STAGE REPORTS & THERAPIST REVIEW (§6) */}
      {activeSection === 'reports' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Report Selector + Generator */}
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4">
            <div className="space-y-3 border-b border-slate-100 pb-4">
              <h2 className="text-base font-semibold text-slate-900">AI 阶段性报告草稿</h2>
              <p className="text-xs text-slate-600">
                调用服务端 Gemini 模型综合客观行为日志、主观自评与康复师基线，生成待审核报告草稿。
              </p>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700">选择目标患者</label>
                <select
                  value={currentPatient?.patientCode ?? ''}
                  onChange={(e) => setSelectedPatientCode(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                >
                  {patients.map((p) => (
                    <option key={p.patientCode} value={p.patientCode}>
                      {p.displayLabel}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleGenerateReport()}
                  disabled={generatingReport || !currentPatient}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 disabled:bg-slate-300"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {generatingReport ? '正在汇总生成报告草稿...' : '生成 AI 阶段性报告草稿'}
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {reports.map((rep) => (
                <button
                  key={rep.id}
                  type="button"
                  onClick={() => setSelectedReportId(rep.id)}
                  className={`w-full py-3 px-2 text-left transition-colors ${
                    currentReport?.id === rep.id ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-900">
                      {rep.patientCode} · {rep.id}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        rep.status === 'approved'
                          ? 'text-emerald-700'
                          : rep.status === 'returned'
                          ? 'text-amber-700'
                          : 'text-teal-800'
                      }`}
                    >
                      {rep.status === 'approved'
                        ? '已通过'
                        : rep.status === 'returned'
                        ? '已退回'
                        : '待审核'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{rep.periodLabel}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Right 8-Section Report Viewer & Review Form */}
          <div className="space-y-6 lg:col-span-8">
            {currentReport ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <FileText className="h-3.5 w-3.5" />
                      <span>报告编号：{currentReport.id}</span>
                      <span>·</span>
                      <span>生成时间：{currentReport.generatedAt}</span>
                    </div>
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">
                      {currentReport.patientCode} 阶段性训练综合分析报告
                    </h3>
                  </div>

                  <span className="text-xs font-semibold text-teal-800">
                    审核状态：
                    {currentReport.status === 'approved'
                      ? '已审核通过'
                      : currentReport.status === 'returned'
                      ? '已退回补充'
                      : '待康复师人工审核'}
                  </span>
                </div>

                {/* 8 Structured Sections (§6.3) */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[
                    { title: '1. 基本信息', body: currentReport.sections.basicInfo },
                    { title: '2. 训练概览（客观记录）', body: currentReport.sections.trainingOverview },
                    {
                      title: '3. VR 交互行为表现（客观记录）',
                      body: currentReport.sections.behavioralPerformance,
                    },
                    {
                      title: '4. 患者主观自评反馈（自我报告）',
                      body: currentReport.sections.subjectiveFeedback,
                    },
                    {
                      title: '5. 多感官适应与偏好',
                      body: currentReport.sections.multisensoryAdaptation,
                    },
                    {
                      title: '6. AI 描述性观察与不确定性（非诊断）',
                      body: currentReport.sections.aiObservations,
                    },
                    { title: '7. 专业审核意见', body: currentReport.sections.professionalReview },
                    { title: '8. 数据来源与不可推断限制', body: currentReport.sections.dataLimitations },
                  ].map((sec) => (
                    <div
                      key={sec.title}
                      className="rounded-lg border border-slate-200 bg-slate-50/50 p-4"
                    >
                      <h4 className="text-xs font-semibold text-slate-900">{sec.title}</h4>
                      <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-slate-700">
                        {sec.body}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Separated AI Adjustment Proposal vs Therapist Decision (§5.5 & §6.4) */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">
                      AI 辅助调整建议（与康复师最终决策分离）
                    </h4>
                    <span className="text-xs text-slate-600">
                      {currentReport.adjustmentProposal.appliedByTherapist
                        ? `已于 ${currentReport.adjustmentProposal.appliedAt} 经人工确认采纳`
                        : '尚未人工采纳，不自动修改当前有效计划'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700">
                    建议参数：场景 {SCENE_META[currentReport.adjustmentProposal.suggestedScene].name.split('（')[0]} · 任务{' '}
                    {currentReport.adjustmentProposal.suggestedTasks
                      .map((t) => TASK_LABELS[t].short)
                      .join(' / ')}{' '}
                    · 音量上限 {currentReport.adjustmentProposal.suggestedAudioMaxVolume}% · 气味{' '}
                    {currentReport.adjustmentProposal.suggestedOlfactoryEnabled ? '授权' : '关闭'}
                  </p>
                  <p className="text-xs text-slate-600">
                    建议依据：{currentReport.adjustmentProposal.rationale}
                  </p>
                  <p className="text-xs text-amber-800">
                    不确定性提醒：{currentReport.adjustmentProposal.uncertaintyNote}
                  </p>
                </div>

                {/* Therapist Final Review Controls */}
                <div className="border-t border-slate-200 pt-5 space-y-4">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <ClipboardCheck className="h-4 w-4 text-teal-700" />
                    康复师专业审核与方案决策
                  </h4>

                  <textarea
                    rows={3}
                    value={reviewOpinion}
                    onChange={(e) => setReviewOpinion(e.target.value)}
                    placeholder="输入康复师专业审核意见、线下访谈观察或方案调整依据..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                  />

                  <div className="flex flex-wrap items-center gap-6 text-xs text-slate-700">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={flagAttentionChecked}
                        onChange={(e) => setFlagAttentionChecked(e.target.checked)}
                        className="h-4 w-4 accent-teal-700"
                      />
                      <span>标记为下一阶段“需重点关注”事项</span>
                    </label>

                    {!currentReport.adjustmentProposal.appliedByTherapist && (
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={applyProposalChecked}
                          onChange={(e) => setApplyProposalChecked(e.target.checked)}
                          className="h-4 w-4 accent-teal-700"
                        />
                        <span>人工确认采纳上述 AI 调整建议，并写入下一版本有效训练计划</span>
                      </label>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => void handleReviewReport('returned')}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      退回补充记录
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReviewReport('approved')}
                      className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
                    >
                      审核通过并留痕存档
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                暂无可查看的阶段性报告，请在左侧选择患者并点击生成报告草稿。
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
