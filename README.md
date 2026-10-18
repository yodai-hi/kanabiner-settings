# kanabiner-settings

Mac（HHKB Studio・US 配列）から JIS 配列の Windows を操作するための Karabiner-Elements 設定。
ルールは [karabiner.ts](https://github.com/evan-liu/karabiner.ts) で生成し、`karabiner.json` に書き込む。

| 経路 | bundle identifier | IME 切り替え | US→JIS 変換 |
|---|---|---|---|
| Splashtop | `com.splashtop.stb.macosx` | hotkey | なし |
| Parallels | `com.parallels.desktop` / `com.parallels.vm` / `com.parallels.winapp.*` | hotkey | なし |
| Openterface KVM | `com.openterface.macOS` | hotkey | あり |

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

Openterface アプリのキーボードモードは **Mac** にする（ツールバーのモード表示をクリックすると Mac → Windows → Linux と切り替わる）。
Windows / Linux モードだとアプリ側でも Cmd→Ctrl、Control→Win に置き換えるため、Karabiner の置き換えと重なって Control などが Win キーになる。

Karabiner-Elements の設定画面を開いたままリンクを張った場合は、設定画面を開き直す。
古い内容を表示し続け、そこで編集すると古い設定で karabiner.json が上書きされる。

操作する Windows では Eisu Kana を入れておく（[インストール・更新](#インストール更新windows)）。

## ルール

Karabiner の設定画面には次の順で表示される。上にあるルールが優先される。

| ルール名 | 条件 | 内容 |
|---|---|---|
| リモート: US→JIS 記号変換 | `usToJis: true` のアプリが前面 | US 配列の記号入力を JIS 配列の key code に変換 |
| リモート: 修飾キー（Eisu Kana） | hotkey 方式のアプリが前面 | 下表「リモート」 |
| リモート: 修飾キー（英数/かな） | lang 方式のアプリが前面（該当アプリがあるときだけ生成） | 下表「リモート」 |
| Mac: 修飾キー入れ替え | 上記以外 | 下表「Mac」 |
| Caps Lock ショートカット | 常に | 左 Shift+Caps Lock→Page Down、右 Shift+Caps Lock→Cmd+Mission Control |

リモート:

| キー | 押しっぱなし | 単押し（hotkey） | 単押し（lang） |
|---|---|---|---|
| Ctrl | Ctrl | | |
| 左 Option | Alt | | |
| 右 Option | Win | Win（スタートメニュー） | Win（スタートメニュー） |
| 左 Command | 左 Ctrl（lazy） | Ctrl+Shift+F11 = IME オフ | 英数（`japanese_eisuu`） |
| 右 Command | 右 Ctrl（lazy） | Ctrl+Shift+F12 = IME オン | かな（`japanese_kana`） |

Win キーは右 Option から送る。Karabiner は Command として送り、Openterface（Mac モード）はそれを Win として届ける。Parallels・Splashtop が Command を Win として届けるかは、それぞれの設定による。

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
| hotkey | Ctrl+Shift+F11 / Ctrl+Shift+F12 | `eisu-kana.exe` が受けて IME をオフ / オン |
| lang | 英数 / かな | 不要（ただし今の3経路ではどれも効かない） |

今の3経路はすべて hotkey。英数・かなは、Splashtop ではバッククオートになり、Parallels と Openterface では IME が切り替わらなかった。
合図は普通のキーだけで作る（Openterface は F13 / F14 を Print Screen / App キーに置き換え、F15 以降は送らない）。Alt を含めないのは、Alt を離したときにメニューバーが反応するのを避けるため。
合図を変えるときは `scripts/karabiner/apps.ts` の `IME_KEYS.hotkey` と `windows/eisu-kana/main.go` の両方を直す。
Karabiner の仮想キーボードは無変換・変換（`international5` / `international4`）を送れず、Microsoft IME の設定で「IME オフ」「IME オン」を別々に割り当てられるのはその2キーだけなので、Windows 側の受け手（Eisu Kana）が必要になる。

## Windows 側: Eisu Kana

`windows/eisu-kana/` は、Mac の英数 / かなと同じ操作を Windows でできるようにする常駐アプリ（Go、標準ライブラリのみ）。Karabiner が送る Ctrl+Shift+F11 / F12 を受けて IME をオフ / オンにする。

- Ctrl+Shift+F11 → IME オフ、Ctrl+Shift+F12 → IME オン（Alt や Win が押されているときは通す）。Home / End などほかのキーには触れない
- フォーカス中のコントロールの IME に直接オン / オフを指示するので、新しい Teams など Chromium 系アプリでも効く
- 起動すると `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` に登録され、サインイン時に自動で起動する
- ウィンドウやタスクトレイのアイコンはない（動作中かはタスクマネージャーで確認する）

### インストール・更新（Windows）

PowerShell で次を実行する。最新の Release から `%LOCALAPPDATA%\EisuKana\eisu-kana.exe` に入れて起動する。更新も同じコマンドで、動作中の古い版は止めてから置き換える。

```powershell
irm https://raw.githubusercontent.com/yodai-hi/kanabiner-settings/main/windows/eisu-kana/install.ps1 | iex
```

アンインストール（停止して自動起動を解除する。exe は `%LOCALAPPDATA%\EisuKana\` ごと削除してよい）:

```powershell
& "$env:LOCALAPPDATA\EisuKana\eisu-kana.exe" --uninstall
```

[Releases](https://github.com/yodai-hi/kanabiner-settings/releases) から `eisu-kana.exe` を手でダウンロードして起動してもよい。その場合、署名していない exe なので初回は SmartScreen の警告が出る（「詳細情報」→「実行」）。

### ビルドと公開（Mac）

```sh
mise run build:eisu-kana     # → dist/eisu-kana.exe（アイコン・バージョン情報入り）
mise run release:eisu-kana   # ビルドして GitHub Release eisu-kana-v<バージョン> を作る
```

公開の手順:

1. `windows/eisu-kana/winres/winres.json` のバージョン（`file_version` / `product_version` / `FileVersion` / `ProductVersion`）を上げる
2. コミットして push する
3. `mise run release:eisu-kana`（未コミットの変更がある、push していない、バージョンがそろっていない場合は止まる）

アイコンは `winres/icon.svg`（32px 以上）と `winres/icon16.svg`（16px）が元データ。変えたら `mise run icons:eisu-kana`（rsvg-convert が必要: `brew install librsvg`）で PNG を書き出してからビルドする。

## 設定の変更

アプリの追加や IME 方式の変更は `scripts/karabiner/apps.ts` の `REMOTE_APPS` を編集する。

```ts
{
  name: 'Splashtop',                            // 設定画面の「対象: …」に出る名前
  bundleIds: [/^com\.splashtop\.stb\.macosx$/], // frontmost_application_if の条件
  ime: 'hotkey',                                // 'hotkey' | 'lang'
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
windows/eisu-kana/           Windows 側の常駐アプリ Eisu Kana（Ctrl+Shift+F11=IME オフ / F12=IME オン）
  main.go
  install.ps1                Windows 用のインストール・更新スクリプト
  winres/                    アイコン（SVG と書き出した PNG）とバージョン情報（winres.json）
sample/                      移行前の設定と旧 ime-toggle.ahk（参照用）
dist/                        ビルドした eisu-kana.exe（git 管理外）
Brewfile
mise.toml                    bun・go のバージョンとタスク（install / check / build / reload / build:eisu-kana / icons:eisu-kana / release:eisu-kana）
```

## Karabiner の再読み込み

```sh
mise run reload
# = launchctl kickstart -k gui/$(id -u)/org.pqrs.service.agent.Karabiner-Console-User-Server
```

古い Karabiner-Elements ではサービス名が `org.pqrs.service.agent.karabiner_console_user_server`。

## トラブルシューティング

- **設定画面に古いルールが表示される**: 設定画面（Karabiner-Elements.app）を終了して開き直す。
- **リモート先で Command 単押しで IME が切り替わらない**: Windows で `eisu-kana.exe` が動いているかタスクマネージャーで確認する。管理者権限で動いているウィンドウには効かない場合がある。
- **Openterface で Control や Cmd 長押しが Win キーになる**: Openterface アプリのキーボードモードが Windows / Linux になっている。Mac に切り替える。
- **元に戻したい**: セットアップ時の `~/karabiner-backup-*` を `~/.config/karabiner` に戻す。
