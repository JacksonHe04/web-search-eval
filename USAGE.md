# 搜索引擎评估系统使用指南

## 🚀 快速开始

### 1. 安装依赖
```bash
pnpm install
```

### 2. 初始化配置
```bash
pnpm run init
```

### 3. 创建示例文件
```bash
pnpm run samples
```

## ⚙️ 配置API密钥

在使用系统之前，您需要在 `config.json` 文件中配置相应的API密钥：

### 搜索引擎API密钥

1. **Jina AI Search API**
   - 访问 [Jina AI](https://jina.ai/) 获取API密钥
   - 在 `config.json` 中替换 `YOUR_JINA_API_KEY`

2. **Serper Google Search API**
   - 访问 [Serper](https://serper.dev/) 获取API密钥
   - 在 `config.json` 中替换 `YOUR_SERPER_API_KEY`

3. **智谱AI搜索API**
   - 访问 [智谱AI](https://open.bigmodel.cn/) 获取API密钥
   - 在 `config.json` 中替换 `YOUR_ZHIPU_API_KEY`

### AI模型API密钥

配置用于评估的AI模型API密钥：
- 在 `config.json` 中替换 `YOUR_MODEL_API_KEY`
- 支持OpenAI、Claude等兼容的API

## 📋 使用方法

### 单次查询测试
```bash
# 测试单个查询
pnpm run test -- --query "JavaScript异步编程最佳实践" --engines jina,serper --output ./results

# 测试连接
pnpm run test -- --test-connection
```

### 批量测试
```bash
# 使用JSON文件批量测试
pnpm run batch -- --input ./samples/sample_queries.json --output ./batch_results

# 使用CSV文件批量测试
pnpm run batch -- --input ./samples/sample_queries.csv --output ./batch_results
```

### 查看帮助
```bash
# 查看所有可用命令
pnpm run help

# 查看特定命令帮助
pnpm run test -- --help
pnpm run batch -- --help
```

## 📊 输出结果

系统会生成以下类型的报告：

1. **详细结果** (`results_detailed.json`)
   - 包含每个搜索引擎的完整搜索结果
   - 包含AI评估的详细评分和理由

2. **汇总报告** (`summary_report.json`)
   - 各搜索引擎的平均得分
   - 各评估维度的统计信息
   - 性能对比分析

3. **CSV报告** (`results.csv`)
   - 适合在Excel中分析的表格格式
   - 包含所有关键指标

## 🔧 自定义配置

### 评估维度
在 `config.json` 中可以自定义评估维度：
- 权威性（权重：40%）
- 相关性（权重：35%）
- 时效性（权重：25%）

### 评分系统
支持两种评分系统：
- 二分制（0-2分）
- 五分制（1-5分）

### 搜索引擎
可以启用/禁用特定的搜索引擎，或添加新的搜索引擎实现。

## 🛠️ 开发

### 项目结构
```
src/
├── batch/          # 批量测试管理
├── config/         # 配置管理
├── data/           # 数据处理
├── evaluation/     # 评估系统
├── report/         # 报告生成
└── search/         # 搜索引擎实现
```

### 添加新的搜索引擎
1. 在 `src/search/` 目录下创建新的搜索引擎类
2. 继承 `SearchEngine` 基类
3. 实现 `search()` 方法
4. 在配置文件中添加相应配置

## 📝 示例

查看 `samples/` 目录中的示例文件：
- `sample_queries.json` - JSON格式的查询列表
- `sample_queries.csv` - CSV格式的查询列表
- `sample_queries.txt` - 纯文本格式的查询列表

## ⚠️ 注意事项

1. 确保网络连接正常，API服务可访问
2. 注意API调用频率限制
3. 大批量测试可能需要较长时间
4. 建议先进行小规模测试验证配置正确性

## 🆘 故障排除

### 常见问题

1. **API密钥错误**
   - 检查 `config.json` 中的API密钥是否正确
   - 确认API密钥有效且有足够的配额

2. **网络连接问题**
   - 检查网络连接
   - 确认防火墙设置允许访问相关API

3. **依赖安装问题**
   - 删除 `node_modules` 和 `pnpm-lock.yaml`
   - 重新运行 `pnpm install`

如有其他问题，请查看控制台输出的详细错误信息。