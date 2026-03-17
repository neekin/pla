module.exports = {
  key: 'sample.external-metrics',
  name: '示例外部插件',
  description: '演示 plugins 目录动态加载（记录任务生命周期日志）',
  version: '0.1.0',
  onTaskDispatched(context) {
    console.log('[sample.external-metrics] dispatched', context.taskId, context.taskType);
  },
  onTaskCompleted(context) {
    console.log('[sample.external-metrics] completed', context.taskId, context.taskType);
  },
};
