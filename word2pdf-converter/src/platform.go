package main

import (
	"fmt"
	"log"
	"os/exec"

	ole "github.com/go-ole/go-ole"
	"github.com/go-ole/go-ole/oleutil"
)

func initCOMThread() {
	if err := ole.CoInitializeEx(0, ole.COINIT_APARTMENTTHREADED); err != nil {
		log.Printf("COM init on worker thread: %v", err)
	}
}

func uninitCOMThread() {
	ole.CoUninitialize()
}

// pickFolderNative opens the Windows native folder picker via Shell.Application.
func pickFolderNative() (string, error) {
	if err := ole.CoInitializeEx(0, ole.COINIT_APARTMENTTHREADED); err != nil {
		return "", fmt.Errorf("COM 初始化失败: %w", err)
	}
	defer ole.CoUninitialize()

	unknown, err := oleutil.CreateObject("Shell.Application")
	if err != nil {
		return "", fmt.Errorf("无法创建 Shell.Application: %w", err)
	}
	defer unknown.Release()

	shell, err := unknown.QueryInterface(ole.IID_IDispatch)
	if err != nil {
		return "", fmt.Errorf("无法获取 Shell.Application COM 接口: %w", err)
	}
	defer shell.Release()

	result, err := oleutil.CallMethod(shell, "BrowseForFolder", 0, "请选择文件夹", 0x0011, 0)
	if err != nil {
		return "", fmt.Errorf("打开文件夹选择器失败: %w", err)
	}
	if result == nil {
		return "", fmt.Errorf("用户取消了选择")
	}
	defer result.Clear()

	folder := result.ToIDispatch()
	if folder == nil {
		return "", fmt.Errorf("用户取消了选择")
	}

	selfVar, err := oleutil.GetProperty(folder, "Self")
	if err != nil {
		return "", fmt.Errorf("读取文件夹信息失败: %w", err)
	}
	defer selfVar.Clear()

	self := selfVar.ToIDispatch()
	if self == nil {
		return "", fmt.Errorf("读取文件夹信息失败")
	}

	pathVar, err := oleutil.GetProperty(self, "Path")
	if err != nil {
		return "", fmt.Errorf("读取文件夹路径失败: %w", err)
	}
	defer pathVar.Clear()

	path := pathVar.ToString()
	return path, nil
}

// openFolderInShell opens the given path in Windows Explorer.
func openFolderInShell(path string) error {
	return exec.Command("explorer", "/select,", path).Start()
}
