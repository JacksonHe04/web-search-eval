#!/usr/bin/env node

import { Command } from 'commander';
import { createEvaluationSystem } from './index.js';
import path from 'path';
import fs from 'fs/promises';

const program = new Command();

/**
 * 命令行工具主程序
 */
program
  .name('web-search-eval')
  .description('网络搜索引擎评估系统')
  .version('1.0.0');

/**
 * 初始化命令
 */
program
  .command('init')
  .description('初始化项目配置文件')
  .option('-f, --force', '强制覆盖已存在的配置文件')
  .action(async (options) => {
    try {
      await initializeProject(options.force);
    } catch (error) {
      console.error('❌ 初始化失败:', error.message);
      process.exit(1);
    }
  });

/**
 * 测试连接命令
 */
program
  .command('test')
  .description('测试搜索引擎连接')
  .option('-c, --config <path>', '配置文件路径', './config.json')
  .action(async (options) => {
    try {
      const system = await createEvaluationSystem(options.config);
      const results = await system.testConnections();
      
      console.log('\n📊 连接测试结果:');
      Object.entries(results).forEach(([engine, result]) => {
        const status = result.status === 'success' ? '✅' : '❌';
        console.log(`   ${status} ${engine}: ${result.status}`);
        if (result.error) {
          console.log(`      错误: ${result.error}`);
        }
      });
      
    } catch (error) {
      console.error('❌ 测试失败:', error.message);
      process.exit(1);
    }
  });

/**
 * 单个查询评估命令
 */
