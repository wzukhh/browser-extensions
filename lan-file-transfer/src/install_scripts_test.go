package main

import (
	"os"
	"strings"
	"testing"
)

func TestWindowsInstallerUsesCorrectEdgeNativeMessagingRegistryPath(t *testing.T) {
	data, err := os.ReadFile("../scripts/install.bat")
	if err != nil {
		t.Fatal(err)
	}
	content := string(data)
	if !strings.Contains(content, `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.browserplugin.filetransfer`) {
		t.Fatal("install.bat does not register Edge NativeMessagingHosts under HKCU\\Software\\Microsoft\\Edge")
	}
	if strings.Contains(content, `HKCU\Microsoft\Edge\NativeMessagingHosts\com.browserplugin.filetransfer`) {
		t.Fatal("install.bat still contains the incorrect HKCU\\Microsoft\\Edge registry path")
	}
}
