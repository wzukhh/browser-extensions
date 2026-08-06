package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"sync/atomic"
	"time"

	ole "github.com/go-ole/go-ole"
	"github.com/go-ole/go-ole/oleutil"
)

// ConversionTask describes a single file to convert.
type ConversionTask struct {
	InputPath  string
	OutputPath string
	FileName   string
}

// ConversionResult holds the outcome for one file.
type ConversionResult struct {
	FileName   string `json:"fileName"`
	InputPath  string `json:"inputPath"`
	OutputPath string `json:"outputPath,omitempty"`
	Success    bool   `json:"success"`
	Error      string `json:"error,omitempty"`
	InputSize  int64  `json:"inputSize,omitempty"`
	OutputSize int64  `json:"outputSize,omitempty"`
}

// ProgressEvent is sent via SSE during conversion.
type ProgressEvent struct {
	Current    int    `json:"current"`
	Total      int    `json:"total"`
	FileName   string `json:"fileName"`
	Status     string `json:"status"` // "converting", "success", "failed", "complete", "aborted"
	Output     string `json:"output,omitempty"`
	Error      string `json:"error,omitempty"`
	InputSize  int64  `json:"inputSize,omitempty"`
	OutputSize int64  `json:"outputSize,omitempty"`
	Duration   string `json:"duration,omitempty"` // per-file conversion time
}

// ConvertJob holds all parameters for one batch conversion.
type ConvertJob struct {
	Files  []ConversionTask
	Output string
	// Callback is invoked for each progress event.
	Callback func(ProgressEvent)
	// StopFlag signals the worker to abort early.
	StopFlag *atomic.Bool
}

// Converter manages the Office COM lifecycle.
type Converter struct {
	office *OfficeInfo
}

// NewConverter creates a Converter bound to the detected Office application.
func NewConverter(office *OfficeInfo) *Converter {
	return &Converter{office: office}
}

// Run processes a batch of files. It must be called from a goroutine
// where COM has been initialized with CoInitializeEx.
func (c *Converter) Run(job ConvertJob) {
	total := len(job.Files)
	if total == 0 {
		return
	}

	var appDisp *ole.IDispatch
	var err error

	// Create the initial Office Application instance.
	appDisp, err = c.startApp()
	if err != nil {
		for j := 0; j < total; j++ {
			job.Callback(ProgressEvent{
				Current: j + 1, Total: total,
				FileName: job.Files[j].FileName,
				Status:   "failed",
				Error:    err.Error(),
			})
		}
		sendComplete(job, total, 0, total, time.Since(time.Now()))
		return
	}

	// Snapshot existing Office PIDs before we start, so we can later
	// kill any orphan processes we spawned ourselves.
	beforePIDs := snapshotOfficePIDs()

	successCount := 0
	failCount := 0
	startTime := time.Now()

	defer func() {
		c.quitApp(appDisp)
		killNewOfficeProcs(beforePIDs)
	}()

	// Main processing loop.
	for i, task := range job.Files {
		// Check abort flag.
		if job.StopFlag != nil && job.StopFlag.Load() {
			job.Callback(ProgressEvent{
				Current: i, Total: total,
				FileName: task.FileName, Status: "aborted",
			})
			return
		}

		result := c.convertOne(appDisp, task, i, total, job.Callback, job.StopFlag)
		if result.Success {
			successCount++
		} else {
			failCount++
		}
	}

	elapsed := time.Since(startTime)
	sendComplete(job, total, successCount, failCount, elapsed)
}

func sendComplete(job ConvertJob, total, successCount, failCount int, elapsed time.Duration) {
	summary := fmt.Sprintf("成功=%d 失败=%d 耗时=%s", successCount, failCount, elapsed.Round(time.Second).String())
	job.Callback(ProgressEvent{
		Current:  total,
		Total:    total,
		Status:   "complete",
		FileName: summary,
	})
	log.Printf("转换完成: %s", summary)
}

func (c *Converter) startApp() (*ole.IDispatch, error) {
	unknown, err := oleutil.CreateObject(c.office.ProgID)
	if err != nil {
		return nil, fmt.Errorf("无法创建 %s 对象: %w", c.office.App, err)
	}
	disp, err := unknown.QueryInterface(ole.IID_IDispatch)
	unknown.Release()
	if err != nil {
		return nil, fmt.Errorf("无法获取 %s COM 接口: %w", c.office.App, err)
	}

	if err := putCOMProperty(disp, "Visible", false); err != nil {
		disp.Release()
		return nil, err
	}
	if err := putCOMProperty(disp, "DisplayAlerts", 0); err != nil {
		disp.Release()
		return nil, err
	}
	return disp, nil
}

