import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addAuditLog, computeMetrics, persistStore, store } from './server/store.ts';
import { generatePlanRecommendation, generateStageReportDraft } from './server/gemini.ts';
import type {
  AIReport,
  HardwareState,
  PlanStatus,
  SafetyEvent,
  TaskType,
  TelemetryEvent,
  TrainingPlan,
  TrainingSession,
  UserRole,
  VerificationItem,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'SenseRehab', timestamp: new Date().toISOString() });
});

// Bootstrap endpoint scoped by role (enforces §2.2 permission boundaries)
app.get('/api/workspace', (req, res) => {
  const role = (req.query.role as UserRole) || 'therapist';
  const patientCode = (req.query.patientCode as string) || 'SR-P-2048';
  const therapistId = (req.query.therapistId as string) || 'TH-101';

  if (role === 'patient') {
    const patient = store.patients.find((p) => p.patientCode === patientCode);
    const plans = store.plans.filter((p) => p.patientCode === patientCode);
    const sessions = store.sessions.filter((s) => s.patientCode === patientCode);
    return res.json({
      institutionName: store.institutionName,
      role,
      patient,
      plans,
      sessions,
      hardwareInventory: store.hardwareInventory,
    });
  }

  if (role === 'admin') {
    // Institutional admin sees accounts, hardware, audit logs, and aggregate metrics.
    // Does NOT receive full individual AI clinical narrative reports by default (§2.2 & §5.6).
    return res.json({
      institutionName: store.institutionName,
      role,
      staff: store.staff,
      patients: store.patients.map((p) => ({
        patientCode: p.patientCode,
        displayLabel: p.displayLabel,
        assignedTherapistId: p.assignedTherapistId,
        assignedTherapistName: p.assignedTherapistName,
        riskTier: p.riskTier,
        supervisionDefault: p.supervisionDefault,
        consentSigned: p.consentSigned,
        lastUpdated: p.lastUpdated,
      })),
      hardwareInventory: store.hardwareInventory,
      metrics: computeMetrics(undefined),
      auditLogs: store.auditLogs.slice(0, 40),
      verificationItems: store.verificationItems,
      safetyEventsSummary: store.safetyEvents.map((e) => ({
        id: e.id,
        severity: e.severity,
        eventType: e.eventType,
        resolvedStatus: e.resolvedStatus,
        timestamp: e.timestamp,
      })),
    });
  }

  // Therapist role: scoped to authorized patients only
  const authorizedPatients = store.patients.filter(
    (p) => p.assignedTherapistId === therapistId,
  );
  const patientCodes = new Set(authorizedPatients.map((p) => p.patientCode));

  return res.json({
    institutionName: store.institutionName,
    role: 'therapist',
    staff: store.staff,
    patients: authorizedPatients,
    plans: store.plans.filter((p) => patientCodes.has(p.patientCode)),
    sessions: store.sessions.filter((s) => patientCodes.has(s.patientCode)),
    safetyEvents: store.safetyEvents.filter((e) => patientCodes.has(e.patientCode)),
    reports: store.reports.filter((r) => patientCodes.has(r.patientCode)),
    telemetryEvents: store.telemetryEvents.filter((t) => patientCodes.has(t.patientCode)),
    hardwareInventory: store.hardwareInventory,
    metrics: computeMetrics(therapistId),
    auditLogs: store.auditLogs.slice(0, 30),
    verificationItems: store.verificationItems,
  });
});

// Create or start a patient training session
app.post('/api/sessions', (req, res) => {
  const session = req.body as TrainingSession;
  if (!session || !session.patientCode || !session.planId) {
    return res.status(400).json({ error: '缺少必要会话字段（patientCode / planId）。' });
  }

  const existingIndex = store.sessions.findIndex((s) => s.id === session.id);
  if (existingIndex >= 0) {
    store.sessions[existingIndex] = session;
  } else {
    store.sessions.unshift(session);
  }
  persistStore();

  return res.json({ ok: true, session });
});

// Update an ongoing training session (pause, task logs, post-feedback, exit, abort)
app.patch('/api/sessions/:id', (req, res) => {
  const { id } = req.params;
  const patch = req.body as Partial<TrainingSession>;
  const idx = store.sessions.findIndex((s) => s.id === id);
  if (idx < 0) {
    return res.status(404).json({ error: '未找到对应的训练会话记录。' });
  }
  store.sessions[idx] = {
    ...store.sessions[idx],
    ...patch,
  };
  persistStore();
  return res.json({ ok: true, session: store.sessions[idx] });
});

