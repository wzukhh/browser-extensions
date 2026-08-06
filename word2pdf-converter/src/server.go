package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
)

// SSEEvent is pushed to all connected SSE clients.
type SSEEvent struct {
	Type string      `json:"-"`
	Data interface{} `json:"data"`
}

// SSEHub manages connected SSE clients.
type SSEHub struct {
	mu      sync.RWMutex
	clients map[chan SSEEvent]struct{}
}

func newSSEHub() *SSEHub {
	return &SSEHub{clients: make(map[chan SSEEvent]struct{})}
}

func (h *SSEHub) Subscribe() chan SSEEvent {
	ch := make(chan SSEEvent, 64)
	h.mu.Lock()
	h.clients[ch] = struct{}{}
	h.mu.Unlock()
	return ch
}

func (h *SSEHub) Unsubscribe(ch chan SSEEvent) {
	h.mu.Lock()
	delete(h.clients, ch)
	h.mu.Unlock()
}

func (h *SSEHub) Broadcast(evt SSEEvent) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for ch := range h.clients {
		select {
		case ch <- evt:
		default:
			// Drop for slow clients.
		}
	}
}

// Server wraps the embedded HTTP server.
type Server struct {
	listener   net.Listener
	hub        *SSEHub
	office     *OfficeInfo
	done       chan struct{}
	selfOrigin string
	token      string
	idleReset  chan struct{}

	stopFlag   atomic.Bool
	mu         sync.Mutex
	converting bool

	mux *http.ServeMux
}

func NewServer(office *OfficeInfo) *Server {
	tokenBytes := make([]byte, 16)
	if _, err := io.ReadFull(rand.Reader, tokenBytes); err != nil {
		panic(fmt.Sprintf("生成会话 token 失败: %v", err))
	}

	s := &Server{
		hub:       newSSEHub(),
		office:    office,
		done:      make(chan struct{}),
		token:     hex.EncodeToString(tokenBytes),
		idleReset: make(chan struct{}, 1),
	}
	s.mux = http.NewServeMux()
	s.mux.Handle("/", webFileServer())
	s.mux.HandleFunc("/api/status", s.auth(s.handleStatus))
	s.mux.HandleFunc("/api/browse-folder", s.authWrite(s.handleBrowseFolder))
	s.mux.HandleFunc("/api/list-docs", s.authWrite(s.handleListDocs))
	s.mux.HandleFunc("/api/convert", s.authWrite(s.handleConvert))
	s.mux.HandleFunc("/api/stop", s.authWrite(s.handleStop))
	s.mux.HandleFunc("/api/open-folder", s.authWrite(s.handleOpenFolder))
	return s
}

func (s *Server) Start() (int, error) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, fmt.Errorf("bind failed: %w", err)
	}
	s.listener = l
	s.selfOrigin = fmt.Sprintf("http://127.0.0.1:%d", l.Addr().(*net.TCPAddr).Port)

	go func() {
		log.Printf("HTTP server started on %s", s.selfOrigin)
		if err := http.Serve(l, s.mux); err != nil && err != http.ErrServerClosed {
			log.Printf("HTTP server error: %v", err)
		}
		close(s.done)
	}()

	// Start idle countdown from server boot.
	s.bumpIdle()
	return l.Addr().(*net.TCPAddr).Port, nil
}

func (s *Server) Stop() {
	s.stopFlag.Store(true)
	if s.listener != nil {
		s.listener.Close()
	}
}

func (s *Server) beginConversion() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.converting {
		return false
	}
	s.converting = true
	s.stopFlag.Store(false)
	return true
}

func (s *Server) endConversion() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.converting = false
	s.stopFlag.Store(true)
}

func (s *Server) Done() <-chan struct{} {
	return s.done
}

// AccessURL returns the web UI URL including the session token.
func (s *Server) AccessURL() string {
	return fmt.Sprintf("%s/?token=%s", s.selfOrigin, s.token)
}

// IdleReset returns a channel that signals on authenticated API activity.
func (s *Server) IdleReset() <-chan struct{} {
	return s.idleReset
}

