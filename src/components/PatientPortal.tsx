import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Pause,
  Play,
  ShieldAlert,
  SkipForward,
  Square,
  Volume2,
  Wind,
} from 'lucide-react';
import type {
  HardwareInventoryItem,
  HardwareSnapshot,
  PatientProfile,
  PostTrainingFeedback,
  PreTrainingFeedback,
  SceneId,
  TaskLogEntry,
  TaskType,
  TrainingPlan,
  TrainingSession,
} from '../types';
import {
  formatDuration,
  PLAN_STATUS_LABELS,
  SCENE_META,
  SESSION_STATUS_LABELS,
  TASK_LABELS,
} from '../utils/labels';
import { soundscape, type SoundCueType } from '../utils/soundscape';
import { ImmersiveViewport } from './ImmersiveViewport';

interface PatientPortalProps {
  activeSection: 'plan' | 'check' | 'session' | 'history';
  onNavigateSection: (sec: 'plan' | 'check' | 'session' | 'history') => void;
  patient: PatientProfile;
  plans: TrainingPlan[];
  sessions: TrainingSession[];
  hardwareInventory: HardwareInventoryItem[];
  onRefreshWorkspace: () => Promise<void>;
}

const AUDITORY_ROUNDS: Array<{
  cue: SoundCueType;
  label: string;
  prompt: string;
}> = [
  {
    cue: 'birdsong',
    label: '林间鸟鸣',
    prompt: '请聆听当前播放的自然提示音，选出您清晰辨识到的声音类别：',
  },
  {
    cue: 'wind_leaves',
    label: '风拂树叶声',
    prompt: '请专注辨识第二段自然环境声景元素：',
  },
  {
    cue: 'stream_water',
    label: '溪流流水声',
    prompt: '请确认第三段自然水声与环境韵律：',
  },
];

