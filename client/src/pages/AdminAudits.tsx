import { ReloadOutlined } from '@ant-design/icons';
import { Button, Card, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listAuditLogsRequest, type AuditLogItem } from '../lib/api';
import ConsoleLayout from '../components/ConsoleLayout';

const { Title, Text } = Typography;

export default function AdminAudits() {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);

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

  useEffect(() => {
    void loadLogs();
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
        <Table<AuditLogItem>
          rowKey={(record) => `${record.timestamp}_${record.path}_${record.userId}`}
          loading={loading}
          columns={columns}
          dataSource={logs}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1050 }}
        />
      </Card>
    </ConsoleLayout>
  );
}