func (s *Server) bumpIdle() {
	select {
	case s.idleReset <- struct{}{}:
	default:
	}
}

func (s *Server) checkToken(r *http.Request) bool {
	token := ""
	if auth := r.Header.Get("Authorization"); len(auth) > 7 && auth[:7] == "Bearer " {
		token = auth[7:]
	}
	if token == "" {
		token = r.URL.Query().Get("token")
	}
	return token == s.token
}

// auth protects read-only API endpoints (token only).
func (s *Server) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.checkToken(r) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		s.bumpIdle()
		next(w, r)
	}
}

// authWrite protects state-changing endpoints (token + same-origin).
func (s *Server) authWrite(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.checkToken(r) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		if !s.isSameOrigin(r) {
			http.Error(w, "rejected cross-origin request", http.StatusForbidden)
			return
		}
		s.bumpIdle()
		next(w, r)
	}
}

// --- Handlers ---

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "GET required", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, http.StatusOK, s.office)
}

func (s *Server) handleBrowseFolder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST required", http.StatusMethodNotAllowed)
		return
	}

	path, err := pickFolderNative()
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}
	path = filepath.Clean(path)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"path":    path,
	})
}

func (s *Server) handleListDocs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST required", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Folder string `json:"folder"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "无效请求"})
		return
	}

	folder, err := validateLocalPath(req.Folder)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": false, "error": err.Error(),
		})
		return
	}
	files, err := listWordFiles(folder)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"files":   files,
	})
}