export const PatientPortal: React.FC<PatientPortalProps> = ({
  activeSection,
  onNavigateSection,
  patient,
  plans,
  sessions,
  hardwareInventory,
  onRefreshWorkspace,
}) => {
  const activePlan = useMemo(
    () => plans.find((p) => p.status === 'active') || plans[0],
    [plans],
  );

  // Selected scene & task mode within therapist authorization
  const [selectedScene, setSelectedScene] = useState<SceneId>(activePlan?.scene ?? 'forest');
  const [selectedMode, setSelectedMode] = useState<TaskType>(
    activePlan?.primaryMode ?? 'A_BASIC',
  );

  // P-02 & P-03 Pre-training state
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const [preTension, setPreTension] = useState(5);
  const [preComfort, setPreComfort] = useState(6);
  const [contraindicationConfirmed, setContraindicationConfirmed] = useState(false);
  const [preNote, setPreNote] = useState('');

  // P-04 Hardware check (seeded from institution hardware, adjustable in Demo to test degradation §7.1)
  const defaultOlfactoryReady = hardwareInventory.some(
    (h) => h.moduleType === 'olfactory_dispenser' && h.status === 'ready',
  );
  const [hwVrStatus, setHwVrStatus] = useState<'ready' | 'offline'>('ready');
  const [hwAudioStatus, setHwAudioStatus] = useState<'ready' | 'offline'>('ready');
  const [hwOlfactoryStatus, setHwOlfactoryStatus] = useState<'ready' | 'not_equipped' | 'offline'>(
    defaultOlfactoryReady ? 'ready' : 'not_equipped',
  );
  const [supervisorConfirmed, setSupervisorConfirmed] = useState(false);

  // Live training session state
  const [currentSession, setCurrentSession] = useState<TrainingSession | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pauseCount, setPauseCount] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [volumePercent, setVolumePercent] = useState(
    Math.min(50, activePlan?.sensoryConfig.maxVolumePercent ?? 60),
  );
  const [olfactoryActive, setOlfactoryActive] = useState(false);
  const [olfactoryChoice, setOlfactoryChoice] = useState('松木清香（低强度）');

  // Task progression inside D or individual mode
  const [activeSubTask, setActiveSubTask] = useState<TaskType>('A_BASIC');
  const [completedTaskLogs, setCompletedTaskLogs] = useState<TaskLogEntry[]>([]);
  const subTaskStartRef = useRef<number>(Date.now());

  // B Auditory interactive rounds
  const [auditoryRoundIdx, setAuditoryRoundIdx] = useState(0);
  const [cuePlayedAt, setCuePlayedAt] = useState<number | null>(null);
  const [auditoryStats, setAuditoryStats] = useState<{
    reactionTimes: number[];
    correctCount: number;
  }>({ reactionTimes: [], correctCount: 0 });
  const [auditoryFeedbackMsg, setAuditoryFeedbackMsg] = useState('');

  // Post-training feedback step
  const [showPostForm, setShowPostForm] = useState(false);
  const [postTension, setPostTension] = useState(4);
  const [postComfort, setPostComfort] = useState(7);
  const [postOverall, setPostOverall] = useState(8);
  const [postPrefScene, setPostPrefScene] = useState<SceneId | 'neutral'>('forest');
  const [postAudioComfort, setPostAudioComfort] =
    useState<PostTrainingFeedback['audioComfort']>('comfortable');
  const [postOlfactoryPref, setPostOlfactoryPref] =
    useState<NonNullable<PostTrainingFeedback['olfactoryPreference']>>('not_used');
  const [postOpenText, setPostOpenText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activePlan) {
      setSelectedScene(activePlan.scene);
      setSelectedMode(activePlan.primaryMode);
      setVolumePercent((v) => Math.min(v, activePlan.sensoryConfig.maxVolumePercent));
    }
  }, [activePlan]);

  // Session elapsed timer
  useEffect(() => {
    if (!currentSession || currentSession.status !== 'in_progress' || isPaused) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [currentSession, isPaused]);

  // Cleanup Web Audio when unmounting or leaving active session
  useEffect(() => {
    return () => {
      soundscape.stopAll();
    };
  }, []);

  // Hardware degradation rules (§7.1)
  const olfactoryBlockedByHardware = hwOlfactoryStatus !== 'ready';
  const olfactoryAllowedByPlan = activePlan?.sensoryConfig.olfactoryEnabled ?? false;
  const canRunOlfactory = !olfactoryBlockedByHardware && olfactoryAllowedByPlan;

  const canStartTraining =
    Boolean(activePlan) &&
    activePlan?.status === 'active' &&
    noticeAccepted &&
    contraindicationConfirmed &&
    hwVrStatus === 'ready' &&
    hwAudioStatus === 'ready' &&
    (activePlan?.supervisionMode !== 'therapist_supervised' || supervisorConfirmed);

  const logTelemetry = async (
    eventName:
      | 'plan_view'
      | 'training_start'
      | 'task_start'
      | 'task_complete'
      | 'training_pause'
      | 'training_exit'
      | 'sensory_feedback'
      | 'safety_event',
    properties: Record<string, string | number | boolean>,
    sessionId?: string,
  ) => {
    try {
      await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName,
          patientCode: patient.patientCode,
          sessionId,
          planId: activePlan?.id,
          properties,
        }),
      });
    } catch {
      // Non-blocking telemetry
    }
  };

  const handleStartTraining = async () => {
    if (!activePlan || !canStartTraining) return;

    // Enforce degradation rule: if C_OLFACTORY selected when hardware unavailable, degrade cleanly
    let effectiveMode = selectedMode;
    if (selectedMode === 'C_OLFACTORY' && !canRunOlfactory) {
      effectiveMode = 'A_BASIC';
    }

    const hardwareSnapshot: HardwareSnapshot = {
      vrStatus: hwVrStatus,
      audioStatus: hwAudioStatus,
      olfactoryStatus: hwOlfactoryStatus,
      isWebSimulation: true,
    };

    const preFeedback: PreTrainingFeedback = {
      tensionScore: preTension,
      comfortScore: preComfort,
      contraindicationConfirmed,
      note: preNote,
      scaleVersion: '自评体验量表 v1.0',
      submittedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };

    const initialSubTask: TaskType =
      effectiveMode === 'D_COMPREHENSIVE' ? 'A_BASIC' : effectiveMode;

    const newSession: TrainingSession = {
      id: `SES-${Date.now().toString().slice(-6)}`,
      planId: activePlan.id,
      planVersion: activePlan.version,
      patientCode: patient.patientCode,
      therapistId: activePlan.therapistId,
      scene: selectedScene,
      mode: effectiveMode,
      status: 'in_progress',
      startedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      elapsedSeconds: 0,
      supervisionRequired: activePlan.supervisionMode === 'therapist_supervised',
      supervisorConfirmedBy: supervisorConfirmed ? activePlan.therapistName : undefined,
      hardwareSnapshot,
      preFeedback,
      taskLogs: [],
      pauseCount: 0,
    };

    setCurrentSession(newSession);
    setElapsedSeconds(0);
    setPauseCount(0);
    setIsPaused(false);
    setCompletedTaskLogs([]);
    setActiveSubTask(initialSubTask);
    setAuditoryRoundIdx(0);
    setAuditoryStats({ reactionTimes: [], correctCount: 0 });
    setAuditoryFeedbackMsg('');
    setOlfactoryActive(initialSubTask === 'C_OLFACTORY' && canRunOlfactory);
    subTaskStartRef.current = Date.now();
    setShowPostForm(false);

    if (audioEnabled) {
      soundscape.startAmbient(selectedScene, volumePercent);
    }

    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSession),
    });

    void logTelemetry(
      'training_start',
      {
        scene_id: selectedScene,
        plan_version: activePlan.version,
        device_status: `${hwVrStatus}/${hwAudioStatus}/${hwOlfactoryStatus}`,
      },
      newSession.id,
    );

    if (olfactoryBlockedByHardware && activePlan.allowedTasks.includes('C_OLFACTORY')) {
      await fetch('/api/safety-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: newSession.id,
          patientCode: patient.patientCode,
          severity: 'notice',
          eventType: '可选气味设备未连接降级',
          description: '训练启动检测气味模块不可用，系统已按规则自动禁用 C 嗅觉任务。',
          systemAction: '保留 A 基础体验与 B 听觉可选任务。',
          resolvedStatus: 'resolved',
        }),
      });
    }

    onNavigateSection('session');
    void onRefreshWorkspace();
  };

  const handleTogglePause = async () => {
    if (!currentSession) return;
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    const nextPauseCount = nextPaused ? pauseCount + 1 : pauseCount;
    if (nextPaused) {
      setPauseCount(nextPauseCount);
      soundscape.stopAll();
      void logTelemetry('training_pause', { pause_reason: 'patient_manual_pause' }, currentSession.id);
    } else if (audioEnabled) {
      soundscape.startAmbient(selectedScene, volumePercent);
    }

    const updatedStatus = nextPaused ? 'paused' : 'in_progress';
    setCurrentSession({ ...currentSession, status: updatedStatus, pauseCount: nextPauseCount });

    await fetch(`/api/sessions/${currentSession.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: updatedStatus,
        pauseCount: nextPauseCount,
        elapsedSeconds,
      }),
    });

    // Consecutive pause attention alert (§10.2)
    if (nextPaused && nextPauseCount >= 2) {
      await fetch('/api/safety-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id,
          patientCode: patient.patientCode,
          severity: 'attention',
          eventType: '连续暂停提示',
          description: `患者在单次训练中已暂停 ${nextPauseCount} 次，建议关注舒适度与耐受状态。`,
          systemAction: '暂缓环境动态与音频播放，等待患者自主决定恢复或退出。',
          resolvedStatus: 'open',
        }),
      });
      void onRefreshWorkspace();
    }
  };

  const handleToggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    if (!next) {
      soundscape.stopAll();
    } else if (!isPaused) {
      soundscape.startAmbient(selectedScene, volumePercent);
    }
  };

  const handleVolumeChange = (val: number) => {
    const capped = Math.min(val, activePlan?.sensoryConfig.maxVolumePercent ?? 70);
    setVolumePercent(capped);
    soundscape.setVolume(capped);
  };

  const handleShutoffOlfactory = async () => {
    setOlfactoryActive(false);
    setPostOlfactoryPref('discomfort');
    setBannerMessage('已立即关闭气味模拟通道。您可以安心继续当前观察或随时暂停。');
    if (currentSession) {
      await fetch('/api/safety-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id,
          patientCode: patient.patientCode,
          severity: 'notice',
          eventType: '患者主动关闭气味通道',
          description: '患者在训练过程中点击独立关闭气味刺激控制。',
          systemAction: '立即停止气味模拟并记录。',
          resolvedStatus: 'open',
        }),
      });
    }
  };

  const pushTaskLog = (entry: TaskLogEntry) => {
    const nextLogs = [...completedTaskLogs, entry];
    setCompletedTaskLogs(nextLogs);
    return nextLogs;
  };

  const advanceOrFinishSubTask = async (
    status: 'completed' | 'skipped',
    detailNote: string,
    extra?: { reactionTimeMs?: number; accuracyPercent?: number; selectedOption?: string },
  ) => {
    if (!currentSession) return;
    const subDuration = Math.max(5, Math.round((Date.now() - subTaskStartRef.current) / 1000));
    const newEntry: TaskLogEntry = {
      taskType: activeSubTask,
      label: TASK_LABELS[activeSubTask].name,
      status,
      durationSeconds: subDuration,
      detailNote,
      ...extra,
    };
    const nextLogs = pushTaskLog(newEntry);

    void logTelemetry(
      'task_complete',
      { task_type: activeSubTask, duration: subDuration, result_status: status },
      currentSession.id,
    );

    if (currentSession.mode === 'D_COMPREHENSIVE') {
      if (activeSubTask === 'A_BASIC' && activePlan?.allowedTasks.includes('B_AUDITORY')) {
        setActiveSubTask('B_AUDITORY');
        subTaskStartRef.current = Date.now();
        await fetch(`/api/sessions/${currentSession.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskLogs: nextLogs, elapsedSeconds }),
        });
        return;
      }
      if (
        (activeSubTask === 'A_BASIC' || activeSubTask === 'B_AUDITORY') &&
        activePlan?.allowedTasks.includes('C_OLFACTORY') &&
        canRunOlfactory
      ) {
        setActiveSubTask('C_OLFACTORY');
        setOlfactoryActive(true);
        subTaskStartRef.current = Date.now();
        await fetch(`/api/sessions/${currentSession.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskLogs: nextLogs, elapsedSeconds }),
        });
        return;
      }
    }

    // Complete session and enter post-training feedback
    await finishSession('completed', nextLogs);
  };

  const finishSession = async (
    finalStatus: 'completed' | 'voluntary_exit' | 'abnormal_abort',
    logsOverride?: TaskLogEntry[],
    reason?: string,
  ) => {
    if (!currentSession) return;
    soundscape.stopAll();
    setOlfactoryActive(false);

    const finalLogs = logsOverride ?? completedTaskLogs;
    const endedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const updated: TrainingSession = {
      ...currentSession,
      status: finalStatus,
      endedAt,
      elapsedSeconds,
      pauseCount,
      taskLogs: finalLogs,
      exitReason: finalStatus === 'voluntary_exit' ? reason : undefined,
      abortReason: finalStatus === 'abnormal_abort' ? reason : undefined,
    };

    setCurrentSession(updated);
    await fetch(`/api/sessions/${currentSession.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });

    if (finalStatus !== 'completed') {
      void logTelemetry(
        'training_exit',
        { exit_reason: reason || finalStatus, elapsed_time: elapsedSeconds },
        currentSession.id,
      );
    }

    setPostPrefScene(selectedScene);
    setShowPostForm(true);
    void onRefreshWorkspace();
  };

  const handleReportDiscomfortEscalation = async () => {
    if (!currentSession) return;
    soundscape.stopAll();
    setOlfactoryActive(false);

    await fetch('/api/safety-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: currentSession.id,
        patientCode: patient.patientCode,
        severity: 'high_risk',
        eventType: '患者主动报告明显不适 / 请求协助',
        description: '患者在训练过程中点击“明显不适 / 立即停止并呼叫协助”，训练已安全中止。',
        systemAction: '立即切断视听及嗅觉模拟刺激，保存已产生记录并向康复师发起人工复核提醒。',
        resolvedStatus: 'open',
      }),
    });

    setBannerMessage('已立即停止全部感官输出并通知责任康复师，您的安全记录已妥善保存。');
    await finishSession(
      'abnormal_abort',
      completedTaskLogs,
      '患者主动触发不适停止并请求康复师协助',
    );
  };

  const handlePlayAuditoryCue = () => {
    const round = AUDITORY_ROUNDS[auditoryRoundIdx];
    soundscape.playTaskCue(round.cue);
    setCuePlayedAt(Date.now());
    setAuditoryFeedbackMsg('提示音已播放，请选择您辨识到的自然声音元素。');
  };

  const handleSelectAuditoryOption = (chosen: SoundCueType) => {
    const round = AUDITORY_ROUNDS[auditoryRoundIdx];
    const rt = cuePlayedAt ? Math.max(250, Date.now() - cuePlayedAt) : 1600;
    const isCorrect = chosen === round.cue;
    const nextReactionTimes = [...auditoryStats.reactionTimes, rt];
    const nextCorrect = auditoryStats.correctCount + (isCorrect ? 1 : 0);

    setAuditoryStats({ reactionTimes: nextReactionTimes, correctCount: nextCorrect });

    if (auditoryRoundIdx < AUDITORY_ROUNDS.length - 1) {
      setAuditoryRoundIdx((i) => i + 1);
      setCuePlayedAt(null);
      setAuditoryFeedbackMsg(
        isCorrect ? `已记录选择（反应时 ${rt}ms），可点击播放下一段声音。` : `已记录选择（反应时 ${rt}ms），请继续下一段。`,
      );
    } else {
      const avgRt = Math.round(
        nextReactionTimes.reduce((a, b) => a + b, 0) / nextReactionTimes.length,
      );
      const accuracy = Math.round((nextCorrect / AUDITORY_ROUNDS.length) * 100);
      void advanceOrFinishSubTask('completed', '完成 B 听觉自然声景层次辨识任务', {
        reactionTimeMs: avgRt,
        accuracyPercent: accuracy,
        selectedOption: '林间鸟鸣 / 树叶风声 / 溪流声',
      });
    }
  };

  const handleSubmitPostFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return;
    setSubmitting(true);
    try {
      const postFeedback: PostTrainingFeedback = {
        tensionScore: postTension,
        comfortScore: postComfort,
        overallExperienceScore: postOverall,
        preferredScene: postPrefScene,
        audioComfort: postAudioComfort,
        audioDiscomfortFlag: postAudioComfort === 'discomfort',
        olfactoryPreference:
          completedTaskLogs.some((t) => t.taskType === 'C_OLFACTORY')
            ? postOlfactoryPref
            : 'not_used',
        olfactoryDiscomfortFlag: postOlfactoryPref === 'discomfort',
        openText: postOpenText,
        scaleVersion: '自评体验量表 v1.0',
        submittedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      };

      await fetch(`/api/sessions/${currentSession.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postFeedback }),
      });

      void logTelemetry(
        'sensory_feedback',
        {
          sensory_type: 'post_session_summary',
          preference: postPrefScene,
          discomfort_flag:
            postFeedback.audioDiscomfortFlag || postFeedback.olfactoryDiscomfortFlag,
        },
        currentSession.id,
      );

      if (postFeedback.audioDiscomfortFlag || postFeedback.olfactoryDiscomfortFlag) {
        await fetch('/api/safety-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: currentSession.id,
            patientCode: patient.patientCode,
            severity: 'attention',
            eventType: '训练后感官不适反馈',
            description: `患者训练后标注感官不适（音频：${postAudioComfort}，气味：${postOlfactoryPref}）。`,
            systemAction: '已自动标记待康复师复核并同步训练档案。',
            resolvedStatus: 'open',
          }),
        });
      }

      setCurrentSession(null);
      setShowPostForm(false);
      setNoticeAccepted(false);
      setContraindicationConfirmed(false);
      setSupervisorConfirmed(false);
      setPostOpenText('');
      setBannerMessage('训练记录与主观体验反馈已安全保存，并同步至责任康复师工作台。');
      await onRefreshWorkspace();
      onNavigateSection('history');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      {/* Patient Identity & Scope Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-medium text-slate-500">
            患者训练端 · 仅访问本人授权训练计划与记录
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            欢迎回来，{patient.displayLabel}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span>责任康复师：{patient.assignedTherapistName}</span>
            <span aria-hidden="true">·</span>
            <span>
              监督模式：{activePlan?.supervisionMode === 'therapist_supervised' ? '需康复师现场监督' : '自主训练'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{patient.focusArea}</span>
          </div>
        </div>

        {/* Sub-view switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {[
            { id: 'plan', label: '1. 今日计划' },
            { id: 'check', label: '2. 检测与确认' },
            { id: 'session', label: '3. 沉浸训练' },
            { id: 'history', label: '4. 我的记录' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigateSection(tab.id as typeof activeSection)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeSection === tab.id
                  ? 'bg-teal-700 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {bannerMessage && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-3 text-sm text-teal-950">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-700" />
            <span>{bannerMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="text-xs font-medium text-teal-800 hover:underline whitespace-nowrap shrink-0"
          >
            知道了
          </button>
        </div>
      )}

      {/* SECTION 1: TODAY'S PLAN & INSTRUCTIONS (P-01 & P-02) */}
      {activeSection === 'plan' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">今日训练计划</h2>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {activePlan ? `${activePlan.id} · v${activePlan.version} · ${PLAN_STATUS_LABELS[activePlan.status]}` : '暂无生效计划'}
                </span>
              </div>

              {activePlan ? (
                <div className="mt-4 space-y-5">
                  <div className="rounded-lg bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500">康复师设定训练目标</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-800">{activePlan.goal}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-xs font-medium text-slate-500">计划场景选择（可确认）</p>
                      <div className="mt-3 space-y-2.5">
                        {(['forest', 'stream'] as SceneId[]).map((sid) => {
                          const sMeta = SCENE_META[sid];
                          const isRecommended = activePlan.scene === sid;
                          const selected = selectedScene === sid;
                          return (
                            <button
                              key={sid}
                              type="button"
                              onClick={() => setSelectedScene(sid)}
                              className={`flex w-full items-start justify-between rounded-lg border p-3 text-left transition-colors ${
                                selected
                                  ? 'border-teal-700 bg-teal-50/50'
                                  : 'border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <div>
                                <p className="text-sm font-medium text-slate-900">{sMeta.name}</p>
                                <p className="mt-0.5 text-xs text-slate-500">{sMeta.audioElements}</p>
                              </div>
                              {isRecommended && (
                                <span className="text-xs font-medium text-teal-700 whitespace-nowrap shrink-0">
                                  计划默认
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-xs font-medium text-slate-500">授权任务模块（可自愿选择）</p>
                      <div className="mt-3 space-y-2">
                        {activePlan.allowedTasks.map((t) => {
                          const info = TASK_LABELS[t];
                          const isSelected = selectedMode === t;
                          const isOlfactoryLocked = t === 'C_OLFACTORY' && !canRunOlfactory;
                          return (
                            <button
                              key={t}
                              type="button"
                              disabled={isOlfactoryLocked}
                              onClick={() => setSelectedMode(t)}
                              className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                                isOlfactoryLocked
                                  ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
                                  : isSelected
                                  ? 'border-teal-700 bg-teal-50/50'
                                  : 'border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-900">
                                  {info.name}
                                </span>
                                {isOlfactoryLocked ? (
                                  <span className="text-xs text-amber-700">硬件未配备已降级</span>
                                ) : isSelected ? (
                                  <span className="text-xs font-medium text-teal-700">已选定</span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs text-slate-600">{info.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
                    <span>有效期：{activePlan.validFrom} 至 {activePlan.validTo}</span>
                    <span>频次：{activePlan.frequency}</span>
                    <span>音量安全上限：{activePlan.sensoryConfig.maxVolumePercent}%</span>
                  </div>
                  <p className="text-xs text-slate-500">{activePlan.durationNote}</p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">
                  当前暂无已生效的训练计划，请联系您的责任康复师发布。
                </p>
              )}
            </div>
          </div>

          <div className="space-y-6 lg:col-span-4">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="text-base font-semibold text-slate-900">训练须知与自主权利</h3>
              <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-600">
                <li>1. 您始终掌握控制权：训练过程中可随时点击“暂停”、“跳过可选任务”或“自主退出”。</li>
                <li>2. 独立感官关闭：声音与气味通道相互独立，若感官刺激令您不适，可单独一键关闭。</li>
                <li>3. 本浏览器端为交互模拟原型，用于呈现流程与体验反馈，不等同于真实 VR 头显或实际物理气味输出。</li>
                <li>4. 本系统仅作辅助训练，不替代专业医疗诊断或常规诊疗。</li>
              </ul>

              <button
                type="button"
                onClick={() => onNavigateSection('check')}
                className="mt-5 w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-800"
              >
                进入训练前安全与设备检测
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: PRE-TRAINING CHECK, HARDWARE DEGRADATION & PERMISSIONS (P-02 ~ P-05) */}
      {activeSection === 'check' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Subjective Baseline & Safety Confirmation */}
          <div className="space-y-6 lg:col-span-7">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">训练前状态自评（P-03）</h2>
                <span className="text-xs text-slate-500">自评体验量表 v1.0 · 非临床量表</span>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                请按当下真实感受评分，训练结束后将使用同一量尺做描述性前后对照。
              </p>

              <div className="mt-5 space-y-5">
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <label htmlFor="pre-tension" className="font-medium text-slate-800">
                      当下主观紧张程度（1 很放松 — 10 很紧张）
                    </label>
                    <span className="font-mono font-semibold text-teal-800 tabular-nums">
                      {preTension} / 10
                    </span>
                  </div>
                  <input
                    id="pre-tension"
                    type="range"
                    min={1}
                    max={10}
                    value={preTension}
                    onChange={(e) => setPreTension(Number(e.target.value))}
                    className="mt-2 w-full accent-teal-700"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm">
                    <label htmlFor="pre-comfort" className="font-medium text-slate-800">
                      当下身体与情绪舒适度（1 很不舒适 — 10 很舒适）
                    </label>
                    <span className="font-mono font-semibold text-teal-800 tabular-nums">
                      {preComfort} / 10
                    </span>
                  </div>
                  <input
                    id="pre-comfort"
                    type="range"
                    min={1}
                    max={10}
                    value={preComfort}
                    onChange={(e) => setPreComfort(Number(e.target.value))}
                    className="mt-2 w-full accent-teal-700"
                  />
                </div>

                <div>
                  <label htmlFor="pre-note" className="block text-xs font-medium text-slate-700">
                    训练前补充说明（可选）
                  </label>
                  <input
                    id="pre-note"
                    type="text"
                    value={preNote}
                    onChange={(e) => setPreNote(e.target.value)}
                    placeholder="例如：今天偏疲劳，希望音量保持轻柔"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
                  />
                </div>

                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={noticeAccepted}
                      onChange={(e) => setNoticeAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-teal-700"
                    />
                    <span>
                      我已阅读《训练须知》，知悉自己可随时暂停、跳过可选任务或退出训练，并了解当前为浏览器模拟演示体验。
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={contraindicationConfirmed}
                      onChange={(e) => setContraindicationConfirmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-teal-700"
                    />
                    <span>
                      禁忌确认：本人当前无严重眩晕、急性发作性头痛、光敏不适或明确气味过敏风险（若有紧急不适请立即告知工作人员）。
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Modular Hardware Check & Degradation (P-04 & P-05) */}
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900">硬件检测与权限校验（P-04 / P-05）</h2>
              <p className="mt-1 text-xs text-slate-600">
                可在此切换硬件连接状态，验证系统降级保护逻辑。
              </p>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">VR 头显（必选）</p>
                    <p className="text-xs text-slate-500">视觉沉浸基础载体</p>
                  </div>
                  <select
                    value={hwVrStatus}
                    onChange={(e) => setHwVrStatus(e.target.value as 'ready' | 'offline')}
                    aria-label="VR头显检测状态"
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800"
                  >
                    <option value="ready">正常就绪</option>
                    <option value="offline">异常 / 断连</option>
                  </select>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">音频设备（必选）</p>
                    <p className="text-xs text-slate-500">自然声景与听觉任务输出</p>
                  </div>
                  <select
                    value={hwAudioStatus}
                    onChange={(e) => setHwAudioStatus(e.target.value as 'ready' | 'offline')}
                    aria-label="音频设备检测状态"
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800"
                  >
                    <option value="ready">正常就绪</option>
                    <option value="offline">异常 / 无输出</option>
                  </select>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">气味释放设备（可选扩展）</p>
                    <p className="text-xs text-slate-500">无设备时自动降级禁用 C 任务</p>
                  </div>
                  <select
                    value={hwOlfactoryStatus}
                    onChange={(e) =>
                      setHwOlfactoryStatus(
                        e.target.value as 'ready' | 'not_equipped' | 'offline',
                      )
                    }
                    aria-label="气味释放设备状态"
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800"
                  >
                    <option value="not_equipped">未配备（默认）</option>
                    <option value="ready">已连接（Web 模拟偏好）</option>
                    <option value="offline">设备故障</option>
                  </select>
                </div>
              </div>

              {/* Degradation feedback messages */}
              {(hwVrStatus !== 'ready' || hwAudioStatus !== 'ready') && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-700" />
                    <span>必选硬件异常：已阻止启动训练</span>
                  </div>
                  <p className="mt-1">
                    VR 头显与音频设备为必选模块，校验未通过时系统禁止启动依赖任务，请联系工作人员检查连接。
                  </p>
                </div>
              )}

              {hwOlfactoryStatus !== 'ready' && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-semibold">降级策略已生效：禁用 C 嗅觉任务</p>
                  <p className="mt-1">
                    当前气味释放设备未配备或未连接，A 基础体验与 B 听觉可选任务可正常继续。
                  </p>
                </div>
              )}

              {/* Supervision validation */}
              {activePlan?.supervisionMode === 'therapist_supervised' && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-900">
                    权限校验：本计划要求康复师现场监督
                  </p>
                  <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={supervisorConfirmed}
                      onChange={(e) => setSupervisorConfirmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-teal-700"
                    />
                    <span>
                      确认责任康复师（{activePlan.therapistName}）已在现场或完成监督授权确认。
                    </span>
                  </label>
                </div>
              )}

              <button
                type="button"
                disabled={!canStartTraining}
                onClick={handleStartTraining}
                className="mt-5 w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                确认并启动本次训练（{TASK_LABELS[selectedMode].short}）
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: ACTIVE IMMERSIVE SESSION & POST-TRAINING FEEDBACK */}
      {activeSection === 'session' && (
        <div className="space-y-6">
          {!currentSession && !showPostForm ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <p className="text-base font-semibold text-slate-900">尚未启动沉浸式训练会话</p>
              <p className="mt-1 text-sm text-slate-600">
                请先在“检测与确认”页面完成训练前自评、设备检测及安全须知确认。
              </p>
              <button
                type="button"
                onClick={() => onNavigateSection('check')}
                className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
              >
                前往训练前确认
              </button>
            </div>
          ) : showPostForm && currentSession ? (
            /* Post-Training Feedback Form (§4.5) */
            <form
              onSubmit={handleSubmitPostFeedback}
              className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-slate-900">训练后主观体验反馈</h2>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    会话 {currentSession.id} · 时长 {formatDuration(currentSession.elapsedSeconds)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  采用与训练前一致的“自评体验量表 v1.0”，前后对比仅作描述性参考，不等同临床疗效评价。
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div>
                  <label className="flex items-center justify-between text-xs font-medium text-slate-800">
                    <span>训练后紧张程度</span>
                    <span className="font-mono font-semibold text-teal-800 tabular-nums">
                      {postTension} / 10
                    </span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={postTension}
                    onChange={(e) => setPostTension(Number(e.target.value))}
                    className="mt-2 w-full accent-teal-700"
                  />
                  <p className="mt-1 text-xs text-slate-500">训练前为 {preTension} / 10</p>
                </div>

                <div>
                  <label className="flex items-center justify-between text-xs font-medium text-slate-800">
                    <span>训练后舒适度</span>
                    <span className="font-mono font-semibold text-teal-800 tabular-nums">
                      {postComfort} / 10
                    </span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={postComfort}
                    onChange={(e) => setPostComfort(Number(e.target.value))}
                    className="mt-2 w-full accent-teal-700"
                  />
                  <p className="mt-1 text-xs text-slate-500">训练前为 {preComfort} / 10</p>
                </div>

                <div>
                  <label className="flex items-center justify-between text-xs font-medium text-slate-800">
                    <span>整体体验满意度</span>
                    <span className="font-mono font-semibold text-teal-800 tabular-nums">
                      {postOverall} / 10
                    </span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={postOverall}
                    onChange={(e) => setPostOverall(Number(e.target.value))}
                    className="mt-2 w-full accent-teal-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">场景偏好</label>
                  <select
                    value={postPrefScene}
                    onChange={(e) => setPostPrefScene(e.target.value as SceneId | 'neutral')}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="forest">偏好森林场景</option>
                    <option value="stream">偏好溪流场景</option>
                    <option value="neutral">两者无明显偏好</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">声音与音量感受</label>
                  <select
                    value={postAudioComfort}
                    onChange={(e) =>
                      setPostAudioComfort(e.target.value as PostTrainingFeedback['audioComfort'])
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="comfortable">声音舒缓适中</option>
                    <option value="too_loud">声音偏响</option>
                    <option value="too_quiet">声音偏轻</option>
                    <option value="discomfort">感到声音不适（将提示康复师）</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">气味反馈（如启用）</label>
                  <select
                    value={postOlfactoryPref}
                    onChange={(e) =>
                      setPostOlfactoryPref(
                        e.target.value as NonNullable<PostTrainingFeedback['olfactoryPreference']>,
                      )
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="not_used">本次未使用气味模块</option>
                    <option value="pleasant">气味偏好舒适</option>
                    <option value="neutral">感受一般 / 中性</option>
                    <option value="discomfort">感到气味不适（将提示康复师）</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  开放式文字感受（可选）
                </label>
                <textarea
                  rows={3}
                  value={postOpenText}
                  onChange={(e) => setPostOpenText(e.target.value)}
                  placeholder="可记录您喜欢的画面、声音细节，或希望康复师下次调整的地方..."
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:bg-slate-300"
                >
                  {submitting ? '正在保存...' : '提交反馈并保存训练记录'}
                </button>
              </div>
            </form>
          ) : currentSession ? (
            /* Active Training Experience */
            <div className="space-y-5">
              {/* Top Control Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <p className="text-xs text-slate-500">当前环节</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {TASK_LABELS[activeSubTask].name}
                    </p>
                  </div>
                  <div className="h-6 w-px bg-slate-200" />
                  <div>
                    <p className="text-xs text-slate-500">已用时长</p>
                    <p className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                      {formatDuration(elapsedSeconds)}
                    </p>
                  </div>
                  <div className="h-6 w-px bg-slate-200" />
                  <div>
                    <p className="text-xs text-slate-500">会话状态</p>
                    <p className="text-sm font-medium text-teal-800">
                      {SESSION_STATUS_LABELS[currentSession.status].label}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleTogglePause}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                    {isPaused ? '继续训练' : '暂停休息'}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void finishSession('voluntary_exit', completedTaskLogs, '患者自主点击退出训练')
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <Square className="h-3.5 w-3.5" />
                    自主退出
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleReportDiscomfortEscalation()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-800 hover:bg-red-100 whitespace-nowrap shrink-0"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    明显不适 / 停止并通知康复师
                  </button>
                </div>
              </div>

              {/* Main 2-Zone Simulation Stage */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="lg:col-span-8">
                  <ImmersiveViewport
                    scene={selectedScene}
                    isPaused={isPaused}
                    audioEnabled={audioEnabled}
                    volumePercent={volumePercent}
                    maxVolumePercent={activePlan?.sensoryConfig.maxVolumePercent ?? 70}
                    olfactoryActive={olfactoryActive}
                    olfactoryProfile={
                      activePlan?.sensoryConfig.olfactoryProfile ?? '松木清香'
                    }
                    onToggleAudio={handleToggleAudio}
                    onVolumeChange={handleVolumeChange}
                    onShutoffOlfactory={() => void handleShutoffOlfactory()}
                  />
                </div>

                {/* Right Task Execution Deck */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4 flex flex-col justify-between space-y-5">
                  {activeSubTask === 'A_BASIC' && (
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-slate-900">
                        A 基础沉浸体验
                      </h3>
                      <p className="text-xs leading-relaxed text-slate-600">
                        请用舒适的呼吸节奏环顾周围{selectedScene === 'forest' ? '林间光影与树木' : '清澈溪流与卵石'}，轻柔留意环境中的自然声响。
                      </p>
                      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                        无需追求特定得分或时长，感觉适应后即可点击下方进入下一步或结束。
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void advanceOrFinishSubTask(
                            'completed',
                            `完成 ${SCENE_META[selectedScene].name} 基础自主探索`,
                          )
                        }
                        className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
                      >
                        {currentSession.mode === 'D_COMPREHENSIVE'
                          ? '完成基础体验，进入下一环节'
                          : '结束本次基础体验并填写反馈'}
                      </button>
                    </div>
                  )}

                  {activeSubTask === 'B_AUDITORY' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-slate-900">
                          B 听觉可选任务
                        </h3>
                        <span className="font-mono text-xs text-slate-500 tabular-nums">
                          第 {auditoryRoundIdx + 1} / {AUDITORY_ROUNDS.length} 轮
                        </span>
                      </div>

                      <p className="text-xs leading-relaxed text-slate-600">
                        {AUDITORY_ROUNDS[auditoryRoundIdx].prompt}
                      </p>

                      <button
                        type="button"
                        onClick={handlePlayAuditoryCue}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-teal-700 bg-teal-50 px-4 py-2.5 text-xs font-semibold text-teal-900 hover:bg-teal-100"
                      >
                        <Volume2 className="h-4 w-4" />
                        播放自然提示音片段
                      </button>

                      {auditoryFeedbackMsg && (
                        <p className="text-xs text-teal-800">{auditoryFeedbackMsg}</p>
                      )}

                      <div className="space-y-2 pt-1">
                        {AUDITORY_ROUNDS.map((opt) => (
                          <button
                            key={opt.cue}
                            type="button"
                            onClick={() => handleSelectAuditoryOption(opt.cue)}
                            className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-left text-xs font-medium text-slate-800 transition-colors hover:border-teal-700 hover:bg-teal-50/40"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          void advanceOrFinishSubTask('skipped', '患者自主跳过 B 听觉可选任务')
                        }
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <SkipForward className="h-3.5 w-3.5" />
                        跳过此可选任务
                      </button>
                    </div>
                  )}

                  {activeSubTask === 'C_OLFACTORY' && (
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-slate-900">
                        C 嗅觉可选任务（模拟偏好）
                      </h3>
                      <p className="text-xs leading-relaxed text-amber-800 rounded-lg bg-amber-50 p-3">
                        当前为 Web 模拟体验界面，不实际释放物理气味；仅记录您的香型偏好与舒适反馈。
                      </p>

                      <div className="space-y-2">
                        {['松木清香（低强度）', '林间草木（低强度）', '湿润泥土（极轻）'].map(
                          (scent) => (
                            <button
                              key={scent}
                              type="button"
                              onClick={() => setOlfactoryChoice(scent)}
                              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-xs font-medium ${
                                olfactoryChoice === scent
                                  ? 'border-teal-700 bg-teal-50/60 text-teal-900'
                                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <Wind className="h-3.5 w-3.5" />
                                {scent}
                              </span>
                              {olfactoryChoice === scent && <span>已选择</span>}
                            </button>
                          ),
                        )}
                      </div>

                      <div className="space-y-2 pt-2">
                        <button
                          type="button"
                          onClick={() =>
                            void advanceOrFinishSubTask('completed', '完成气味偏好与耐受确认', {
                              selectedOption: olfactoryChoice,
                            })
                          }
                          className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
                        >
                          确认偏好并完成训练
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void advanceOrFinishSubTask('skipped', '患者跳过 C 嗅觉可选任务')
                          }
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          <SkipForward className="h-3.5 w-3.5" />
                          跳过嗅觉环节
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-3 text-xs text-slate-500">
                    已完成步骤：{completedTaskLogs.length} 项 · 暂停次数：{pauseCount} 次
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* SECTION 4: MY TRAINING HISTORY (Scoped strictly to current patient §2.2) */}
      {activeSection === 'history' && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">我的训练记录与反馈历史</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                共 {sessions.length} 条记录 · 仅本人与授权康复师可见
              </p>
            </div>
          </div>

          {sessions.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">暂无训练历史记录。</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <div key={s.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                      <span>{SCENE_META[s.scene].name}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span>{TASK_LABELS[s.mode].short}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="text-xs text-slate-600">
                        {SESSION_STATUS_LABELS[s.status].label}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-slate-500 tabular-nums">
                      {s.startedAt} · 时长 {formatDuration(s.elapsedSeconds)}
                    </span>
                  </div>

                  {s.postFeedback && (
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                      <span className="tabular-nums">
                        紧张度前后自评：{s.preFeedback.tensionScore} → {s.postFeedback.tensionScore}
                      </span>
                      <span className="tabular-nums">
                        舒适度前后自评：{s.preFeedback.comfortScore} → {s.postFeedback.comfortScore}
                      </span>
                      {s.postFeedback.openText && (
                        <span className="text-slate-500">备注：{s.postFeedback.openText}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
