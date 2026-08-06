package main

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	maxNativeMessageSize = 1024 * 1024 // 1 MB
	idleTimeout          = 10 * time.Minute
)

func readMessage() ([]byte, error) {
	var length uint32
	if err := binary.Read(os.Stdin, binary.LittleEndian, &length); err != nil {
		return nil, err
	}
	if length > maxNativeMessageSize {
		return nil, fmt.Errorf("消息超长: %d", length)
	}
	data := make([]byte, length)
	_, err := io.ReadFull(os.Stdin, data)
	return data, err
}

func writeMessage(v interface{}) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	length := uint32(len(data))
	if err := binary.Write(os.Stdout, binary.LittleEndian, length); err != nil {
		return err
	}
	_, err = os.Stdout.Write(data)
	return err
}

func getLANIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "127.0.0.1"
	}
	var fallback string
	for _, addr := range addrs {
		ipnet, ok := addr.(*net.IPNet)
		if !ok || ipnet.IP.To4() == nil || ipnet.IP.IsLoopback() {
			continue
		}
		ip := ipnet.IP.String()
		if len(ip) >= 7 && ip[:7] == "169.254" {
			continue
		}
		if strings.HasPrefix(ip, "192.168.") || strings.HasPrefix(ip, "10.") {
			return ip
		}
		if fallback == "" {
			fallback = ip
		}
	}
	if fallback != "" {
		return fallback
	}
	return "127.0.0.1"
}

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

// ─── Dev Mode (standalone HTTP server, no native messaging) ───────────

func standaloneServe() {
	listener, err := net.Listen("tcp", ":0")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to listen: %v\n", err)
		os.Exit(1)
	}

	port := listener.Addr().(*net.TCPAddr).Port
	ip := getLANIP()

	sessionDir, err := os.MkdirTemp("", "lan-transfer-*")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create temp dir: %v\n", err)
		os.Exit(1)
	}
	defer os.RemoveAll(sessionDir)

	fs, err := newFileServer(sessionDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize server: %v\n", err)
		os.Exit(1)
	}
	defer os.RemoveAll(fs.sentDir)
	go fs.start(listener)

	fmt.Printf("\n  📁 LAN File Transfer\n")
	fmt.Printf("  ─────────────────────\n")
	fmt.Printf("  PC:  http://localhost:%d/?token=%s\n", port, fs.token)
	fmt.Printf("  LAN: http://%s:%d/?token=%s\n", ip, port, fs.token)
	fmt.Printf("  QR:  http://%s:%d/?token=%s\n\n", ip, port, fs.token)
	fmt.Printf("  Press Ctrl+C to stop\n\n")

	select {}
}

// ─── Main ──────────────────────────────────────────────────────────────────

func main() {
	log.SetFlags(0)

	if len(os.Args) > 1 && os.Args[1] == "--serve" {
		standaloneServe()
		return
	}

	listener, err := net.Listen("tcp", ":0")
	if err != nil {
		writeMessage(map[string]string{"type": "error", "message": err.Error()})
		os.Exit(1)
	}

	port := listener.Addr().(*net.TCPAddr).Port
	ip := getLANIP()

	homeDir, err := os.UserHomeDir()
	if err != nil {
		writeMessage(map[string]string{"type": "error", "message": err.Error()})
		os.Exit(1)
	}
	sessionDir := filepath.Join(homeDir, "Downloads", "LAN Transfer")
	if err := os.MkdirAll(sessionDir, 0755); err != nil {
		writeMessage(map[string]string{"type": "error", "message": err.Error()})
		os.Exit(1)
	}

	fs, err := newFileServer(sessionDir)
	if err != nil {
		writeMessage(map[string]string{"type": "error", "message": err.Error()})
		os.Exit(1)
	}
	defer os.RemoveAll(fs.sentDir)
	go fs.start(listener)

	writeMessage(map[string]interface{}{
		"type":  "server-started",
		"port":  port,
		"ip":    ip,
		"token": fs.token,
		"url":   fmt.Sprintf("http://localhost:%d/?token=%s", port, fs.token),
	})

	idleStop := make(chan struct{})
	shutdown := make(chan struct{})
	go watchIdle(fs.IdleReset(), idleTimeout, shutdown, idleStop)

	msgChan := make(chan []byte, 1)
	go func() {
		for {
			data, err := readMessage()
			if err != nil {
				close(msgChan)
				return
			}
			msgChan <- data
		}
	}()

	done := false
	for !done {
		select {
		case data, ok := <-msgChan:
			if !ok {
				done = true
				break
			}
			var msg struct {
				Type string `json:"type"`
			}
			if err := json.Unmarshal(data, &msg); err != nil {
				continue
			}
			if msg.Type == "stop-server" {
				done = true
			}
		case <-idleStop:
			log.Println("空闲超时（10 分钟无操作），自动退出")
			done = true
		}
	}
	close(shutdown)
	listener.Close()
}
