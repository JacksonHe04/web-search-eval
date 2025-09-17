import fetch from 'node-fetch';
import { SearchEngine } from './SearchEngine.js';

/**
 * 智谱Quark搜索引擎实现
 * 使用search_pro_quark引擎进行网络搜索
 */
export class ZhipuQuarkSearchEngine extends SearchEngine {
  constructor(config) {
    super('zhipu_quark', config);
  }

  /**
   * 执行智谱Quark搜索
   * @param {string} query - 搜索查询
   * @param {Object} options - 搜索选项
   * @returns {Promise<Object>} 搜索结果
   */
  async search(query, options = {}) {
    if (!this.validateConfig()) {
      throw new Error('智谱Quark搜索引擎配置无效');
    }

    try {
      console.log(`使用 zhipu_quark 搜索: ${query}`);
      
      const requestData = {
        search_query: query,
        search_engine: 'search_pro_quark',
        search_intent: false,
        count: options.maxResults || 10,
        search_domain_filter: options.domainFilter || '',
        search_recency_filter: options.recencyFilter || 'noLimit',
        content_size: options.contentSize || 'medium',
        request_id: this.generateRequestId(),
        user_id: options.userId || 'default'
      };

      console.log(`智谱Quark请求数据:`, JSON.stringify(requestData, null, 2));

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
        const errorText = await response.text();
        console.error(`智谱Quark API错误响应: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`智谱Quark响应摘要: 返回${data.search_result?.length || 0}条结果`);

      const results = this.parseZhipuResults(data?.search_result || []);
      console.log(`zhipu_quark 搜索完成，返回 ${results.length} 条结果`);

      return this.formatResults({
        query,
        total: results.length,
        results: results,
        raw: data
      });

    } catch (error) {
      console.error(`智谱Quark搜索失败: ${error.message}`);
      throw new Error(`智谱Quark搜索失败: ${error.message}`);
    }
  }

  /**
   * 解析智谱API返回的结果
   * @param {Array} rawResults - 原始结果数组
   * @returns {Array} 格式化的结果数组
   */
  parseZhipuResults(rawResults) {
    if (!Array.isArray(rawResults)) {
      console.log('智谱Quark返回的数据不是数组:', rawResults);
      return [];
    }

    // 严格限制返回结果数量为10条
    const limitedResults = rawResults.slice(0, 10);
    
    if (rawResults.length > 10) {
      console.log(`智谱Quark返回了${rawResults.length}条结果，已限制为10条`);
    }

    return limitedResults.map((item, index) => ({
      rank: index + 1,
      title: item.title || '',
      url: item.url || item.link || '',
      snippet: item.content || item.snippet || '',
      source: this.extractDomain(item.url || item.link || ''),
      timestamp: new Date().toISOString()
    }));
  }

  /**
   * 从URL中提取域名
   * @param {string} url - URL地址
   * @returns {string} 域名
   */
  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  /**
   * 生成请求ID
   * @returns {string} 请求ID
   */
  generateRequestId() {
    return `zhipu_quark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}