import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import {
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
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { Rule } from 'antd/es/form';
import { useMemo, useState } from 'react';

const { Title, Text } = Typography;

export interface CrudSearchField<T extends object> {
  key: string;
  label: string;
  type?: 'input' | 'select';
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  getValue: (record: T) => string | number | boolean | null | undefined;
}

export interface CrudFormField {
  key: string;
  label: string;
  type?: 'input' | 'textarea' | 'select' | 'switch';
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  rules?: Rule[];
  multiple?: boolean;
  width?: number;
  textareaRows?: number;
}

export interface CrudFormSchema {
  title: string;
  okText?: string;
  width?: number;
  initialValues?: Record<string, unknown>;
  fields: CrudFormField[];
}

interface CrudPageProps<T extends object> {
  title: string;
  description?: string;
  loading?: boolean;
  dataSource: T[];
  rowKey: string | ((record: T) => string);
  columns: ColumnsType<T>;
  searchFields?: Array<CrudSearchField<T>>;
  onRefresh?: () => void;
  onCreate?: () => void;
  onEdit?: (record: T) => void;
  onDelete?: (record: T) => void | Promise<void>;
  createFormSchema?: CrudFormSchema;
  onCreateSubmit?: (values: Record<string, unknown>) => void | Promise<void>;
  editFormSchema?: CrudFormSchema;
  getEditFormInitialValues?: (record: T) => Record<string, unknown>;
  onEditSubmit?: (record: T, values: Record<string, unknown>) => void | Promise<void>;
  onFormSubmitError?: (error: unknown, mode: 'create' | 'edit') => void;
  createButtonDisabled?: boolean;
  createButtonText?: string;
  pageSizeOptions?: number[];
}

export function CrudPage<T extends object>({
  title,
  description,
  loading = false,
  dataSource,
  rowKey,
  columns,
  searchFields = [],
  onRefresh,
  onCreate,
  onEdit,
  onDelete,
  createFormSchema,
  onCreateSubmit,
  editFormSchema,
  getEditFormInitialValues,
  onEditSubmit,
  onFormSubmitError,
  createButtonDisabled = false,
  createButtonText = '新建',
  pageSizeOptions = [10, 20, 50],
}: CrudPageProps<T>) {
  const [searchValues, setSearchValues] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<T | null>(null);
  const [submittingMode, setSubmittingMode] = useState<'create' | 'edit' | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: pageSizeOptions[0] ?? 10,
    showSizeChanger: true,
    pageSizeOptions: pageSizeOptions.map(String),
  });

  const filteredData = useMemo(() => {
    if (!searchFields.length) {
      return dataSource;
    }

    return dataSource.filter((record) =>
      searchFields.every((field) => {
        const rawKeyword = (searchValues[field.key] ?? '').trim();

        if (!rawKeyword) {
          return true;
        }

        const value = field.getValue(record);

        if (value === undefined || value === null) {
          return false;
        }

        const normalizedValue = String(value).toLowerCase();
        const normalizedKeyword = rawKeyword.toLowerCase();

        if (field.type === 'select') {
          return normalizedValue === normalizedKeyword;
        }

        return normalizedValue.includes(normalizedKeyword);
      }),
    );
  }, [dataSource, searchFields, searchValues]);

  const mergedColumns = useMemo(() => {
    const editable = Boolean(onEdit || editFormSchema);

    if (!editable && !onDelete) {
      return columns;
    }

    const actionColumn: ColumnsType<T>[number] = {
      title: '操作',
      key: '__actions',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {editable ? (
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                if (editFormSchema && onEditSubmit) {
                  const initialValues = {
                    ...(editFormSchema.initialValues ?? {}),
                    ...(getEditFormInitialValues?.(record) ?? {}),
                  };
                  setEditingRecord(record);
                  editForm.setFieldsValue(initialValues);
                  return;
                }

                onEdit?.(record);
              }}
            >
              编辑
            </Button>
          ) : null}
          {onDelete ? (
            <Popconfirm
              title="确认删除该记录？"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => onDelete(record)}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    };

    return [...columns, actionColumn];
  }, [
    columns,
    editForm,
    editFormSchema,
    getEditFormInitialValues,
    onDelete,
    onEdit,
    onEditSubmit,
  ]);

  const renderFormField = (field: CrudFormField) => {
    const width = field.width ?? 320;

    if (field.type === 'select') {
      return (
        <Select
          allowClear
          mode={field.multiple ? 'multiple' : undefined}
          style={{ width: '100%' }}
          placeholder={field.placeholder ?? `请选择${field.label}`}
          options={field.options ?? []}
        />
      );
    }

    if (field.type === 'textarea') {
      return (
        <Input.TextArea
          rows={field.textareaRows ?? 4}
          style={{ width: '100%' }}
          placeholder={field.placeholder ?? `请输入${field.label}`}
        />
      );
    }

    if (field.type === 'switch') {
      return <Switch />;
    }

    return (
      <Input
        style={{ width }}
        placeholder={field.placeholder ?? `请输入${field.label}`}
      />
    );
  };

  const handleCreateSubmit = async () => {
    if (!createFormSchema || !onCreateSubmit) {
      return;
    }

    try {
      const values = await createForm.validateFields();
      setSubmittingMode('create');
      await onCreateSubmit(values as Record<string, unknown>);
      setCreateOpen(false);
      createForm.resetFields();
    } catch (error) {
      onFormSubmitError?.(error, 'create');
    } finally {
      setSubmittingMode(null);
    }
  };

  const handleEditSubmit = async () => {
    if (!editingRecord || !editFormSchema || !onEditSubmit) {
      return;
    }

    try {
      const values = await editForm.validateFields();
      setSubmittingMode('edit');
      await onEditSubmit(editingRecord, values as Record<string, unknown>);
      setEditingRecord(null);
      editForm.resetFields();
    } catch (error) {
      onFormSubmitError?.(error, 'edit');
    } finally {
      setSubmittingMode(null);
    }
  };

  return (
    <>
      <Card
        bordered={false}
        style={{ marginBottom: 16 }}
        styles={{ body: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }}
      >
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {title}
          </Title>
          {description ? <Text type="secondary">{description}</Text> : null}
        </div>

        <Space>
          {onRefresh ? (
            <Button icon={<ReloadOutlined />} onClick={onRefresh}>
              刷新
            </Button>
          ) : null}
          {onCreate || (createFormSchema && onCreateSubmit) ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={createButtonDisabled}
              onClick={() => {
                if (createFormSchema && onCreateSubmit) {
                  createForm.resetFields();
                  createForm.setFieldsValue(createFormSchema.initialValues ?? {});
                  setCreateOpen(true);
                  return;
                }

                onCreate?.();
              }}
            >
              {createButtonText}
            </Button>
          ) : null}
        </Space>
      </Card>

      <Card bordered={false}>
        {searchFields.length ? (
          <Space wrap style={{ marginBottom: 16 }}>
            {searchFields.map((field) => {
              const value = searchValues[field.key] ?? '';

              if (field.type === 'select') {
                return (
                  <Space key={field.key} size={6}>
                    <Text type="secondary">{field.label}</Text>
                    <Select
                      allowClear
                      style={{ width: 180 }}
                      placeholder={field.placeholder ?? `请选择${field.label}`}
                      value={value || undefined}
                      options={field.options ?? []}
                      onChange={(next) => {
                        setSearchValues((prev) => ({
                          ...prev,
                          [field.key]: next ?? '',
                        }));
                        setPagination((prev) => ({ ...prev, current: 1 }));
                      }}
                    />
                  </Space>
                );
              }

              return (
                <Space key={field.key} size={6}>
                  <Text type="secondary">{field.label}</Text>
                  <Input
                    allowClear
                    style={{ width: 220 }}
                    placeholder={field.placeholder ?? `请输入${field.label}`}
                    value={value}
                    onChange={(event) => {
                      setSearchValues((prev) => ({
                        ...prev,
                        [field.key]: event.target.value,
                      }));
                      setPagination((prev) => ({ ...prev, current: 1 }));
                    }}
                  />
                </Space>
              );
            })}
          </Space>
        ) : null}

        <Table<T>
          rowKey={rowKey}
          loading={loading}
          columns={mergedColumns}
          dataSource={filteredData}
          pagination={{
            ...pagination,
            total: filteredData.length,
            showTotal: (total) => `共 ${total} 条`,
          }}
          onChange={(nextPagination) => {
            setPagination(nextPagination);
          }}
          scroll={{ x: 960 }}
        />
      </Card>

      {createFormSchema && onCreateSubmit ? (
        <Modal
          title={createFormSchema.title}
          open={createOpen}
          onCancel={() => setCreateOpen(false)}
          onOk={() => void handleCreateSubmit()}
          confirmLoading={submittingMode === 'create'}
          okText={createFormSchema.okText ?? '保存'}
          destroyOnHidden
          width={createFormSchema.width}
        >
          <Form form={createForm} layout="vertical" preserve={false}>
            {createFormSchema.fields.map((field) => (
              <Form.Item
                key={field.key}
                label={field.label}
                name={field.key}
                rules={field.rules}
                valuePropName={field.type === 'switch' ? 'checked' : 'value'}
              >
                {renderFormField(field)}
              </Form.Item>
            ))}
          </Form>
        </Modal>
      ) : null}

      {editFormSchema && onEditSubmit ? (
        <Modal
          title={editFormSchema.title}
          open={Boolean(editingRecord)}
          onCancel={() => setEditingRecord(null)}
          onOk={() => void handleEditSubmit()}
          confirmLoading={submittingMode === 'edit'}
          okText={editFormSchema.okText ?? '保存'}
          destroyOnHidden
          width={editFormSchema.width}
        >
          <Form form={editForm} layout="vertical" preserve={false}>
            {editFormSchema.fields.map((field) => (
              <Form.Item
                key={field.key}
                label={field.label}
                name={field.key}
                rules={field.rules}
                valuePropName={field.type === 'switch' ? 'checked' : 'value'}
              >
                {renderFormField(field)}
              </Form.Item>
            ))}
          </Form>
        </Modal>
      ) : null}
    </>
  );
}
