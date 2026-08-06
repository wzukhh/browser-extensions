package main

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	"embed"
)

//go:embed web/index.html web/style.css web/app.js web/qrcode.min.js
var webFS embed.FS

// ─── Types ─────────────────────────────────────────────────────────────────

type Device struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	IsPC     bool      `json:"isPC"`
	LastSeen time.Time `json:"lastSeen"`
	Secret   string    `json:"-"`
}

type FileInfo struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Size       int64     `json:"size"`
	ModTime    time.Time `json:"modTime"`
	UploadedBy string    `json:"uploadedBy"` // device ID
	SentTo     []string  `json:"sentTo"`     // target device IDs; nil = all devices
	Path       string    `json:"-"`          // actual on-disk location
}

type Event struct {
	Type    string      `json:"type"`
	Data    interface{} `json:"data"`
	Targets []string    `json:"-"` // nil = send to all subscribers
}

type subscriber struct {
	ch       chan Event
	deviceID string // empty = receive all events (PC admin view)
}

type FileServer struct {
	token      string
	sessionDir string
	sentDir    string // staging dir for PC→phone files (kept out of LAN Transfer folder)
	files      []FileInfo
	mu         sync.RWMutex
	subs       map[string]*subscriber
	subsMu     sync.Mutex
	devices    map[string]*Device
	devicesMu  sync.RWMutex
	pcDeviceID string
	sseConns   map[string]int
	sseConnsMu sync.Mutex
	idleReset  chan struct{}
}

// ─── Constructor ───────────────────────────────────────────────────────────

// sweepStaleSentDirs removes staging dirs left behind by sessions that were
// killed without a graceful shutdown (the defer in main.go misses SIGKILL).
// The OS temp cleaner handles them on reboot anyway; this keeps them from
// accumulating in the meantime.
func sweepStaleSentDirs(root string, olderThan time.Duration) {
	matches, err := filepath.Glob(filepath.Join(root, "lan-transfer-sent-*"))
	if err != nil {
		return
	}
	for _, m := range matches {
		fi, err := os.Stat(m)
		if err != nil || time.Since(fi.ModTime()) < olderThan {
			continue
		}
		os.RemoveAll(m)
	}
}

func newFileServer(sessionDir string) (*FileServer, error) {
	// Purge staging dirs from crashed sessions — run in the background so
	// startup is never blocked by cleanup of large leftovers
	go sweepStaleSentDirs(os.TempDir(), 24*time.Hour)

	token, err := randomHex(16)
	if err != nil {
		return nil, err
	}
	pcSecret, err := randomHex(16)
	if err != nil {
		return nil, err
	}

	pcID := "pc"

	sentDir, err := os.MkdirTemp("", "lan-transfer-sent-*")
	if err != nil {
		return nil, err
	}

	fs := &FileServer{
		token:      token,
		sessionDir: sessionDir,
		sentDir:    sentDir,
		subs:       make(map[string]*subscriber),
		devices:    make(map[string]*Device),
		pcDeviceID: pcID,
		sseConns:   make(map[string]int),
		idleReset:  make(chan struct{}, 1),
	}

	// Auto-create PC device
	fs.devices[pcID] = &Device{
		ID:       pcID,
		Name:     "电脑",
		IsPC:     true,
		LastSeen: time.Now(),
		Secret:   pcSecret,
	}

	fs.bumpIdle()
	return fs, nil
}

func (s *FileServer) IdleReset() <-chan struct{} {
	return s.idleReset
}

func (s *FileServer) bumpIdle() {
	select {
	case s.idleReset <- struct{}{}:
	default:
	}
}

// isLocalhost returns true when the request comes from the PC browser on this machine.
func isLocalhost(r *http.Request) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return false
	}
	return host == "127.0.0.1" || host == "::1"
}

