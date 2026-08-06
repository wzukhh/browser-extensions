package main

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func performRequest(handler http.HandlerFunc, method, target, remoteAddr string, body io.Reader, contentType string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, target, body)
	req.RemoteAddr = remoteAddr
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func newTestFileServer(t *testing.T, dir string) *FileServer {
	t.Helper()
	s, err := newFileServer(dir)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func registerDeviceForTest(t *testing.T, s *FileServer, name string) (string, string) {
	t.Helper()

	body := strings.NewReader(`{"name":"` + name + `","isPC":false}`)
	rec := performRequest(
		s.auth(s.handleRegisterDevice),
		http.MethodPost,
		"/api/device/register?token="+s.token,
		"192.168.1.20:4567",
		body,
		"application/json",
	)
	if rec.Code != http.StatusOK {
		t.Fatalf("register device status = %d, body = %s", rec.Code, rec.Body.String())
	}

	var resp struct {
		DeviceID     string `json:"deviceId"`
		DeviceSecret string `json:"deviceSecret"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.DeviceID == "" || resp.DeviceSecret == "" {
		t.Fatalf("expected device id and secret, got %#v", resp)
	}
	return resp.DeviceID, resp.DeviceSecret
}

func TestNewFileServerUsesLongRandomToken(t *testing.T) {
	s := newTestFileServer(t, t.TempDir())
	if len(s.token) != 32 {
		t.Fatalf("token length = %d, want 32 hex chars", len(s.token))
	}
}

func TestDeviceFilesRequireMatchingDeviceSecret(t *testing.T) {
	s := newTestFileServer(t, t.TempDir())
	deviceID, deviceSecret := registerDeviceForTest(t, s, "phone-a")

	s.mu.Lock()
	s.files = append(s.files,
		FileInfo{ID: "mine", Name: "mine.txt", UploadedBy: deviceID},
		FileInfo{ID: "other", Name: "other.txt", UploadedBy: "other-device", SentTo: []string{"other-device"}},
	)
	s.mu.Unlock()

	rec := performRequest(
		s.auth(s.handleFiles),
		http.MethodGet,
		"/api/files?token="+s.token,
		"192.168.1.20:4567",
		nil,
		"",
	)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("unscoped LAN file list status = %d, want 403", rec.Code)
	}

	rec = performRequest(
		s.auth(s.handleFiles),
		http.MethodGet,
		"/api/files?token="+s.token+"&deviceId="+deviceID+"&deviceSecret=wrong",
		"192.168.1.20:4567",
		nil,
		"",
	)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("wrong device secret status = %d, want 403", rec.Code)
	}

	rec = performRequest(
		s.auth(s.handleFiles),
		http.MethodGet,
		"/api/files?token="+s.token+"&deviceId="+deviceID+"&deviceSecret="+deviceSecret,
		"192.168.1.20:4567",
		nil,
		"",
	)
	if rec.Code != http.StatusOK {
		t.Fatalf("scoped file list status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var files []FileInfo
	if err := json.Unmarshal(rec.Body.Bytes(), &files); err != nil {
		t.Fatal(err)
	}
	if len(files) != 1 || files[0].Name != "mine.txt" {
		t.Fatalf("scoped files = %#v, want only mine.txt", files)
	}
}

func TestEmptyFileListIsEmptyArrayNotNull(t *testing.T) {
	s := newTestFileServer(t, t.TempDir())
	rec := performRequest(
		s.auth(s.handleFiles),
		http.MethodGet,
		"/api/files?token="+s.token,
		"127.0.0.1:4567",
		nil,
		"",
	)
	if rec.Code != http.StatusOK {
		t.Fatalf("files status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if strings.TrimSpace(rec.Body.String()) != "[]" {
		t.Fatalf("empty file list body = %q, want [] (not null)", rec.Body.String())
	}
}

func TestDownloadRequiresVisibleDevice(t *testing.T) {
	dir := t.TempDir()
	s := newTestFileServer(t, dir)
	deviceID, deviceSecret := registerDeviceForTest(t, s, "phone-a")
	otherID, otherSecret := registerDeviceForTest(t, s, "phone-b")

	if err := os.WriteFile(filepath.Join(dir, "visible.txt"), []byte("visible"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "hidden.txt"), []byte("hidden"), 0600); err != nil {
		t.Fatal(err)
	}
	s.mu.Lock()
	s.files = append(s.files,
		FileInfo{ID: "visible", Name: "visible.txt", UploadedBy: "pc", SentTo: []string{deviceID}, Path: filepath.Join(dir, "visible.txt")},
		FileInfo{ID: "hidden", Name: "hidden.txt", UploadedBy: "pc", SentTo: []string{deviceID}, Path: filepath.Join(dir, "hidden.txt")},
	)
	s.mu.Unlock()

	rec := performRequest(
		s.auth(s.handleDownload),
		http.MethodGet,
		"/api/download/visible.txt?token="+s.token+"&deviceId="+deviceID+"&deviceSecret="+deviceSecret,
		"192.168.1.20:4567",
		nil,
		"",
	)
	if rec.Code != http.StatusOK {
		t.Fatalf("visible download status = %d, body = %s", rec.Code, rec.Body.String())
	}

	rec = performRequest(
		s.auth(s.handleDownload),
		http.MethodGet,
		"/api/download/hidden.txt?token="+s.token+"&deviceId="+otherID+"&deviceSecret="+otherSecret,
		"192.168.1.21:4567",
		nil,
		"",
	)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("hidden download status = %d, want 403", rec.Code)
	}
}

func TestOpenSavePathRequiresLocalhost(t *testing.T) {
	s := newTestFileServer(t, t.TempDir())
	rec := performRequest(
		s.auth(s.handleOpenSavePath),
		http.MethodPost,
		"/api/open-save-path?token="+s.token,
		"192.168.1.20:4567",
		nil,
		"",
	)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("open save path from LAN status = %d, want 403", rec.Code)
	}
}

func TestUploadChoosesUniqueDestination(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "same.txt"), []byte("old"), 0600); err != nil {
		t.Fatal(err)
	}

	dst, path, err := createUniqueUploadFile(dir, "same.txt")
	if err != nil {
		t.Fatal(err)
	}
	defer dst.Close()

	if filepath.Base(path) != "same(1).txt" {
		t.Fatalf("path = %s, want same(1).txt", filepath.Base(path))
	}
}

// uploadBytes uploads the given content from a simulated device and returns
// the file info as recorded in the server's in-memory list (Path is not
// serialized to clients).
func uploadBytes(t *testing.T, s *FileServer, remoteAddr, query string, fileName, content string) FileInfo {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", fileName)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write([]byte(content)); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	rec := performRequest(
		s.auth(s.handleUpload),
		http.MethodPost,
		"/api/upload?token="+s.token+query,
		remoteAddr,
		&body,
		writer.FormDataContentType(),
	)
	if rec.Code != http.StatusOK {
		t.Fatalf("upload status = %d, body = %s", rec.Code, rec.Body.String())
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	if len(s.files) != 1 {
		t.Fatalf("files len = %d, want 1", len(s.files))
	}
	return s.files[len(s.files)-1]
}

func TestPCUploadStagedOutsideSessionDir(t *testing.T) {
	dir := t.TempDir()
	s := newTestFileServer(t, dir)
	deviceID, deviceSecret := registerDeviceForTest(t, s, "phone-a")

	// PC sends a file to the phone
	info := uploadBytes(t, s, "127.0.0.1:4567",
		"&deviceId="+s.pcDeviceID+"&targets="+deviceID,
		"from-pc.txt", "from pc")

	// The file must NOT be saved into the LAN Transfer folder
	if _, err := os.Stat(filepath.Join(dir, "from-pc.txt")); !os.IsNotExist(err) {
		t.Fatalf("PC-sent file unexpectedly saved into session dir")
	}
	if filepath.Dir(info.Path) != s.sentDir {
		t.Fatalf("PC upload path = %q, want staging dir %q", info.Path, s.sentDir)
	}
	if _, err := os.Stat(info.Path); err != nil {
		t.Fatalf("staged file missing: %v", err)
	}

	// The phone can still download it
	rec := performRequest(
		s.auth(s.handleDownload),
		http.MethodGet,
		"/api/download/from-pc.txt?token="+s.token+"&deviceId="+deviceID+"&deviceSecret="+deviceSecret,
		"192.168.1.20:4567",
		nil,
		"",
	)
	if rec.Code != http.StatusOK {
		t.Fatalf("phone download of PC-sent file status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if rec.Body.String() != "from pc" {
		t.Fatalf("downloaded content = %q, want %q", rec.Body.String(), "from pc")
	}

	// Deleting the entry also removes the staged file from disk
	rec = performRequest(
		s.auth(s.handleDelete),
		http.MethodDelete,
		"/api/delete/from-pc.txt?token="+s.token,
		"127.0.0.1:4567",
		nil,
		"",
	)
	if rec.Code != http.StatusOK {
		t.Fatalf("delete status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(info.Path); !os.IsNotExist(err) {
		t.Fatalf("staged file still on disk after delete")
	}
}

func TestPhoneUploadSavedToSessionDir(t *testing.T) {
	dir := t.TempDir()
	s := newTestFileServer(t, dir)
	deviceID, deviceSecret := registerDeviceForTest(t, s, "phone-a")

	info := uploadBytes(t, s, "192.168.1.20:4567",
		"&deviceId="+deviceID+"&deviceSecret="+deviceSecret,
		"from-phone.txt", "from phone")

	if filepath.Dir(info.Path) != dir {
		t.Fatalf("phone upload path = %q, want session dir %q", info.Path, dir)
	}
	if _, err := os.Stat(filepath.Join(dir, "from-phone.txt")); err != nil {
		t.Fatalf("phone upload missing from session dir: %v", err)
	}
}

func TestSweepStaleSentDirs(t *testing.T) {
	root := t.TempDir()

	stale := filepath.Join(root, "lan-transfer-sent-old")
	if err := os.MkdirAll(stale, 0700); err != nil {
		t.Fatal(err)
	}
	old := time.Now().Add(-48 * time.Hour)
	if err := os.Chtimes(stale, old, old); err != nil {
		t.Fatal(err)
	}

	fresh := filepath.Join(root, "lan-transfer-sent-new")
	if err := os.MkdirAll(fresh, 0700); err != nil {
		t.Fatal(err)
	}
	unrelated := filepath.Join(root, "other-dir")
	if err := os.MkdirAll(unrelated, 0700); err != nil {
		t.Fatal(err)
	}

	sweepStaleSentDirs(root, 24*time.Hour)

	if _, err := os.Stat(stale); !os.IsNotExist(err) {
		t.Fatalf("stale dir not swept")
	}
	if _, err := os.Stat(fresh); err != nil {
		t.Fatalf("fresh dir wrongly removed: %v", err)
	}
	if _, err := os.Stat(unrelated); err != nil {
		t.Fatalf("unrelated dir removed: %v", err)
	}
}

func TestMobileUploadCannotTargetOtherDevices(t *testing.T) {
	s := newTestFileServer(t, t.TempDir())
	deviceID, deviceSecret := registerDeviceForTest(t, s, "phone-a")
	otherID, _ := registerDeviceForTest(t, s, "phone-b")

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "note.txt")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write([]byte("hello")); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	rec := performRequest(
		s.auth(s.handleUpload),
		http.MethodPost,
		"/api/upload?token="+s.token+"&deviceId="+deviceID+"&deviceSecret="+deviceSecret+"&targets="+otherID,
		"192.168.1.20:4567",
		&body,
		writer.FormDataContentType(),
	)
	if rec.Code != http.StatusOK {
		t.Fatalf("upload status = %d, body = %s", rec.Code, rec.Body.String())
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	if len(s.files) != 1 {
		t.Fatalf("files len = %d, want 1", len(s.files))
	}
	if len(s.files[0].SentTo) != 1 || s.files[0].SentTo[0] != s.pcDeviceID {
		t.Fatalf("mobile upload targets = %#v, want only pc", s.files[0].SentTo)
	}
}
