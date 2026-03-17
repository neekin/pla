import { DeleteOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConsoleLayout from '../components/ConsoleLayout';
import {
  checkQueueStorageHealthRequest,
  createFeatureFlagRequest,
  deleteScopedSettingRequest,
  deleteFeatureFlagRequest,
  getEffectiveSettingsRequest,
  getPlatformConfigRequest,
  getPlatformConfigRuntimeStatusRequest,
  listFeatureFlagsRequest,
  listScopedSettingsRequest,
  updateFeatureFlagRequest,
  updatePlatformConfigRequest,
  upsertScopedSettingRequest,
  type PlatformConfigRuntimeStatusResponse,
  type PlatformConfigResponse,
  type PlatformSettingItem,
  type PlatformSettingScopeType,
  type QueueStorageHealthResponse,
} from '../lib/api';
import { getCurrentUser, hasPermissions } from '../router/auth';

const { Title, Text } = Typography;

interface FeatureFlagRow {
  key: string;
  enabled: boolean;
}

interface CreateFlagForm {
  key: string;
  enabled: boolean;
}

interface SettingForm {
  key: string;
  valueText: string;
}

interface ScopeSettingRow {
  id?: string;
  key: string;
  value: unknown;
  updatedBy?: string | null;
  updatedAt?: string;
}

export default function AdminConfig() {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<CreateFlagForm>();
  const [settingForm] = Form.useForm<SettingForm>();

  const [loading, setLoading] = useState(false);
  const [savingQueueConfig, setSavingQueueConfig] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [updatingFeatureKey, setUpdatingFeatureKey] = useState<string | null>(null);
  const [deletingFeatureKey, setDeletingFeatureKey] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [config, setConfig] = useState<PlatformConfigResponse | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<PlatformConfigRuntimeStatusResponse | null>(null);
  const [queueHealth, setQueueHealth] = useState<QueueStorageHealthResponse | null>(null);
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [settingsScopeType, setSettingsScopeType] = useState<PlatformSettingScopeType>('host');
  const [settingsScopeId, setSettingsScopeId] = useState('host');
  const [scopeSettings, setScopeSettings] = useState<ScopeSettingRow[]>([]);
  const [effectiveSettings, setEffectiveSettings] = useState<PlatformSettingItem[]>([]);
  const [savingSetting, setSavingSetting] = useState(false);
  const [deletingSettingKey, setDeletingSettingKey] = useState<string | null>(null);

  const canWriteConfig = hasPermissions(['config:write']);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = getCurrentUser();
      const [configResult, featureResult, runtimeResult, effectiveResult] = await Promise.all([
        getPlatformConfigRequest(),
        listFeatureFlagsRequest(),
        getPlatformConfigRuntimeStatusRequest(),
        getEffectiveSettingsRequest({
          tenantId: currentUser?.tenantId,
          userId: currentUser?.userId,
        }),
      ]);
      setConfig(configResult);
      setFeatureFlags(featureResult);
      setRuntimeStatus(runtimeResult);
      setEffectiveSettings(effectiveResult.settings);

      const defaultScopeId = currentUser?.tenantId ?? 'host';
      setSettingsScopeType('tenant');
      setSettingsScopeId(defaultScopeId);

      const scopedList = await listScopedSettingsRequest({
        scopeType: 'tenant',
        scopeId: defaultScopeId,
      });
      setScopeSettings(scopedList);
    } catch {
      messageApi.error('读取配置失败，请检查权限或重新登录');
      navigate('/login', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const runQueueHealthCheck = async () => {
    setCheckingHealth(true);
    try {
      const result = await checkQueueStorageHealthRequest();
      setQueueHealth(result);
      messageApi[result.ok ? 'success' : 'warning'](result.detail);
    } catch {
      messageApi.error('健康检查失败，请稍后重试');
    } finally {
      setCheckingHealth(false);
    }
  };

  const handleCreateFlag = async () => {
    const values = await form.validateFields();
    setCreating(true);
    try {
      await createFeatureFlagRequest(values.key.trim(), values.enabled ?? false);
      setFeatureFlags((prev) => ({ ...prev, [values.key.trim()]: values.enabled ?? false }));
      messageApi.success(`功能开关 ${values.key.trim()} 已创建`);
      setCreateModalOpen(false);
      form.resetFields();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteFlag = async (key: string) => {
    setDeletingFeatureKey(key);
    try {
      await deleteFeatureFlagRequest(key);
      setFeatureFlags((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      messageApi.success(`功能开关 ${key} 已删除`);
    } catch {
      messageApi.error(`删除失败：${key}`);
    } finally {
      setDeletingFeatureKey(null);
    }
  };

  const loadScopedSettings = async (scopeType: PlatformSettingScopeType, scopeId: string) => {
    const rows = await listScopedSettingsRequest({
      scopeType,
      scopeId,
    });

    setScopeSettings(rows.map((row) => ({
      id: row.id,
      key: row.key,
      value: row.value,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    })));
  };

  const loadEffectiveSettings = async () => {
    const currentUser = getCurrentUser();
    const result = await getEffectiveSettingsRequest({
      tenantId: currentUser?.tenantId,
      userId: currentUser?.userId,
    });
    setEffectiveSettings(result.settings);
  };

  const handleSaveSetting = async () => {
    const values = await settingForm.validateFields();

    let parsedValue: unknown = values.valueText;
    if (values.valueText.trim().startsWith('{') || values.valueText.trim().startsWith('[')) {
      parsedValue = JSON.parse(values.valueText);
    }

    setSavingSetting(true);
    try {
      await upsertScopedSettingRequest(values.key.trim(), {
        scopeType: settingsScopeType,
        scopeId: settingsScopeId,
        value: parsedValue,
      });
      messageApi.success('设置保存成功');
      settingForm.resetFields();
      await Promise.all([
        loadScopedSettings(settingsScopeType, settingsScopeId),
        loadEffectiveSettings(),
      ]);
    } catch {
      messageApi.error('设置保存失败，请检查 value 是否为合法 JSON');
    } finally {
      setSavingSetting(false);
    }
  };

  const handleDeleteSetting = async (key: string) => {
    setDeletingSettingKey(key);
    try {
      await deleteScopedSettingRequest(key, {
        scopeType: settingsScopeType,
        scopeId: settingsScopeId,
      });
      messageApi.success('设置已删除');
      await Promise.all([
        loadScopedSettings(settingsScopeType, settingsScopeId),
        loadEffectiveSettings(),
      ]);
    } catch {
      messageApi.error('删除设置失败');
    } finally {
      setDeletingSettingKey(null);
    }
  };

  const featureRows = useMemo<FeatureFlagRow[]>(
    () =>
      Object.entries(featureFlags)
        .sort(([l], [r]) => l.localeCompare(r))
        .map(([key, enabled]) => ({ key, enabled })),
    [featureFlags],
  );

  const featureColumns: ColumnsType<FeatureFlagRow> = [
    {
      title: '功能开关键',
      dataIndex: 'key',
      key: 'key',
      render: (value: string) => <Text code>{value}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 160,
      render: (enabled: boolean, row) => (
        <Switch
          checked={enabled}
          checkedChildren="开启"
          unCheckedChildren="关闭"
          loading={updatingFeatureKey === row.key}
          disabled={!canWriteConfig}
          onChange={async (next) => {
            setUpdatingFeatureKey(row.key);
            try {
              await updateFeatureFlagRequest(row.key, next);
              setFeatureFlags((prev) => ({ ...prev, [row.key]: next }));
              messageApi.success(`已更新：${row.key}`);
            } catch {
              messageApi.error(`更新失败：${row.key}`);
            } finally {
              setUpdatingFeatureKey(null);
            }
          }}
        />
      ),
    },
    ...(canWriteConfig
      ? [
          {
            title: '操作',
            key: 'action',
            width: 100,
            render: (_: unknown, row: FeatureFlagRow) => (
              <Popconfirm
                title={`确认删除功能开关 "${row.key}"？`}
                okText="删除"
                okButtonProps={{ danger: true }}
                cancelText="取消"
                onConfirm={() => void handleDeleteFlag(row.key)}
              >
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  loading={deletingFeatureKey === row.key}
                >
                  删除
                </Button>
              </Popconfirm>
            ),
          } as ColumnsType<FeatureFlagRow>[number],
        ]
      : []),
  ];

  const settingColumns: ColumnsType<ScopeSettingRow> = [
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      render: (value: string) => <Text code>{value}</Text>,
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      render: (value: unknown) => (
        <Text code>{typeof value === 'string' ? value : JSON.stringify(value)}</Text>
      ),
    },
    {
      title: '更新人',
      dataIndex: 'updatedBy',
      key: 'updatedBy',
      width: 120,
      render: (value?: string | null) => value ?? '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (value?: string) => (value ? new Date(value).toLocaleString() : '-'),
    },
    ...(canWriteConfig
      ? [
          {
            title: '操作',
            key: 'action',
            width: 90,
            render: (_: unknown, row: ScopeSettingRow) => (
              <Popconfirm
                title={`确认删除设置 ${row.key}？`}
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                onConfirm={() => void handleDeleteSetting(row.key)}
              >
                <Button
                  size="small"
                  danger
                  loading={deletingSettingKey === row.key}
                >
                  删除
                </Button>
              </Popconfirm>
            ),
          } as ColumnsType<ScopeSettingRow>[number],
        ]
      : []),
  ];

  return (
    <ConsoleLayout breadcrumbItems={[{ title: '首页' }, { title: '平台管理' }, { title: '配置中心' }]}>
      {contextHolder}

      {/* 页面标题栏 */}
      <Card
        bordered={false}
        style={{ marginBottom: 16 }}
        styles={{ body: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }}
      >
        <div>
          <Title level={4} style={{ margin: 0 }}>配置中心</Title>
          <Text type="secondary">管理平台运行配置、功能开关与任务队列行为</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>刷新</Button>
      </Card>

      {/* 任务队列配置 */}
      <Card
        title="任务队列配置"
        bordered={false}
        style={{ marginBottom: 16 }}
        loading={loading}
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={savingQueueConfig}
            disabled={!canWriteConfig || !config}
            onClick={async () => {
              if (!config) return;
              setSavingQueueConfig(true);
              try {
                const updated = await updatePlatformConfigRequest({
                  taskQueuePersistenceEnabled: config.taskQueue.persistenceEnabled,
                  taskQueueRunnerEnabled: config.taskQueue.runnerEnabled,
                });
                setConfig(updated);
                setFeatureFlags(updated.featureFlags);
                messageApi.success('任务队列配置已保存');
              } catch {
                messageApi.error('保存任务队列配置失败');
              } finally {
                setSavingQueueConfig(false);
              }
            }}
          >
            保存
          </Button>
        }
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space>
            <Text style={{ width: 80, display: 'inline-block' }}>队列持久化</Text>
            <Switch
              checked={config?.taskQueue.persistenceEnabled}
              checkedChildren="开启"
              unCheckedChildren="关闭"
              disabled={!canWriteConfig || !config}
              onChange={(checked) =>
                setConfig((prev) => prev ? { ...prev, taskQueue: { ...prev.taskQueue, persistenceEnabled: checked } } : prev)
              }
            />
          </Space>
          <Space>
            <Text style={{ width: 80, display: 'inline-block' }}>任务执行器</Text>
            <Switch
              checked={config?.taskQueue.runnerEnabled}
              checkedChildren="开启"
              unCheckedChildren="关闭"
              disabled={!canWriteConfig || !config}
              onChange={(checked) =>
                setConfig((prev) => prev ? { ...prev, taskQueue: { ...prev.taskQueue, runnerEnabled: checked } } : prev)
              }
            />
          </Space>
          <Text type="secondary">
            最近更新：{config?.updatedAt ? new Date(config.updatedAt).toLocaleString() : '-'}
          </Text>
        </Space>
      </Card>

      {/* 运行状态 */}
      <Card
        title="运行状态"
        bordered={false}
        style={{ marginBottom: 16 }}
        loading={loading}
        extra={
          <Button loading={checkingHealth} onClick={() => void runQueueHealthCheck()}>
            健康检查
          </Button>
        }
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text>数据目录：<Text code>{runtimeStatus?.dataDirectory ?? '-'}</Text></Text>
          <Text>配置文件：<Text code>{runtimeStatus?.configFilePath ?? '-'}</Text></Text>
          <Text>队列文件：<Text code>{runtimeStatus?.taskQueueFilePath ?? '-'}</Text></Text>
          <Text>
            文件存在：{runtimeStatus?.taskQueueFileExists ? '是' : '否'}
            {'  '}|{'  '}
            文件大小：{runtimeStatus?.taskQueueFileSizeBytes ?? 0} bytes
          </Text>
          <Text type="secondary">
            最近写入：{runtimeStatus?.taskQueueFileUpdatedAt
              ? new Date(runtimeStatus.taskQueueFileUpdatedAt).toLocaleString()
              : '-'}
          </Text>

          {queueHealth && (
            <Alert
              type={queueHealth.ok ? 'success' : 'warning'}
              showIcon
              message={queueHealth.ok ? '队列存储健康' : '队列存储异常'}
              description={
                <Space direction="vertical" size={2}>
                  <Text>{queueHealth.detail}</Text>
                  <Text type="secondary">检查时间：{new Date(queueHealth.checkedAt).toLocaleString()}</Text>
                  <Text type="secondary">目录可写：{queueHealth.dataDirectoryWritable ? '是' : '否'}{'  '}文件可读：{queueHealth.taskQueueFileReadable ? '是' : '否'}{'  '}文件可写：{queueHealth.taskQueueFileWritable ? '是' : '否'}{'  '}JSON 有效：{queueHealth.taskQueueJsonValid === null ? '未检查' : queueHealth.taskQueueJsonValid ? '是' : '否'}</Text>
                </Space>
              }
            />
          )}
        </Space>
      </Card>

      {/* 设置系统三层继承 */}
      <Card
        title="设置系统（Host / Tenant / User）"
        bordered={false}
        style={{ marginBottom: 16 }}
        loading={loading}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space wrap>
            <Text style={{ width: 70 }}>作用域</Text>
            <Select<PlatformSettingScopeType>
              value={settingsScopeType}
              style={{ width: 150 }}
              options={[
                { label: 'Host', value: 'host' },
                { label: 'Tenant', value: 'tenant' },
                { label: 'User', value: 'user' },
              ]}
              onChange={(next) => {
                setSettingsScopeType(next);
                const currentUser = getCurrentUser();
                const nextScopeId =
                  next === 'host'
                    ? 'host'
                    : next === 'tenant'
                      ? currentUser?.tenantId ?? 'host'
                      : currentUser?.userId ?? '';
                setSettingsScopeId(nextScopeId);
                void loadScopedSettings(next, nextScopeId);
              }}
            />

            <Input
              style={{ width: 220 }}
              placeholder="Scope ID"
              value={settingsScopeId}
              disabled={settingsScopeType === 'host'}
              onChange={(event) => setSettingsScopeId(event.target.value)}
            />

            <Button
              onClick={() => void loadScopedSettings(settingsScopeType, settingsScopeId)}
            >
              加载作用域设置
            </Button>
          </Space>

          <Form form={settingForm} layout="inline" style={{ rowGap: 8 }}>
            <Form.Item
              label="Key"
              name="key"
              rules={[{ required: true, message: '请输入 key' }]}
            >
              <Input style={{ width: 280 }} placeholder="例如：ui.theme.mode" />
            </Form.Item>
            <Form.Item
              label="Value"
              name="valueText"
              rules={[{ required: true, message: '请输入 value' }]}
            >
              <Input style={{ width: 360 }} placeholder={'例如：dark 或 {"enabled":true}'} />
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={savingSetting}
                disabled={!canWriteConfig}
                onClick={() => void handleSaveSetting()}
              >
                保存设置
              </Button>
            </Form.Item>
          </Form>

          <Table<ScopeSettingRow>
            rowKey={(record) => record.id ?? record.key}
            columns={settingColumns}
            dataSource={scopeSettings}
            pagination={false}
            locale={{ emptyText: '当前作用域暂无设置' }}
          />

          <Card size="small" title="Effective 预览（user > tenant > host > default)">
            <Table<PlatformSettingItem>
              rowKey={(record) => `${record.key}_${record.source}`}
              pagination={false}
              dataSource={effectiveSettings}
              columns={[
                {
                  title: 'Key',
                  dataIndex: 'key',
                  key: 'key',
                  render: (value: string) => <Text code>{value}</Text>,
                },
                {
                  title: 'Value',
                  dataIndex: 'value',
                  key: 'value',
                  render: (value: unknown) => (
                    <Text code>{typeof value === 'string' ? value : JSON.stringify(value)}</Text>
                  ),
                },
                { title: '来源层级', dataIndex: 'source', key: 'source', width: 120 },
                { title: '来源ScopeId', dataIndex: 'sourceScopeId', key: 'sourceScopeId', width: 160 },
              ]}
            />
          </Card>
        </Space>
      </Card>

      {/* 功能开关 */}
      <Card
        title="功能开关"
        bordered={false}
        loading={loading}
        extra={
          canWriteConfig && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields();
                setCreateModalOpen(true);
              }}
            >
              新增开关
            </Button>
          )
        }
      >
        <Table<FeatureFlagRow>
          rowKey="key"
          columns={featureColumns}
          dataSource={featureRows}
          pagination={false}
          locale={{ emptyText: '暂无功能开关' }}
        />
      </Card>

      {/* 新增开关 Modal */}
      <Modal
        title="新增功能开关"
        open={createModalOpen}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => void handleCreateFlag()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ enabled: true }}>
          <Form.Item
            label="开关键（建议格式：module.feature.enabled）"
            name="key"
            rules={[
              { required: true, message: '请输入开关键' },
              { pattern: /^[a-z0-9._-]+$/, message: '仅允许小写字母、数字和 . _ -' },
            ]}
          >
            <Input placeholder="例如：payment.beta.enabled" />
          </Form.Item>
          <Form.Item label="默认状态" name="enabled" valuePropName="checked">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>
        </Form>
      </Modal>
    </ConsoleLayout>
  );
}

