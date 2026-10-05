# 示例主题 - 期刊白名单（格式参考）

> 本文件仅作格式参考，展示白名单 md 应有的结构。
> 实际使用时，whitelist=auto 的主题会由 build_whitelist.py 自动生成；
> 用户也可手写此格式文件，在 topics.yaml 中用 whitelist: 文件名.md 指定。
>
> 引擎解析规则：正则提取每行第一列（期刊全称），归一化后模糊匹配。
> 因此只要保持 `| 期刊名称 | xxx | xxx |` 三列表格即可，后两列内容任意。

---

| 期刊名称 | 简称 | 参考IF |
|---------|------|--------|
| Nature | Nature | ≈64.8 |
| Science | Science | ≈56.9 |
| Nature Materials | Nat. Mater. | ≈41.2 |
| Advanced Materials | Adv. Mater. | ≈27.4 |
| Journal of the American Chemical Society | JACS | ≈15.0 |
| Angewandte Chemie | Angew. Chem. | ≈16.1 |
| Chemical Reviews | Chem. Rev. | ≈72.4 |
