import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const { moduleName, options } = parseArgs(args);

if (!moduleName) {
  printUsage();
  process.exit(1);
}

const normalizedModuleName = normalizeModuleName(moduleName);
const pascal = toPascalCase(normalizedModuleName);
const camelName = toCamelCase(pascal);
const singularName = toSingularName(normalizedModuleName);

const serverRoot = resolve(process.cwd());
const serverSrcRoot = resolve(serverRoot, 'src');
const clientRoot = resolve(serverRoot, '..', 'client');
const clientSrcRoot = resolve(clientRoot, 'src');

const backendEnabled = !options.skipBackend;
const frontendEnabled = options.fullstack && !options.skipFrontend;

const apiPath = normalizePathSegment(options.apiPath ?? normalizedModuleName);
const permission = options.permission ?? `${normalizedModuleName}:manage`;
const routePath = normalizeRoutePath(options.routePath ?? `/admin/${normalizedModuleName}`);
const pageTitle = options.pageTitle ?? `${pascal}管理`;
const pageDescription = options.pageDescription ?? `${pascal} CRUD（脚手架生成）`;
const menuLabel = options.menuLabel ?? pageTitle;

if (!existsSync(serverSrcRoot)) {
  console.error(`❌ Invalid server workspace: missing ${serverSrcRoot}`);
  process.exit(1);
}

if (frontendEnabled && !existsSync(clientSrcRoot)) {
  console.error(`❌ Frontend workspace not found: ${clientSrcRoot}`);
  process.exit(1);
}

if (backendEnabled) {
  generateBackend({
    normalizedModuleName,
    pascal,
    camelName,
    singularName,
    apiPath,
    permission,
    serverSrcRoot,
    useCrud: options.crud,
  });
}

if (frontendEnabled) {
  generateFrontend({
    normalizedModuleName,
    pascal,
    singularName,
    routePath,
    permission,
    pageTitle,
    pageDescription,
    menuLabel,
    apiPath,
    clientSrcRoot,
  });
}

console.log(`✅ Module generated: ${normalizedModuleName}`);
console.log('Summary:');
console.log(`- Backend: ${backendEnabled ? 'generated' : 'skipped'}`);
console.log(`- Frontend: ${frontendEnabled ? 'generated' : 'skipped'}`);
console.log(`- CRUD mode: ${options.crud ? 'enabled' : 'disabled'}`);
console.log(`- Permission: ${permission}`);
console.log(`- API path: /${apiPath}`);
if (frontendEnabled) {
  console.log(`- Route path: ${routePath}`);
}

