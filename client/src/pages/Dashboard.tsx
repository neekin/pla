import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DashboardOutlined,
  FileTextOutlined,
  SettingOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Button,
  Card,
  Col,
  List,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, hasPermissions } from '../router/auth';
import { getTaskStatsRequest } from '../lib/api';
import ConsoleLayout from '../components/ConsoleLayout';

const { Title, Text } = Typography;

const recentActivity = [
  { title: '张三 完成了项目「设计系统 v2」', time: '2 分钟前', tag: '已完成', color: 'success' },
  { title: '李四 提交了发票申请', time: '18 分钟前', tag: '待审核', color: 'processing' },
  { title: '王五 更新了合同条款', time: '1 小时前', tag: '已更新', color: 'default' },
  { title: '赵六 新加入团队', time: '3 小时前', tag: '新成员', color: 'blue' },
  { title: '月结算报告已生成', time: '昨天', tag: '报告', color: 'purple' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const username = getCurrentUser()?.username ?? 'User';
  const canReadConfig = hasPermissions(['config:read']);
  const canReadTasks = hasPermissions(['task:read']);
  const [queuedTaskCount, setQueuedTaskCount] = useState<number | null>(null);

  useEffect(() => {
    if (!canReadTasks) return;
    void getTaskStatsRequest()
      .then((stats) => setQueuedTaskCount(stats.queued))
      .catch(() => setQueuedTaskCount(null));
  }, []);

  const quickEntries = [
    { icon: <FileTextOutlined />, label: '租户管理', color: '#1677ff', bg: '#e6f4ff', to: '/admin/tenants' },
    { icon: <WalletOutlined />, label: '任务中心', color: '#52c41a', bg: '#f6ffed', to: '/tasks' },
    { icon: <TeamOutlined />, label: '用户权限', color: '#722ed1', bg: '#f9f0ff', to: '/admin/users' },
    { icon: <SettingOutlined />, label: '系统设置', color: '#fa8c16', bg: '#fff7e6' },
  ];

  if (canReadConfig) {
    quickEntries.push({
      icon: <SettingOutlined />,
      label: '配置中心',
      color: '#13c2c2',
      bg: '#e6fffb',
      to: '/admin/config',
    });
  }

  return (
    <ConsoleLayout breadcrumbItems={[{ title: '首页' }, { title: '数据概览' }]}>
      <Card
        style={{
          marginBottom: 24,
          background: 'linear-gradient(135deg,#1677ff 0%,#0958d9 100%)',
          border: 'none',
          borderRadius: 12,
        }}
        styles={{ body: { padding: '24px 32px' } }}
      >
        <Row align="middle" justify="space-between">
          <Col>
            <Title level={4} style={{ color: '#fff', margin: 0 }}>
              早上好，{username} 👋
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4, display: 'block' }}>
              今天共有 <strong style={{ color: '#fff' }}>3</strong> 条待审核事项，祝您工作顺利！
            </Text>
          </Col>
          <Col>
            <Space>
              <Button ghost style={{ borderRadius: 8 }}>
                查看待办
              </Button>
              {canReadConfig && (
                <Button
                  ghost
                  style={{ borderRadius: 8 }}
                  onClick={() => navigate('/admin/config')}
                >
                  配置中心
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          {
            title: '总用户数',
            value: 1128,
            suffix: '人',
            change: 12.5,
            up: true,
            icon: <TeamOutlined />,
            color: '#1677ff',
            bg: '#e6f4ff',
          },
          {
            title: '本月收入',
            value: 92800,
            prefix: '¥',
            change: 8.2,
            up: true,
            icon: <WalletOutlined />,
            color: '#52c41a',
            bg: '#f6ffed',
          },
          {
            title: '待处理任务',
            value: queuedTaskCount ?? '-',
            suffix: '项',
            change: 3.1,
            up: false,
            icon: <FileTextOutlined />,
            color: '#fa8c16',
            bg: '#fff7e6',
          },
          {
            title: '活跃率',
            value: 78.5,
            suffix: '%',
            change: 5.4,
            up: true,
            icon: <DashboardOutlined />,
            color: '#722ed1',
            bg: '#f9f0ff',
          },
        ].map((item) => (
          <Col xs={24} sm={12} xl={6} key={item.title}>
            <Card bordered={false} style={{ borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Statistic
                  title={<span style={{ fontSize: 13, color: '#8c8c8c' }}>{item.title}</span>}
                  value={item.value}
                  prefix={item.prefix}
                  suffix={item.suffix}
                  precision={item.suffix === '%' ? 1 : 0}
                  valueStyle={{ fontSize: 28, fontWeight: 600, color: '#262626' }}
                />
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: item.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    color: item.color,
                  }}
                >
                  {item.icon}
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                {item.up ? (
                  <ArrowUpOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <ArrowDownOutlined style={{ color: '#ff4d4f' }} />
                )}
                <Text style={{ color: item.up ? '#52c41a' : '#ff4d4f', fontSize: 13 }}>{item.change}%</Text>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  较上月
                </Text>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title="近期动态" bordered={false} style={{ borderRadius: 12 }} extra={<Button type="link" size="small">查看全部</Button>}>
            <List
              dataSource={recentActivity}
              renderItem={(item) => (
                <List.Item style={{ padding: '12px 0' }}>
                  <List.Item.Meta
                    avatar={
                      <Avatar size={36} style={{ background: '#e6f4ff', color: '#1677ff', fontSize: 14 }}>
                        {item.title[0]}
                      </Avatar>
                    }
                    title={<Text style={{ fontSize: 14 }}>{item.title}</Text>}
                    description={<Text type="secondary" style={{ fontSize: 12 }}>{item.time}</Text>}
                  />
                  <Tag color={item.color}>{item.tag}</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="快速入口" bordered={false} style={{ borderRadius: 12, height: '100%' }}>
            <Row gutter={[12, 12]}>
              {quickEntries.map((entry) => (
                <Col span={12} key={entry.label}>
                  <Button
                    block
                    onClick={() => {
                      if ('to' in entry && entry.to) navigate(entry.to);
                    }}
                    style={{
                      height: 72,
                      borderRadius: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      background: entry.bg,
                      border: 'none',
                      color: entry.color,
                      fontWeight: 500,
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{entry.icon}</span>
                    <span style={{ fontSize: 13 }}>{entry.label}</span>
                  </Button>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </ConsoleLayout>
  );
}
