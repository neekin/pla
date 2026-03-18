import { PlayCircleOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Divider,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  dispatchTaskRequest,
  listFailedTasksRequest,
  listTaskHistoryRequest,
  listTasksRequest,
  retryTaskRequest,
  runTaskNowRequest,
  type TaskHistoryItem,
  type TaskItem,
} from '../lib/api';
import { hasPermissions } from '../router/auth';
import ConsoleLayout from '../components/ConsoleLayout';

const { Title, Text } = Typography;

interface TaskFormValues {
  taskType: string;
  payloadText?: string;
  maxRetry?: number;
  retryStrategy?: 'fixed' | 'exponential';
  retryBaseDelayMs?: number;
}

export default function Tasks() {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskItem['status'] | 'all'>('all');
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);
  const [detailTask, setDetailTask] = useState<TaskItem | null>(null);
  const [taskHistory, setTaskHistory] = useState<TaskHistoryItem[]>([]);
  const [taskHistoryLoading, setTaskHistoryLoading] = useState(false);
  const [quotaAlert, setQuotaAlert] = useState<{
    type: 'warning' | 'error';
    message: string;
  } | null>(null);
  const [form] = Form.useForm<TaskFormValues>();

  const canDispatchTask = hasPermissions(['task:dispatch']);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const list = await listTasksRequest();
      setTasks(list);
      await listFailedTasksRequest();
    } catch {
      messageApi.error('获取任务列表失败，请重新登录后重试');
      navigate('/login', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTasks();
  }, []);

  const statusTag = (status: TaskItem['status']) => {
    if (status === 'queued') return <Tag color="gold">排队中</Tag>;
    if (status === 'running') return <Tag color="processing">执行中</Tag>;
    if (status === 'retrying') return <Tag color="warning">重试中</Tag>;
    if (status === 'failed') return <Tag color="error">失败</Tag>;
    return <Tag color="success">已完成</Tag>;
  };

  const filteredTasks = useMemo(
    () => tasks.filter((task) => (statusFilter === 'all' ? true : task.status === statusFilter)),
    [tasks, statusFilter],
  );

  const columns: ColumnsType<TaskItem> = useMemo(
    () => [
      {
        title: '任务ID',
        dataIndex: 'id',
        key: 'id',
        width: 260,
        ellipsis: true,
      },
      {
        title: '任务类型',
        dataIndex: 'taskType',
        key: 'taskType',
        width: 160,
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (status: TaskItem['status']) => statusTag(status),
      },
      {
        title: '重试',
        key: 'retry',
        width: 110,
        render: (_, record) => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.retryCount}/{record.maxRetry}
          </Text>
        ),
      },
      {
        title: '调度时间',
        dataIndex: 'runAt',
        key: 'runAt',
        width: 190,
        render: (value: string) => new Date(value).toLocaleString(),
      },
      {
        title: '创建人',
        dataIndex: 'createdBy',
        key: 'createdBy',
        width: 120,
      },
      {
        title: '操作',
        key: 'actions',
        width: 260,
        render: (_, record) => (
          <Space>
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              disabled={!canDispatchTask || runningTaskId === record.id}
              loading={runningTaskId === record.id}
              onClick={async () => {
                setRunningTaskId(record.id);
                try {
                  await runTaskNowRequest(record.id);
                  messageApi.success('任务执行成功');
                  await fetchTasks();
                } catch {
                  messageApi.error('执行任务失败');
                } finally {
                  setRunningTaskId(null);
                }
              }}
            >
              立即执行
            </Button>

            <Button
              size="small"
              disabled={!canDispatchTask || record.status !== 'failed' || retryingTaskId === record.id}
              loading={retryingTaskId === record.id}
              onClick={async () => {
                setRetryingTaskId(record.id);
                try {
                  await retryTaskRequest(record.id);
                  messageApi.success('失败任务已进入重试队列');
                  await fetchTasks();
                } catch {
                  messageApi.error('重试失败');
                } finally {
                  setRetryingTaskId(null);
                }
              }}
            >
              失败重试
            </Button>

            <Button size="small" onClick={() => void openTaskDetail(record)}>
              错误详情
            </Button>
          </Space>
        ),
      },
    ],
    [canDispatchTask, runningTaskId, retryingTaskId],
  );

  const handleDispatch = async () => {
    try {
      const values = await form.validateFields();
      let parsedPayload: Record<string, unknown> = {};

      if (values.payloadText && values.payloadText.trim()) {
        parsedPayload = JSON.parse(values.payloadText) as Record<string, unknown>;
      }

      setDispatching(true);
      const result = await dispatchTaskRequest({
        taskType: values.taskType,
        payload: parsedPayload,
        maxRetry: values.maxRetry,
        retryStrategy: values.retryStrategy,
        retryBaseDelayMs: values.retryBaseDelayMs,
      });

      if (result.quota?.degraded) {
        setQuotaAlert({
          type: 'warning',
          message: '当前请求已触发超限降级，任务将延后执行。',
        });
      } else {
        setQuotaAlert(null);
      }

      messageApi.success(result.message || '任务已派发');
      setCreateModalOpen(false);
      form.resetFields();
      await fetchTasks();
    } catch (error) {
      if (error instanceof SyntaxError) {
        messageApi.error('Payload 必须是合法 JSON');
        return;
      }

      if (error instanceof Error) {
        const isQuotaExceeded = error.message.includes('QUOTA_LIMIT_EXCEEDED');
        const isSubscriptionExpired = error.message.includes('SUBSCRIPTION_EXPIRED');

        if (isQuotaExceeded || isSubscriptionExpired) {
          setQuotaAlert({
            type: 'error',
            message: isSubscriptionExpired
              ? '当前租户订阅已过期，任务派发已被拦截，请先续费。'
              : '当前租户已达到任务派发配额上限，请续费或切换超限降级策略。',
          });
          messageApi.warning('租户配额已超限，本次请求被拦截');
          return;
        }
      }

      messageApi.error('任务派发失败');
    } finally {
      setDispatching(false);
    }
  };

  const openTaskDetail = async (task: TaskItem) => {
    setDetailTask(task);
    setTaskHistoryLoading(true);

    try {
      const history = await listTaskHistoryRequest(task.id);
      setTaskHistory(history);
    } catch {
      setTaskHistory([]);
      messageApi.warning('任务历史加载失败，稍后重试');
    } finally {
      setTaskHistoryLoading(false);
    }
  };

  return (
    <ConsoleLayout breadcrumbItems={[{ title: '首页' }, { title: '任务中心' }]}>
      {contextHolder}

      {quotaAlert ? (
        <Alert
          showIcon
          type={quotaAlert.type}
          message={quotaAlert.message}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <Card
        bordered={false}
        style={{ marginBottom: 16 }}
        styles={{ body: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }}
      >
        <div>
          <Title level={4} style={{ margin: 0 }}>
            任务中心
          </Title>
          <Text type="secondary">任务调度与执行管理（平台骨架示例）</Text>
        </div>

        <Space>
          <Select
            value={statusFilter}
            style={{ width: 140 }}
            onChange={(value) => setStatusFilter(value)}
            options={[
              { label: '全部状态', value: 'all' },
              { label: '排队中', value: 'queued' },
              { label: '执行中', value: 'running' },
              { label: '重试中', value: 'retrying' },
              { label: '失败', value: 'failed' },
              { label: '已完成', value: 'done' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void fetchTasks()}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!canDispatchTask}
            onClick={() => setCreateModalOpen(true)}
          >
            新建任务
          </Button>
        </Space>
      </Card>

      <Card bordered={false}>
        <Table<TaskItem>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredTasks}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 1280 }}
        />
      </Card>

      <Drawer
        open={!!detailTask}
        title="任务错误详情"
        width={520}
        onClose={() => {
          setDetailTask(null);
          setTaskHistory([]);
        }}
      >
        {detailTask ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Text>
              <strong>任务ID：</strong>
              {detailTask.id}
            </Text>
            <Text>
              <strong>状态：</strong>
              {detailTask.status}
            </Text>
            <Text>
              <strong>最后错误：</strong>
              {detailTask.lastError ?? '-'}
            </Text>
            <Text>
              <strong>重试次数：</strong>
              {detailTask.retryCount}/{detailTask.maxRetry}
            </Text>
            <Text>
              <strong>Payload：</strong>
            </Text>
            <Input.TextArea
              readOnly
              rows={8}
              value={JSON.stringify(detailTask.payload, null, 2)}
            />

            <Divider style={{ margin: '4px 0' }} />

            <Text>
              <strong>执行历史：</strong>
            </Text>
            <Input.TextArea
              readOnly
              rows={10}
              value={taskHistoryLoading
                ? '加载中...'
                : taskHistory.length === 0
                  ? '暂无历史'
                  : taskHistory
                    .map((item) => `${new Date(item.createdAt).toLocaleString()} | ${item.type} | ${JSON.stringify(item.payload)}`)
                    .join('\n')}
            />
          </Space>
        ) : null}
      </Drawer>

      <Modal
        title="派发任务"
        open={createModalOpen}
        confirmLoading={dispatching}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => void handleDispatch()}
        okText="派发"
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            label="任务类型"
            name="taskType"
            rules={[{ required: true, message: '请选择任务类型' }]}
          >
            <Select
              placeholder="选择任务类型"
              options={[
                { label: 'sync-report', value: 'sync-report' },
                { label: 'billing-check', value: 'billing-check' },
                { label: 'notify-users', value: 'notify-users' },
              ]}
            />
          </Form.Item>

          <Form.Item label="Payload(JSON，可选)" name="payloadText">
            <Input.TextArea
              rows={5}
              placeholder='例如：{"scope":"weekly","priority":"high"}'
            />
          </Form.Item>

          <Form.Item label="最大重试次数" name="maxRetry" initialValue={3}>
            <Select
              options={[
                { label: '0 次（失败即终止）', value: 0 },
                { label: '1 次', value: 1 },
                { label: '2 次', value: 2 },
                { label: '3 次', value: 3 },
                { label: '5 次', value: 5 },
              ]}
            />
          </Form.Item>

          <Form.Item label="重试策略" name="retryStrategy" initialValue="fixed">
            <Select
              options={[
                { label: '固定间隔（Fixed）', value: 'fixed' },
                { label: '指数退避（Exponential）', value: 'exponential' },
              ]}
            />
          </Form.Item>

          <Form.Item label="重试基准间隔" name="retryBaseDelayMs" initialValue={30000}>
            <Select
              options={[
                { label: '5 秒', value: 5000 },
                { label: '10 秒', value: 10000 },
                { label: '30 秒', value: 30000 },
                { label: '60 秒', value: 60000 },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </ConsoleLayout>
  );
}
