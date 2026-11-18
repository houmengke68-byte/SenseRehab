import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight, Shield } from 'lucide-react';
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
} from './types';
import { PatientPortal } from './components/PatientPortal';
import { TherapistConsole } from './components/TherapistConsole';
import { AdminConsole } from './components/AdminConsole';

interface WorkspacePayload {
  institutionName: string;
  role: UserRole;
  staff?: StaffAccount[];
  patient?: PatientProfile;
  patients?: PatientProfile[];
  plans?: TrainingPlan[];
  sessions?: TrainingSession[];
  safetyEvents?: SafetyEvent[];
  reports?: AIReport[];
  telemetryEvents?: TelemetryEvent[];
  hardwareInventory: HardwareInventoryItem[];
  metrics?: AppMetricsSummary;
  auditLogs?: AuditLogEntry[];
  verificationItems?: VerificationItem[];
}

export default function App() {
  const [role, setRole] = useState<UserRole>('therapist');
  const [activePatientCode, setActivePatientCode] = useState('SR-P-2048');
  const [activeTherapistId, setActiveTherapistId] = useState('TH-101');
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);

  const [patientSection, setPatientSection] = useState<'plan' | 'check' | 'session' | 'history'>(
    'plan',
  );
  const [therapistSection, setTherapistSection] = useState<
    'dashboard' | 'patients_plans' | 'monitoring' | 'reports'
  >('dashboard');
  const [adminSection, setAdminSection] = useState<'accounts' | 'hardware' | 'stats' | 'audit'>(
    'accounts',
  );

  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchWorkspace = useCallback(async () => {
    try {
      setErrorMsg(null);
      const params = new URLSearchParams({
        role,
        patientCode: activePatientCode,
        therapistId: activeTherapistId,
      });
      const res = await fetch(`/api/workspace?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`加载工作区失败（HTTP ${res.status}）`);
      }
      const data = (await res.json()) as WorkspacePayload;
      setWorkspace(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '无法加载工作区数据');
    } finally {
      setLoading(false);
    }
  }, [role, activePatientCode, activeTherapistId]);

  useEffect(() => {
    setLoading(true);
    void fetchWorkspace();
  }, [fetchWorkspace]);

  const activeTherapistName =
    workspace?.staff?.find((s) => s.id === activeTherapistId)?.name ?? '周安（主任康复师）';
  const activeAdminName =
    workspace?.staff?.find((s) => s.role === 'admin')?.name ?? '王宁（机构运营管理员）';

  const navItems: Array<{ id: string; label: string }> =
    role === 'patient'
      ? [
          { id: 'plan', label: '今日计划' },
          { id: 'check', label: '检测确认' },
          { id: 'session', label: '沉浸训练' },
          { id: 'history', label: '训练记录' },
        ]
      : role === 'therapist'
      ? [
          { id: 'dashboard', label: '工作台' },
          { id: 'patients_plans', label: '患者与计划' },
          { id: 'monitoring', label: '实时监控' },
          { id: 'reports', label: '报告审核' },
        ]
      : [
          { id: 'accounts', label: '账号归属' },
          { id: 'hardware', label: '设备管理' },
          { id: 'stats', label: '机构统计' },
          { id: 'audit', label: '审计留痕' },
        ];

  const activeNavId =
    role === 'patient'
      ? patientSection
      : role === 'therapist'
      ? therapistSection
      : adminSection;

  const handleSelectNav = (id: string) => {
    if (role === 'patient') setPatientSection(id as typeof patientSection);
    else if (role === 'therapist') setTherapistSection(id as typeof therapistSection);
    else setAdminSection(id as typeof adminSection);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => handleSelectNav(navItems[0].id)}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            SenseRehab
          </button>

          {/* Zone 2: 4 single-line text navigation links */}
          <nav className="flex items-center gap-6 overflow-x-auto text-sm font-medium">
            {navItems.map((item) => {
              const isActive = activeNavId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectNav(item.id)}
                  className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'border-teal-700 text-teal-800'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setRoleSwitcherOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              {role === 'patient'
                ? '患者端 · 切换'
                : role === 'therapist'
                ? '康复师端 · 切换'
                : '机构管理 · 切换'}
            </button>
          </div>
        </div>

        {/* Role & Account Isolation Switcher Drawer */}
        {roleSwitcherOpen && (
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-slate-700">选择体验端别与权限身份：</span>
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
                  {(
                    [
                      { id: 'patient', label: '患者训练端' },
                      { id: 'therapist', label: '康复师管理端' },
                      { id: 'admin', label: '机构管理员端' },
                    ] as const
                  ).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setRole(r.id);
                        setRoleSwitcherOpen(false);
                      }}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        role === r.id
                          ? 'bg-teal-700 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs">
                {role === 'patient' && (
                  <label className="flex items-center gap-2 text-slate-700">
                    <span>模拟患者账号：</span>
                    <select
                      value={activePatientCode}
                      onChange={(e) => setActivePatientCode(e.target.value)}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-900"
                    >
                      <option value="SR-P-2048">林某 (SR-P-2048 · 自主训练)</option>
                      <option value="SR-P-2051">陈某 (SR-P-2051 · 需现场监督)</option>
                      <option value="SR-P-2055">赵某 (SR-P-2055 · 自主训练)</option>
                    </select>
                  </label>
                )}

                {role === 'therapist' && (
                  <label className="flex items-center gap-2 text-slate-700">
                    <span>康复师授权范围：</span>
                    <select
                      value={activeTherapistId}
                      onChange={(e) => setActiveTherapistId(e.target.value)}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-900"
                    >
                      <option value="TH-101">周安（主任康复师 · 管理 SR-P-2048 / 2051）</option>
                      <option value="TH-102">顾清（康复治疗师 · 管理 SR-P-2055）</option>
                    </select>
                  </label>
                )}

                <button
                  type="button"
                  onClick={() => setRoleSwitcherOpen(false)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900"
                >
                  收起
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {loading && !workspace ? (
          <div className="mx-auto max-w-6xl px-6 py-16 text-center text-sm text-slate-500">
            正在加载 SenseRehab 工作区...
          </div>
        ) : errorMsg ? (
          <div className="mx-auto max-w-3xl px-6 py-12">
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
              <p className="font-semibold">工作区数据加载异常</p>
              <p className="mt-1">{errorMsg}</p>
              <button
                type="button"
                onClick={() => void fetchWorkspace()}
                className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-xs font-medium text-white hover:bg-red-800"
              >
                重试加载
              </button>
            </div>
          </div>
        ) : workspace ? (
          <>
            {role === 'patient' && workspace.patient && (
              <PatientPortal
                activeSection={patientSection}
                onNavigateSection={setPatientSection}
                patient={workspace.patient}
                plans={workspace.plans ?? []}
                sessions={workspace.sessions ?? []}
                hardwareInventory={workspace.hardwareInventory}
                onRefreshWorkspace={fetchWorkspace}
              />
            )}

            {role === 'therapist' && workspace.metrics && (
              <TherapistConsole
                activeSection={therapistSection}
                onNavigateSection={setTherapistSection}
                therapistId={activeTherapistId}
                therapistName={activeTherapistName}
                patients={workspace.patients ?? []}
                plans={workspace.plans ?? []}
                sessions={workspace.sessions ?? []}
                safetyEvents={workspace.safetyEvents ?? []}
                reports={workspace.reports ?? []}
                telemetryEvents={workspace.telemetryEvents ?? []}
                hardwareInventory={workspace.hardwareInventory}
                metrics={workspace.metrics}
                verificationItems={workspace.verificationItems ?? []}
                onRefreshWorkspace={fetchWorkspace}
              />
            )}

            {role === 'admin' && workspace.metrics && (
              <AdminConsole
                activeSection={adminSection}
                institutionName={workspace.institutionName}
                adminName={activeAdminName}
                staff={workspace.staff ?? []}
                patients={workspace.patients ?? []}
                hardwareInventory={workspace.hardwareInventory}
                metrics={workspace.metrics}
                auditLogs={workspace.auditLogs ?? []}
                onRefreshWorkspace={fetchWorkspace}
              />
            )}
          </>
        ) : null}
      </main>

      {/* Quiet Clinical Boundary Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-slate-400" />
            <span>
              SenseRehab 康复辅助训练系统 · 不自动诊断情绪/精神疾病，不替代专业诊疗；AI 仅作辅助分析，重要方案须经康复师确认。
            </span>
          </div>
          <span>Web Demo 浏览器交互模拟 · 非真实 VR 头显或物理气味输出</span>
        </div>
      </footer>
    </div>
  );
}
