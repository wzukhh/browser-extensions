//go:build windows

package main

import (
	"log"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
)

func snapshotOfficePIDs() map[uint32]bool {
	pids := make(map[uint32]bool)
	handle, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return pids
	}
	defer windows.CloseHandle(handle)

	var entry windows.ProcessEntry32
	entry.Size = uint32(unsafe.Sizeof(entry))

	err = windows.Process32First(handle, &entry)
	for err == nil {
		name := windows.UTF16ToString(entry.ExeFile[:])
		if isOfficeProc(name) {
			pids[entry.ProcessID] = true
		}
		err = windows.Process32Next(handle, &entry)
	}
	return pids
}

func killNewOfficeProcs(before map[uint32]bool) {
	after := snapshotOfficePIDs()

	for pid := range after {
		if before[pid] {
			continue
		}
		handle, err := windows.OpenProcess(windows.PROCESS_TERMINATE, false, pid)
		if err != nil {
			continue
		}
		if err := windows.TerminateProcess(handle, 0); err == nil {
			log.Printf("Killed orphan office process PID %d", pid)
		}
		windows.CloseHandle(handle)
	}
}

func isOfficeProc(name string) bool {
	upper := strings.ToUpper(name)
	if upper == "WINWORD.EXE" {
		return true
	}
	return strings.Contains(upper, "WPS")
}
