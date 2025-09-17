# 网络搜索引擎评估系统

一个用于评估和比较不同搜索引擎性能的工具。

## ✨ 特性

- 🔍 支持多个搜索引擎（Jina AI、Serper、智谱AI）
- 🤖 AI驱动的智能评估系统
- 📊 多维度评估（权威性、相关性、时效性）
- 📈 详细的性能报告和可视化
- 🚀 批量测试和单次查询支持
- 📁 多种数据格式支持（JSON、CSV、TXT）

## 🚀 快速开始

### 安装依赖
```bash
pnpm install
```

### 初始化配置
```bash
pnpm run init
```

### 创建示例文件
```bash
pnpm run samples
```

### 配置API密钥
编辑 `config.json` 文件，替换以下占位符：
- `YOUR_JINA_API_KEY` - Jina AI搜索API密钥
- `YOUR_SERPER_API_KEY` - Serper Google搜索API密钥  
- `YOUR_ZHIPU_API_KEY` - 智谱AI搜索API密钥
- `YOUR_MODEL_API_KEY` - AI评估模型API密钥

## 📋 使用方法

### 查看帮助
```bash
pnpm run help
```

### 查看系统状态
```bash
pnpm run status
```

### 测试搜索引擎连接
```bash
pnpm run test -- --test-connection
```

### 单次查询评估
```bash
pnpm run eval -- "JavaScript异步编程最佳实践"
```

### 批量测试
```bash
pnpm run batch -- ./samples/sample_queries.json
```

## 📊 输出结果

系统会生成以下类型的报告：
- 详细结果（JSON格式）
- 汇总报告（包含统计分析）
- CSV报告（适合Excel分析）

## 📖 详细文档

查看 [USAGE.md](./USAGE.md) 获取详细的使用说明和配置指南。

## 🛠️ 技术栈

- Node.js + ES6 模块
- Commander.js（命令行界面）
- 多个搜索引擎API集成
- AI模型评估（支持OpenAI等）

## 📁 项目结构

```
src/
├── batch/          # 批量测试管理
├── config/         # 配置管理
├── data/           # 数据处理
├── evaluation/     # 评估系统
├── report/         # 报告生成
└── search/         # 搜索引擎实现
```

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个项目！

## 📄 许可证

MIT License

## 🚀 功能特性

- **多搜索引擎支持**: 支持 Jina、Serper、智谱等搜索引擎API
- **多维度评估**: 可自定义评估维度（默认：权威性、相关性、时效性）
- **多种评分体系**: 支持二分制（0-2分）和五分制（1-5分）评分
- **批量测试**: 支持批量导入查询进行评估
- **智能报告**: 自动生成HTML、Markdown、JSON格式的评估报告
- **命令行工具**: 提供便捷的CLI工具
- **可配置权重**: 支持自定义各维度权重分配

## 📦 安装

### 环境要求

- Node.js >= 18.0.0
- pnpm（推荐）或 npm

### 安装依赖

```bash
# 使用 pnpm（推荐）
pnpm install

# 或使用 npm
npm install
```

## ⚙️ 配置

### 1. 初始化配置

```bash
# 创建配置文件和目录结构
pnpm run init

# 或使用命令行工具
npx web-search-eval init
```

### 2. 配置API密钥

复制示例配置文件并编辑：

```bash
cp config.example.json config.json
```

编辑 `config.json` 文件，填入您的API密钥：

```json
{
  "model": {
    "api_key": "your_model_api_key_here",
    "base_url": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    "model_name": "glm-4"
  },
  "search_engines": {
    "jina": {
      "enabled": true,
      "api_key": "your_jina_api_key_here"
    },
    "serper": {
      "enabled": true,
      "api_key": "your_serper_api_key_here"
    },
    "zhipu": {
      "enabled": true,
      "api_key": "your_zhipu_api_key_here"
    }
  }
}
```

### 3. 测试连接

```bash
# 测试所有搜索引擎连接
pnpm run test

# 或
npx web-search-eval test
```

## 🎯 使用方法

### 命令行工具

#### 1. 单个查询评估

```bash
# 评估单个查询
npx web-search-eval eval "人工智能发展趋势"

# 指定输出目录
npx web-search-eval eval "人工智能发展趋势" -o ./my-results
```

#### 2. 批量评估

```bash
# 使用查询文件
npx web-search-eval batch ./samples/sample_queries.json

# 使用逗号分隔的查询列表
npx web-search-eval batch "查询1,查询2,查询3"

# 指定重复次数和输出格式
npx web-search-eval batch queries.json -r 5 --format html,markdown,json
```

#### 3. 创建示例文件

```bash
# 创建示例查询文件
npx web-search-eval samples

# 指定输出目录
npx web-search-eval samples -o ./my-samples
```

#### 4. 查看系统状态

```bash
npx web-search-eval status
```

