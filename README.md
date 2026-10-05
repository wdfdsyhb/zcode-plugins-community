# zcode-plugins-community

社区维护的 [ZCode](https://github.com/zai-org/ZCode) 第三方插件市场。官方市场之外的收录地：中文安全技能包、数据竞赛工作流、以及散落在 GitHub 各处的社区插件。

Community-run third-party plugin marketplace for ZCode: Chinese security packs, data-science workflows, and curated community plugins.

## 安装 / Install

任选一种，在终端执行（或在 ZCode 桌面端 **插件市场 → 新增** 中添加）：

```bash
# 方式一：git 直连
zcode plugins marketplace add wdfdsyhb/zcode-plugins-community --scope user

# 方式二：国内网络用 jsDelivr 镜像（URL 来源，不走 git）
zcode plugins marketplace add https://cdn.jsdelivr.net/gh/wdfdsyhb/zcode-plugins-community@main/marketplace.json --scope user
```

添加后打开 ZCode 商店页的 **个人** 分段即可看到本市场条目。

## 收录 / Catalog

| 插件 | 分类 | 说明 |
|---|---|---|
| [security-cn-pack](plugins/security-cn-pack/) | security | 中文安全挖洞四合一：SRC 工作流、护网红蓝队、CNVD/CNNVD 报送、11 类漏洞方法论 |
| [data-competition-pack](plugins/data-competition-pack/) | data-science | 天池/Kaggle 六阶段竞赛方法论 + 过拟合诊断 |

更多条目见 [marketplace.json](marketplace.json)。收录标准见 [docs/SUBMIT.md](docs/SUBMIT.md)。

## 提交插件 / Submit your plugin

欢迎 PR 或 issue。要求：有 LICENSE、过 gitleaks 扫描、plugin.json 合法、中英双语描述。详见 [docs/SUBMIT.md](docs/SUBMIT.md)。

## 说明

- 本市场为社区项目，与 Z.ai 官方无隶属关系；官方市场见 [zai-org/zcode-plugins](https://github.com/zai-org/zcode-plugins)。
- 收录的第三方插件版权归原作者，收录前已通过基础安全审计；使用产生的风险自担。
- 安全技能内容仅用于授权测试与防御学习场景。