func randomHex(byteLen int) (string, error) {
	b := make([]byte, byteLen)
	if _, err := io.ReadFull(rand.Reader, b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// ─── HTTP Server ──────────────────────────────────────────────────────────

func (s *FileServer) start(l net.Listener) {
	mux := http.NewServeMux()

	// Static files (CSS, JS)
	staticFS, _ := fs.Sub(webFS, "web")
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.FS(staticFS))))

	// Routes — main page is public, API is token-protected
	mux.HandleFunc("/", s.handleIndex)
	mux.HandleFunc("/api/info", s.auth(s.handleInfo))
	mux.HandleFunc("/api/device/register", s.auth(s.handleRegisterDevice))
	mux.HandleFunc("/api/device/list", s.auth(s.handleDeviceList))
	mux.HandleFunc("/api/files", s.auth(s.handleFiles))
	mux.HandleFunc("/api/upload", s.auth(s.handleUpload))
	mux.HandleFunc("/api/download/", s.auth(s.handleDownload))
	mux.HandleFunc("/api/delete/", s.auth(s.handleDelete))
	mux.HandleFunc("/api/events", s.auth(s.handleEvents))
	mux.HandleFunc("/api/open-save-path", s.auth(s.handleOpenSavePath))

	http.Serve(l, withCORS(mux))
}

// ─── Middleware ────────────────────────────────────────────────────────────

// Auth restricts API access to requests with the correct token.
func (s *FileServer) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := ""
		if auth := r.Header.Get("Authorization"); len(auth) > 7 && auth[:7] == "Bearer " {
			token = auth[7:]
		}
		if token == "" {
			token = r.URL.Query().Get("token")
		}
		if token != s.token {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		s.bumpIdle()
		next(w, r)
	}
}

// CORS allows any origin (LAN tool — any device on the network may connect).
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "*")
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ─── Helpers ──────────────────────────────────────────────────────────────

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

func generateUUID() (string, error) {
	return randomHex(16)
}

// TouchDevice updates LastSeen for a device (if it exists).
func (s *FileServer) touchDevice(id string) {
	s.devicesMu.RLock()
	d, ok := s.devices[id]
	s.devicesMu.RUnlock()
	if ok {
		s.devicesMu.Lock()
		d.LastSeen = time.Now()
		s.devicesMu.Unlock()
	}
}

func (s *FileServer) validateDeviceCredentials(deviceID, secret string) bool {
	if deviceID == "" || secret == "" {
		return false
	}
	s.devicesMu.RLock()
	d, ok := s.devices[deviceID]
	s.devicesMu.RUnlock()
	if !ok || d.Secret == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(d.Secret), []byte(secret)) == 1
}

func (s *FileServer) requireDeviceAccess(w http.ResponseWriter, r *http.Request) (string, bool) {
	deviceID := r.URL.Query().Get("deviceId")
	if deviceID == "" {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return "", false
	}
	if deviceID == s.pcDeviceID && isLocalhost(r) {
		return deviceID, true
	}
	if !s.validateDeviceCredentials(deviceID, r.URL.Query().Get("deviceSecret")) {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return "", false
	}
	return deviceID, true
}

func fileVisibleToDevice(f FileInfo, deviceID string) bool {
	return f.UploadedBy == deviceID || len(f.SentTo) == 0 || contains(f.SentTo, deviceID)
}

func createUniqueUploadFile(dir, name string) (*os.File, string, error) {
	for i := 0; ; i++ {
		candidateName := name
		if i > 0 {
			ext := filepath.Ext(name)
			base := name[:len(name)-len(ext)]
			candidateName = fmt.Sprintf("%s(%d)%s", base, i, ext)
		}
		path := filepath.Join(dir, candidateName)
		file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
		if os.IsExist(err) {
			continue
		}
		return file, path, err
	}
}

// findFileForDevice returns the file with the given name for a requester,
// preferring the requester's own upload (PC-sent and phone-uploaded files can
// share a name but live in different directories). Falls back to the most
// recently added match.
func (s *FileServer) findFileForDevice(name, deviceID string) (FileInfo, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var match *FileInfo
	for i := range s.files {
		f := &s.files[i]
		if f.Name != name {
			continue
		}
		if f.UploadedBy == deviceID {
			return *f, true
		}
		match = f
	}
	if match != nil {
		return *match, true
	}
	return FileInfo{}, false
}

// ─── Handlers: Device ─────────────────────────────────────────────────────

