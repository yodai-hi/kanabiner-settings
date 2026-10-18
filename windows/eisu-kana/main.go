//go:build windows

// Eisu Kana: Mac-style 英数 / かな for Windows. Home = IME off, End = IME on.
//
// Karabiner-Elements on the Mac sends Home / End when Command is tapped alone.
// This resident app swallows those keys (only when no modifier is held) and sets
// the IME open status of the focused control directly, which also works in
// Chromium-based apps (new Teams / WebView2) where key-based toggling does not.
//
//	eisu-kana.exe              start (and register to run at sign-in)
//	eisu-kana.exe --uninstall  stop and unregister
package main

import (
	"os"
	"runtime"
	"syscall"
	"unsafe"
)

const (
	appName   = "Eisu Kana"
	className = "EisuKanaMessageWindow"
	runKey    = `Software\Microsoft\Windows\CurrentVersion\Run`

	whKeyboardLL = 13
	wmKeyDown    = 0x0100
	wmKeyUp      = 0x0101
	wmSysKeyDown = 0x0104
	wmSysKeyUp   = 0x0105
	wmClose      = 0x0010
	wmDestroy    = 0x0002
	wmApp        = 0x8000
	wmSetIME     = wmApp + 1
	wmIMEControl = 0x0283
	imcSetOpen   = 0x0006

	vkEnd     = 0x23
	vkHome    = 0x24
	vkShift   = 0x10
	vkControl = 0x11
	vkMenu    = 0x12
	vkLWin    = 0x5B
	vkRWin    = 0x5C

	hkeyCurrentUser   = 0x80000001
	keySetValue       = 0x0002
	regSZ             = 1
	errorAlreadyExist = 183
	smtoAbortIfHung   = 0x0002
)

var hwndMessage = ^uintptr(2) // HWND_MESSAGE = (HWND)-3

var (
	user32   = syscall.NewLazyDLL("user32.dll")
	kernel32 = syscall.NewLazyDLL("kernel32.dll")
	imm32    = syscall.NewLazyDLL("imm32.dll")
	advapi32 = syscall.NewLazyDLL("advapi32.dll")

	procSetWindowsHookExW     = user32.NewProc("SetWindowsHookExW")
	procCallNextHookEx        = user32.NewProc("CallNextHookEx")
	procGetAsyncKeyState      = user32.NewProc("GetAsyncKeyState")
	procGetMessageW           = user32.NewProc("GetMessageW")
	procDispatchMessageW      = user32.NewProc("DispatchMessageW")
	procRegisterClassExW      = user32.NewProc("RegisterClassExW")
	procCreateWindowExW       = user32.NewProc("CreateWindowExW")
	procDefWindowProcW        = user32.NewProc("DefWindowProcW")
	procDestroyWindow         = user32.NewProc("DestroyWindow")
	procPostQuitMessage       = user32.NewProc("PostQuitMessage")
	procPostMessageW          = user32.NewProc("PostMessageW")
	procFindWindowExW         = user32.NewProc("FindWindowExW")
	procGetForegroundWindow   = user32.NewProc("GetForegroundWindow")
	procGetWindowThreadProcId = user32.NewProc("GetWindowThreadProcessId")
	procGetGUIThreadInfo      = user32.NewProc("GetGUIThreadInfo")
	procSendMessageTimeoutW   = user32.NewProc("SendMessageTimeoutW")
	procCreateMutexW          = kernel32.NewProc("CreateMutexW")
	procGetModuleHandleW      = kernel32.NewProc("GetModuleHandleW")
	procImmGetDefaultIMEWnd   = imm32.NewProc("ImmGetDefaultIMEWnd")
	procRegCreateKeyExW       = advapi32.NewProc("RegCreateKeyExW")
	procRegSetValueExW        = advapi32.NewProc("RegSetValueExW")
	procRegDeleteKeyValueW    = advapi32.NewProc("RegDeleteKeyValueW")
	procRegCloseKey           = advapi32.NewProc("RegCloseKey")
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

	if len(os.Args) > 1 && os.Args[1] == "--uninstall" {
		unregisterStartup()
		stopRunningInstance()
		return
	}

	mutexName, _ := syscall.UTF16PtrFromString(`Local\` + className)
	if _, _, err := procCreateMutexW.Call(0, 0, uintptr(unsafe.Pointer(mutexName))); err == syscall.Errno(errorAlreadyExist) {
		return // already running
	}

	registerStartup() // also refreshes the path if the exe was moved
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
		if k.VkCode == vkHome || k.VkCode == vkEnd {
			switch wParam {
			case wmKeyDown, wmSysKeyDown:
				if !anyModifierDown() {
					swallowed[k.VkCode] = true
					open := uintptr(0)
					if k.VkCode == vkEnd {
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

func anyModifierDown() bool {
	for _, vk := range []uintptr{vkShift, vkControl, vkMenu, vkLWin, vkRWin} {
		if s, _, _ := procGetAsyncKeyState.Call(vk); s&0x8000 != 0 {
			return true
		}
	}
	return false
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
	case wmClose:
		procDestroyWindow.Call(hwnd)
		return 0
	case wmDestroy:
		procPostQuitMessage.Call(0)
		return 0
	}
	r, _, _ := procDefWindowProcW.Call(hwnd, uintptr(message), wParam, lParam)
	return r
}

// createMessageWindow creates a hidden message-only window. It receives the IME
// requests from the hook and lets `--uninstall` find and close this instance.
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

func stopRunningInstance() {
	name, _ := syscall.UTF16PtrFromString(className)
	if hwnd, _, _ := procFindWindowExW.Call(hwndMessage, 0, uintptr(unsafe.Pointer(name)), 0); hwnd != 0 {
		procPostMessageW.Call(hwnd, wmClose, 0, 0)
	}
}

// registerStartup adds this exe to HKCU\...\Run so it starts at sign-in.
func registerStartup() {
	exe, err := os.Executable()
	if err != nil {
		return
	}
	keyName, _ := syscall.UTF16PtrFromString(runKey)
	var key uintptr
	if r, _, _ := procRegCreateKeyExW.Call(hkeyCurrentUser, uintptr(unsafe.Pointer(keyName)),
		0, 0, 0, keySetValue, 0, uintptr(unsafe.Pointer(&key)), 0); r != 0 {
		return
	}
	defer procRegCloseKey.Call(key)

	valueName, _ := syscall.UTF16PtrFromString(appName)
	data, _ := syscall.UTF16FromString(`"` + exe + `"`)
	procRegSetValueExW.Call(key, uintptr(unsafe.Pointer(valueName)), 0, regSZ,
		uintptr(unsafe.Pointer(&data[0])), uintptr(len(data)*2))
}

func unregisterStartup() {
	keyName, _ := syscall.UTF16PtrFromString(runKey)
	valueName, _ := syscall.UTF16PtrFromString(appName)
	procRegDeleteKeyValueW.Call(hkeyCurrentUser, uintptr(unsafe.Pointer(keyName)), uintptr(unsafe.Pointer(valueName)))
}
