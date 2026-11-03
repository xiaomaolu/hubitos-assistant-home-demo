# Hubitos AI 助手首页交互 Demo

在线预览：https://xiaomaolu.github.io/hubitos-assistant-home-demo/

本项目仅用于交互评审，未连接模型、扣费或社媒发布服务。附件只在当前页面预览。

## 开发需求

详见 [开发需求简述](开发需求简述.md)。

- 11 条日常工作示例，每次进入空白新对话随机展示一组，避开上次条目，停留期间不轮换。
- 点击示例或在空输入框按 Tab 填入，不自动发送，不覆盖草稿。
- Word、PPT、Excel 和 PDF 引导上传后分析；不承诺文件导出。
- 电商图片模式维持静态。

## 修改文案

唯一文案源为 config.js。页面通过 config.js 和 app.js 加载；右上角可编辑、导入、导出配置。能力开关是演示预设，正式接入需读取实际产品状态。

修改后运行 node build-demo.mjs，同步更新 config.json 及单文件离线版 Hubitos-动态助手-demo.html。GitHub Pages 直接发布 main 分支根目录。

本仓库只包含 Demo 页面、配置和演示素材。