program
  .command('eval')
  .description('评估单个搜索查询')
  .argument('<query>', '搜索查询')
  .option('-c, --config <path>', '配置文件路径', './config.json')
  .option('-o, --output <dir>', '输出目录', './results')
  .option('--no-report', '不生成报告')
  .action(async (query, options) => {
    try {
      const system = await createEvaluationSystem(options.config);
      
      console.log(`🔍 评估查询: "${query}"`);
      const result = await system.evaluateSingleQuery(query);
      
      // 保存结果
      const outputDir = options.output;
      await fs.mkdir(outputDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const resultFile = path.join(outputDir, `single_eval_${timestamp}.json`);
      
      await fs.writeFile(resultFile, JSON.stringify(result, null, 2));
      console.log(`💾 结果已保存到: ${resultFile}`);
      
      // 生成报告
      if (options.report) {
        const reportFiles = await system.generateReports(
          { queries: [result] },
          outputDir,
          { format: ['html', 'markdown'] }
        );
        console.log('📝 报告已生成:', reportFiles);
      }
      
      // 显示简要结果
      console.log('\n📊 评估结果摘要:');
      Object.entries(result.engineResults).forEach(([engine, engineResult]) => {
        console.log(`   ${engine}: ${engineResult.finalScore.toFixed(2)}分`);
      });
      
    } catch (error) {
      console.error('❌ 评估失败:', error.message);
      process.exit(1);
    }
  });

/**
 * 批量评估命令
 */
program
  .command('batch')
  .description('批量评估搜索查询')
  .argument('<queries>', '查询文件路径或查询列表（逗号分隔）')
  .option('-c, --config <path>', '配置文件路径', './config.json')
  .option('-o, --output <dir>', '输出目录', './results')
  .option('-r, --repeat <times>', '重复测试次数', '3')
  .option('--format <formats>', '报告格式（html,markdown,json）', 'html,markdown')
  .option('--no-report', '不生成报告')
  .action(async (queries, options) => {
    try {
      const system = await createEvaluationSystem(options.config);
      
      // 解析查询输入
      let queriesInput;
      if (queries.includes(',')) {
        // 逗号分隔的查询列表
        queriesInput = queries.split(',').map(q => q.trim());
      } else {
        // 文件路径
        queriesInput = queries;
      }
      
      const batchOptions = {
        repeatTimes: parseInt(options.repeat),
        outputDir: options.output,
        generateReport: options.report,
        reportOptions: {
          format: options.format.split(',').map(f => f.trim())
        }
      };
      
      console.log('📊 开始批量评估...');
      const result = await system.runBatchEvaluation(queriesInput, batchOptions);
      
      console.log('\n🎉 批量评估完成！');
      console.log(`📁 结果保存在: ${options.output}`);
      
      // 显示排名
      console.log('\n🏆 搜索引擎排名:');
      result.finalReport.engineRanking.forEach((engine, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
        console.log(`   ${medal} ${index + 1}. ${engine.name}: ${engine.averageScore.toFixed(2)}分`);
      });
      
    } catch (error) {
      console.error('❌ 批量评估失败:', error.message);
      process.exit(1);
    }
  });

/**
 * 创建示例文件命令
 */
program
  .command('samples')
  .description('创建示例查询文件')
  .option('-o, --output <dir>', '输出目录', './samples')
  .action(async (options) => {
    try {
      const system = await createEvaluationSystem();
      const files = await system.createSampleFiles(options.output);
      
      console.log('📁 示例文件已创建:');
      Object.entries(files).forEach(([type, path]) => {
        console.log(`   ${type}: ${path}`);
      });
      
    } catch (error) {
      console.error('❌ 创建示例文件失败:', error.message);
      process.exit(1);
    }
  });

/**
 * 状态查看命令
 */
program
  .command('status')
  .description('查看系统状态')
  .option('-c, --config <path>', '配置文件路径', './config.json')
  .action(async (options) => {
    try {
      const system = await createEvaluationSystem(options.config);
      const status = system.getSystemStatus();
      
      console.log('📋 系统状态:');
      console.log(`   状态: ${status.status}`);
      console.log(`   搜索引擎: ${status.config.engines.enabled}/${status.config.engines.total} 个已启用`);
      console.log(`   评估维度: ${status.config.dimensions.join(', ')}`);
      console.log(`   重复测试: ${status.config.repeatTimes} 次`);
      console.log(`   启用引擎: ${status.config.engines.engines.join(', ')}`);
      
    } catch (error) {
      console.error('❌ 获取状态失败:', error.message);
      process.exit(1);
    }
  });

/**
 * 初始化项目
 * @param {boolean} force - 是否强制覆盖
 */
async function initializeProject(force = false) {
  const configPath = './config.json';
  
  // 检查配置文件是否已存在
  try {
    await fs.access(configPath);
    if (!force) {
      console.log('⚠️  配置文件已存在，使用 --force 参数强制覆盖');
      return;
    }
  } catch {
    // 文件不存在，继续创建
  }
  
  // 创建默认配置
  const defaultConfig = {
    "model": {
      "api_key": "your_model_api_key_here",
      "base_url": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      "model_name": "glm-4"
    },
    "search_engines": {
      "jina": {
        "enabled": true,
        "api_key": "your_jina_api_key_here",
        "base_url": "https://s.jina.ai/",
        "max_results": 10
      },
      "serper": {
        "enabled": true,
        "api_key": "your_serper_api_key_here",
        "base_url": "https://google.serper.dev/search",
        "max_results": 10
      },
      "zhipu": {
        "enabled": true,
        "api_key": "your_zhipu_api_key_here",
        "base_url": "https://open.bigmodel.cn/api/paas/v4/web_search",
        "max_results": 10
      }
    },
    "evaluation": {
      "dimensions": [
        {
          "name": "权威性",
          "weight": 0.4,
          "description": "信息来源的权威性和可信度"
        },
        {
          "name": "相关性",
          "weight": 0.35,
          "description": "搜索结果与查询的相关程度"
        },
        {
          "name": "时效性",
          "weight": 0.25,
          "description": "信息的时效性和最新程度"
        }
      ],
      "scoring_systems": {
        "binary": {
          "min_score": 0,
          "max_score": 2,
          "prompts": {
            "权威性": "",
            "相关性": "",
            "时效性": ""
          }
        },
        "five_point": {
          "min_score": 1,
          "max_score": 5,
          "prompts": {
            "权威性": "",
            "相关性": "",
            "时效性": ""
          }
        }
      },
      "default_scoring_system": "five_point",
      "repeat_times": 3
    }
  };
  
  await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
  console.log(`✅ 配置文件已创建: ${configPath}`);
  
  // 创建目录结构
  const dirs = ['./results', './samples', './data'];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
    console.log(`📁 目录已创建: ${dir}`);
  }
  
  console.log('\n💡 下一步:');
  console.log('   1. 编辑 config.json 填入您的API密钥');
  console.log('   2. 运行 "web-search-eval test" 测试连接');
  console.log('   3. 运行 "web-search-eval samples" 创建示例文件');
  console.log('   4. 运行 "web-search-eval batch samples/sample_queries.json" 开始评估');
}

// 解析命令行参数
program.parse();

export { program };