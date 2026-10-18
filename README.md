# kanabiner-settings

Mac（HHKB Studio・US 配列）から JIS 配列の Windows を操作するための Karabiner-Elements 設定。
ルールは [karabiner.ts](https://github.com/evan-liu/karabiner.ts) で生成し、`karabiner.json` に書き込む。

| 経路 | bundle identifier | IME 切り替え | US→JIS 変換 |
|---|---|---|---|
| Splashtop | `com.splashtop.stb.macosx` | homeend | なし |
| Parallels | `com.parallels.desktop` / `com.parallels.vm` / `com.parallels.winapp.*` | homeend | なし |
| Openterface KVM | `com.openterface.macOS` | homeend | あり |

## セットアップ

```sh
git clone git@github.com:yodai-hi/kanabiner-settings.git ~/Dev/0_scripts/kanabiner-settings
cd ~/Dev/0_scripts/kanabiner-settings

brew bundle            # karabiner-elements, mas, mise, Openterface

# 既存の設定を退避してから、ディレクトリごとリンクする。
# karabiner.json 単体のリンクは不可（Karabiner が保存時にファイルを置き換えてリンクが切れる）。
[ -e ~/.config/karabiner ] && mv ~/.config/karabiner ~/karabiner-backup-$(date +%Y%m%d-%H%M%S)
ln -s "$PWD/karabiner" ~/.config/karabiner

mise install           # bun, go
mise run install       # bun install
mise run build         # ルールを生成して karabiner.json に反映
mise run reload        # Karabiner を再読み込み
```

Karabiner-Elements の設定画面を開いたままリンクを張った場合は、設定画面を開き直す。
古い内容を表示し続け、そこで編集すると古い設定で karabiner.json が上書きされる。

操作する Windows では `ime-toggle.exe` を一度起動しておく（[Windows 側: ime-toggle](#windows-側-ime-toggle)）。

## ルール

Karabiner の設定画面には次の順で表示される。上にあるルールが優先される。

| ルール名 | 条件 | 内容 |
|---|---|---|
| リモート: US→JIS 記号変換 | `usToJis: true` のアプリが前面 | US 配列の記号入力を JIS 配列の key code に変換 |
| リモート: 修飾キー（Home/End） | homeend 方式のアプリが前面 | 下表「リモート」 |
| リモート: 修飾キー（英数/かな） | lang 方式のアプリが前面（該当アプリがあるときだけ生成） | 下表「リモート」 |
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
| homeend | Home / End | `ime-toggle.exe` が受けて IME をオフ / オン |
| lang | 英数 / かな | 不要（ただし今の3経路ではどれも効かない） |

今の3経路はすべて homeend。英数・かなは、Splashtop ではバッククオートになり、Parallels と Openterface では IME が切り替わらなかった。
Karabiner の仮想キーボードは無変換・変換（`international5` / `international4`）を送れず、Microsoft IME の設定で「IME オフ」「IME オン」を別々に割り当てられるのはその2キーだけなので、Windows 側の受け手（ime-toggle）が必要になる。

## Windows 側: ime-toggle

`windows/ime-toggle/` は、Home / End を受けて IME をオフ / オンにする常駐アプリ（Go、標準ライブラリのみ）。

- Home（修飾キーなし）→ IME オフ、End（修飾キーなし）→ IME オン。Shift+Home などはそのまま通す
- フォーカス中のコントロールの IME に直接オン / オフを指示するので、新しい Teams など Chromium 系アプリでも効く
- 起動すると `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` に登録され、サインイン時に自動で起動する
- ウィンドウやタスクトレイのアイコンはない（動作中かはタスクマネージャーで確認する）

ビルド（Mac 上で Windows 用 exe を作る）:

```sh
mise run build:ime-toggle   # → dist/ime-toggle.exe
```

Windows でのインストールとアンインストール:

```bat
:: 好きな場所（例: %LOCALAPPDATA%\ime-toggle\）に置いて一度起動する
ime-toggle.exe

:: 停止して自動起動を解除する
ime-toggle.exe --uninstall
```

署名していない exe なので、初回は SmartScreen の警告が出る。「詳細情報」→「実行」で起動する。

## 設定の変更

アプリの追加や IME 方式の変更は `scripts/karabiner/apps.ts` の `REMOTE_APPS` を編集する。

```ts
{
  name: 'Splashtop',                            // 設定画面の「対象: …」に出る名前
  bundleIds: [/^com\.splashtop\.stb\.macosx$/], // frontmost_application_if の条件
  ime: 'homeend',                               // 'homeend' | 'lang'
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
windows/ime-toggle/          Windows 側の常駐アプリ（Home=IME オフ / End=IME オン）
sample/                      移行前の設定と旧 ime-toggle.ahk（参照用）
dist/                        ビルドした ime-toggle.exe（git 管理外）
Brewfile
mise.toml                    bun・go のバージョンとタスク（install / check / build / reload / build:ime-toggle）
```

## Karabiner の再読み込み

```sh
mise run reload
# = launchctl kickstart -k gui/$(id -u)/org.pqrs.service.agent.Karabiner-Console-User-Server
```

古い Karabiner-Elements ではサービス名が `org.pqrs.service.agent.karabiner_console_user_server`。

## トラブルシューティング

- **設定画面に古いルールが表示される**: 設定画面（Karabiner-Elements.app）を終了して開き直す。
- **リモート先で Command 単押しで IME が切り替わらない**: Windows で `ime-toggle.exe` が動いているかタスクマネージャーで確認する。管理者権限で動いているウィンドウには効かない場合がある。
- **元に戻したい**: セットアップ時の `~/karabiner-backup-*` を `~/.config/karabiner` に戻す。
