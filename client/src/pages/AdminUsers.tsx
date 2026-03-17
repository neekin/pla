import {
  Space,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CrudPage,
  type CrudFormSchema,
  type CrudSearchField,
} from '../components/crud/CrudPage';
import {
  listIamUsersRequest,
  listPermissionCatalogRequest,
  updateUserAccessRequest,
  type IamUserItem,
} from '../lib/api';
import ConsoleLayout from '../components/ConsoleLayout';

export default function AdminUsers() {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<IamUserItem[]>([]);
  const [permissionCatalog, setPermissionCatalog] = useState<string[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [userList, permissionList] = await Promise.all([
        listIamUsersRequest(),
        listPermissionCatalogRequest(),
      ]);
      setUsers(userList);
      setPermissionCatalog(permissionList);
    } catch {
      messageApi.error('获取 IAM 数据失败，请重新登录后重试');
      navigate('/login', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const roleOptions = [
    { label: '管理员', value: 'admin' },
    { label: '运营', value: 'operator' },
    { label: '只读', value: 'viewer' },
  ];

  const permissionOptions = useMemo(
    () => permissionCatalog.map((permission) => ({ label: permission, value: permission })),
    [permissionCatalog],
  );

  const columns: ColumnsType<IamUserItem> = [
    {
      title: '用户ID',
      dataIndex: 'id',
      key: 'id',
      width: 200,
      sorter: (l, r) => l.id.localeCompare(r.id),
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 180,
      sorter: (l, r) => l.username.localeCompare(r.username),
    },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: string[]) => (
        <Space wrap>
          {roles.map((role) => (
            <Tag key={role} color="blue">
              {role}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '权限',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions: string[]) => (
        <Space wrap>
          {permissions.map((permission) => (
            <Tag key={permission}>{permission}</Tag>
          ))}
        </Space>
      ),
    },
  ];

  const searchFields: CrudSearchField<IamUserItem>[] = [
    {
      key: 'id',
      label: '用户ID',
      placeholder: '按用户ID搜索',
      getValue: (record) => record.id,
    },
    {
      key: 'username',
      label: '用户名',
      placeholder: '按用户名搜索',
      getValue: (record) => record.username,
    },
    {
      key: 'roles',
      label: '角色',
      placeholder: '按角色搜索',
      getValue: (record) => record.roles.join(','),
    },
  ];

  const editFormSchema: CrudFormSchema = {
    title: '编辑权限',
    okText: '保存',
    fields: [
      {
        key: 'roles',
        label: '角色',
        type: 'select',
        multiple: true,
        options: roleOptions,
        rules: [{ required: true, message: '请选择角色' }],
      },
      {
        key: 'permissions',
        label: '权限',
        type: 'select',
        multiple: true,
        options: permissionOptions,
        rules: [{ required: true, message: '请选择权限' }],
      },
    ],
  };

  const handleEditSubmit = async (
    record: IamUserItem,
    values: Record<string, unknown>,
  ) => {
    try {
      await updateUserAccessRequest(record.id, {
        roles: (values.roles as string[]) ?? [],
        permissions: (values.permissions as string[]) ?? [],
      });
      messageApi.success('权限更新成功');
      await loadData();
    } catch {
      messageApi.error('权限更新失败');
    }
  };

  return (
    <ConsoleLayout breadcrumbItems={[{ title: '首页' }, { title: '平台管理' }, { title: '用户权限' }]}>
      {contextHolder}
      <CrudPage<IamUserItem>
        title="用户与权限管理"
        description="角色与权限分配（平台骨架）"
        loading={loading}
        rowKey="id"
        columns={columns}
        dataSource={users}
        searchFields={searchFields}
        onRefresh={() => void loadData()}
        editFormSchema={editFormSchema}
        getEditFormInitialValues={(record) => ({
          roles: record.roles,
          permissions: record.permissions,
        })}
        onEditSubmit={(record, values) => handleEditSubmit(record, values)}
      />
    </ConsoleLayout>
  );
}