function generateBackend({
  normalizedModuleName,
  pascal,
  camelName,
  singularName,
  apiPath,
  permission,
  serverSrcRoot,
  useCrud,
}) {
  const baseDir = resolve(serverSrcRoot, normalizedModuleName);
  if (existsSync(baseDir)) {
    console.error(`❌ Module already exists: ${baseDir}`);
    process.exit(1);
  }

  mkdirSync(baseDir, { recursive: true });
  const dtoDir = join(baseDir, 'dto');
  if (useCrud) {
    mkdirSync(dtoDir, { recursive: true });
  }

  const serviceFile = join(baseDir, `${normalizedModuleName}.service.ts`);
  const controllerFile = join(baseDir, `${normalizedModuleName}.controller.ts`);
  const moduleFile = join(baseDir, `${normalizedModuleName}.module.ts`);

  const serviceClass = `${pascal}Service`;
  const controllerClass = `${pascal}Controller`;
  const moduleClass = `${pascal}Module`;
  const entityType = `${pascal}Item`;

  if (useCrud) {
    const createDtoClass = `Create${pascal}Dto`;
    const updateDtoClass = `Update${pascal}Dto`;

    writeFileSync(
      join(dtoDir, `create-${normalizedModuleName}.dto.ts`),
      `import { IsString, MaxLength } from 'class-validator';\n\nexport class ${createDtoClass} {\n  @IsString()\n  @MaxLength(120)\n  name: string;\n}\n`,
    );

    writeFileSync(
      join(dtoDir, `update-${normalizedModuleName}.dto.ts`),
      `import { IsOptional, IsString, MaxLength } from 'class-validator';\n\nexport class ${updateDtoClass} {\n  @IsOptional()\n  @IsString()\n  @MaxLength(120)\n  name?: string;\n}\n`,
    );

    writeFileSync(
      serviceFile,
      `import { Injectable, NotFoundException } from '@nestjs/common';\nimport { randomUUID } from 'node:crypto';\nimport { Create${pascal}Dto } from './dto/create-${normalizedModuleName}.dto';\nimport { Update${pascal}Dto } from './dto/update-${normalizedModuleName}.dto';\n\nexport interface ${entityType} {\n  id: string;\n  name: string;\n  createdAt: string;\n  updatedAt: string;\n}\n\n@Injectable()\nexport class ${serviceClass} {\n  private readonly ${camelName}Store = new Map<string, ${entityType}>();\n\n  list(): ${entityType}[] {\n    return Array.from(this.${camelName}Store.values());\n  }\n\n  detail(id: string): ${entityType} {\n    const item = this.${camelName}Store.get(id);\n\n    if (!item) {\n      throw new NotFoundException('${pascal} not found');\n    }\n\n    return item;\n  }\n\n  create(dto: Create${pascal}Dto): ${entityType} {\n    const now = new Date().toISOString();\n    const item: ${entityType} = {\n      id: randomUUID(),\n      name: dto.name,\n      createdAt: now,\n      updatedAt: now,\n    };\n\n    this.${camelName}Store.set(item.id, item);\n    return item;\n  }\n\n  update(id: string, dto: Update${pascal}Dto): ${entityType} {\n    const current = this.detail(id);\n    const next: ${entityType} = {\n      ...current,\n      ...(dto.name !== undefined ? { name: dto.name } : {}),\n      updatedAt: new Date().toISOString(),\n    };\n\n    this.${camelName}Store.set(id, next);\n    return next;\n  }\n\n  remove(id: string): { id: string; deleted: boolean } {\n    this.detail(id);\n    this.${camelName}Store.delete(id);\n    return { id, deleted: true };\n  }\n}\n`,
    );

    writeFileSync(
      controllerFile,
      `import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';\nimport { Permissions } from '../common/decorators/permissions.decorator';\nimport { Create${pascal}Dto } from './dto/create-${normalizedModuleName}.dto';\nimport { Update${pascal}Dto } from './dto/update-${normalizedModuleName}.dto';\nimport { ${serviceClass} } from './${normalizedModuleName}.service';\n\n@Controller('${apiPath}')\n@Permissions('${permission}')\nexport class ${controllerClass} {\n  constructor(private readonly ${camelName}Service: ${serviceClass}) {}\n\n  @Get()\n  list() {\n    return this.${camelName}Service.list();\n  }\n\n  @Get(':id')\n  detail(@Param('id') id: string) {\n    return this.${camelName}Service.detail(id);\n  }\n\n  @Post()\n  create(@Body() dto: Create${pascal}Dto) {\n    return this.${camelName}Service.create(dto);\n  }\n\n  @Patch(':id')\n  update(@Param('id') id: string, @Body() dto: Update${pascal}Dto) {\n    return this.${camelName}Service.update(id, dto);\n  }\n\n  @Delete(':id')\n  remove(@Param('id') id: string) {\n    return this.${camelName}Service.remove(id);\n  }\n}\n`,
    );
  } else {
    writeFileSync(
      serviceFile,
      `import { Injectable } from '@nestjs/common';\n\n@Injectable()\nexport class ${serviceClass} {\n  health() {\n    return { module: '${normalizedModuleName}', status: 'ok' };\n  }\n}\n`,
    );

    writeFileSync(
      controllerFile,
      `import { Controller, Get } from '@nestjs/common';\nimport { ${serviceClass} } from './${normalizedModuleName}.service';\n\n@Controller('${apiPath}')\nexport class ${controllerClass} {\n  constructor(private readonly ${camelName}Service: ${serviceClass}) {}\n\n  @Get('health')\n  health() {\n    return this.${camelName}Service.health();\n  }\n}\n`,
    );
  }

  writeFileSync(
    moduleFile,
    `import { Module } from '@nestjs/common';\nimport { ${controllerClass} } from './${normalizedModuleName}.controller';\nimport { ${serviceClass} } from './${normalizedModuleName}.service';\n\n@Module({\n  controllers: [${controllerClass}],\n  providers: [${serviceClass}],\n  exports: [${serviceClass}],\n})\nexport class ${moduleClass} {}\n`,
  );

  const appModulePath = resolve(serverSrcRoot, 'app.module.ts');
  const mainTsPath = resolve(serverSrcRoot, 'main.ts');

  patchAppModule(appModulePath, {
    normalizedModuleName,
    moduleClass,
    apiPath,
  });
  patchMainTs(mainTsPath, apiPath);

  console.log(`- Backend files: src/${normalizedModuleName}`);
}

