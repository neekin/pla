import { ReloadOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Form,
  InputNumber,
  Modal,
  Progress,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConsoleLayout from '../components/ConsoleLayout';
import {
  assignTenantSubscriptionRequest,
  getTenantSubscriptionRequest,
  listBillingEditionsRequest,
  listScopedSettingsRequest,
  listTenantsRequest,
  renewTenantSubscriptionRequest,
  upsertScopedSettingRequest,
  type BillingEditionItem,
  type TenantItem,
  type TenantSubscriptionItem,
} from '../lib/api';
import { hasPermissions } from '../router/auth';

const { Title, Text } = Typography;

interface AssignFormValues {
  tenantId: string;
  editionId: string;
  trialDays?: number;
  quotaTaskDispatchMonthly?: number;
}

interface RenewFormValues {
  tenantId: string;
  months: number;
}

interface BillingRow {
  tenantId: string;
  tenantName: string;
  tenantStatus: TenantItem['status'];
  fallbackEdition: TenantItem['edition'];
  subscription: TenantSubscriptionItem | null;
}

export default function AdminBilling() {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const [assignForm] = Form.useForm<AssignFormValues>();
  const [renewForm] = Form.useForm<RenewFormValues>();

  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [savingStrategy, setSavingStrategy] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [renewModalOpen, setRenewModalOpen] = useState(false);

  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [editions, setEditions] = useState<BillingEditionItem[]>([]);
  const [subscriptionMap, setSubscriptionMap] = useState<Record<string, TenantSubscriptionItem>>({});
  const [overageStrategy, setOverageStrategy] = useState<'reject' | 'degrade'>('reject');

  const canWrite = hasPermissions(['config:write']);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tenantRows, editionRows, hostSettings] = await Promise.all([
        listTenantsRequest(),
        listBillingEditionsRequest(),
        listScopedSettingsRequest({ scopeType: 'host', scopeId: 'host' }),
      ]);

      const subscriptionEntries = await Promise.all(
        tenantRows.map(async (tenant) => {
          const subscription = await getTenantSubscriptionRequest(tenant.id);
          return [tenant.id, subscription] as const;
        }),
      );

      const nextSubscriptionMap: Record<string, TenantSubscriptionItem> = {};
      for (const [tenantId, subscription] of subscriptionEntries) {
        nextSubscriptionMap[tenantId] = subscription;
      }

      const strategySetting = hostSettings.find((item) => item.key === 'quota.overageStrategy')?.value;
      if (strategySetting === 'degrade' || strategySetting === 'reject') {
        setOverageStrategy(strategySetting);
      } else {
        const strategyFromSubscription = subscriptionEntries[0]?.[1]?.overageStrategy;
        if (strategyFromSubscription === 'degrade' || strategyFromSubscription === 'reject') {
          setOverageStrategy(strategyFromSubscription);
        }
      }

      setTenants(tenantRows);
      setEditions(editionRows);
      setSubscriptionMap(nextSubscriptionMap);
    } catch {
      messageApi.error('读取订阅数据失败，请重新登录后重试');
      navigate('/login', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const rows: BillingRow[] = useMemo(
    () =>
      tenants.map((tenant) => ({
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantStatus: tenant.status,
        fallbackEdition: tenant.edition,
        subscription: subscriptionMap[tenant.id] ?? null,
      })),
    [subscriptionMap, tenants],
  );

  const exceededTenants = useMemo(
    () => rows.filter((row) => row.subscription?.quota.exceeded).map((row) => row.tenantId),
    [rows],
  );

  const columns: ColumnsType<BillingRow> = [
    {
      title: '租户',
      key: 'tenant',
      width: 210,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.tenantName}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.tenantId}
          </Text>
        </Space>
      ),
    },
    {
      title: '版本',
      key: 'plan',
      width: 140,
      render: (_, row) => {
        const plan = row.subscription?.plan ?? row.fallbackEdition;
        return <Tag color="blue">{plan.toUpperCase()}</Tag>;
      },
    },
    {
      title: '订阅状态',
      key: 'status',
      width: 140,
      render: (_, row) => {
        const status = row.subscription?.status;

        if (status === 'trialing') {
          return <Tag color="processing">试用中</Tag>;
        }

        if (status === 'active') {
          return <Tag color="success">有效</Tag>;
        }

        if (status === 'expired') {
          return <Tag color="error">已过期</Tag>;
        }

        return <Tag>未知</Tag>;
      },
    },
    {
      title: '有效期',
      key: 'period',
      width: 240,
      render: (_, row) => {
        const subscription = row.subscription;

        if (!subscription) {
          return <Text type="secondary">-</Text>;
        }

        if (subscription.status === 'trialing' && subscription.trialEndAt) {
          return <Text>{`试用至 ${new Date(subscription.trialEndAt).toLocaleString()}`}</Text>;
        }

        if (subscription.currentPeriodEndAt) {
          return <Text>{`到期于 ${new Date(subscription.currentPeriodEndAt).toLocaleString()}`}</Text>;
        }

        return <Text type="secondary">-</Text>;
      },
    },
    {
      title: '配额使用率',
      key: 'quota',
      width: 260,
      render: (_, row) => {
        const quota = row.subscription?.quota;

        if (!quota) {
          return <Text type="secondary">-</Text>;
        }

        if (quota.unlimited) {
          return (
            <Space direction="vertical" size={2}>
              <Tag color="success">无限制</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                已使用 {quota.used}
              </Text>
            </Space>
          );
        }

        return (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Progress
              size="small"
              percent={Math.min(100, quota.usageRate)}
              status={quota.exceeded ? 'exception' : 'active'}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {`已用 ${quota.used} / ${quota.limit}`}
            </Text>
          </Space>
        );
      },
    },
    {
      title: '超限策略',
      key: 'strategy',
      width: 120,
      render: (_, row) => {
        const strategy = row.subscription?.overageStrategy ?? overageStrategy;
        return strategy === 'degrade'
          ? <Tag color="warning">降级</Tag>
          : <Tag color="error">拒绝</Tag>;
      },
    },
    ...(canWrite
      ? [
          {
            title: '操作',
            key: 'actions',
            width: 180,
            render: (_: unknown, row: BillingRow) => (
              <Space>
                <Button
                  size="small"
                  onClick={() => {
                    assignForm.setFieldsValue({
                      tenantId: row.tenantId,
                    });
                    setAssignModalOpen(true);
                  }}
                >
                  分配
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    renewForm.setFieldsValue({
                      tenantId: row.tenantId,
                      months: 1,
                    });
                    setRenewModalOpen(true);
                  }}
                >
                  续费
                </Button>
              </Space>
            ),
          } as ColumnsType<BillingRow>[number],
        ]
      : []),
  ];

  const updateOverageStrategy = async (next: 'reject' | 'degrade') => {
    setSavingStrategy(true);
    try {
      await upsertScopedSettingRequest('quota.overageStrategy', {
        scopeType: 'host',
        scopeId: 'host',
        value: next,
      });
      setOverageStrategy(next);
      messageApi.success(`超限策略已更新为${next === 'degrade' ? '降级' : '拒绝'}`);
      await loadData();
    } catch {
      messageApi.error('更新超限策略失败');
    } finally {
      setSavingStrategy(false);
    }
  };

  const onAssign = async () => {
    const values = await assignForm.validateFields();
    setAssigning(true);
    try {
      await assignTenantSubscriptionRequest({
        tenantId: values.tenantId,
        editionId: values.editionId,
        trialDays: values.trialDays,
        quotaTaskDispatchMonthly: values.quotaTaskDispatchMonthly,
      });
      messageApi.success('订阅分配成功');
      setAssignModalOpen(false);
      assignForm.resetFields();
      await loadData();
    } catch {
      messageApi.error('订阅分配失败');
    } finally {
      setAssigning(false);
    }
  };

  const onRenew = async () => {
    const values = await renewForm.validateFields();
    setRenewing(true);
    try {
      await renewTenantSubscriptionRequest({
        tenantId: values.tenantId,
        months: values.months,
      });
      messageApi.success('续费成功');
      setRenewModalOpen(false);
      renewForm.resetFields();
      await loadData();
    } catch {
      messageApi.error('续费失败');
    } finally {
      setRenewing(false);
    }
  };

  return (
    <ConsoleLayout breadcrumbItems={[{ title: '首页' }, { title: '平台管理' }, { title: '版本与订阅' }]}> 
      {contextHolder}

      {exceededTenants.length > 0 ? (
        <Alert
          showIcon
          type="warning"
          style={{ marginBottom: 16 }}
          message={`存在 ${exceededTenants.length} 个租户配额已超限：${exceededTenants.join(', ')}`}
        />
      ) : null}

      <Card
        bordered={false}
        style={{ marginBottom: 16 }}
        styles={{ body: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }}
      >
        <div>
          <Title level={4} style={{ margin: 0 }}>
            版本与订阅
          </Title>
          <Text type="secondary">查看租户试用中/已过期/有效状态，并管理配额与续费</Text>
        </div>

        <Space>
          <Text type="secondary">超限策略</Text>
          <Switch
            checked={overageStrategy === 'degrade'}
            checkedChildren="降级"
            unCheckedChildren="拒绝"
            disabled={!canWrite}
            loading={savingStrategy}
            onChange={(checked) => {
              const next = checked ? 'degrade' : 'reject';
              void updateOverageStrategy(next);
            }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
            刷新
          </Button>
        </Space>
      </Card>

      <Card bordered={false}>
        <Table<BillingRow>
          rowKey="tenantId"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title="分配订阅"
        open={assignModalOpen}
        confirmLoading={assigning}
        onCancel={() => setAssignModalOpen(false)}
        onOk={() => void onAssign()}
        okText="确认"
        destroyOnHidden
      >
        <Form form={assignForm} layout="vertical" preserve={false} initialValues={{ trialDays: 14 }}>
          <Form.Item label="租户" name="tenantId" rules={[{ required: true, message: '请选择租户' }]}> 
            <Select
              showSearch
              optionFilterProp="label"
              options={tenants.map((tenant) => ({
                label: `${tenant.name} (${tenant.id})`,
                value: tenant.id,
              }))}
            />
          </Form.Item>
          <Form.Item label="版本" name="editionId" rules={[{ required: true, message: '请选择版本' }]}> 
            <Select
              options={editions.map((edition) => ({
                label: `${edition.name} (${edition.plan})`,
                value: edition.id,
              }))}
            />
          </Form.Item>
          <Form.Item label="试用天数" name="trialDays">
            <InputNumber min={0} max={365} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="任务月配额（可选，-1=无限）" name="quotaTaskDispatchMonthly">
            <InputNumber min={-1} max={1_000_000} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="续费订阅"
        open={renewModalOpen}
        confirmLoading={renewing}
        onCancel={() => setRenewModalOpen(false)}
        onOk={() => void onRenew()}
        okText="确认"
        destroyOnHidden
      >
        <Form form={renewForm} layout="vertical" preserve={false} initialValues={{ months: 1 }}>
          <Form.Item label="租户" name="tenantId" rules={[{ required: true, message: '请选择租户' }]}> 
            <Select
              showSearch
              optionFilterProp="label"
              options={tenants.map((tenant) => ({
                label: `${tenant.name} (${tenant.id})`,
                value: tenant.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            label="续费月数"
            name="months"
            rules={[{ required: true, message: '请输入续费月数' }]}
          >
            <InputNumber min={1} max={36} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </ConsoleLayout>
  );
}
