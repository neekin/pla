import { ConsoleLogger, LogLevel } from '@nestjs/common';

/**
 * 结构化 JSON 日志记录器，输出 JSON 格式到 stdout，
 * 便于日志聚合（ELK、Loki 等）解析。
 */
export class JsonLogger extends ConsoleLogger {
  protected formatMessage(
    logLevel: LogLevel,
    message: unknown,
    pidMessage: string,
    formattedLogLevel: string,
    contextMessage: string,
    timestampDiff: string,
  ): string {
    void pidMessage;
    void formattedLogLevel;
    void timestampDiff;
    const context = contextMessage.replace(/[\[\]]/g, '').trim();
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level: logLevel,
      context: context || undefined,
      message,
    };
    return JSON.stringify(entry) + '\n';
  }
}
