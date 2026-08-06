//go:build !windows

package main

func snapshotOfficePIDs() map[uint32]bool {
	return map[uint32]bool{}
}

func killNewOfficeProcs(before map[uint32]bool) {}

func isOfficeProc(name string) bool {
	return false
}