func (s *Server) handleConvert(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST required", http.StatusMethodNotAllowed)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}

	var req struct {
		Source string   `json:"source"`
		Output string   `json:"output"`
		Files  []string `json:"files"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "无效请求"})
		return
	}
	if req.Source == "" || req.Output == "" || len(req.Files) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "source、output 和 files 不能为空"})
		return
	}

	source, err := validateLocalPath(req.Source)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": false, "error": err.Error(),
		})
		return
	}
	output, err := validateLocalPath(req.Output)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": false, "error": err.Error(),
		})
		return
	}

	if !s.beginConversion() {
		http.Error(w, "已有转换任务进行中", http.StatusConflict)
		return
	}

	tasks, err := buildConversionTasks(source, output, req.Files)
	if err != nil {
		s.endConversion()
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": false, "error": err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	ch := s.hub.Subscribe()
	defer s.hub.Unsubscribe(ch)

	done := make(chan struct{})
	converter := NewConverter(s.office)
	go func() {
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()

		initCOMThread()
		defer uninitCOMThread()

		defer s.endConversion()
		defer close(done)
		converter.Run(ConvertJob{
			Files:  tasks,
			Output: output,
			Callback: func(evt ProgressEvent) {
				s.hub.Broadcast(SSEEvent{Type: "progress", Data: evt})
			},
			StopFlag: &s.stopFlag,
		})
	}()

	for {
		select {
		case evt := <-ch:
			s.bumpIdle()
			data, _ := json.Marshal(evt.Data)
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", evt.Type, data)
			flusher.Flush()

			if p, ok := evt.Data.(ProgressEvent); ok && (p.Status == "complete" || p.Status == "aborted") {
				return
			}
		case <-done:
			return
		case <-r.Context().Done():
			return
		}
	}
}

func (s *Server) handleStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST required", http.StatusMethodNotAllowed)
		return
	}
	s.stopFlag.Store(true)
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (s *Server) handleOpenFolder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST required", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Path == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "path required"})
		return
	}

	cleanPath, err := validateLocalPath(req.Path)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": false, "error": err.Error(),
		})
		return
	}
	if len(cleanPath) >= 2 && cleanPath[0] == '\\' && cleanPath[1] == '\\' {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": false, "error": "不支持网络路径",
		})
		return
	}
	if err := openFolderInShell(cleanPath); err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": false, "error": err.Error(),
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func buildConversionTasks(source, output string, fileNames []string) ([]ConversionTask, error) {
	allFiles, err := listWordFiles(source)
	if err != nil {
		return nil, err
	}
	fileMap := make(map[string]FileInfo, len(allFiles))
	for _, f := range allFiles {
		fileMap[f.Name] = f
	}

	tasks := make([]ConversionTask, 0, len(fileNames))
	for _, name := range fileNames {
		if err := validateWordFileName(name); err != nil {
			return nil, fmt.Errorf("无效文件名 %q: %w", name, err)
		}
		f, ok := fileMap[name]
		if !ok {
			return nil, fmt.Errorf("文件不在源文件夹中: %s", name)
		}
		tasks = append(tasks, ConversionTask{
			InputPath:  f.Path,
			OutputPath: filepath.Join(output, f.BaseName+".pdf"),
			FileName:   f.Name,
		})
	}
	if len(tasks) == 0 {
		return nil, fmt.Errorf("没有可转换的文件")
	}
	return tasks, nil
}

func validateWordFileName(name string) error {
	if name == "" || name != filepath.Base(name) {
		return fmt.Errorf("文件名不合法")
	}
	if strings.Contains(name, "..") {
		return fmt.Errorf("文件名不合法")
	}
	ext := strings.ToLower(filepath.Ext(name))
	if ext != ".doc" && ext != ".docx" {
		return fmt.Errorf("仅支持 .doc / .docx")
	}
	return nil
}

// isSameOrigin checks that the request originates from our own web UI.
func (s *Server) isSameOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		referer := r.Header.Get("Referer")
		if referer == "" {
			return false
		}
		return hasPrefixHost(referer, s.selfOrigin)
	}
	return origin == s.selfOrigin
}

// hasPrefixHost checks whether rawURL starts with scheme://host (ignoring path).
func hasPrefixHost(rawURL, schemeHost string) bool {
	n := len(schemeHost)
	if len(rawURL) < n {
		return false
	}
	if rawURL[:n] != schemeHost {
		return false
	}
	return len(rawURL) == n || rawURL[n] == '/' || rawURL[n] == '?'
}

// validateLocalPath resolves a user-supplied path to an absolute form
// and rejects traversal attempts.  The server binds only 127.0.0.1, so
// this guards against other apps on the same machine.
func validateLocalPath(path string) (string, error) {
	clean := filepath.Clean(path)
	if clean != path {
		return "", fmt.Errorf("路径不规范（包含不必要的 . 或 ..）")
	}
	if containsDotDot(clean) {
		return "", fmt.Errorf("路径包含 .. 跳转")
	}
	abs, err := filepath.Abs(clean)
	if err != nil {
		return "", fmt.Errorf("无法解析路径: %w", err)
	}
	real, err := filepath.EvalSymlinks(abs)
	if err != nil {
		real = abs
	}
	if len(real) <= 3 {
		return "", fmt.Errorf("不支持驱动器根目录")
	}
	return real, nil
}

func containsDotDot(p string) bool {
	for i := 0; i < len(p); i++ {
		if p[i] == '.' && i+1 < len(p) && p[i+1] == '.' {
			sep := false
			if i == 0 || p[i-1] == '/' || p[i-1] == '\\' {
				sep = true
			}
			if sep && (i+2 >= len(p) || p[i+2] == '/' || p[i+2] == '\\') {
				return true
			}
		}
	}
	return false
}

type FileInfo struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	BaseName string `json:"baseName"`
	Size     int64  `json:"size"`
}

func listWordFiles(folder string) ([]FileInfo, error) {
	info, err := os.Stat(folder)
	if err != nil {
		return nil, fmt.Errorf("文件夹不存在: %w", err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("路径不是文件夹")
	}

	entries, err := os.ReadDir(folder)
	if err != nil {
		return nil, fmt.Errorf("读取文件夹失败: %w", err)
	}

	var files []FileInfo
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		ext := strings.ToLower(filepath.Ext(e.Name()))
		if ext != ".doc" && ext != ".docx" {
			continue
		}
		fi, err := e.Info()
		if err != nil {
			continue
		}
		files = append(files, FileInfo{
			Name:     e.Name(),
			Path:     filepath.Join(folder, e.Name()),
			BaseName: fi.Name()[:len(fi.Name())-len(ext)],
			Size:     fi.Size(),
		})
	}
	return files, nil
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
