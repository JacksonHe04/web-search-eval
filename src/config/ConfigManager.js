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
  async getPrompts() {
    // 尝试从外部文件加载提示词
    try {
      const promptsDir = path.join(process.cwd(), 'prompts');
      const prompts = {};
      
      // 检查prompts目录是否存在
      try {
        await fs.access(promptsDir);
      } catch (error) {
        // 如果prompts目录不存在，回退到配置文件中的提示词
        console.log('⚠️  prompts目录不存在，使用配置文件中的提示词');
        return this.config?.evaluation?.prompts || {};
      }
      
      // 加载binary评分系统的提示词
      const binaryDir = path.join(promptsDir, 'binary');
      try {
        await fs.access(binaryDir);
        prompts.binary = {};
        
        const binaryFiles = await fs.readdir(binaryDir);
        for (const file of binaryFiles) {
          if (file.endsWith('.txt')) {
            const dimension = path.basename(file, '.txt');
            const filePath = path.join(binaryDir, file);
            prompts.binary[dimension] = await fs.readFile(filePath, 'utf8');
          }
        }
      } catch (error) {
        console.log('⚠️  binary提示词目录不存在，跳过加载');
      }
      
      // 加载five_point评分系统的提示词
      const fivePointDir = path.join(promptsDir, 'five_point');
      try {
        await fs.access(fivePointDir);
        prompts.five_point = {};
        
        const fivePointFiles = await fs.readdir(fivePointDir);
        for (const file of fivePointFiles) {
          if (file.endsWith('.txt')) {
            const dimension = path.basename(file, '.txt');
            const filePath = path.join(fivePointDir, file);
            prompts.five_point[dimension] = await fs.readFile(filePath, 'utf8');
          }
        }
      } catch (error) {
        console.log('⚠️  five_point提示词目录不存在，跳过加载');
      }
      
      // 如果成功加载了外部提示词，返回加载的内容
      if (Object.keys(prompts).length > 0) {
        console.log('✅ 成功从外部文件加载提示词');
        return prompts;
      }
      
      // 如果没有加载到任何外部提示词，回退到配置文件
      console.log('⚠️  未找到外部提示词文件，使用配置文件中的提示词');
      return this.config?.evaluation?.prompts || {};
      
    } catch (error) {
      console.error('❌ 加载外部提示词失败，回退到配置文件:', error.message);
      return this.config?.evaluation?.prompts || {};
    }
  }

  /**
   * 获取模型配置
   * @returns {Object} 模型配置
   */
  getModelConfig() {
    return this.config?.model || {};
  }
}