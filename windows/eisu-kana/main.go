//go:build windows

// Eisu Kana: Mac-style 英数 / かな for Windows.
// Ctrl+Shift+F11 = IME off, Ctrl+Shift+F12 = IME on.
//
// Karabiner-Elements on the Mac sends these when Command is tapped alone
// (scripts/karabiner/apps.ts, IME_KEYS.hotkey). They are made of standard keys only
// so that every remote path (Splashtop, Parallels, Openterface) delivers them.
// This resident app swallows them and sets the IME open status of the focused
// control directly, which also works in Chromium-based apps (new Teams / WebView2)
// where key-based toggling does not.
//
// It does not register itself to start at sign-in: an unknown exe writing its own
// Run key is flagged by Microsoft Defender (Behavior:Win32/Persistence.A!ml).
// To start it at sign-in, put a shortcut in the Startup folder (shell:startup).
// To stop it, end eisu-kana.exe in Task Manager.
package main

import (
	"runtime"
	"syscall"
	"unsafe"
)

const (
	className = "EisuKanaMessageWindow"

	whKeyboardLL = 13
	wmKeyDown    = 0x0100
	wmKeyUp      = 0x0101
	wmSysKeyDown = 0x0104
	wmSysKeyUp   = 0x0105
	wmApp        = 0x8000
	wmSetIME     = wmApp + 1
	wmIMEControl = 0x0283
	imcSetOpen   = 0x0006

	vkF11     = 0x7A // IME off
	vkF12     = 0x7B // IME on
	vkShift   = 0x10
	vkControl = 0x11
	vkMenu    = 0x12
	vkLWin    = 0x5B
	vkRWin    = 0x5C

	errorAlreadyExist = 183
	smtoAbortIfHung   = 0x0002
)

var hwndMessage = ^uintptr(2) // HWND_MESSAGE = (HWND)-3

var (
	user32   = syscall.NewLazyDLL("user32.dll")
	kernel32 = syscall.NewLazyDLL("kernel32.dll")
	imm32    = syscall.NewLazyDLL("imm32.dll")

	procSetWindowsHookExW     = user32.NewProc("SetWindowsHookExW")
	procCallNextHookEx        = user32.NewProc("CallNextHookEx")
	procGetAsyncKeyState      = user32.NewProc("GetAsyncKeyState")
	procGetMessageW           = user32.NewProc("GetMessageW")
	procDispatchMessageW      = user32.NewProc("DispatchMessageW")
	procRegisterClassExW      = user32.NewProc("RegisterClassExW")
	procCreateWindowExW       = user32.NewProc("CreateWindowExW")
	procDefWindowProcW        = user32.NewProc("DefWindowProcW")
	procPostMessageW          = user32.NewProc("PostMessageW")
	procGetForegroundWindow   = user32.NewProc("GetForegroundWindow")
	procGetWindowThreadProcId = user32.NewProc("GetWindowThreadProcessId")
	procGetGUIThreadInfo      = user32.NewProc("GetGUIThreadInfo")
	procSendMessageTimeoutW   = user32.NewProc("SendMessageTimeoutW")
	procCreateMutexW          = kernel32.NewProc("CreateMutexW")
	procGetModuleHandleW      = kernel32.NewProc("GetModuleHandleW")
	procImmGetDefaultIMEWnd   = imm32.NewProc("ImmGetDefaultIMEWnd")
)

type kbdllHookStruct struct {
	VkCode      uint32
	ScanCode    uint32
	Flags       uint32
	Time        uint32
	DwExtraInfo uintptr
}

type guiThreadInfo struct {
	CbSize        uint32
	Flags         uint32
	HwndActive    uintptr
	HwndFocus     uintptr
	HwndCapture   uintptr
	HwndMenuOwner uintptr
	HwndMoveSize  uintptr
	HwndCaret     uintptr
	RcCaret       [4]int32
}

type wndClassEx struct {
	CbSize        uint32
	Style         uint32
	LpfnWndProc   uintptr
	CbClsExtra    int32
	CbWndExtra    int32
	HInstance     uintptr
	HIcon         uintptr
	HCursor       uintptr
	HbrBackground uintptr
	LpszMenuName  *uint16
	LpszClassName *uint16
	HIconSm       uintptr
}

type msg struct {
	Hwnd    uintptr
	Message uint32
	WParam  uintptr
	LParam  uintptr
	Time    uint32
	Pt      [2]int32
	_       uint32
}

