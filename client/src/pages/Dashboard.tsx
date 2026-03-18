import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckCircleFilled,
  DashboardOutlined,
  ExclamationCircleFilled,
  FileTextOutlined,
  SettingOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  List,
  Progress,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, hasPermissions } from '../router/auth';
import { getSystemHealthRequest, getTaskStatsRequest } from '../lib/api';
import { trpcClient } from '../lib/trpc';
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
  const canReadConfig = hasPermissions(['config:read']);
  const canReadTasks = hasPermissions(['task:read']);

  const profileQuery = useQuery({
    queryKey: ['dashboard', 'profile'],
    queryFn: () => (trpcClient as any).authProfile.query(),
    retry: false,
  });

  const username = profileQuery.data?.user.username ?? getCurrentUser()?.username ?? 'User';

  const taskStatsQuery = useQuery({
    queryKey: ['dashboard', 'task-stats'],
    queryFn: getTaskStatsRequest,
    enabled: canReadTasks,
    retry: 1,
  });

  const healthQuery = useQuery({
    queryKey: ['dashboard', 'health'],
    queryFn: getSystemHealthRequest,
    retry: 1,
  });

  const taskStats = taskStatsQuery.data ?? null;
  const health = healthQuery.data ?? null;
  const queuedTaskCount = taskStats?.queued ?? null;

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
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {/* 运行健康卡片 */}
            <Card
              title="运行健康"
              bordered={false}
              style={{ borderRadius: 12 }}
              extra={
                health ? (
                  health.status === 'ok' ? (
                    <Badge status="success" text={<Text style={{ color: '#52c41a', fontSize: 12 }}>正常</Text>} />
                  ) : (
                    <Badge status="error" text={<Text style={{ color: '#ff4d4f', fontSize: 12 }}>异常</Text>} />
                  )
                ) : (
                  <Badge status="default" text={<Text type="secondary" style={{ fontSize: 12 }}>检测中</Text>} />
                )
              }
            >
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {health?.status === 'ok' ? (
                    <CheckCircleFilled style={{ color: '#52c41a', fontSize: 16 }} />
                  ) : (
                    <ExclamationCircleFilled style={{ color: health ? '#ff4d4f' : '#d9d9d9', fontSize: 16 }} />
                  )}
                  <Text style={{ fontSize: 13 }}>
                    {health ? `服务: ${health.service}` : '正在连接服务…'}
                  </Text>
                </div>

                {taskStats && (
                  <>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, color: '#8c8c8c' }}>任务队列</Text>
                        <Text style={{ fontSize: 12 }}>{taskStats.queued + taskStats.running} / {taskStats.total}</Text>
                      </div>
                      <Progress
                        percent={taskStats.total > 0 ? Math.round(((taskStats.queued + taskStats.running) / taskStats.total) * 100) : 0}
                        strokeColor="#1677ff"
                        size="small"
                        showInfo={false}
                      />
                    </div>

                    <Row gutter={8}>
                      <Col span={8}>
                        <div style={{ textAlign: 'center', padding: '8px 4px', background: '#f6ffed', borderRadius: 8 }}>
                          <div style={{ fontSize: 18, fontWeight: 600, color: '#52c41a' }}>{taskStats.done}</div>
                          <div style={{ fontSize: 11, color: '#8c8c8c' }}>已完成</div>
                        </div>
                      </Col>
                      <Col span={8}>
                        <div style={{ textAlign: 'center', padding: '8px 4px', background: '#fff7e6', borderRadius: 8 }}>
                          <div style={{ fontSize: 18, fontWeight: 600, color: '#fa8c16' }}>{taskStats.running}</div>
                          <div style={{ fontSize: 11, color: '#8c8c8c' }}>运行中</div>
                        </div>
                      </Col>
                      <Col span={8}>
                        <div style={{ textAlign: 'center', padding: '8px 4px', background: '#fff2f0', borderRadius: 8 }}>
                          <div style={{ fontSize: 18, fontWeight: 600, color: '#ff4d4f' }}>{taskStats.failed}</div>
                          <div style={{ fontSize: 11, color: '#8c8c8c' }}>失败</div>
                        </div>
                      </Col>
                    </Row>
                  </>
                )}
              </Space>
            </Card>

            {/* 快速入口卡片 */}
            <Card title="快速入口" bordered={false} style={{ borderRadius: 12 }}>
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
          </Space>
        </Col>
      </Row>
    </ConsoleLayout>
  );
}
