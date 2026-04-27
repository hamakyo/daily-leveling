# Daily Leveling Design

## 目的

Daily Leveling の UI は、習慣の記録を軽く、継続の進捗を前向きに見せることを優先する。
参考ビジュアルの方向性は、白いカード、淡いブルー背景、濃紺の文字、シアン・ブルー・バイオレットのアクセントを中心にする。

## 原則

- UI は日本語を前提にする。
- フォントスタックは sans-serif のみを使う。
- グラデーションは使わない。
- 背景は淡く、カードは白を基本にする。
- 操作可能な要素はブルー、達成状態はシアン、選択中や強調はバイオレットで表現する。
- 色だけに依存せず、文言と状態ラベルでも意味が伝わるようにする。

## カラーパレット

実装上の正は `src/web/styles.css` の CSS variables とする。

| Token | Hex / Value | 用途 |
| --- | --- | --- |
| `--color-ink` | `#060b26` | 見出し、強い本文、ブランド名 |
| `--color-text` | `#1c2945` | 標準テキスト |
| `--color-muted` | `#60708d` | 補足文、説明文、サブ情報 |
| `--color-page` | `#f4f8ff` | ページ背景 |
| `--color-surface` | `#ffffff` | カード、パネル、入力面 |
| `--color-panel` | `#f9fbff` | 薄いパネル、sticky header |
| `--color-soft-blue` | `#eaf2ff` | secondary button、月チップ、未完了操作 |
| `--color-soft-cyan` | `#e5fbfb` | summary band、達成系の淡い背景 |
| `--color-cyan` | `#20c7bd` | 達成、完了、チェック済み |
| `--color-blue` | `#2f7df0` | primary action、入力 focus |
| `--color-violet` | `#8a5cf6` | active tab、eyebrow、強調アクセント |
| `--color-line` | `rgba(16, 27, 58, 0.1)` | 境界線 |
| `--shadow-card` | `0 12px 30px rgba(29, 55, 105, 0.08)` | カード影 |

## 状態表現

| 状態 | 表現 |
| --- | --- |
| Primary action | `--color-blue` の塗り、白文字 |
| Secondary action | `--color-soft-blue` の塗り、濃紺文字 |
| Active tab / selected state | `--color-violet` の塗り、白文字 |
| Completed / achieved state | `--color-cyan` の塗り、白文字 |
| Target day but not completed | `rgba(47, 125, 240, 0.16)` の淡いブルー |
| Non-target / inactive cell | `rgba(96, 112, 141, 0.14)` のニュートラル |

## 禁止事項

- セリフ体を使わない。
- グラデーションを使わない。
- 紫を主役にしすぎない。バイオレットは active / accent に限定する。
- タスク管理アプリのような重い一覧 UI に寄せない。
- 達成状態を赤や警告色で表現しない。

## 更新ルール

配色や状態表現を変える場合は、`src/web/styles.css` とこの `DESIGN.md` を同時に更新する。
実装とドキュメントが矛盾した場合は、実装前にこのファイルの方針を更新してから CSS に反映する。
