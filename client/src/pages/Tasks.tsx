import { PlayCircleOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
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
  listTasksRequest,
  runTaskNowRequest,
  type TaskItem,
} from '../lib/api';
import { hasPermissions } from '../router/auth';
import ConsoleLayout from '../components/ConsoleLayout';

const { Title, Text } = Typography;

interface TaskFormValues {
  taskType: string;
  payloadText?: string;
}

export default function Tasks() {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
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
    return <Tag color="success">已完成</Tag>;
  };

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
        width: 140,
        render: (_, record) => (
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
        ),
      },
    ],
    [canDispatchTask, runningTaskId],
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
          dataSource={tasks}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 980 }}
        />
      </Card>

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
        </Form>
      </Modal>
    </ConsoleLayout>
  );
}