var (
	window    uintptr
	swallowed = map[uint32]bool{} // keys whose key-down was swallowed, so the key-up is too
)

func main() {
	// The hook and the message loop must stay on the same OS thread.
	runtime.LockOSThread()

	mutexName, _ := syscall.UTF16PtrFromString(`Local\` + className)
	if _, _, err := procCreateMutexW.Call(0, 0, uintptr(unsafe.Pointer(mutexName))); err == syscall.Errno(errorAlreadyExist) {
		return // already running
	}

	window = createMessageWindow()
	procSetWindowsHookExW.Call(whKeyboardLL, syscall.NewCallback(keyboardHook), 0, 0)

	var m msg
	for {
		r, _, _ := procGetMessageW.Call(uintptr(unsafe.Pointer(&m)), 0, 0, 0)
		if int32(r) <= 0 {
			return
		}
		procDispatchMessageW.Call(uintptr(unsafe.Pointer(&m)))
	}
}

// keyboardHook runs for every key event system-wide, so it must return quickly:
// the IME update is posted to the message loop instead of being done here.
func keyboardHook(nCode int, wParam, lParam uintptr) uintptr {
	if nCode == 0 {
		// lParam points to OS-owned memory, not the Go heap; convert without tripping go vet.
		k := *(**kbdllHookStruct)(unsafe.Pointer(&lParam))
		if k.VkCode == vkF11 || k.VkCode == vkF12 {
			switch wParam {
			case wmKeyDown, wmSysKeyDown:
				if isTriggerModifiers() {
					swallowed[k.VkCode] = true
					open := uintptr(0)
					if k.VkCode == vkF12 {
						open = 1
					}
					procPostMessageW.Call(window, wmSetIME, open, 0)
					return 1
				}
			case wmKeyUp, wmSysKeyUp:
				if swallowed[k.VkCode] {
					delete(swallowed, k.VkCode)
					return 1
				}
			}
		}
	}
	r, _, _ := procCallNextHookEx.Call(0, uintptr(nCode), wParam, lParam)
	return r
}

// isTriggerModifiers reports whether exactly Ctrl and Shift are held.
func isTriggerModifiers() bool {
	return keyDown(vkControl) && keyDown(vkShift) &&
		!keyDown(vkMenu) && !keyDown(vkLWin) && !keyDown(vkRWin)
}

func keyDown(vk uintptr) bool {
	s, _, _ := procGetAsyncKeyState.Call(vk)
	return s&0x8000 != 0
}

// setIME sends IMC_SETOPENSTATUS to the default IME window of the control that
// actually has focus (not the top-level window), which Chromium-based apps need.
func setIME(open uintptr) {
	fg, _, _ := procGetForegroundWindow.Call()
	if fg == 0 {
		return
	}
	tid, _, _ := procGetWindowThreadProcId.Call(fg, 0)

	target := fg
	info := guiThreadInfo{CbSize: uint32(unsafe.Sizeof(guiThreadInfo{}))}
	if ok, _, _ := procGetGUIThreadInfo.Call(tid, uintptr(unsafe.Pointer(&info))); ok != 0 && info.HwndFocus != 0 {
		target = info.HwndFocus
	}

	ime, _, _ := procImmGetDefaultIMEWnd.Call(target)
	if ime == 0 {
		return
	}
	var result uintptr
	procSendMessageTimeoutW.Call(ime, wmIMEControl, imcSetOpen, open,
		smtoAbortIfHung, 500, uintptr(unsafe.Pointer(&result)))
}

func windowProc(hwnd uintptr, message uint32, wParam, lParam uintptr) uintptr {
	switch message {
	case wmSetIME:
		setIME(wParam)
		return 0
	}
	r, _, _ := procDefWindowProcW.Call(hwnd, uintptr(message), wParam, lParam)
	return r
}

// createMessageWindow creates a hidden message-only window that receives the IME
// requests from the hook.
func createMessageWindow() uintptr {
	instance, _, _ := procGetModuleHandleW.Call(0)
	name, _ := syscall.UTF16PtrFromString(className)
	wc := wndClassEx{
		LpfnWndProc:   syscall.NewCallback(windowProc),
		HInstance:     instance,
		LpszClassName: name,
	}
	wc.CbSize = uint32(unsafe.Sizeof(wc))
	procRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc)))
	hwnd, _, _ := procCreateWindowExW.Call(0, uintptr(unsafe.Pointer(name)), 0, 0,
		0, 0, 0, 0, hwndMessage, 0, instance, 0)
	return hwnd
}