### 编程接口

```javascript
import { createEvaluationSystem } from './src/index.js';

// 创建并初始化系统
const system = await createEvaluationSystem('./config.json');

// 评估单个查询
const result = await system.evaluateSingleQuery('人工智能发展趋势');
console.log(result);

// 批量评估
const batchResult = await system.runBatchEvaluation([
  '人工智能发展趋势',
  '区块链技术应用',
  '量子计算前景'
], {
  repeatTimes: 3,
  outputDir: './results'
});

// 测试连接
const connectionResults = await system.testConnections();
console.log(connectionResults);
```

## 📊 评估维度

### 默认维度

1. **权威性** (权重: 0.4)
   - 评估信息来源的权威性和可信度
   - 考虑网站声誉、作者专业性等因素

2. **相关性** (权重: 0.35)
   - 评估搜索结果与查询的相关程度
   - 考虑内容匹配度、主题一致性等

3. **时效性** (权重: 0.25)
   - 评估信息的时效性和最新程度
   - 考虑发布时间、更新频率等

### 自定义维度

您可以在配置文件中自定义评估维度：

```json
{
  "evaluation": {
    "dimensions": [
      {
        "name": "自定义维度1",
        "weight": 0.5,
        "description": "维度描述"
      },
      {
        "name": "自定义维度2",
        "weight": 0.3,
        "description": "维度描述"
      },
      {
        "name": "自定义维度3",
        "weight": 0.2,
        "description": "维度描述"
      }
    ]
  }
}
```

## 🎨 评分体系

### 二分制评分 (0-2分)

- **0分**: 不满足要求
- **1分**: 部分满足要求
- **2分**: 完全满足要求

### 五分制评分 (1-5分)

- **1分**: 很差
- **2分**: 较差
- **3分**: 一般
- **4分**: 较好
- **5分**: 很好

### 自定义提示词

您可以为每个维度和评分体系自定义评分提示词：

```json
{
  "evaluation": {
    "scoring_systems": {
      "five_point": {
        "prompts": {
          "权威性": "您的自定义权威性评分提示词...",
          "相关性": "您的自定义相关性评分提示词...",
          "时效性": "您的自定义时效性评分提示词..."
        }
      }
    }
  }
}
```

## 📁 文件格式

### 查询文件格式

#### JSON格式
```json
[
  "查询1",
  "查询2",
  "查询3"
]
```

#### CSV格式
```csv
query
查询1
查询2
查询3
```

#### TXT格式
```
查询1
查询2
查询3
```

### 结果文件格式

系统会生成以下格式的结果文件：

- **JSON**: 完整的结构化数据
- **CSV**: 扁平化的表格数据
- **HTML**: 可视化的网页报告
- **Markdown**: 文档格式的报告

## 🔧 高级配置

### 搜索引擎配置

```json
{
  "search_engines": {
    "jina": {
      "enabled": true,
      "api_key": "your_key",
      "max_results": 10,
      "timeout": 15000
    }
  }
}
```

### 评估配置

```json
{
  "evaluation": {
    "repeat_times": 3,
    "delay_between_requests": 1000,
    "default_scoring_system": "five_point"
  }
}
```

### 输出配置

```json
{
  "output": {
    "default_format": ["html", "markdown", "json"],
    "include_raw_results": true,
    "include_detailed_scores": true
  }
}
```

## 📈 报告示例

评估完成后，系统会生成包含以下内容的报告：

- **搜索引擎排名**: 按平均得分排序
- **详细评分**: 每个维度的具体得分
- **统计分析**: 平均分、标准差等统计信息
- **稳定性分析**: 多次测试的一致性分析

## 🛠️ 开发

### 项目结构

```
web-search-eval/
├── src/
│   ├── config/          # 配置管理
│   ├── search/          # 搜索引擎接口
│   ├── evaluation/      # 评估系统
│   ├── batch/           # 批量测试
│   ├── report/          # 报告生成
│   ├── data/            # 数据处理
│   ├── index.js         # 主入口
│   └── cli.js           # 命令行工具
├── config.example.json  # 示例配置
├── package.json
└── README.md
```

### 开发模式

```bash
# 启动开发模式（文件监听）
pnpm run dev
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🆘 常见问题

### Q: 如何添加新的搜索引擎？

A: 继承 `SearchEngine` 基类并实现相应的方法，然后在配置文件中添加相应配置。

### Q: 如何自定义评分维度？

A: 在配置文件的 `evaluation.dimensions` 中添加新的维度配置。

### Q: 评估速度较慢怎么办？

A: 可以调整 `repeat_times` 和 `delay_between_requests` 参数来平衡速度和准确性。

### Q: API调用失败怎么办？

A: 检查API密钥是否正确，网络连接是否正常，可以使用 `test` 命令进行连接测试。

---

如有问题，请查看文档或提交 Issue。