function generateFrontend({
  normalizedModuleName,
  pascal,
  singularName,
  routePath,
  permission,
  pageTitle,
  pageDescription,
  menuLabel,
  apiPath,
  clientSrcRoot,
}) {
  const pageComponentName = `Admin${pascal}`;
  const pageFilePath = resolve(clientSrcRoot, 'pages', `${pageComponentName}.tsx`);

  if (existsSync(pageFilePath)) {
    console.error(`❌ Page already exists: ${pageFilePath}`);
    process.exit(1);
  }

  const listFn = `list${pascal}Request`;
  const createFn = `create${pascal}Request`;
  const updateFn = `update${pascal}Request`;
  const deleteFn = `delete${pascal}Request`;
  const itemType = `${pascal}Item`;
  const createPayloadType = `Create${pascal}Payload`;
  const updatePayloadType = `Update${pascal}Payload`;

  writeFileSync(
    pageFilePath,
    `import { message } from 'antd';\nimport type { ColumnsType } from 'antd/es/table';\nimport { useEffect, useMemo, useState } from 'react';\nimport { useNavigate } from 'react-router-dom';\nimport {\n  CrudPage,\n  type CrudFormSchema,\n  type CrudSearchField,\n} from '../components/crud/CrudPage';\nimport {\n  ${createFn},\n  ${deleteFn},\n  ${listFn},\n  ${updateFn},\n  type ${createPayloadType},\n  type ${itemType},\n  type ${updatePayloadType},\n} from '../lib/api';\nimport ConsoleLayout from '../components/ConsoleLayout';\n\nexport default function ${pageComponentName}() {\n  const navigate = useNavigate();\n  const [messageApi, contextHolder] = message.useMessage();\n  const [loading, setLoading] = useState(false);\n  const [records, setRecords] = useState<${itemType}[]>([]);\n\n  const loadData = async () => {\n    setLoading(true);\n    try {\n      const result = await ${listFn}();\n      setRecords(result);\n    } catch {\n      messageApi.error('数据加载失败，请重新登录后重试');\n      navigate('/login', { replace: true });\n    } finally {\n      setLoading(false);\n    }\n  };\n\n  useEffect(() => {\n    void loadData();\n  }, []);\n\n  const columns: ColumnsType<${itemType}> = useMemo(\n    () => [\n      {\n        title: 'ID',\n        dataIndex: 'id',\n        key: 'id',\n        width: 260,\n      },\n      {\n        title: '名称',\n        dataIndex: 'name',\n        key: 'name',\n        sorter: (l, r) => l.name.localeCompare(r.name),\n      },\n      {\n        title: '创建时间',\n        dataIndex: 'createdAt',\n        key: 'createdAt',\n        width: 200,\n      },\n      {\n        title: '更新时间',\n        dataIndex: 'updatedAt',\n        key: 'updatedAt',\n        width: 200,\n      },\n    ],\n    [],\n  );\n\n  const searchFields: CrudSearchField<${itemType}>[] = useMemo(\n    () => [\n      {\n        key: 'id',\n        label: 'ID',\n        placeholder: '按ID搜索',\n        getValue: (record) => record.id,\n      },\n      {\n        key: 'name',\n        label: '名称',\n        placeholder: '按名称搜索',\n        getValue: (record) => record.name,\n      },\n    ],\n    [],\n  );\n\n  const createFormSchema: CrudFormSchema = {\n    title: '新建${pageTitle}',\n    okText: '创建',\n    fields: [\n      {\n        key: 'name',\n        label: '名称',\n        type: 'input',\n        rules: [{ required: true, message: '请输入名称' }],\n      },\n    ],\n  };\n\n  const editFormSchema: CrudFormSchema = {\n    title: '编辑${pageTitle}',\n    okText: '保存',\n    fields: [\n      {\n        key: 'name',\n        label: '名称',\n        type: 'input',\n        rules: [{ required: true, message: '请输入名称' }],\n      },\n    ],\n  };\n\n  const onCreateSubmit = async (values: Record<string, unknown>) => {\n    try {\n      await ${createFn}({ name: String(values.name ?? '') } satisfies ${createPayloadType});\n      messageApi.success('创建成功');\n      await loadData();\n    } catch {\n      messageApi.error('创建失败');\n    }\n  };\n\n  const onEditSubmit = async (record: ${itemType}, values: Record<string, unknown>) => {\n    try {\n      await ${updateFn}(record.id, { name: String(values.name ?? '') } satisfies ${updatePayloadType});\n      messageApi.success('更新成功');\n      await loadData();\n    } catch {\n      messageApi.error('更新失败');\n    }\n  };\n\n  const onDelete = async (record: ${itemType}) => {\n    try {\n      await ${deleteFn}(record.id);\n      messageApi.success('删除成功');\n      await loadData();\n    } catch {\n      messageApi.error('删除失败');\n    }\n  };\n\n  return (\n    <ConsoleLayout breadcrumbItems={[{ title: '首页' }, { title: '平台管理' }, { title: '${menuLabel}' }]}>\n      {contextHolder}\n      <CrudPage<${itemType}>\n        title="${pageTitle}"\n        description="${pageDescription}"\n        loading={loading}\n        rowKey="id"\n        columns={columns}\n        dataSource={records}\n        searchFields={searchFields}\n        onRefresh={() => void loadData()}\n        createFormSchema={createFormSchema}\n        onCreateSubmit={onCreateSubmit}\n        editFormSchema={editFormSchema}\n        getEditFormInitialValues={(record) => ({\n          name: record.name,\n        })}\n        onEditSubmit={onEditSubmit}\n        onDelete={onDelete}\n      />\n    </ConsoleLayout>\n  );\n}\n`,
  );

  const routesPath = resolve(clientSrcRoot, 'router', 'routes.tsx');
  const menuPath = resolve(clientSrcRoot, 'components', 'console', 'console-menu.tsx');
  const apiPathFile = resolve(clientSrcRoot, 'lib', 'api.ts');

  patchClientRoutes(routesPath, {
    pageComponentName,
    routePath,
    permission,
  });

  patchClientMenu(menuPath, {
    routePath,
    permission,
    menuLabel,
  });

  patchClientApi(apiPathFile, {
    pascal,
    singularName,
    apiPath,
    listFn,
    createFn,
    updateFn,
    deleteFn,
    itemType,
  });

  console.log(`- Frontend page: src/pages/${pageComponentName}.tsx`);
}