func putCOMProperty(disp *ole.IDispatch, name string, params ...interface{}) error {
	result, err := oleutil.PutProperty(disp, name, params...)
	if result != nil {
		result.Clear()
	}
	if err != nil {
		return fmt.Errorf("设置 Office 属性 %s 失败: %w", name, err)
	}
	return nil
}

func (c *Converter) quitApp(appDisp *ole.IDispatch) {
	if appDisp != nil {
		oleutil.CallMethod(appDisp, "Quit")
		appDisp.Release()
	}
	for i := 0; i < 3; i++ {
		runtime.GC()
		runtime.Gosched()
	}
}

func (c *Converter) convertOne(app *ole.IDispatch, task ConversionTask, index, total int, cb func(ProgressEvent), stop *atomic.Bool) ConversionResult {
	fileStart := time.Now()

	// Send "converting" event.
	cb(ProgressEvent{
		Current:  index + 1,
		Total:    total,
		FileName: task.FileName,
		Status:   "converting",
	})

	inputSize := int64(0)
	if fi, err := os.Stat(task.InputPath); err == nil {
		inputSize = fi.Size()
	}

	result := ConversionResult{
		FileName:  task.FileName,
		InputPath: task.InputPath,
		InputSize: inputSize,
	}

	// Ensure output directory exists.
	outputDir := filepath.Dir(task.OutputPath)
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		cb(makeProgressEvent(index, total, task.FileName, "failed", err.Error(), inputSize, 0, fileStart))
		result.Error = err.Error()
		return result
	}

	// Get Documents collection (holds one COM reference via VARIANT).
	docsVar, err := oleutil.GetProperty(app, "Documents")
	if err != nil {
		cb(makeProgressEvent(index, total, task.FileName, "failed", err.Error(), inputSize, 0, fileStart))
		result.Error = err.Error()
		return result
	}
	defer docsVar.Clear()

	// Open document.  docsVar.ToIDispatch() shares docsVar's ref — no AddRef needed.
	// The returned docVar gets its own COM reference.
	docVar, err := oleutil.CallMethod(docsVar.ToIDispatch(), "Open", task.InputPath, false, true, false)
	if err != nil {
		cb(makeProgressEvent(index, total, task.FileName, "failed", err.Error(), inputSize, 0, fileStart))
		result.Error = err.Error()
		return result
	}
	defer docVar.Clear()

	doc := docVar.ToIDispatch()

	// Export to PDF (17 = wdFormatPDF).
	_, exportErr := oleutil.CallMethod(doc, "ExportAsFixedFormat", task.OutputPath, 17)

	// Close document (0 = wdDoNotSaveChanges).
	oleutil.CallMethod(doc, "Close", 0)

	if exportErr != nil {
		// Win8.1 compatibility: sometimes ExportAsFixedFormat throws but the
		// file is actually created. Wait briefly and check.
		time.Sleep(500 * time.Millisecond)
		if _, statErr := os.Stat(task.OutputPath); statErr == nil {
			exportErr = nil
		}
	}

	outputSize := int64(0)
	if exportErr == nil {
		if fi, err := os.Stat(task.OutputPath); err == nil {
			outputSize = fi.Size()
		}
	}

	if exportErr != nil {
		result.Success = false
		result.Error = fmt.Sprintf("导出 PDF 失败: %v", exportErr)
		cb(makeProgressEvent(index, total, task.FileName, "failed", result.Error, inputSize, outputSize, fileStart))
	} else {
		result.Success = true
		result.OutputPath = task.OutputPath
		result.OutputSize = outputSize
		cb(makeProgressEvent(index, total, task.FileName, "success", "", inputSize, outputSize, fileStart))
	}

	return result
}

func makeProgressEvent(index, total int, fileName, status, errMsg string, inputSize, outputSize int64, startTime time.Time) ProgressEvent {
	evt := ProgressEvent{
		Current:    index + 1,
		Total:      total,
		FileName:   fileName,
		Status:     status,
		InputSize:  inputSize,
		OutputSize: outputSize,
		Duration:   time.Since(startTime).Round(time.Millisecond * 100).String(),
	}
	if status == "failed" {
		evt.Error = errMsg
	}
	if status == "success" {
		evt.Output = fileName
	}
	return evt
}
