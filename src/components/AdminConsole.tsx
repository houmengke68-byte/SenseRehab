import React, { useState } from 'react';
import { CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import type {
  AppMetricsSummary,
  AuditLogEntry,
  HardwareInventoryItem,
  HardwareState,
  PatientProfile,
  StaffAccount,
} from '../types';
import { HARDWARE_STATE_LABELS } from '../utils/labels';

interface AdminConsoleProps {
  activeSection: 'accounts' | 'hardware' | 'stats' | 'audit';
  institutionName: string;
  adminName: string;
  staff: StaffAccount[];
  patients: Array<
    Pick<
      PatientProfile,
      | 'patientCode'
      | 'displayLabel'
      | 'assignedTherapistId'
      | 'assignedTherapistName'
      | 'riskTier'
      | 'supervisionDefault'
      | 'consentSigned'
      | 'lastUpdated'
    >
  >;
  hardwareInventory: HardwareInventoryItem[];
  metrics: AppMetricsSummary;
  auditLogs: AuditLogEntry[];
  onRefreshWorkspace: () => Promise<void>;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  activeSection,
  institutionName,
  adminName,
  staff,
  patients,
  hardwareInventory,
  metrics,
  auditLogs,
  onRefreshWorkspace,
}) => {
  const [notice, setNotice] = useState<string | null>(null);
  const therapists = staff.filter((s) => s.role === 'therapist');

  const handleAssignTherapist = async (patientCode: string, therapistId: string) => {
    const res = await fetch(`/api/admin/patients/${patientCode}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ therapistId, actorName: adminName }),
    });
    if (res.ok) {
      setNotice(`已更新 ${patientCode} 的责任康复师授权归属，并记录审计日志。`);
      await onRefreshWorkspace();
    }
  };

  const handleUpdateHardware = async (id: string, status: HardwareState) => {
    const res = await fetch(`/api/admin/hardware/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, actorName: adminName }),
    });
    if (res.ok) {
      setNotice(`已更新设备模块 ${id} 状态为“${HARDWARE_STATE_LABELS[status].label}”。`);
      await onRefreshWorkspace();
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-medium text-slate-500">
            机构管理员端 · {institutionName} · 当前账号：{adminName}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {activeSection === 'accounts' && '机构人员角色与患者归属管理'}
            {activeSection === 'hardware' && '模块化硬件设备配置与运维'}
            {activeSection === 'stats' && '机构级运行统计（去标识化聚合）'}
            {activeSection === 'audit' && '权限与关键操作安全审计留痕'}
          </h1>
        </div>

        <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <Lock className="h-3.5 w-3.5 text-slate-500" />
          <span>权限隔离：管理员不可查看或编辑个体专业评估报告正文</span>
        </div>
      </div>

      {notice && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-3 text-sm text-teal-950">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-700" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs font-medium underline"
          >
            关闭
          </button>
        </div>
      )}

      {activeSection === 'accounts' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">机构人员账号与角色</h2>
            <div className="divide-y divide-slate-100">
              {staff.map((st) => (
                <div key={st.id} className="flex items-center justify-between py-3 text-xs">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{st.name}</p>
                    <p className="mt-0.5 text-slate-500">
                      {st.id} · {st.department}
                    </p>
                  </div>
                  <span className="font-medium text-slate-700">
                    {st.role === 'therapist' ? '康复师' : '机构管理员'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">患者授权归属关系配置</h2>
            <p className="text-xs text-slate-500">
              调整患者授权责任康复师后，新康复师将仅可访问其被授权患者的训练记录与报告。
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-4 font-medium">患者编码</th>
                    <th className="py-2 pr-4 font-medium">知情同意</th>
                    <th className="py-2 pr-4 font-medium">默认监督要求</th>
                    <th className="py-2 font-medium">授权责任康复师</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {patients.map((p) => (
                    <tr key={p.patientCode}>
                      <td className="py-3 pr-4 font-medium text-slate-900">{p.displayLabel}</td>
                      <td className="py-3 pr-4 text-emerald-700">
                        {p.consentSigned ? '已签署' : '待签署'}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {p.supervisionDefault === 'therapist_supervised' ? '现场监督' : '自主训练'}
                      </td>
                      <td className="py-3">
                        <select
                          value={p.assignedTherapistId}
                          onChange={(e) =>
                            void handleAssignTherapist(p.patientCode, e.target.value)
                          }
                          aria-label={`为 ${p.patientCode} 分配康复师`}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800"
                        >
                          {therapists.map((th) => (
                            <option key={th.id} value={th.id}>
                              {th.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'hardware' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              模块化硬件清单（VR 头显与音频必选 · 气味设备可选扩展）
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              当气味释放设备设为“未配备”或“异常/离线”时，患者训练端将自动执行降级规则禁用 C 嗅觉任务。
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 pr-4 font-medium">设备名称</th>
                  <th className="py-2.5 pr-4 font-medium">配置属性</th>
                  <th className="py-2.5 pr-4 font-medium">所属训练室</th>
                  <th className="py-2.5 pr-4 font-medium">规格说明</th>
                  <th className="py-2.5 pr-4 font-medium">状态管理</th>
                  <th className="py-2.5 font-medium">最近核验</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hardwareInventory.map((hw) => (
                  <tr key={hw.id}>
                    <td className="py-3 pr-4 font-medium text-slate-900">{hw.name}</td>
                    <td className="py-3 pr-4 text-slate-700">
                      {hw.required ? '必选核心模块' : '可选扩展模块'}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{hw.room}</td>
                    <td className="py-3 pr-4 text-slate-600">{hw.firmwareOrSpec}</td>
                    <td className="py-3 pr-4">
                      <select
                        value={hw.status}
                        onChange={(e) =>
                          void handleUpdateHardware(hw.id, e.target.value as HardwareState)
                        }
                        aria-label={`更新设备 ${hw.name} 状态`}
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800"
                      >
                        <option value="ready">连接正常</option>
                        <option value="degraded">降级运行</option>
                        <option value="offline">异常 / 离线</option>
                        {!hw.required && <option value="not_equipped">未配备（可选）</option>}
                      </select>
                    </td>
                    <td className="py-3 font-mono tabular-nums text-slate-500">
                      {hw.lastCheckedAt}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'stats' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>统计口径：{metrics.scopeLabel}</span>
            <span>统计周期：{metrics.timeRangeLabel}</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs text-slate-500">机构累计训练会话</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {metrics.totalSessions}
              </p>
              <p className="mt-1 text-xs text-slate-500">覆盖 {metrics.activePatients} 位在训编码患者</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs text-slate-500">整体任务完成率</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold text-teal-800 tabular-nums">
                {metrics.taskCompletionRate}%
              </p>
              <p className="mt-1 text-xs text-slate-500">不含临床疗效推断</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs text-slate-500">设备异常率</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {metrics.deviceAbnormalRate}%
              </p>
              <p className="mt-1 text-xs text-slate-500">异常训练 / 总启动次数</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs text-slate-500">待处置安全事件</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {metrics.openSafetyEvents}
              </p>
              <p className="mt-1 text-xs text-slate-500">由责任康复师临床复核闭环</p>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'audit' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-700" />
            <h2 className="text-base font-semibold text-slate-900">
              关键操作与权限变更审计日志（§2.2）
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4 font-medium">时间</th>
                  <th className="py-2 pr-4 font-medium">操作角色</th>
                  <th className="py-2 pr-4 font-medium">操作人</th>
                  <th className="py-2 pr-4 font-medium">动作</th>
                  <th className="py-2 pr-4 font-medium">目标对象</th>
                  <th className="py-2 font-medium">详情记录</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-4 font-mono tabular-nums text-slate-500">
                      {log.timestamp}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-700">
                      {log.actorRole === 'therapist'
                        ? '康复师'
                        : log.actorRole === 'admin'
                        ? '机构管理员'
                        : '患者'}
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-slate-900">{log.actorName}</td>
                    <td className="py-2.5 pr-4 text-slate-800">{log.action}</td>
                    <td className="py-2.5 pr-4 font-mono text-slate-600">{log.targetId}</td>
                    <td className="py-2.5 text-slate-600">{log.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
