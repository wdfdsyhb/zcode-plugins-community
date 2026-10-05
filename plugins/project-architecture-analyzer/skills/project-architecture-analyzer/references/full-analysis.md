# 模式一：全量分析

目标：对整个项目建立"架构知识图谱"，产出**单文件可视化看板** `docs/architecture-analysis.html`。

执行顺序：

1. 先读 `references/evidence-rules.md`（证据规则）
2. 再读 `references/dashboard-data.md`（看板 DATA 数据结构与填写规范）
3. 按 9 个阶段扫描分析（以下阶段 0-⑥ 与旧文档流程一致，但**产出物是 DATA 数据，不是 Markdown 文件**）
4. 最后按 SKILL.md"输出约定"的 cp + Edit 三步生成看板

大项目允许分批推进（每批简要汇报进度），但阶段顺序不变。

## 阶段 0：扫描策略（先定位，后精读）

禁止一上来逐个文件通读。按这个顺序用检索工具建立项目地图：

1. 构建文件：`Glob: **/pom.xml、**/build.gradle、**/package.json`（+ `gradle/libs.versions.toml` 取精确版本）——单体还是多模块、引入了哪些依赖
2. 配置：`Glob: **/application*.yml、**/application*.properties、**/bootstrap*.yml`——数据源、Redis、MQ、AI、端口
3. `Grep: @RestController|@Controller` → Controller 全集
4. `Grep: @RequestMapping|@GetMapping|@PostMapping|@PutMapping|@DeleteMapping|@PatchMapping` → 接口清单（类级+方法级路径拼接）
5. `Grep: @Service|@Mapper|@TableName|@Entity|extends JpaRepository` → Service/数据访问/表
6. `Grep: RedisTemplate|StringRedisTemplate|Redisson|RabbitTemplate|KafkaTemplate|StpUtil|ChatClient|VectorStore` → 中间件与 AI 真实使用点
7. 顶层包结构 → 识别分层（controller/service/mapper|repository/entity/dto/vo/config/common）

之后只精读与结论相关的文件。**每个结论随手记录证据位置**。

## 阶段 ①：项目体检 → DATA.overview

- 项目名称（从构建文件/README/配置读）、类型勾选（每项勾选带依据）、后端技术栈表（技术/版本/用途/证据——版本必须来自版本目录或依赖文件，不凭印象）、前端技术栈表、运行环境、3-5 条核心结论、【待确认】清单。
- "用途"只允许两种表述："业务使用（证据：文件）"或"依赖引入（未发现业务调用）"。

## 阶段 ②：结构识别 → DATA.architecture

- packages：包结构与各包职责
- diagramHtml：用模板提供的 CSS 类（`.dbox`/`.drow`/`.darr`/`.dside`）拼真实分层图——从代码包结构与调用关系归纳，不是套模板。若发现 Service 直接调 Redis，就把 Redis 画进主链并追问其用途
- features：关键架构特征（每条含证据）
- extras：其他组件速览表

## 阶段 ③+④+⑤：模块与接口 → DATA.modules

- 模块划分依据：包名 → URL 前缀 → Service 命名。每个模块：name/pkg/desc + 接口数组
- 接口全部来自真实注解方法，扫到几个写几个，**方法级路径必须类级+方法级拼接核对**
- 核心接口（每模块 1-3 个）填完整 `detail` 十节（功能/请求/参数/Controller/Service/数据访问/数据库/使用技术/调用链/数据流）；其余接口填 summary 即可，不允许为凑数量编 detail
- 调用链（detail.chain）从 Controller 沿方法调用向下追到 SQL/表；侧向调用（Redis/AI/存储）单独成行；追不到的环节写【待确认】+ 线索

## 阶段 ⑥：接口×技术矩阵 → DATA.matrix

打 ✓ 的唯一依据：该接口调用链中真实出现该技术；未出现一律 `-`；需要脚注的用 `✓*` 并在 footnote 解释。列按项目实际技术增减。

## 阶段 ⑦：技术组件"为什么存在" → DATA.techs

分析对象是"业务代码真实使用"的技术，不是依赖清单里的每个包。每个组件七问：在哪里使用（usage 表）/怎么使用（how）/存什么做什么（what）/为什么存在（why）/如果没有它会怎样（without，标【推测】）/与其他组件的关系（relations）/学渣版（xuezha，一段大白话）。

## 阶段 ⑧：数据流 → DATA.flows

挑核心功能（至少覆盖 1 个登录/入口类功能 + 1-2 个写操作；若项目无登录，选真实的核心入口）。每条流：steps（编号时间线，逐步标注证据）、shapes（数据形态变化表：阶段/长什么样/放在哪）、points（关键设计点）。

## 阶段 ⑨：生成看板

1. `mkdir -p <目标>/docs && cp <skill>/assets/dashboard-template.html <目标>/docs/architecture-analysis.html`
2. Read 复制后的文件，确认 DATA 占位行位置
3. Edit 替换 `const DATA = __ANALYSIS_DATA__;` 为填好的完整 DATA
4. 用浏览器无头方式或语法检查确认 JS 无错误（如 `node -e "new Function(require('fs').readFileSync(path,'utf8').match(/<script>([\s\S]*)<\/script>/)[1])()"` 或至少肉眼核对括号配对）
5. 收尾汇报（见 SKILL.md）

DATA.interview 留空数组——面试题属面试审判模式，不混进全量看板。
