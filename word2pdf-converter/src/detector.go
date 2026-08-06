package main

import (
	ole "github.com/go-ole/go-ole"
	"github.com/go-ole/go-ole/oleutil"
)

// OfficeInfo describes a detected Office application.
type OfficeInfo struct {
	Available bool   `json:"available"`
	App       string `json:"app"`    // "Microsoft Word" or "WPS Word"
	ProgID    string `json:"progId"` // e.g. "Word.Application"
	Path      string `json:"path"`   // installation path, "" if unavailable
}

type progIDEntry struct {
	ProgID string
	Name   string
}

var officeCandidates = []progIDEntry{
	{"Word.Application", "Microsoft Word"},
	{"Kwps.Application", "WPS Word"},
	{"Wps.Application", "WPS Word"},
}

// DetectOffice tries each COM ProgID in order and returns the first that succeeds.
func DetectOffice() *OfficeInfo {
	for _, c := range officeCandidates {
		unknown, err := oleutil.CreateObject(c.ProgID)
		if err != nil {
			continue
		}

		info := &OfficeInfo{
			Available: true,
			App:       c.Name,
			ProgID:    c.ProgID,
		}

		app, err := unknown.QueryInterface(ole.IID_IDispatch)
		if err != nil {
			unknown.Release()
			continue
		}
		if pathVar, err := oleutil.GetProperty(app, "Path"); err == nil {
			info.Path = pathVar.ToString()
			pathVar.Clear()
		}
		app.Release()
		unknown.Release()
		return info
	}
	return &OfficeInfo{Available: false}
}
