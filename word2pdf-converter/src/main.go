package main

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	ole "github.com/go-ole/go-ole"
)

const idleTimeout = 10 * time.Minute

// nativeMessage is the protocol frame between extension and native host.
type nativeMessage struct {
	Type string `json:"type"`
}

func main() {
	log.SetFlags(0)
	log.SetPrefix("")

	initCOM()
	defer uninitCOM()

	data, err := readNativeMessage(os.Stdin)
	if err != nil {
		writeNativeError(fmt.Sprintf("读取消息失败: %v", err))
		os.Exit(1)
	}

	var msg nativeMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		writeNativeError(fmt.Sprintf("解析消息失败: %v", err))
		os.Exit(1)
	}
	if msg.Type != "start-converter" {
		writeNativeError(fmt.Sprintf("未知消息类型: %s", msg.Type))
		os.Exit(1)
	}

	beforePIDs := snapshotOfficePIDs()
	officeInfo := DetectOffice()
	if !officeInfo.Available {
		writeNativeMessage(map[string]interface{}{
			"type":   "converter-started",
			"url":    "",
			"office": officeInfo,
		})
		log.Println("未检测到 Office 或 WPS")
		waitForSignal()
		os.Exit(0)
	}
	log.Printf("检测到: %s (ProgID: %s)", officeInfo.App, officeInfo.ProgID)

	server := NewServer(officeInfo)
	if _, err := server.Start(); err != nil {
		writeNativeError(fmt.Sprintf("启动服务器失败: %v", err))
		os.Exit(1)
	}

	writeNativeMessage(map[string]interface{}{
		"type":   "converter-started",
		"url":    server.AccessURL(),
		"office": officeInfo,
	})

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	stopCh := make(chan struct{})
	go func() {
		for {
			data, err := readNativeMessage(os.Stdin)
			if err != nil {
				close(stopCh)
				return
			}
			var msg nativeMessage
			if json.Unmarshal(data, &msg) == nil && msg.Type == "stop" {
				close(stopCh)
				return
			}
		}
	}()

	idleStop := make(chan struct{})
	shutdown := make(chan struct{})
	go watchIdle(server.IdleReset(), idleTimeout, shutdown, idleStop)

	select {
	case <-sigCh:
	case <-stopCh:
	case <-idleStop:
		log.Println("空闲超时（10 分钟无操作），自动退出")
	}
	close(shutdown)

	log.Println("正在关闭...")
	server.Stop()
	killNewOfficeProcs(beforePIDs)
}

// watchIdle exits when no authenticated API activity occurs within timeout.
func watchIdle(idleReset <-chan struct{}, timeout time.Duration, shutdown <-chan struct{}, idleStop chan struct{}) {
	timer := time.NewTimer(timeout)
	defer timer.Stop()

	for {
		select {
		case <-shutdown:
			return
		case <-idleReset:
			if !timer.Stop() {
				select {
				case <-timer.C:
				default:
				}
			}
			timer.Reset(timeout)
		case <-timer.C:
			close(idleStop)
			return
		}
	}
}

func readNativeMessage(r io.Reader) ([]byte, error) {
	var length uint32
	if err := binary.Read(r, binary.LittleEndian, &length); err != nil {
		return nil, err
	}
	if length > 1024*1024 {
		return nil, fmt.Errorf("消息超长: %d", length)
	}
	data := make([]byte, length)
	if _, err := io.ReadFull(r, data); err != nil {
		return nil, err
	}
	return data, nil
}

func writeNativeMessage(v interface{}) {
	data, err := json.Marshal(v)
	if err != nil {
		return
	}
	header := make([]byte, 4)
	binary.LittleEndian.PutUint32(header, uint32(len(data)))
	os.Stdout.Write(header)
	os.Stdout.Write(data)
}

func writeNativeError(msg string) {
	writeNativeMessage(map[string]string{"type": "error", "message": msg})
}

func waitForSignal() {
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	stopCh := make(chan struct{})
	go func() {
		readNativeMessage(os.Stdin)
		close(stopCh)
	}()

	select {
	case <-sigCh:
	case <-stopCh:
	}
}

func initCOM() {
	if err := ole.CoInitializeEx(0, ole.COINIT_APARTMENTTHREADED); err != nil {
		if err.Error() != "The COM apartment has already been initialized" {
			writeNativeError(fmt.Sprintf("COM 初始化失败: %v", err))
			os.Exit(1)
		}
	}
}

func uninitCOM() {
	ole.CoUninitialize()
}