// Log telemetry event (§9)
app.post('/api/telemetry', (req, res) => {
  const evt = req.body as Omit<TelemetryEvent, 'id' | 'timestamp'>;
  const entry: TelemetryEvent = {
    id: `TEL-${Date.now().toString().slice(-6)}`,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    ...evt,
  };
  store.telemetryEvents.unshift(entry);
  persistStore();
  return res.json({ ok: true, event: entry });
});

// Log or update safety event (§10)
app.post('/api/safety-events', (req, res) => {
  const body = req.body as Omit<SafetyEvent, 'id' | 'timestamp'>;
  const evt: SafetyEvent = {
    id: `EVT-${Date.now().toString().slice(-5)}`,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    ...body,
  };
  store.safetyEvents.unshift(evt);
  addAuditLog(
    'patient',
    evt.patientCode,
    '触发安全/异常事件记录',
    evt.id,
    `${evt.eventType}（${evt.severity}）：${evt.description}`,
  );
  return res.json({ ok: true, safetyEvent: evt });
});

app.patch('/api/safety-events/:id', (req, res) => {
  const { id } = req.params;
  const { resolvedStatus, therapistAction, reviewedBy } = req.body as {
    resolvedStatus: SafetyEvent['resolvedStatus'];
    therapistAction?: string;
    reviewedBy: string;
  };
  const idx = store.safetyEvents.findIndex((e) => e.id === id);
  if (idx < 0) {
    return res.status(404).json({ error: '未找到异常事件记录。' });
  }
  store.safetyEvents[idx] = {
    ...store.safetyEvents[idx],
    resolvedStatus,
    therapistAction: therapistAction ?? store.safetyEvents[idx].therapistAction,
    reviewedBy,
  };
  addAuditLog(
    'therapist',
    reviewedBy,
    '处置安全异常事件',
    id,
    `状态更新为 ${resolvedStatus}${therapistAction ? `；处理意见：${therapistAction}` : ''}`,
  );
  return res.json({ ok: true, safetyEvent: store.safetyEvents[idx] });
});

// Create or update training plan (§5.3)
app.post('/api/plans', (req, res) => {
  const planInput = req.body as Omit<TrainingPlan, 'id' | 'version' | 'adjustmentHistory'>;
  if (!planInput.patientCode || !planInput.goal) {
    return res.status(400).json({ error: '训练目标与患者编号不能为空。' });
  }
  const newPlan: TrainingPlan = {
    ...planInput,
    id: `PLAN-${planInput.patientCode.slice(-4)}-${Date.now().toString().slice(-2)}`,
    version: 1,
    adjustmentHistory: [
      {
        version: 1,
        adjustedBy: planInput.therapistName,
        adjustedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        reason: '康复师创建新阶段训练计划。',
      },
    ],
  };
  store.plans.unshift(newPlan);
  addAuditLog(
    'therapist',
    planInput.therapistName,
    '创建训练计划',
    newPlan.id,
    `为 ${planInput.patientCode} 创建计划（场景：${planInput.scene}，状态：${planInput.status}）`,
  );
  return res.json({ ok: true, plan: newPlan });
});

app.patch('/api/plans/:id', (req, res) => {
  const { id } = req.params;
  const body = req.body as Partial<TrainingPlan> & {
    adjustedBy?: string;
    adjustmentReason?: string;
  };
  const idx = store.plans.findIndex((p) => p.id === id);
  if (idx < 0) {
    return res.status(404).json({ error: '未找到对应的训练计划。' });
  }
  const current = store.plans[idx];
  const nextVersion = current.version + 1;
  const actor = body.adjustedBy || current.therapistName;
  const reason = body.adjustmentReason || '康复师手动调整训练方案参数。';

  const updated: TrainingPlan = {
    ...current,
    ...body,
    version: nextVersion,
    adjustmentHistory: [
      ...current.adjustmentHistory,
      {
        version: nextVersion,
        adjustedBy: actor,
        adjustedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        reason,
      },
    ],
  };
  store.plans[idx] = updated;
  addAuditLog('therapist', actor, '调整训练计划', id, `版本升至 v${nextVersion}：${reason}`);
  return res.json({ ok: true, plan: updated });
});

