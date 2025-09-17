import fs from 'fs';
import path from 'path';

/**
 * 日志管理器 - 实现动态日志文件生成和实时同步保存
 */
export class LogManager {
  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.currentLogFile = null;
    this.logStream = null;
    this.originalConsoleLog = console.log;
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;
    this.isLogging = false;
    
    this.ensureLogDirectory();
  }

  /**
   * 确保日志目录存在
   */
  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * 生成带时间戳的日志文件名
   * @returns {string} 日志文件路径
   */
  generateLogFileName() {
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/:/g, '-')
      .replace(/\./g, '-')
      .replace('T', '_')
      .slice(0, 19);
    
    return path.join(this.logDir, `search-eval_${timestamp}.log`);
  }

  /**
   * 开始日志记录
   */
  startLogging() {
    if (this.isLogging) {
      return;
    }

    this.currentLogFile = this.generateLogFileName();
    this.logStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
    
    // 写入日志头部信息
    const header = `
===========================================
搜索引擎评估系统日志
开始时间: ${new Date().toISOString()}
日志文件: ${path.basename(this.currentLogFile)}
===========================================

`;
    this.logStream.write(header);
    
    // 重写console方法以实现实时同步
    this.overrideConsoleMethods();
    this.isLogging = true;
    
    console.log(`📝 日志记录已启动: ${this.currentLogFile}`);
  }

  /**
   * 停止日志记录
   */
  stopLogging() {
    if (!this.isLogging) {
      return;
    }

    // 写入日志尾部信息
    const footer = `
===========================================
日志记录结束时间: ${new Date().toISOString()}
===========================================
`;
    
    if (this.logStream) {
      this.logStream.write(footer);
      this.logStream.end();
    }
    
    // 恢复原始console方法
    this.restoreConsoleMethods();
    this.isLogging = false;
    
    console.log(`📝 日志记录已停止: ${this.currentLogFile}`);
  }

  /**
   * 重写console方法以实现实时同步
   */
  overrideConsoleMethods() {
    const self = this;
    
    console.log = function(...args) {
      const message = self.formatLogMessage('LOG', args);
      self.originalConsoleLog.apply(console, args);
      self.writeToLog(message);
    };
    
    console.error = function(...args) {
      const message = self.formatLogMessage('ERROR', args);
      self.originalConsoleError.apply(console, args);
      self.writeToLog(message);
    };
    
    console.warn = function(...args) {
      const message = self.formatLogMessage('WARN', args);
      self.originalConsoleWarn.apply(console, args);
      self.writeToLog(message);
    };
  }

  /**
   * 恢复原始console方法
   */
  restoreConsoleMethods() {
    console.log = this.originalConsoleLog;
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
  }

  /**
   * 格式化日志消息
   * @param {string} level - 日志级别
   * @param {Array} args - 参数数组
   * @returns {string} 格式化的日志消息
   */
  formatLogMessage(level, args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        return JSON.stringify(arg, null, 2);
      }
      return String(arg);
    }).join(' ');
    
    return `[${timestamp}] [${level}] ${message}\n`;
  }

  /**
   * 写入日志到文件
   * @param {string} message - 日志消息
   */
  writeToLog(message) {
    if (this.logStream && !this.logStream.destroyed) {
      this.logStream.write(message);
    }
  }

  /**
   * 直接写入自定义日志（不通过console）
   * @param {string} message - 日志消息
   * @param {string} level - 日志级别
   */
  writeCustomLog(message, level = 'INFO') {
    const formattedMessage = this.formatLogMessage(level, [message]);
    this.writeToLog(formattedMessage);
  }

  /**
   * 获取当前日志文件路径
   * @returns {string|null} 当前日志文件路径
   */
  getCurrentLogFile() {
    return this.currentLogFile;
  }

  /**
   * 获取日志目录中的所有日志文件
   * @returns {Array} 日志文件列表
   */
  getLogFiles() {
    try {
      return fs.readdirSync(this.logDir)
        .filter(file => file.endsWith('.log'))
        .map(file => path.join(this.logDir, file))
        .sort((a, b) => fs.statSync(b).mtime - fs.statSync(a).mtime);
    } catch (error) {
      console.error('获取日志文件列表失败:', error);
      return [];
    }
  }
}

// 创建全局日志管理器实例
export const logManager = new LogManager();