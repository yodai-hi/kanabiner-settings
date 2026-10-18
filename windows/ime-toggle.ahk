#Requires AutoHotkey v2.0
#SingleInstance Force

; ============================================================
; Mac(HHKB US) + Splashtop -> Windows 用
; 左Command->Home(IMEオフ) / 右Command->End(IMEオン)
;
; Chromium系アプリ(新しいTeams = WebView2 等)対策版。
; GetForegroundWindow から直接ではなく、GetGUIThreadInfo で
; 実際にフォーカスを持つコントロールを特定し、そのスレッドの
; 既定IMEウィンドウへ WM_IME_CONTROL を送る。
; ============================================================

Home::IME_Set(0)   ; IME OFF (半角英数)
End::IME_Set(1)    ; IME ON  (日本語)

IME_Set(open) {
    ; --- フォーカス中のコントロールを特定 ---
    fg := DllCall("GetForegroundWindow", "Ptr")
    if !fg
        return
    tid := DllCall("GetWindowThreadProcessId", "Ptr", fg, "Ptr", 0, "UInt")

    ; GUITHREADINFO 構造体 (cbSize + flags + 6つのHWND/RECT)
    sz := 4 + 4 + (A_PtrSize * 6) + 16
    gti := Buffer(sz, 0)
    NumPut("UInt", sz, gti, 0)             ; cbSize
    target := fg
    if DllCall("GetGUIThreadInfo", "UInt", tid, "Ptr", gti) {
        ; hwndFocus は cbSize(4) + flags(4) + hwndActive(Ptr) の後
        off := 4 + 4 + A_PtrSize          ; -> hwndFocus
        hwndFocus := NumGet(gti, off, "Ptr")
        if hwndFocus
            target := hwndFocus
    }

    ; --- 対象スレッドの既定IMEウィンドウへ送る ---
    ime := DllCall("imm32\ImmGetDefaultIMEWnd", "Ptr", target, "Ptr")
    if ime {
        DllCall("SendMessageW", "Ptr", ime, "UInt", 0x0283, "Ptr", 0x0006, "Ptr", open)  ; WM_IME_CONTROL / IMC_SETOPENSTATUS
        return
    }

    ; --- フォールバック: ImmSetOpenStatus を直接呼ぶ ---
    himc := DllCall("imm32\ImmGetContext", "Ptr", target, "Ptr")
    if himc {
        DllCall("imm32\ImmSetOpenStatus", "Ptr", himc, "Int", open)
        DllCall("imm32\ImmReleaseContext", "Ptr", target, "Ptr", himc)
    }
}