app.patch('/api/plans/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, actorName } = req.body as { status: PlanStatus; actorName: string };
  const idx = store.plans.findIndex((p) => p.id === id);
  if (idx < 0) return res.status(404).json({ error: '未找到计划。' });
  store.plans[idx].status = status;
  addAuditLog('therapist', actorName, '变更计划状态', id, `状态变更为 ${status}`);
  return res.json({ ok: true, plan: store.plans[idx] });
});

// Generate AI stage-based report draft (§6)
app.post('/api/reports/generate', async (req, res) => {
  try {
    const { patientCode, therapistId, therapistName } = req.body as {
      patientCode: string;
      therapistId: string;
      therapistName: string;
    };
    const patient = store.patients.find((p) => p.patientCode === patientCode);
    if (!patient) {
      return res.status(404).json({ error: '未找到指定患者档案。' });
    }
    const plan =
      store.plans.find((p) => p.patientCode === patientCode && p.status === 'active') ||
      store.plans.find((p) => p.patientCode === patientCode);
    const sessions = store.sessions.filter((s) => s.patientCode === patientCode);
    const safetyEvents = store.safetyEvents.filter((e) => e.patientCode === patientCode);

    const generated = await generateStageReportDraft({
      patient,
      plan,
      sessions,
      safetyEvents,
    });

    const newReport: AIReport = {
      id: `REP-${patientCode.slice(-4)}-${Date.now().toString().slice(-3)}`,
      patientCode,
      therapistId,
      generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      periodLabel: `截至 ${new Date().toISOString().slice(0, 10)} 阶段汇总`,
      sessionCountIncluded: sessions.length,
      status: 'pending_review',
      flaggedForAttention: safetyEvents.some((e) => e.resolvedStatus !== 'resolved'),
      sections: generated.sections,
      adjustmentProposal: generated.adjustmentProposal,
    };

    store.reports.unshift(newReport);
    addAuditLog(
      'therapist',
      therapistName,
      '生成 AI 阶段性报告草稿',
      newReport.id,
      `为 ${patientCode} 生成报告草稿（状态：待审核）`,
    );

    return res.json({ ok: true, report: newReport });
  } catch (err) {
    const message = err instanceof Error ? err.message : '生成 AI 报告失败';
    return res.status(500).json({ error: message });
  }
});

// Therapist review of AI report (§5.5 & §6.4)
app.patch('/api/reports/:id/review', (req, res) => {
  const { id } = req.params;
  const {
    status,
    therapistOpinion,
    reviewedBy,
    flaggedForAttention,
    applyAdjustmentToPlan,
  } = req.body as {
    status: AIReport['status'];
    therapistOpinion: string;
    reviewedBy: string;
    flaggedForAttention?: boolean;
    applyAdjustmentToPlan?: boolean;
  };

  const idx = store.reports.findIndex((r) => r.id === id);
  if (idx < 0) {
    return res.status(404).json({ error: '未找到报告草稿。' });
  }

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const report = store.reports[idx];
  report.status = status;
  report.therapistOpinion = therapistOpinion;
  report.reviewedBy = reviewedBy;
  report.reviewedAt = now;
  if (typeof flaggedForAttention === 'boolean') {
    report.flaggedForAttention = flaggedForAttention;
  }
  report.sections.professionalReview = `审核状态：${
    status === 'approved' ? '已审核通过' : status === 'returned' ? '已退回补充' : '待审核'
  }｜审核人：${reviewedBy}｜审核时间：${now}｜专业意见：${therapistOpinion || '无附加意见'}`;

  let updatedPlan: TrainingPlan | undefined;
  if (status === 'approved' && applyAdjustmentToPlan && !report.adjustmentProposal.appliedByTherapist) {
    const planIdx = store.plans.findIndex(
      (p) => p.patientCode === report.patientCode && p.status === 'active',
    );
    if (planIdx >= 0) {
      const currentPlan = store.plans[planIdx];
      const nextVersion = currentPlan.version + 1;
      const proposal = report.adjustmentProposal;
      const nextAllowed = proposal.suggestedTasks.filter((t): t is TaskType =>
        ['A_BASIC', 'B_AUDITORY', 'C_OLFACTORY', 'D_COMPREHENSIVE'].includes(t),
      );
      store.plans[planIdx] = {
        ...currentPlan,
        version: nextVersion,
        scene: proposal.suggestedScene,
        allowedTasks: nextAllowed.length > 0 ? nextAllowed : currentPlan.allowedTasks,
        sensoryConfig: {
          ...currentPlan.sensoryConfig,
          maxVolumePercent: proposal.suggestedAudioMaxVolume,
          olfactoryEnabled: proposal.suggestedOlfactoryEnabled,
        },
        adjustmentHistory: [
          ...currentPlan.adjustmentHistory,
          {
            version: nextVersion,
            adjustedBy: reviewedBy,
            adjustedAt: now,
            reason: `经康复师审核确认后采纳报告 ${report.id} 调整建议：${proposal.rationale}`,
          },
        ],
      };
      updatedPlan = store.plans[planIdx];
      report.adjustmentProposal.appliedByTherapist = true;
      report.adjustmentProposal.appliedAt = now;
    }
  }

  addAuditLog(
    'therapist',
    reviewedBy,
    '审核阶段性报告',
    id,
    `审核结果：${status}${applyAdjustmentToPlan ? '（已确认应用方案调整）' : ''}`,
  );

  return res.json({ ok: true, report, updatedPlan });
});

