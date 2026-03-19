import { ReloadOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  DatePicker,
  Input,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listAuditLogsRequest,
  listAlertEventsRequest,
  listEntityAuditsRequest,
  listWorkflowRunsRequest,
  type AlertEventItem,
  type AuditLogItem,
  type EntityAuditItem,
  type WorkflowRunItem,
} from '../lib/api';
import ConsoleLayout from '../components/ConsoleLayout';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function AdminAudits() {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [entityLoading, setEntityLoading] = useState(false);
  const [entityLogs, setEntityLogs] = useState<EntityAuditItem[]>([]);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRunItem[]>([]);
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertEvents, setAlertEvents] = useState<AlertEventItem[]>([]);
  const [entityNameFilter, setEntityNameFilter] = useState<string | undefined>(undefined);
  const [actorFilter, setActorFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<'create' | 'update' | 'delete' | undefined>(undefined);
  const [timeRange, setTimeRange] = useState<[string | null, string | null]>([null, null]);
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<'critical' | 'warning' | 'info' | undefined>(undefined);
  const [alertStatusFilter, setAlertStatusFilter] = useState<'open' | 'investigating' | 'mitigated' | 'resolved' | undefined>(undefined);
  const [alertNameFilter, setAlertNameFilter] = useState<string>('');
  const [alertTicketFilter, setAlertTicketFilter] = useState<string>('');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const result = await listAuditLogsRequest();
      setLogs(result);
    } catch {
      messageApi.error('获取审计日志失败，请重新登录后重试');
      navigate('/login', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const loadEntityLogs = async () => {
    setEntityLoading(true);
    try {
      const [from, to] = timeRange;
      const result = await listEntityAuditsRequest({
        entityName: entityNameFilter,
        actorUsername: actorFilter.trim() || undefined,
        action: actionFilter,
        from: from ?? undefined,
        to: to ?? undefined,
      });
      setEntityLogs(result);
    } catch {
      messageApi.error('获取实体审计失败，请重新登录后重试');
      navigate('/login', { replace: true });
    } finally {
      setEntityLoading(false);
    }
  };

  const loadWorkflowRuns = async () => {
    setWorkflowLoading(true);
    try {
      const result = await listWorkflowRunsRequest(100);
      setWorkflowRuns(result);
    } catch {
      messageApi.error('获取工作流运行记录失败，请重新登录后重试');
      navigate('/login', { replace: true });
    } finally {
      setWorkflowLoading(false);
    }
  };

  const loadAlertEvents = async () => {
    setAlertLoading(true);
    try {
      const result = await listAlertEventsRequest({
        severity: alertSeverityFilter,
        status: alertStatusFilter,
        alertName: alertNameFilter.trim() || undefined,
        ticketId: alertTicketFilter.trim() || undefined,
        limit: 200,
      });
      setAlertEvents(result);
    } catch {
      messageApi.error('获取告警事件失败，请重新登录后重试');
      navigate('/login', { replace: true });
    } finally {
      setAlertLoading(false);
    }
  };

  useEffect(() => {
    void loadLogs();
    void loadEntityLogs();
    void loadWorkflowRuns();
    void loadAlertEvents();
  }, []);

  const columns: ColumnsType<AuditLogItem> = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 190,
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: '租户',
      dataIndex: 'tenantId',
      key: 'tenantId',
      width: 100,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 130,
    },
    {
      title: '请求',
      key: 'request',
      width: 320,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Tag>{record.method}</Tag>
          <Text style={{ fontSize: 12 }}>{record.path}</Text>
        </Space>
      ),
    },
    {
      title: '状态码',
      dataIndex: 'statusCode',
      key: 'statusCode',
      width: 90,
      render: (code: number) =>
        code >= 400 ? <Tag color="error">{code}</Tag> : <Tag color="success">{code}</Tag>,
    },
    {
      title: '耗时(ms)',
      dataIndex: 'durationMs',
      key: 'durationMs',
      width: 110,
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 150,
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      width: 260,
      render: (value?: string) => value ?? '-',
    },
  ];

  const entityColumns: ColumnsType<EntityAuditItem> = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: '实体',
      key: 'entity',
      width: 220,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Tag color="blue">{row.entityName}</Tag>
          <Text style={{ fontSize: 12 }}>{row.entityId}</Text>
        </Space>
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (value: EntityAuditItem['action']) => {
        if (value === 'create') return <Tag color="success">创建</Tag>;
        if (value === 'delete') return <Tag color="error">删除</Tag>;
        return <Tag color="processing">更新</Tag>;
      },
    },
    {
      title: '操作人',
      key: 'actor',
      width: 140,
      render: (_, row) => row.actorUsername ?? '-',
    },
    {
      title: '租户',
      dataIndex: 'tenantId',
      key: 'tenantId',
      width: 100,
      render: (value: string) => <Tag color="purple">{value}</Tag>,
    },
    {
      title: '变更详情',
      key: 'changes',
      render: (_, row) => {
        const entries = Object.entries(row.changes ?? {});
        if (entries.length === 0) return '-';

        return (
          <Space direction="vertical" size={4}>
            {entries.map(([field, change]) => (
              <Text key={field} style={{ fontSize: 12 }}>
                {field}: {JSON.stringify(change.before)} → {JSON.stringify(change.after)}
              </Text>
            ))}
          </Space>
        );
      },
    },
  ];

  const workflowColumns: ColumnsType<WorkflowRunItem> = [
    {
      title: '开始时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: '流程',
      dataIndex: 'workflowKey',
      key: 'workflowKey',
      width: 220,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value: WorkflowRunItem['status']) => {
        if (value === 'done') return <Tag color="success">完成</Tag>;
        if (value === 'failed') return <Tag color="error">失败</Tag>;
        return <Tag color="processing">执行中</Tag>;
      },
    },
    {
      title: '步骤轨迹',
      key: 'stepRuns',
      render: (_, row) => (
        <Space direction="vertical" size={4}>
          {row.stepRuns.map((step) => (
            <Text key={`${row.runId}-${step.stepKey}`} style={{ fontSize: 12 }}>
              {step.stepKey} [{step.status}] attempts={step.attempts}
              {step.errorMessage ? ` error=${step.errorMessage}` : ''}
            </Text>
          ))}
        </Space>
      ),
    },
  ];

  const alertColumns: ColumnsType<AlertEventItem> = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: '告警',
      key: 'alert',
      width: 220,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Tag color="blue">{row.alertName}</Tag>
          <Text style={{ fontSize: 12 }}>{row.summary}</Text>
        </Space>
      ),
    },
    {
      title: '级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (value: AlertEventItem['severity']) => {
        if (value === 'critical') return <Tag color="error">critical</Tag>;
        if (value === 'warning') return <Tag color="warning">warning</Tag>;
        return <Tag>info</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value: AlertEventItem['status']) => {
        if (value === 'open') return <Tag color="error">open</Tag>;
        if (value === 'investigating') return <Tag color="processing">investigating</Tag>;
        if (value === 'mitigated') return <Tag color="warning">mitigated</Tag>;
        return <Tag color="success">resolved</Tag>;
      },
    },
    {
      title: '工单',
      key: 'ticket',
      width: 220,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{row.ticket.id}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{row.ticket.status}</Text>
        </Space>
      ),
    },
    {
      title: '值班轨迹',
      key: 'oncallTrail',
      render: (_, row) => (
        <Space direction="vertical" size={4}>
          {row.oncallTrail.map((item) => (
            <Text key={`${row.id}_${item.stage}_${item.at}`} style={{ fontSize: 12 }}>
              {item.stage} · {item.owner} · {item.status} · {new Date(item.at).toLocaleString()}
            </Text>
          ))}
        </Space>
      ),
    },
  ];

  return (
    <ConsoleLayout breadcrumbItems={[{ title: '首页' }, { title: '平台管理' }, { title: '审计日志' }]}>
      {contextHolder}

      <Card
        bordered={false}
        style={{ marginBottom: 16 }}
        styles={{ body: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }}
      >
        <div>
          <Title level={4} style={{ margin: 0 }}>
            审计日志
          </Title>
          <Text type="secondary">平台操作审计记录（近 500 条）</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void loadLogs()}>
            刷新
          </Button>
        </Space>
      </Card>

      <Card bordered={false}>
        <Tabs
          items={[
            {
              key: 'request-audits',
              label: '请求审计',
              children: (
                <Table<AuditLogItem>
                  rowKey={(record) => `${record.timestamp}_${record.path}_${record.userId}`}
                  loading={loading}
                  columns={columns}
                  dataSource={logs}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1300 }}
                />
              ),
            },
            {
              key: 'entity-audits',
              label: '实体变更',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Space wrap>
                    <Select
                      allowClear
                      placeholder="实体"
                      style={{ width: 160 }}
                      value={entityNameFilter}
                      onChange={(value) => setEntityNameFilter(value)}
                      options={[
                        { label: 'UserEntity', value: 'UserEntity' },
                        { label: 'PlatformSettingEntity', value: 'PlatformSettingEntity' },
                      ]}
                    />
                    <Input
                      allowClear
                      placeholder="操作人"
                      style={{ width: 180 }}
                      value={actorFilter}
                      onChange={(event) => setActorFilter(event.target.value)}
                    />
                    <Select
                      allowClear
                      placeholder="动作"
                      style={{ width: 140 }}
                      value={actionFilter}
                      onChange={(value) => setActionFilter(value)}
                      options={[
                        { label: '创建', value: 'create' },
                        { label: '更新', value: 'update' },
                        { label: '删除', value: 'delete' },
                      ]}
                    />
                    <RangePicker
                      showTime
                      onChange={(_, dateStrings) => setTimeRange([dateStrings[0] || null, dateStrings[1] || null])}
                    />
                    <Button onClick={() => void loadEntityLogs()} icon={<ReloadOutlined />}>查询</Button>
                  </Space>

                  <Table<EntityAuditItem>
                    rowKey="id"
                    loading={entityLoading}
                    columns={entityColumns}
                    dataSource={entityLogs}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1400 }}
                  />
                </Space>
              ),
            },
            {
              key: 'workflow-runs',
              label: '工作流运行',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Space>
                    <Button onClick={() => void loadWorkflowRuns()} icon={<ReloadOutlined />}>刷新</Button>
                  </Space>

                  <Table<WorkflowRunItem>
                    rowKey="runId"
                    loading={workflowLoading}
                    columns={workflowColumns}
                    dataSource={workflowRuns}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1200 }}
                  />
                </Space>
              ),
            },
            {
              key: 'alert-events',
              label: '告警事件',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Space wrap>
                    <Select
                      allowClear
                      placeholder="级别"
                      style={{ width: 140 }}
                      value={alertSeverityFilter}
                      onChange={(value) => setAlertSeverityFilter(value)}
                      options={[
                        { label: 'critical', value: 'critical' },
                        { label: 'warning', value: 'warning' },
                        { label: 'info', value: 'info' },
                      ]}
                    />
                    <Select
                      allowClear
                      placeholder="状态"
                      style={{ width: 160 }}
                      value={alertStatusFilter}
                      onChange={(value) => setAlertStatusFilter(value)}
                      options={[
                        { label: 'open', value: 'open' },
                        { label: 'investigating', value: 'investigating' },
                        { label: 'mitigated', value: 'mitigated' },
                        { label: 'resolved', value: 'resolved' },
                      ]}
                    />
                    <Input
                      allowClear
                      placeholder="告警名"
                      style={{ width: 220 }}
                      value={alertNameFilter}
                      onChange={(event) => setAlertNameFilter(event.target.value)}
                    />
                    <Input
                      allowClear
                      placeholder="工单号"
                      style={{ width: 180 }}
                      value={alertTicketFilter}
                      onChange={(event) => setAlertTicketFilter(event.target.value)}
                    />
                    <Button onClick={() => void loadAlertEvents()} icon={<ReloadOutlined />}>查询</Button>
                  </Space>

                  <Table<AlertEventItem>
                    rowKey="id"
                    loading={alertLoading}
                    columns={alertColumns}
                    dataSource={alertEvents}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1400 }}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </ConsoleLayout>
  );
}
