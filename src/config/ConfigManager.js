import fs from 'fs/promises';
import path from 'path';

/**
 * 配置管理器类
 * 负责加载、验证和管理系统配置
 */
export class ConfigManager {
  constructor(configPath = './config.json') {
    this.configPath = configPath;
    this.config = null;
  }

  /**
   * 加载配置文件
   * @returns {Object} 配置对象
   */
  async loadConfig() {
    try {
      try {
        await fs.access(this.configPath);
      } catch (error) {
        throw new Error(`配置文件不存在: ${this.configPath}`);
      }

      const configContent = JSON.parse(await fs.readFile(this.configPath, 'utf8'));
      this.config = configContent;
      
      // 验证配置
      this.validateConfig();
      
      return this.config;
    } catch (error) {
      throw new Error(`加载配置文件失败: ${error.message}`);
    }
  }

  /**
   * 验证配置文件的完整性
   */
  validateConfig() {
    if (!this.config) {
      throw new Error('配置未加载');
    }

    // 验证模型配置
    if (!this.config.model || !this.config.model.model_key) {
      throw new Error('缺少模型API密钥配置');
    }

    // 验证搜索引擎配置
    if (!this.config.search_engines) {
      throw new Error('缺少搜索引擎配置');
    }

    // 验证评估配置
    if (!this.config.evaluation || !this.config.evaluation.dimensions) {
      throw new Error('缺少评估维度配置');
    }

    // 验证权重总和
    const totalWeight = this.config.evaluation.dimensions.reduce(
      (sum, dim) => sum + dim.weight, 0
    );
    
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      throw new Error(`维度权重总和应为1.0，当前为: ${totalWeight}`);
    }
  }

  /**
   * 获取启用的搜索引擎列表
   * @returns {Array} 启用的搜索引擎配置
   */
  getEnabledSearchEngines() {
    if (!this.config) {
      throw new Error('配置未加载');
    }

    return Object.entries(this.config.search_engines)
      .filter(([name, config]) => config.enabled)
      .map(([name, config]) => ({ name, ...config }));
  }

  /**
   * 获取评估维度配置
   * @returns {Array} 评估维度列表
   */
  getEvaluationDimensions() {
    return this.config?.evaluation?.dimensions || [];
  }

  /**
   * 获取评分系统配置
   * @returns {Object} 评分系统配置
   */
  getScoringSystems() {
    return this.config?.evaluation?.scoring_systems || {};
  }

  /**
   * 获取提示词模板
   * @returns {Object} 提示词配置
   */
  getPrompts() {
    return this.config?.evaluation?.prompts || {};
  }

  /**
   * 获取模型配置
   * @returns {Object} 模型配置
   */
  getModelConfig() {
    return this.config?.model || {};
  }
}