// Bounded AI plan recommendation endpoint
app.post('/api/recommendations/suggest', async (req, res) => {
  try {
    const { patientCode } = req.body as { patientCode: string };
    const patient = store.patients.find((p) => p.patientCode === patientCode);
    if (!patient) return res.status(404).json({ error: '未找到患者信息。' });
    const plan = store.plans.find((p) => p.patientCode === patientCode && p.status === 'active');
    const recentSessions = store.sessions.filter((s) => s.patientCode === patientCode);
    const suggestion = await generatePlanRecommendation({
      patient,
      plan,
      recentSessions,
    });
    return res.json({ ok: true, suggestion });
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取 AI 推荐失败';
    return res.status(500).json({ error: message });
  }
});

// Institution Admin actions (§5.6)
app.patch('/api/admin/hardware/:id', (req, res) => {
  const { id } = req.params;
  const { status, note, actorName } = req.body as {
    status: HardwareState;
    note?: string;
    actorName: string;
  };
  const idx = store.hardwareInventory.findIndex((h) => h.id === id);
  if (idx < 0) return res.status(404).json({ error: '未找到设备记录。' });
  store.hardwareInventory[idx] = {
    ...store.hardwareInventory[idx],
    status,
    note: note ?? store.hardwareInventory[idx].note,
    lastCheckedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
  };
  addAuditLog('admin', actorName, '更新设备模块状态', id, `设备状态变更为 ${status}`);
  return res.json({ ok: true, hardware: store.hardwareInventory[idx] });
});

app.patch('/api/admin/patients/:patientCode/assign', (req, res) => {
  const { patientCode } = req.params;
  const { therapistId, actorName } = req.body as {
    therapistId: string;
    actorName: string;
  };
  const pIdx = store.patients.findIndex((p) => p.patientCode === patientCode);
  const therapist = store.staff.find((s) => s.id === therapistId && s.role === 'therapist');
  if (pIdx < 0 || !therapist) {
    return res.status(404).json({ error: '患者或康复师账号不存在。' });
  }
  store.patients[pIdx].assignedTherapistId = therapist.id;
  store.patients[pIdx].assignedTherapistName = therapist.name;
  addAuditLog(
    'admin',
    actorName,
    '变更患者授权归属',
    patientCode,
    `授权责任康复师变更为 ${therapist.name}`,
  );
  return res.json({ ok: true, patient: store.patients[pIdx] });
});

// Update Three-Layer Product Verification record (§11)
app.patch('/api/verification/:id', (req, res) => {
  const { id } = req.params;
  const { status, evidenceNote, updatedBy } = req.body as {
    status: VerificationItem['status'];
    evidenceNote?: string;
    updatedBy: string;
  };
  const idx = store.verificationItems.findIndex((v) => v.id === id);
  if (idx < 0) return res.status(404).json({ error: '未找到验证条目。' });
  store.verificationItems[idx] = {
    ...store.verificationItems[idx],
    status,
    evidenceNote: evidenceNote ?? store.verificationItems[idx].evidenceNote,
    updatedBy,
    updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
  };
  addAuditLog(
    'therapist',
    updatedBy,
    '更新三层产品验证状态',
    id,
    `状态变更为 ${status}`,
  );
  return res.json({ ok: true, item: store.verificationItems[idx] });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(__dirname, 'dist');

  if (!isProd || !fs.existsSync(distDir)) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`SenseRehab server running on http://0.0.0.0:${port}`);
  });
}

startServer();
