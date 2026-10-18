# kanabiner-settings

Mac（HHKB Studio・US 配列）から JIS 配列の Windows を操作するための Karabiner-Elements 設定。
ルールは [karabiner.ts](https://github.com/evan-liu/karabiner.ts) で生成し、`karabiner.json` に書き込む。

| 経路 | bundle identifier | IME 切り替え | US→JIS 変換 |
|---|---|---|---|
| Splashtop | `com.splashtop.stb.macosx` | homeend | なし |
| Parallels | `com.parallels.desktop` / `com.parallels.vm` / `com.parallels.winapp.*` | lang | なし |
| Openterface KVM | `com.openterface.macOS` | lang | あり |

## セットアップ

```sh
git clone git@github.com:yodai-hi/kanabiner-settings.git ~/Dev/0_scripts/kanabiner-settings
cd ~/Dev/0_scripts/kanabiner-settings

brew bundle            # karabiner-elements, mas, mise, Openterface

# 既存の設定を退避してから、ディレクトリごとリンクする。
# karabiner.json 単体のリンクは不可（Karabiner が保存時にファイルを置き換えてリンクが切れる）。
[ -e ~/.config/karabiner ] && mv ~/.config/karabiner ~/karabiner-backup-$(date +%Y%m%d-%H%M%S)
ln -s "$PWD/karabiner" ~/.config/karabiner

mise install           # bun
mise run install       # bun install
mise run build         # ルールを生成して karabiner.json に反映
mise run reload        # Karabiner を再読み込み
```

Karabiner-Elements の設定画面を開いたままリンクを張った場合は、設定画面を開き直す。
古い内容を表示し続け、そこで編集すると古い設定で karabiner.json が上書きされる。

Splashtop を使う Windows では `windows/ime-toggle.ahk`（AutoHotkey v2）を常駐させる（homeend 方式）。Parallels と Openterface（lang 方式）は Windows 側の設定不要。

## ルール

Karabiner の設定画面には次の順で表示される。上にあるルールが優先される。

| ルール名 | 条件 | 内容 |
|---|---|---|
| リモート: US→JIS 記号変換 | `usToJis: true` のアプリが前面 | US 配列の記号入力を JIS 配列の key code に変換 |
| リモート: 修飾キー（英数/かな） | lang 方式のアプリが前面 | 下表「リモート」 |
| リモート: 修飾キー（Home/End） | homeend 方式のアプリが前面（該当アプリがあるときだけ生成） | 下表「リモート」 |
| Mac: 修飾キー入れ替え | 上記以外 | 下表「Mac」 |
| Caps Lock ショートカット | 常に | 左 Shift+Caps Lock→Page Down、右 Shift+Caps Lock→Cmd+Mission Control |

リモート:

| キー | 押しっぱなし | 単押し（lang） | 単押し（homeend） |
|---|---|---|---|
| Ctrl | Ctrl | | |
| Option | Alt | | |
| 左 Command | 左 Ctrl（lazy） | 英数（`japanese_eisuu`）= IME オフ | Home |
| 右 Command | 右 Ctrl（lazy） | かな（`japanese_kana`）= IME オン | End |

Win キーは送らない。

Mac:

| キー | 押しっぱなし | 単押し |
|---|---|---|
| 左 Ctrl | Command | |
| Option | Ctrl | |
| 左 Command | Option | 英数 |
| 右 Command | Option | かな |

### IME 切り替え方式

| 方式 | Command 単押しで送るキー | Windows 側 |
|---|---|---|
| lang | 英数 / かな | 不要 |
| homeend | Home / End | `windows/ime-toggle.ahk`（AutoHotkey v2）を常駐させる |

基本は lang。英数・かなのキーが Windows に届かない経路だけ homeend にする（Splashtop は英数・かなをバッククオートとして送ってしまうため homeend）。
Karabiner の仮想キーボードは無変換・変換（`international5` / `international4`）を送れないため、それを使う方式はない。

## 設定の変更

アプリの追加や IME 方式の変更は `scripts/karabiner/apps.ts` の `REMOTE_APPS` を編集する。

```ts
{
  name: 'Splashtop',                            // 設定画面の「対象: …」に出る名前
  bundleIds: [/^com\.splashtop\.stb\.macosx$/], // frontmost_application_if の条件
  ime: 'lang',                                  // 'lang' | 'homeend'
  usToJis: false,                               // US→JIS 記号変換を使うか
},
```

編集したら再生成して再読み込みする。

```sh
mise run check   # 型チェック
mise run build   # remote-windows.json を生成し、karabiner.json の "Default profile" に反映
mise run reload
```

確認だけしたいとき:

```sh
mise exec -- bun scripts/build_karabiner.ts --dry-run    # 反映せず、profile の内容を表示
mise exec -- bun scripts/build_karabiner.ts --no-apply   # remote-windows.json だけ生成
```

`mise run build` は profile の `complex_modifications` を丸ごと置き換える。
Karabiner の設定画面で追加・編集したルールは消えるので、ルールは必ずスクリプトに書く。

## 構成

```
karabiner/                   ~/.config/karabiner の実体（~/.config/karabiner はここへのシンボリックリンク）
  karabiner.json             生成したルールを含む Karabiner の設定
  assets/complex_modifications/
    remote-windows.json      生成物（リモート関連のルール一式）
  automatic_backups/         Karabiner の自動バックアップ（git 管理外）
scripts/
  build_karabiner.ts         生成スクリプトの入口（JSON 出力と profile への反映）
  karabiner/
    apps.ts                  リモート用アプリの一覧と IME 方式（普段触るのはここ）
    us-to-jis.ts             US→JIS 変換の対応表
    rules.ts                 ルールの組み立て
windows/ime-toggle.ahk       homeend 方式用の AutoHotkey（Home=IME オフ / End=IME オン）
sample/                      移行前の設定（参照用）
Brewfile
mise.toml                    bun のバージョンとタスク（install / check / build / reload）
```

## Karabiner の再読み込み

```sh
mise run reload
# = launchctl kickstart -k gui/$(id -u)/org.pqrs.service.agent.Karabiner-Console-User-Server
```

古い Karabiner-Elements ではサービス名が `org.pqrs.service.agent.karabiner_console_user_server`。

## トラブルシューティング

- **設定画面に古いルールが表示される**: 設定画面（Karabiner-Elements.app）を終了して開き直す。
- **リモート先で Command 単押しで IME が切り替わらない**: その経路が英数・かなのキーを届けていない可能性がある。`apps.ts` でそのアプリを `ime: 'homeend'` にして再生成し、Windows 側で `windows/ime-toggle.ahk` を起動する。
- **元に戻したい**: セットアップ時の `~/karabiner-backup-*` を `~/.config/karabiner` に戻す。
