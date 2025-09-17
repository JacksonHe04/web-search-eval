import fetch from 'node-fetch';
import { SearchEngine } from './SearchEngine.js';

/**
 * 智谱搜索引擎实现
 * 调用智谱API进行网络搜索
 */
export class ZhipuSearchEngine extends SearchEngine {
  constructor(config) {
    super('zhipu', config);
  }

  /**
   * 执行智谱搜索
   * @param {string} query - 搜索查询
   * @param {Object} options - 搜索选项
   * @returns {Promise<Object>} 搜索结果
   */
  async search(query, options = {}) {
    if (!this.validateConfig()) {
      throw new Error('智谱搜索引擎配置无效');
    }

    try {
      const requestData = {
        search_query: query,
        search_engine: options.engine || 'search_pro',
        search_intent: false,
        count: options.maxResults || 10,
        search_domain_filter: options.domainFilter || '',
        search_recency_filter: options.recencyFilter || 'noLimit',
        content_size: options.contentSize || 'medium',
        request_id: this.generateRequestId(),
        user_id: options.userId || 'default'
      };

      const response = await fetch(this.config.base_url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData),
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return this.formatResults({
        query,
        total: data?.data?.length || 0,
        results: this.parseZhipuResults(data?.data || []),
        raw: data
      });

    } catch (error) {
      console.error(`智谱搜索失败: ${error.message}`);
      throw new Error(`智谱搜索失败: ${error.message}`);
    }
  }

  /**
   * 解析智谱API返回的结果
   * @param {Array} rawResults - 原始结果数组
   * @returns {Array} 格式化的结果数组
   */
  parseZhipuResults(rawResults) {
    if (!Array.isArray(rawResults)) {
      return [];
    }

    return rawResults.map((item, index) => ({
      rank: index + 1,
      title: item.title || '',
      url: item.url || item.link || '',
      snippet: item.content || item.snippet || '',
      source: item.source || this.extractDomain(item.url || item.link),
      timestamp: item.publish_time || item.date || null,
      score: item.relevance_score || null
    }));
  }

  /**
   * 从URL提取域名
   * @param {string} url - 完整URL
   * @returns {string} 域名
   */
  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  /**
   * 生成请求ID
   * @returns {string} 唯一请求ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}