func (s *FileServer) handleRegisterDevice(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		DeviceID     string `json:"deviceId"`
		DeviceSecret string `json:"deviceSecret"`
		Name         string `json:"name"`
		IsPC         bool   `json:"isPC"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	if req.IsPC && !isLocalhost(r) {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	// Determine device ID
	deviceID := req.DeviceID
	if req.IsPC {
		deviceID = s.pcDeviceID
	} else if deviceID == "" {
		generatedID, err := generateUUID()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		deviceID = generatedID
	}

	// Generate a fallback name
	if req.Name == "" {
		if req.IsPC {
			req.Name = "电脑"
		} else {
			req.Name = "手机-" + deviceID[:4]
		}
	}

	// Check for duplicate name (skip for PC, skip for the same device)
	if !req.IsPC {
		s.devicesMu.RLock()
		if existing, ok := s.devices[deviceID]; ok && existing.Secret != "" &&
			subtle.ConstantTimeCompare([]byte(existing.Secret), []byte(req.DeviceSecret)) != 1 {
			s.devicesMu.RUnlock()
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}
		for id, d := range s.devices {
			if !d.IsPC && id != deviceID && d.Name == req.Name {
				s.devicesMu.RUnlock()
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusConflict)
				json.NewEncoder(w).Encode(map[string]string{"error": "name already exists"})
				return
			}
		}
		s.devicesMu.RUnlock()
	}

	deviceSecret := req.DeviceSecret
	s.devicesMu.Lock()
	if existing, ok := s.devices[deviceID]; ok {
		if deviceSecret == "" {
			deviceSecret = existing.Secret
		}
	}
	if deviceSecret == "" {
		generatedSecret, err := randomHex(16)
		if err != nil {
			s.devicesMu.Unlock()
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		deviceSecret = generatedSecret
	}
	s.devices[deviceID] = &Device{
		ID:       deviceID,
		Name:     req.Name,
		IsPC:     req.IsPC,
		LastSeen: time.Now(),
		Secret:   deviceSecret,
	}
	s.devicesMu.Unlock()

	json.NewEncoder(w).Encode(map[string]interface{}{
		"deviceId":     deviceID,
		"deviceSecret": deviceSecret,
		"name":         req.Name,
	})
}

func (s *FileServer) handleDeviceList(w http.ResponseWriter, r *http.Request) {
	if !isLocalhost(r) {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	s.devicesMu.RLock()
	list := make([]Device, 0, len(s.devices))
	for _, d := range s.devices {
		list = append(list, *d)
	}
	s.devicesMu.RUnlock()

	// Sort: PC first, then by name
	sort.Slice(list, func(i, j int) bool {
		if list[i].IsPC != list[j].IsPC {
			return list[i].IsPC
		}
		return list[i].Name < list[j].Name
	})

	json.NewEncoder(w).Encode(list)
}

// ─── Handlers: Info ──────────────────────────────────────────────────────

func (s *FileServer) handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	data, err := webFS.ReadFile("web/index.html")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write(data)
}

func (s *FileServer) handleInfo(w http.ResponseWriter, r *http.Request) {
	ip := getLANIP()
	_, portStr, _ := net.SplitHostPort(r.Host)
	if portStr == "" {
		portStr = "80"
	}
	json.NewEncoder(w).Encode(map[string]string{
		"ip":    ip,
		"port":  portStr,
		"token": s.token,
	})
}

// ─── Handlers: Files ─────────────────────────────────────────────────────

func (s *FileServer) handleFiles(w http.ResponseWriter, r *http.Request) {
	deviceID := r.URL.Query().Get("deviceId")
	if deviceID != "" {
		if _, ok := s.requireDeviceAccess(w, r); !ok {
			return
		}
		json.NewEncoder(w).Encode(s.filesForDevice(deviceID))
		return
	}
	if !isLocalhost(r) {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}
	// No device filter = all files (PC admin view)
	json.NewEncoder(w).Encode(s.listFiles())
}

func (s *FileServer) listFiles() []FileInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sorted := append([]FileInfo(nil), s.files...)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].ModTime.After(sorted[j].ModTime)
	})
	if sorted == nil {
		sorted = []FileInfo{} // JSON: [] not null, so clients can iterate safely
	}
	return sorted
}

// filesForDevice returns files visible to a specific device:
//   - files uploaded by this device
//   - files targeted at this device (SentTo contains this device ID)
//   - files with no specific target (SentTo is nil — broadcast)
func (s *FileServer) filesForDevice(deviceID string) []FileInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []FileInfo
	for _, f := range s.files {
		if f.UploadedBy == deviceID {
			result = append(result, f)
		} else if len(f.SentTo) == 0 {
			// Broadcast file — visible to all
			result = append(result, f)
		} else if contains(f.SentTo, deviceID) {
			result = append(result, f)
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].ModTime.After(result[j].ModTime)
	})
	if result == nil {
		result = []FileInfo{} // JSON: [] not null
	}
	return result
}

// ─── Handlers: Upload ────────────────────────────────────────────────────

func (s *FileServer) handleUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	deviceID := r.URL.Query().Get("deviceId")
	isPCUpload := false
	if deviceID == "" && isLocalhost(r) {
		deviceID = s.pcDeviceID
		isPCUpload = true
	} else if deviceID == s.pcDeviceID && isLocalhost(r) {
		isPCUpload = true
	} else {
		validDeviceID, ok := s.requireDeviceAccess(w, r)
		if !ok {
			return
		}
		deviceID = validDeviceID
	}

	r.Body = http.MaxBytesReader(w, r.Body, 200<<20)       // 200 MB limit
	if err := r.ParseMultipartForm(32 << 20); err != nil { // 32 MB buffer
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Safe filename to prevent path traversal
	name := filepath.Base(header.Filename)
	if name == "." || name == "" {
		http.Error(w, "invalid file name", http.StatusBadRequest)
		return
	}

	// Files sent from the PC are staged in a temp dir; only phone uploads
	// land in the LAN Transfer folder.
	dir := s.sessionDir
	if isPCUpload {
		dir = s.sentDir
	}
	dst, dstPath, err := createUniqueUploadFile(dir, name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	written, err := io.Copy(dst, file)
	if err != nil {
		os.Remove(dstPath)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// ─── Device identity & targeting ─────────────────────────────────
	targetsParam := r.URL.Query().Get("targets")

	s.touchDevice(deviceID)

	var sentTo []string // nil = broadcast to all
	if isPCUpload && targetsParam != "" {
		sentTo = strings.Split(targetsParam, ",")
	} else if deviceID != "" && deviceID != s.pcDeviceID {
		// Mobile upload with no explicit targets → visible to PC only
		sentTo = []string{s.pcDeviceID}
	}
	// PC upload with no targets, or no deviceId at all → sentTo stays nil (broadcast)

	fileID := fmt.Sprintf("f_%x", time.Now().UnixNano())
	info := FileInfo{
		ID:         fileID,
		Name:       filepath.Base(dstPath),
		Size:       written,
		ModTime:    time.Now(),
		UploadedBy: deviceID,
		SentTo:     sentTo,
		Path:       dstPath,
	}

	s.mu.Lock()
	s.files = append(s.files, info)
	s.mu.Unlock()

	s.broadcast(Event{Type: "file-added", Data: info, Targets: sentTo})

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"file":    info,
	})
}

// ─── Handlers: Download / Delete / Open ──────────────────────────────────

func (s *FileServer) handleDownload(w http.ResponseWriter, r *http.Request) {
	name := filepath.Base(r.URL.Path[len("/api/download/"):])
	if name == "" {
		http.Error(w, "file name required", http.StatusBadRequest)
		return
	}

	requesterID := s.pcDeviceID
	if !isLocalhost(r) {
		var ok bool
		requesterID, ok = s.requireDeviceAccess(w, r)
		if !ok {
			return
		}
	}
	info, found := s.findFileForDevice(name, requesterID)
	if !found {
		if isLocalhost(r) {
			// Legacy: localhost may still download files left on disk from a previous run
			info = FileInfo{Path: filepath.Join(s.sessionDir, name)}
		} else {
			http.Error(w, "file not found", http.StatusNotFound)
			return
		}
	}

	filePath := info.Path
	if filePath == "" {
		filePath = filepath.Join(s.sessionDir, name) // entries without a recorded path
	}
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}
	if !isLocalhost(r) && !fileVisibleToDevice(info, requesterID) {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	name = strings.NewReplacer("\r", "", "\n", "", "\x00", "", "\"", "").Replace(name)

	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, name))
	w.Header().Set("Content-Type", "application/octet-stream")
	http.ServeFile(w, r, filePath)
}

func (s *FileServer) handleDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != "DELETE" && r.Method != "POST" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !isLocalhost(r) {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	name := filepath.Base(r.URL.Path[len("/api/delete/"):])
	if name == "" || name == "." {
		http.Error(w, "file name required", http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	found := false
	var removed FileInfo
	for i, f := range s.files {
		if f.Name == name {
			removed = f
			s.files = append(s.files[:i], s.files[i+1:]...)
			found = true
			break
		}
	}
	s.mu.Unlock()

	if !found {
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}

	// Staged PC→phone files are transient (the PC keeps the original) —
	// delete them from disk. LAN Transfer folder files stay as before.
	if removed.Path != "" && filepath.Dir(removed.Path) == s.sentDir {
		os.Remove(removed.Path)
	}

	s.broadcast(Event{Type: "file-deleted", Data: map[string]string{"name": name}})

	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (s *FileServer) handleOpenSavePath(w http.ResponseWriter, r *http.Request) {
	if !isLocalhost(r) {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	savePath := filepath.Join(homeDir, "Downloads", "LAN Transfer")
	var cmd string
	switch runtime.GOOS {
	case "windows":
		cmd = "explorer"
	case "darwin":
		cmd = "open"
	default:
		cmd = "xdg-open"
	}
	exec.Command(cmd, savePath).Start()
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// ─── SSE (Server-Sent Events) ──────────────────────────────────────────────

func (s *FileServer) handleEvents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	id := fmt.Sprintf("sub_%x", time.Now().UnixNano())
	ch := make(chan Event, 20)
	deviceID := r.URL.Query().Get("deviceId")
	if deviceID == "" {
		if !isLocalhost(r) {
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}
	} else if deviceID == s.pcDeviceID {
		if !isLocalhost(r) {
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}
	} else if _, ok := s.requireDeviceAccess(w, r); !ok {
		return
	}

	s.subsMu.Lock()
	s.subs[id] = &subscriber{ch: ch, deviceID: deviceID}
	s.subsMu.Unlock()

	// Track SSE connection count per device
	if deviceID != "" && deviceID != s.pcDeviceID {
		s.sseConnsMu.Lock()
		s.sseConns[deviceID]++
		wasFirst := s.sseConns[deviceID] == 1
		s.sseConnsMu.Unlock()
		if wasFirst {
			s.broadcast(Event{
				Type:    "device-connected",
				Data:    map[string]string{"deviceId": deviceID},
				Targets: []string{s.pcDeviceID},
			})
		}
	}

	defer func() {
		s.subsMu.Lock()
		delete(s.subs, id)
		s.subsMu.Unlock()

		if deviceID != "" && deviceID != s.pcDeviceID {
			s.sseConnsMu.Lock()
			s.sseConns[deviceID]--
			remaining := s.sseConns[deviceID]
			if remaining <= 0 {
				delete(s.sseConns, deviceID)
				s.sseConnsMu.Unlock()
				s.devicesMu.Lock()
				delete(s.devices, deviceID)
				s.devicesMu.Unlock()
				s.broadcast(Event{
					Type:    "device-disconnected",
					Data:    map[string]string{"deviceId": deviceID},
					Targets: []string{s.pcDeviceID},
				})
			} else {
				s.sseConnsMu.Unlock()
			}
		}
	}()
	// Send initial "connected" event
	fmt.Fprintf(w, "event: connected\ndata: {}\n\n")
	flusher.Flush()

	for {
		select {
		case event, ok := <-ch:
			if !ok {
				return
			}
			s.bumpIdle()
			data, _ := json.Marshal(event.Data)
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event.Type, data)
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}

// Broadcast an event to subscribers.
// If event.Targets is set (non-nil):
//   - PC subscriber (deviceID == s.pcDeviceID) always receives everything
//   - Mobile subscribers only get events where their ID is in Targets
//
// If event.Targets is nil (broadcast), all subscribers receive it.
func (s *FileServer) broadcast(event Event) {
	s.subsMu.Lock()
	defer s.subsMu.Unlock()
	for id, sub := range s.subs {
		// Targeted event: PC gets everything, mobiles get only what's for them
		if len(event.Targets) > 0 && sub.deviceID != s.pcDeviceID {
			if !contains(event.Targets, sub.deviceID) {
				continue
			}
		}
		select {
		case sub.ch <- event:
		default:
			close(sub.ch)
			delete(s.subs, id)
		}
	}
}
