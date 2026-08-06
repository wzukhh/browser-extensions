package main

import (
	"os"
	"strings"
	"testing"
)

func TestWebAppUsesPathJoinHelperForDefaultOutput(t *testing.T) {
	src, err := os.ReadFile("web/app.js")
	if err != nil {
		t.Fatal(err)
	}
	text := string(src)

	if !strings.Contains(text, "defaultOutputFolder(") {
		t.Fatal("web app should use a shared defaultOutputFolder helper")
	}
	if strings.Contains(text, "+ '/word2pdf_output'") {
		t.Fatal("web app should not append /word2pdf_output directly to Windows paths")
	}
}

func TestWebAppReportsNonStreamingConvertErrors(t *testing.T) {
	src, err := os.ReadFile("web/app.js")
	if err != nil {
		t.Fatal(err)
	}
	text := string(src)

	if !strings.Contains(text, "readErrorMessage(res)") {
		t.Fatal("convert failures should read and display the server error response")
	}
	if !strings.Contains(text, "setBadge('err'") {
		t.Fatal("convert failures should set an error badge instead of showing completed")
	}
}

func TestCOMCallsDoNotUsePanicHelpers(t *testing.T) {
	for _, path := range []string{"converter.go", "detector.go", "platform.go"} {
		src, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		text := string(src)
		for _, forbidden := range []string{"MustCallMethod", "MustGetProperty", "MustPutProperty", "MustQueryInterface"} {
			if strings.Contains(text, forbidden) {
				t.Fatalf("%s should not use %s; return errors to the UI instead", path, forbidden)
			}
		}
	}
}
