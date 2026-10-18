# kanabiner-settings

Mac（HHKB Studio・US 配列）から JIS 配列の Windows を操作するための Karabiner-Elements 設定。

| 経路 | bundle identifier | IME 切り替え | US→JIS 変換 |
|---|---|---|---|
| Splashtop | `com.splashtop.stb.macosx` | lang | なし |
| Parallels | `com.parallels.desktop` / `com.parallels.vm` / `com.parallels.winapp.*` | lang | なし |
| Openterface KVM | `com.openterface.macOS` | lang | あり |

## 構成

```
karabiner/          ~/.config/karabiner の実体（~/.config/karabiner はここへのシンボリックリンク）
  karabiner.json
  assets/complex_modifications/remote-windows.json   生成物
scripts/build_karabiner.ts   ルール生成スクリプト（karabiner.ts）の入口
scripts/karabiner/
  apps.ts                    リモート用アプリの一覧と IME 方式（普段触るのはここ）
  us-to-jis.ts               US→JIS 変換の対応表
  rules.ts                   ルールの組み立て
windows/ime-toggle.ahk       Windows 側の AutoHotkey（homeend 方式のときだけ必要）
Brewfile
mise.toml
```

## キー割り当て

リモート用アプリが前面のとき:

| キー | 押しっぱなし | 単押し（lang） | 単押し（homeend） |
|---|---|---|---|
| Ctrl | Ctrl | | |
| Option | Alt | | |
| 左 Command | 左 Ctrl（lazy） | 英数（`japanese_eisuu`） | Home |
| 右 Command | 右 Ctrl（lazy） | かな（`japanese_kana`） | End |

Win キーは送らない。US→JIS 変換が有効なアプリでは、記号キーを JIS 配列の key code に変換する。

それ以外（ローカルの Mac）:

| キー | 押しっぱなし | 単押し |
|---|---|---|
| 左 Ctrl | Command | |
| Option | Ctrl | |
| 左 Command | Option | 英数 |
| 右 Command | Option | かな |

ほかに Shift+Caps Lock のルール（左 Shift = Page Down、右 Shift = Cmd+Mission Control）がある。

## セットアップ

```sh
git clone <this repo> ~/Dev/0_scripts/kanabiner-settings
cd ~/Dev/0_scripts/kanabiner-settings

brew bundle            # karabiner-elements, mas, mise, Openterface

# 既存の設定を退避してから、ディレクトリごとリンクする。
# karabiner.json 単体のリンクは不可（Karabiner が保存時にファイルを置き換えてリンクが切れる）。
[ -e ~/.config/karabiner ] && mv ~/.config/karabiner ~/karabiner-backup-$(date +%Y%m%d-%H%M%S)
ln -s "$PWD/karabiner" ~/.config/karabiner

mise install           # bun
mise run install       # bun install
mise run build
mise run reload
```

既定ではすべてのアプリが lang 方式なので、Windows 側に常駐アプリは要らない。
lang のキー（英数・かな）が Windows に届かない経路では、`apps.ts` でそのアプリを `ime: 'homeend'` にし、Windows 側で `windows/ime-toggle.ahk`（AutoHotkey v2）を常駐させる。

Karabiner の仮想キーボードは無変換・変換（`international5` / `international4`）を送れないため、それを使う方式は用意していない。

## ルールの再生成

アプリの追加や IME 方式の変更は、`scripts/karabiner/apps.ts` の `REMOTE_APPS` を編集する。

```sh
mise run check                                # 型チェック
mise run build                                # remote-windows.json を生成し、karabiner.json の "Default profile" に反映
mise exec -- bun scripts/build_karabiner.ts --dry-run    # 反映せず、profile の内容を表示
mise exec -- bun scripts/build_karabiner.ts --no-apply   # remote-windows.json だけ生成
```

`mise run build` は profile の `complex_modifications` を丸ごと置き換える。Karabiner の UI で追加したルールは消えるので、ルールはスクリプトに書く。

## Karabiner の再読み込み

```sh
mise run reload
# = launchctl kickstart -k gui/$(id -u)/org.pqrs.service.agent.Karabiner-Console-User-Server
```

古い Karabiner-Elements ではサービス名が `org.pqrs.service.agent.karabiner_console_user_server`。