function patchAppModule(filePath, { normalizedModuleName, moduleClass, apiPath }) {
  let content = readFileSync(filePath, 'utf8');
  const moduleImport = `import { ${moduleClass} } from './${normalizedModuleName}/${normalizedModuleName}.module';`;

  if (!content.includes(moduleImport)) {
    const anchor = "import { BillingModule } from './billing/billing.module';\n";
    if (!content.includes(anchor)) {
      throw new Error('Unable to patch app.module.ts import section');
    }

    content = content.replace(anchor, `${anchor}${moduleImport}\n`);
  }

  if (!content.includes(`${moduleClass},`)) {
    const importsAnchor = '    BillingModule,\n  ],';
    if (!content.includes(importsAnchor)) {
      throw new Error('Unable to patch app.module.ts @Module imports');
    }

    content = content.replace(importsAnchor, `    BillingModule,\n    ${moduleClass},\n  ],`);
  }

  const excludePathA = `        '/${apiPath}',`;
  const excludePathB = `        '/${apiPath}/*path',`;
  if (!content.includes(excludePathA) || !content.includes(excludePathB)) {
    const excludeAnchor = "        '/billing/*path',\n";
    if (!content.includes(excludeAnchor)) {
      throw new Error('Unable to patch app.module.ts static exclude list');
    }

    content = content.replace(
      excludeAnchor,
      `${excludeAnchor}        '${`/${apiPath}`}',\n        '${`/${apiPath}/*path`}',\n`,
    );
  }

  writeFileSync(filePath, content);
}

function patchMainTs(filePath, apiPath) {
  let content = readFileSync(filePath, 'utf8');
  const backendPrefix = `            '/${apiPath}',`;

  if (content.includes(backendPrefix)) {
    return;
  }

  const anchor = "            '/billing',\n";
  if (!content.includes(anchor)) {
    throw new Error('Unable to patch main.ts backendPrefixes');
  }

  content = content.replace(anchor, `${anchor}            '/${apiPath}',\n`);
  writeFileSync(filePath, content);
}

function patchClientRoutes(filePath, { pageComponentName, routePath, permission }) {
  let content = readFileSync(filePath, 'utf8');
  const importLine = `const ${pageComponentName} = lazy(() => import('../pages/${pageComponentName}'));`;

  if (!content.includes(importLine)) {
    const importAnchor = "const AdminSecurity = lazy(() => import('../pages/AdminSecurity'));\n";
    if (!content.includes(importAnchor)) {
      throw new Error('Unable to patch routes.tsx imports');
    }

    content = content.replace(importAnchor, `${importAnchor}${importLine}\n`);
  }

  const routeSnippet = `  {\n    path: '${routePath}',\n    element: <${pageComponentName} />,\n    requiresAuth: true,\n    requiredPermissions: ['${permission}'],\n  },\n`;

  if (!content.includes(`path: '${routePath}'`)) {
    const routeAnchor = "  {\n    path: '/403',\n";
    if (!content.includes(routeAnchor)) {
      throw new Error('Unable to patch routes.tsx route list');
    }

    content = content.replace(routeAnchor, `${routeSnippet}${routeAnchor}`);
  }

  writeFileSync(filePath, content);
}

function patchClientMenu(filePath, { routePath, permission, menuLabel }) {
  let content = readFileSync(filePath, 'utf8');

  if (content.includes(`key: '${routePath}'`)) {
    return;
  }

  const insertSnippet = `    if (hasPermission(['${permission}'])) {\n      children.push({\n        key: '${routePath}',\n        label: '${menuLabel}',\n        onClick: () => navigate('${routePath}'),\n      });\n    }\n\n`;

  const anchor = "    if (hasPermission(['config:write'])) {\n";
  if (!content.includes(anchor)) {
    throw new Error('Unable to patch console-menu.tsx admin section');
  }

  content = content.replace(anchor, `${insertSnippet}${anchor}`);
  writeFileSync(filePath, content);
}

function patchClientApi(filePath, {
  pascal,
  singularName,
  apiPath,
  listFn,
  createFn,
  updateFn,
  deleteFn,
  itemType,
}) {
  let content = readFileSync(filePath, 'utf8');

  if (content.includes(`export interface ${itemType}`)) {
    return;
  }

  const apiSnippet = `\n\nexport interface ${itemType} {\n  id: string;\n  name: string;\n  createdAt: string;\n  updatedAt: string;\n}\n\nexport interface Create${pascal}Payload {\n  name: string;\n}\n\nexport interface Update${pascal}Payload {\n  name?: string;\n}\n\nexport async function ${listFn}(): Promise<${itemType}[]> {\n  const response = await fetch(buildUrl('/${apiPath}'), {\n    method: 'GET',\n    headers: {\n      Authorization: requireAuthHeader(),\n    },\n  });\n\n  if (!response.ok) {\n    throw new Error('${toConstErrorCode(singularName)}_LIST_FAILED');\n  }\n\n  return response.json() as Promise<${itemType}[]>;\n}\n\nexport async function ${createFn}(\n  payload: Create${pascal}Payload,\n): Promise<${itemType}> {\n  const response = await fetch(buildUrl('/${apiPath}'), {\n    method: 'POST',\n    headers: {\n      Authorization: requireAuthHeader(),\n      'Content-Type': 'application/json',\n    },\n    body: JSON.stringify(payload),\n  });\n\n  if (!response.ok) {\n    throw new Error('${toConstErrorCode(singularName)}_CREATE_FAILED');\n  }\n\n  return response.json() as Promise<${itemType}>;\n}\n\nexport async function ${updateFn}(\n  id: string,\n  payload: Update${pascal}Payload,\n): Promise<${itemType}> {\n  const response = await fetch(buildUrl('/${apiPath}/${'${encodeURIComponent(id)}'}'), {\n    method: 'PATCH',\n    headers: {\n      Authorization: requireAuthHeader(),\n      'Content-Type': 'application/json',\n    },\n    body: JSON.stringify(payload),\n  });\n\n  if (!response.ok) {\n    throw new Error('${toConstErrorCode(singularName)}_UPDATE_FAILED');\n  }\n\n  return response.json() as Promise<${itemType}>;\n}\n\nexport async function ${deleteFn}(\n  id: string,\n): Promise<{ id: string; deleted: boolean }> {\n  const response = await fetch(buildUrl('/${apiPath}/${'${encodeURIComponent(id)}'}'), {\n    method: 'DELETE',\n    headers: {\n      Authorization: requireAuthHeader(),\n    },\n  });\n\n  if (!response.ok) {\n    throw new Error('${toConstErrorCode(singularName)}_DELETE_FAILED');\n  }\n\n  return response.json() as Promise<{ id: string; deleted: boolean }>;\n}`;

  content += apiSnippet;
  writeFileSync(filePath, content);
}

function parseArgs(argv) {
  const options = {
    crud: false,
    fullstack: false,
    skipBackend: false,
    skipFrontend: false,
    permission: null,
    routePath: null,
    apiPath: null,
    pageTitle: null,
    pageDescription: null,
    menuLabel: null,
  };

  let moduleName = null;

  for (const arg of argv) {
    if (!arg.startsWith('--') && !moduleName) {
      moduleName = arg;
      continue;
    }

    if (arg === '--crud') {
      options.crud = true;
      continue;
    }

    if (arg === '--fullstack') {
      options.fullstack = true;
      options.crud = true;
      continue;
    }

    if (arg === '--skip-backend') {
      options.skipBackend = true;
      continue;
    }

    if (arg === '--skip-frontend') {
      options.skipFrontend = true;
      continue;
    }

    if (arg.startsWith('--permission=')) {
      options.permission = arg.slice('--permission='.length).trim();
      continue;
    }

    if (arg.startsWith('--route=')) {
      options.routePath = arg.slice('--route='.length).trim();
      continue;
    }

    if (arg.startsWith('--api-path=')) {
      options.apiPath = arg.slice('--api-path='.length).trim();
      continue;
    }

    if (arg.startsWith('--page-title=')) {
      options.pageTitle = arg.slice('--page-title='.length).trim();
      continue;
    }

    if (arg.startsWith('--page-description=')) {
      options.pageDescription = arg.slice('--page-description='.length).trim();
      continue;
    }

    if (arg.startsWith('--menu-label=')) {
      options.menuLabel = arg.slice('--menu-label='.length).trim();
    }
  }

  return { moduleName, options };
}

function printUsage() {
  console.error(
    'Usage:\n' +
      '  pnpm --filter server run gen:module -- <module-name> [--crud]\n' +
      '  pnpm --filter server run gen:module -- <module-name> --fullstack [--permission=resource:manage] [--api-path=resources] [--route=/admin/resources] [--page-title=资源管理] [--page-description=资源管理页] [--menu-label=资源管理]\n',
  );
}

function normalizeModuleName(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizePathSegment(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/[^a-z0-9/-]/g, '-')
    .replace(/\/+/g, '/');
}

function normalizeRoutePath(value) {
  const path = value.trim().replace(/\s+/g, '');
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path;
}

function toPascalCase(value) {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function toCamelCase(value) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function toSingularName(value) {
  if (value.endsWith('ies')) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.endsWith('s') && value.length > 1) {
    return value.slice(0, -1);
  }

  return value;
}

function toConstErrorCode(value) {
  return value
    .replace(/[^a-z0-9]+/gi, '_')
    .toUpperCase();
}
