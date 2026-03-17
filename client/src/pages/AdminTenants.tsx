import { Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CrudPage, type CrudSearchField } from '../components/crud/CrudPage';
import { listTenantsRequest, type TenantItem } from '../lib/api';
import ConsoleLayout from '../components/ConsoleLayout';

export default function AdminTenants() {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<TenantItem[]>([]);

  const loadTenants = async () => {
    setLoading(true);
    try {
      const result = await listTenantsRequest();
      setTenants(result);
    } catch {
      messageApi.error('获取租户列表失败，请重新登录后重试');
      navigate('/login', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTenants();
  }, []);

  const columns: ColumnsType<TenantItem> = useMemo(
    () => [
      {
        title: '租户ID',
        dataIndex: 'id',
        key: 'id',
        width: 180,
        sorter: (l, r) => l.id.localeCompare(r.id),
      },
      {
        title: '租户名称',
        dataIndex: 'name',
        key: 'name',
        sorter: (l, r) => l.name.localeCompare(r.name),
      },
      {
        title: '版本',
        dataIndex: 'edition',
        key: 'edition',
        width: 150,
        sorter: (l, r) => l.edition.localeCompare(r.edition),
        render: (edition: TenantItem['edition']) => edition.toUpperCase(),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 140,
        sorter: (l, r) => l.status.localeCompare(r.status),
        render: (status: TenantItem['status']) =>
          status === 'active' ? <Tag color="success">启用</Tag> : <Tag color="default">停用</Tag>,
      },
    ],
    [],
  );

  const searchFields: CrudSearchField<TenantItem>[] = useMemo(
    () => [
      {
        key: 'id',
        label: '租户ID',
        type: 'input',
        placeholder: '按租户ID搜索',
        getValue: (record) => record.id,
      },
      {
        key: 'name',
        label: '租户名称',
        type: 'input',
        placeholder: '按租户名称搜索',
        getValue: (record) => record.name,
      },
      {
        key: 'edition',
        label: '版本',
        type: 'select',
        options: [
          { label: 'FREE', value: 'free' },
          { label: 'PRO', value: 'pro' },
          { label: 'ENTERPRISE', value: 'enterprise' },
        ],
        getValue: (record) => record.edition,
      },
      {
        key: 'status',
        label: '状态',
        type: 'select',
        options: [
          { label: '启用', value: 'active' },
          { label: '停用', value: 'inactive' },
        ],
        getValue: (record) => record.status,
      },
    ],
    [],
  );

  return (
    <ConsoleLayout breadcrumbItems={[{ title: '首页' }, { title: '平台管理' }, { title: '租户管理' }]}>
      {contextHolder}
      <CrudPage<TenantItem>
        title="租户管理"
        description="多租户基础信息（平台骨架）"
        loading={loading}
        rowKey="id"
        columns={columns}
        dataSource={tenants}
        searchFields={searchFields}
        onRefresh={() => void loadTenants()}
      />
    </ConsoleLayout>
  );
}
